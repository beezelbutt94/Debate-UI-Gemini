"""Deployments, Sentry incident correlation, automated reverts and canary gates."""

import hashlib
import hmac
import logging
from datetime import timedelta
from typing import Any

import httpx
from sqlalchemy import func, or_, select

from app import approvals, db, dispatcher, events
from app.config import settings
from app.models import CanaryEvaluation, DeploymentRecord, IncidentRecord, as_utc, iso, utcnow

logger = logging.getLogger("polsia.sre")
AGENT = "SRESentinel"


class SignatureError(ValueError):
    pass


def verify_sentry_signature(payload: bytes, signature: str | None, secret: str) -> None:
    if not signature:
        raise SignatureError("Missing Sentry-Hook-Signature header")
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise SignatureError("Sentry signature mismatch")


# --- Deployments -------------------------------------------------------------


def register_deployment(
    repo: str,
    commit_sha: str,
    environment: str = "production",
    pr_number: int | None = None,
    pr_title: str | None = None,
    files_changed: list[str] | None = None,
) -> dict[str, Any]:
    with db.session_scope() as session:
        record = DeploymentRecord(
            repo=repo, commit_sha=commit_sha, environment=environment, pr_number=pr_number, pr_title=pr_title, files_changed=files_changed or []
        )
        session.add(record)
        session.flush()
        out = {"id": record.id, "repo": repo, "commit_sha": commit_sha, "environment": environment}
    events.publish("DEPLOYMENT_REGISTERED", deployment=out)
    return out


# --- Incidents -----------------------------------------------------------------


def _tag(tags: Any, key: str) -> str | None:
    if isinstance(tags, list):
        for t in tags:
            if isinstance(t, (list, tuple)) and len(t) == 2 and t[0] == key:
                return str(t[1])
            if isinstance(t, dict) and t.get("key") == key:
                return str(t.get("value"))
    return None


def parse_sentry_payload(resource: str | None, body: dict[str, Any]) -> dict[str, Any] | None:
    data = body.get("data") or {}
    if resource == "issue" and body.get("action") not in ("created", "unresolved"):
        return None
    item = data.get("event") or data.get("issue")
    if not item:
        return None
    return {
        "title": item.get("title") or "Sentry alert",
        "culprit": item.get("culprit"),
        "environment": item.get("environment") or _tag(item.get("tags"), "environment"),
        "release": item.get("release") or _tag(item.get("tags"), "release"),
    }


def _correlate(session, release: str | None, environment: str | None) -> DeploymentRecord | None:
    if release:
        match = session.scalar(
            select(DeploymentRecord)
            .where(or_(DeploymentRecord.commit_sha == release, DeploymentRecord.commit_sha.startswith(release[:12])))
            .order_by(DeploymentRecord.deployed_at.desc())
        )
        if match:
            return match
    since = utcnow() - timedelta(minutes=settings.INCIDENT_CORRELATION_WINDOW_MINUTES)
    stmt = select(DeploymentRecord).where(DeploymentRecord.deployed_at >= since)
    if environment:
        stmt = stmt.where(DeploymentRecord.environment == environment)
    return session.scalar(stmt.order_by(DeploymentRecord.deployed_at.desc()))


def handle_incident(source: str, title: str, culprit: str | None = None, environment: str | None = None, release: str | None = None) -> dict[str, Any]:
    with db.session_scope() as session:
        deployment = _correlate(session, release, environment)
        incident = IncidentRecord(source=source, title=title, culprit=culprit, environment=environment)
        session.add(incident)
        if deployment:
            incident.deployment_id = deployment.id
            incident.commit_sha = deployment.commit_sha
            # One revert per bad deploy, however many alerts it fires.
            already = session.scalar(
                select(IncidentRecord.id).where(
                    IncidentRecord.deployment_id == deployment.id,
                    IncidentRecord.status.in_(("REVERT_PENDING_APPROVAL", "REVERT_OPENED")),
                )
            )
            if already:
                incident.status = "DUPLICATE"
        session.flush()
        incident_id, status = incident.id, incident.status
        dep = {"repo": deployment.repo, "commit_sha": deployment.commit_sha, "pr_number": deployment.pr_number} if deployment else None

    if dep and status != "DUPLICATE":
        pr_ref = f" (PR #{dep['pr_number']})" if dep["pr_number"] else ""
        payload = {"repo": dep["repo"], "commit_sha": dep["commit_sha"], "reason": f"Incident {incident_id[:8]}: {title[:120]}{pr_ref}"}
        if settings.AUTO_REVERT:
            try:
                result = dispatcher.dispatch("REVERT_COMMIT", payload)
                status, update = "REVERT_OPENED", {"revert_pr_url": result.get("pr_url")}
            except Exception as exc:
                logger.exception("Automatic revert failed")
                status, update = "REVERT_FAILED", {}
                result = {"error": str(exc)}
        else:
            approval_id = approvals.request(AGENT, "REVERT_COMMIT", payload, reason=f"Error spike after deploy of {dep['commit_sha'][:10]}")
            status, update = "REVERT_PENDING_APPROVAL", {"approval_id": approval_id}
        with db.session_scope() as session:
            incident = session.get(IncidentRecord, incident_id)
            incident.status = status
            for key, value in update.items():
                setattr(incident, key, value)

    out = get_incident(incident_id)
    events.publish("INCIDENT", incident=out)
    return out


def _serialize_incident(i: IncidentRecord) -> dict[str, Any]:
    return {
        "id": i.id,
        "source": i.source,
        "title": i.title,
        "culprit": i.culprit,
        "environment": i.environment,
        "commit_sha": i.commit_sha,
        "status": i.status,
        "approval_id": i.approval_id,
        "revert_pr_url": i.revert_pr_url,
        "created_at": iso(i.created_at),
    }


def get_incident(incident_id: str) -> dict[str, Any]:
    with db.session_scope() as session:
        return _serialize_incident(session.get(IncidentRecord, incident_id))


def recent_incidents(limit: int = 20) -> list[dict[str, Any]]:
    with db.session_scope() as session:
        return [_serialize_incident(i) for i in session.scalars(select(IncidentRecord).order_by(IncidentRecord.created_at.desc()).limit(limit))]


# --- Canary gate -------------------------------------------------------------------


def start_canary(repo: str, commit_sha: str, environment: str = "staging", duration_minutes: int = 15, max_allowed_errors: int = 0) -> dict[str, Any]:
    now = utcnow()
    with db.session_scope() as session:
        canary = CanaryEvaluation(
            repo=repo,
            commit_sha=commit_sha,
            environment=environment,
            duration_minutes=duration_minutes,
            max_allowed_errors=max_allowed_errors,
            started_at=now,
            expires_at=now + timedelta(minutes=duration_minutes),
        )
        session.add(canary)
        session.flush()
        out = _serialize_canary(canary)
    events.publish("CANARY_STARTED", canary=out)
    return out


def _sentry_error_count(commit_sha: str, environment: str, start, end) -> int | None:
    if not (settings.SENTRY_AUTH_TOKEN and settings.SENTRY_ORG):
        return None
    params = {
        "field": "count()",
        "query": f"release:{commit_sha} environment:{environment} event.type:error",
        "start": start.isoformat(),
        "end": end.isoformat(),
    }
    if settings.SENTRY_PROJECT:
        params["project"] = settings.SENTRY_PROJECT
    try:
        resp = httpx.get(
            f"https://sentry.io/api/0/organizations/{settings.SENTRY_ORG}/events/",
            params=params,
            headers={"Authorization": f"Bearer {settings.SENTRY_AUTH_TOKEN}"},
            timeout=15,
        )
        resp.raise_for_status()
        rows = resp.json().get("data") or [{}]
        return int(rows[0].get("count()", 0))
    except Exception:
        logger.exception("Sentry query failed; falling back to recorded incidents")
        return None


def evaluate_canary(canary_id: str) -> dict[str, Any]:
    now = utcnow()
    with db.session_scope() as session:
        canary = session.get(CanaryEvaluation, canary_id)
        if canary is None:
            raise LookupError(canary_id)
        if canary.status != "MONITORING":
            return _serialize_canary(canary)
        started, expires = as_utc(canary.started_at), as_utc(canary.expires_at)
        errors = _sentry_error_count(canary.commit_sha, canary.environment, started, min(now, expires))
        if errors is None:
            errors = (
                session.scalar(
                    select(func.count(IncidentRecord.id)).where(
                        IncidentRecord.commit_sha == canary.commit_sha,
                        IncidentRecord.created_at >= started,
                        or_(IncidentRecord.environment == canary.environment, IncidentRecord.environment.is_(None)),
                    )
                )
                or 0
            )
        canary.observed_errors = int(errors)
        if canary.observed_errors > canary.max_allowed_errors:
            # Fail fast: no reason to keep soaking a build that already broke the budget.
            canary.status = "FAILED"
            canary.failure_reason = f"{canary.observed_errors} errors observed (allowed {canary.max_allowed_errors})"
            canary.resolved_at = now
        elif now >= expires:
            canary.status = "PASSED"
            canary.resolved_at = now
        out = _serialize_canary(canary)
    if out["status"] != "MONITORING":
        events.publish("CANARY_RESOLVED", canary=out)
    return out


def sweep_canaries() -> list[dict[str, Any]]:
    with db.session_scope() as session:
        ids = list(session.scalars(select(CanaryEvaluation.id).where(CanaryEvaluation.status == "MONITORING")))
    return [evaluate_canary(i) for i in ids]


def get_canary(canary_id: str) -> dict[str, Any]:
    with db.session_scope() as session:
        canary = session.get(CanaryEvaluation, canary_id)
        if canary is None:
            raise LookupError(canary_id)
        return _serialize_canary(canary)


def _serialize_canary(c: CanaryEvaluation) -> dict[str, Any]:
    return {
        "id": c.id,
        "repo": c.repo,
        "commit_sha": c.commit_sha,
        "environment": c.environment,
        "status": c.status,
        "observed_errors": c.observed_errors,
        "max_allowed_errors": c.max_allowed_errors,
        "failure_reason": c.failure_reason,
        "started_at": iso(c.started_at),
        "expires_at": iso(c.expires_at),
        "resolved_at": iso(c.resolved_at),
    }
