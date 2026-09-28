"""SendGrid event webhook: mark bounced prospects and trip the campaign circuit breaker."""

import base64
from datetime import timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app import db, events
from app.config import settings
from app.models import CampaignState, EmailEvent, OutboundEmail, Prospect, utcnow

HARD_FAIL = {"bounce", "dropped"}
OPT_OUT = {"unsubscribe", "group_unsubscribe", "spamreport"}


class SignatureError(ValueError):
    pass


def verify_signature(payload: bytes, signature_b64: str | None, timestamp: str | None, public_key_b64: str) -> None:
    """SendGrid Signed Event Webhook: ECDSA P-256/SHA-256 over `timestamp + body`."""
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.serialization import load_der_public_key

    if not signature_b64 or not timestamp:
        raise SignatureError("Missing SendGrid signature headers")
    key = load_der_public_key(base64.b64decode(public_key_b64))
    try:
        key.verify(base64.b64decode(signature_b64), timestamp.encode() + payload, ec.ECDSA(hashes.SHA256()))
    except (InvalidSignature, ValueError) as exc:
        raise SignatureError("SendGrid signature mismatch") from exc


def _match_email(session, sg_message_id: str | None) -> OutboundEmail | None:
    # sg_message_id is "<X-Message-Id>.filter....": match on the prefix we stored.
    if not sg_message_id:
        return None
    return session.scalar(select(OutboundEmail).where(OutboundEmail.message_id == sg_message_id.split(".")[0]))


def process_events(batch: list[dict[str, Any]]) -> dict[str, Any]:
    touched: set[str] = set()
    processed = 0
    for item in batch:
        kind = item.get("event")
        address = str(item.get("email", "")).strip().lower()
        event_id = item.get("sg_event_id")
        if not kind or not address or not event_id:
            continue
        try:
            with db.session_scope() as session:
                session.add(EmailEvent(sg_event_id=event_id, event=kind, email=address, reason=item.get("reason")))
                session.flush()
                outbound = _match_email(session, item.get("sg_message_id"))
                prospect = session.scalar(select(Prospect).where(Prospect.email == address))
                if kind in HARD_FAIL:
                    if outbound:
                        outbound.status = "BOUNCED" if kind == "bounce" else "DROPPED"
                    if prospect:
                        prospect.status = "BOUNCED"
                elif kind in OPT_OUT and prospect:
                    prospect.status = "UNSUBSCRIBED"
                elif kind == "delivered" and outbound:
                    outbound.status = "DELIVERED"
                campaign = item.get("campaign") or (outbound.campaign if outbound else None)
        except IntegrityError:
            continue  # SendGrid retries deliver the same sg_event_id again
        processed += 1
        if campaign and kind in HARD_FAIL:
            touched.add(campaign)

    tripped = [c for c in sorted(touched) if evaluate_campaign(c)["paused"]]
    return {"processed": processed, "paused_campaigns": tripped}


def campaign_health(campaign: str) -> dict[str, Any]:
    since = utcnow() - timedelta(days=settings.BOUNCE_WINDOW_DAYS)
    with db.session_scope() as session:
        sent = session.scalar(select(func.count(OutboundEmail.id)).where(OutboundEmail.campaign == campaign, OutboundEmail.sent_at >= since))
        failed = session.scalar(
            select(func.count(OutboundEmail.id)).where(
                OutboundEmail.campaign == campaign,
                OutboundEmail.sent_at >= since,
                OutboundEmail.status.in_(("BOUNCED", "DROPPED")),
            )
        )
        state = session.get(CampaignState, campaign)
        paused = bool(state and state.paused)
        reason = state.pause_reason if state else None
    sent, failed = int(sent or 0), int(failed or 0)
    return {
        "campaign": campaign,
        "sent": sent,
        "bounced": failed,
        "bounce_rate": failed / sent if sent else 0.0,
        "threshold": settings.BOUNCE_RATE_THRESHOLD,
        "min_sample": settings.BOUNCE_MIN_SAMPLE,
        "paused": paused,
        "pause_reason": reason,
    }


def evaluate_campaign(campaign: str) -> dict[str, Any]:
    health = campaign_health(campaign)
    if health["paused"] or health["sent"] < settings.BOUNCE_MIN_SAMPLE or health["bounce_rate"] <= settings.BOUNCE_RATE_THRESHOLD:
        return health
    reason = f"Bounce rate {health['bounce_rate']:.1%} over {health['sent']} sends exceeds {settings.BOUNCE_RATE_THRESHOLD:.0%}"
    with db.session_scope() as session:
        state = session.get(CampaignState, campaign) or CampaignState(campaign=campaign)
        state.paused, state.pause_reason, state.paused_at = True, reason, utcnow()
        session.merge(state)
    events.publish("DELIVERABILITY_ALERT", campaign=campaign, reason=reason, bounce_rate=health["bounce_rate"])
    return {**health, "paused": True, "pause_reason": reason}


def resume_campaign(campaign: str) -> dict[str, Any]:
    with db.session_scope() as session:
        state = session.get(CampaignState, campaign)
        if state:
            state.paused, state.pause_reason, state.paused_at = False, None, None
    events.publish("DELIVERABILITY_RESUMED", campaign=campaign)
    return campaign_health(campaign)


def overview() -> list[dict[str, Any]]:
    with db.session_scope() as session:
        campaigns = {c for (c,) in session.execute(select(OutboundEmail.campaign).distinct())}
        campaigns |= {c for (c,) in session.execute(select(CampaignState.campaign))}
    return [campaign_health(c) for c in sorted(campaigns)]
