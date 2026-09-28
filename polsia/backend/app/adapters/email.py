"""SendGrid outbound email, gated by the deliverability circuit breaker."""

import uuid
from typing import Any

import httpx
from sqlalchemy import select

from app import db
from app.config import settings
from app.models import CampaignState, OutboundEmail, Prospect


class CampaignPausedError(RuntimeError):
    pass


def is_paused(campaign: str) -> str | None:
    with db.session_scope() as session:
        state = session.get(CampaignState, campaign)
        return state.pause_reason or "paused" if state and state.paused else None


def send_email(to_email: str, subject: str, body: str, campaign: str = "default") -> dict[str, Any]:
    reason = is_paused(campaign)
    if reason:
        raise CampaignPausedError(f"Campaign '{campaign}' is paused: {reason}")

    to_email = to_email.strip().lower()
    with db.session_scope() as session:
        prospect = session.scalar(select(Prospect).where(Prospect.email == to_email))
        if prospect and prospect.status in ("BOUNCED", "UNSUBSCRIBED"):
            return {"status": "skipped", "reason": f"prospect is {prospect.status}", "to": to_email}

    if settings.SANDBOX_MODE:
        message_id = f"sandbox-{uuid.uuid4().hex[:12]}"
        status = "simulated"
    else:
        if not settings.SENDGRID_API_KEY:
            raise RuntimeError("SENDGRID_API_KEY is required when SANDBOX_MODE is off")
        resp = httpx.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={"Authorization": f"Bearer {settings.SENDGRID_API_KEY}"},
            json={
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": settings.OUTREACH_FROM_EMAIL, "name": settings.OUTREACH_FROM_NAME},
                "subject": subject,
                "content": [{"type": "text/plain", "value": body}],
                "custom_args": {"campaign": campaign},
            },
            timeout=15,
        )
        resp.raise_for_status()
        message_id = resp.headers.get("X-Message-Id", "")
        status = "sent"

    with db.session_scope() as session:
        prospect = session.scalar(select(Prospect).where(Prospect.email == to_email))
        if prospect is None:
            prospect = Prospect(email=to_email)
            session.add(prospect)
            session.flush()
        if prospect.status == "NEW":
            prospect.status = "CONTACTED"
        session.add(OutboundEmail(prospect_id=prospect.id, campaign=campaign, subject=subject, body=body, message_id=message_id))
    return {"status": status, "message_id": message_id, "to": to_email, "campaign": campaign}
