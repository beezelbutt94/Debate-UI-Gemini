import hashlib
import hmac
import json
from datetime import timedelta

from app import db, sre
from app.models import CanaryEvaluation, IncidentRecord, utcnow

SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"
CI = {"x-deployment-secret": "deploy-secret"}


def _sentry_event(title="TypeError: cart is undefined", release=SHA, environment="production") -> dict:
    return {"action": "triggered", "data": {"event": {"title": title, "culprit": "app/checkout.ts", "release": release, "environment": environment}}}


def test_deployment_registration_requires_the_secret(client, configure):
    body = {"repo": "acme/app", "commit_sha": SHA, "pr_number": 42}
    assert client.post("/deployments", json=body).status_code == 503  # unconfigured -> refuse
    configure(DEPLOYMENT_SECRET="deploy-secret")
    assert client.post("/deployments", json=body, headers={"x-deployment-secret": "nope"}).status_code == 403
    assert client.post("/deployments", json=body, headers=CI).status_code == 201


def test_sentry_spike_after_deploy_files_a_revert_for_approval(client, configure):
    configure(DEPLOYMENT_SECRET="deploy-secret", SENTRY_CLIENT_SECRET="sentry-secret")
    client.post("/deployments", json={"repo": "acme/app", "commit_sha": SHA, "pr_number": 42}, headers=CI)

    body = json.dumps(_sentry_event()).encode()
    sig = hmac.new(b"sentry-secret", body, hashlib.sha256).hexdigest()
    assert client.post("/webhooks/sentry", content=body, headers={"sentry-hook-signature": "bad"}).status_code == 401
    ok = client.post("/webhooks/sentry", content=body, headers={"sentry-hook-signature": sig, "sentry-hook-resource": "event_alert"})
    assert ok.json() == {"status": "accepted"}

    incident = client.get("/incidents").json()[0]
    assert incident["status"] == "REVERT_PENDING_APPROVAL"
    assert incident["commit_sha"] == SHA
    approval = client.get("/approvals/pending").json()[0]
    assert approval["action_type"] == "REVERT_COMMIT" and "PR #42" in approval["payload"]["reason"]

    # A second alert for the same bad deploy doesn't open a second revert.
    client.post("/webhooks/sentry", content=body, headers={"sentry-hook-signature": sig})
    assert [i["status"] for i in client.get("/incidents").json()] == ["DUPLICATE", "REVERT_PENDING_APPROVAL"]
    assert len(client.get("/approvals/pending").json()) == 1

    client.post(f"/approvals/{approval['id']}/resolve", json={"decision": "APPROVE"})
    reverted = next(i for i in client.get("/incidents").json() if i["id"] == incident["id"])
    assert reverted["status"] == "REVERT_OPENED" and reverted["revert_pr_url"]


def test_auto_revert_and_time_window_correlation(configure):
    configure(AUTO_REVERT=True)
    sre.register_deployment("acme/app", SHA)
    # No release tag: falls back to the most recent deploy inside the window.
    incident = sre.handle_incident("sentry", "Checkout 500s", environment="production", release=None)
    assert incident["status"] == "REVERT_OPENED" and incident["commit_sha"] == SHA


def test_incident_without_a_recent_deploy_is_uncorrelated():
    assert sre.handle_incident("sentry", "Background job timeout")["status"] == "UNCORRELATED"


def test_canary_gate_fails_fast_and_passes_after_soak(client, configure):
    configure(DEPLOYMENT_SECRET="deploy-secret")
    bad = client.post("/canary", json={"repo": "acme/app", "commit_sha": SHA, "duration_minutes": 15}, headers=CI).json()
    good = client.post("/canary", json={"repo": "acme/app", "commit_sha": "f" * 40, "duration_minutes": 15}, headers=CI).json()
    assert bad["status"] == good["status"] == "MONITORING"

    with db.session_scope() as s:
        s.add(IncidentRecord(source="sentry", title="boom", commit_sha=SHA, environment="staging"))
    assert sre.evaluate_canary(bad["id"])["status"] == "FAILED"
    assert sre.evaluate_canary(good["id"])["status"] == "MONITORING"

    with db.session_scope() as s:
        s.get(CanaryEvaluation, good["id"]).expires_at = utcnow() - timedelta(seconds=1)
    sre.sweep_canaries()
    assert client.get(f"/canary/{good['id']}", headers=CI).json()["status"] == "PASSED"


def test_ignored_sentry_resources():
    assert sre.parse_sentry_payload("issue", {"action": "resolved", "data": {"issue": {"title": "x"}}}) is None
    parsed = sre.parse_sentry_payload("event_alert", {"data": {"event": {"title": "x", "tags": [["environment", "prod"], ["release", "abc1234"]]}}})
    assert parsed["environment"] == "prod" and parsed["release"] == "abc1234"
