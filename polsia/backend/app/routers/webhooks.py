"""Inbound webhooks. Each verifies its provider's signature over the raw body first."""

import json
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app import deliverability, finance, sales, sre
from app.config import settings
from app.security import webhook_secret
from app.tasks import handle_incident, process_calcom_event

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _json(body: bytes) -> Any:
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(400, "Body is not valid JSON") from None


@router.post("/stripe")
async def stripe_webhook(request: Request) -> dict[str, Any]:
    body = await request.body()
    secret = webhook_secret("STRIPE_WEBHOOK_SECRET", settings.STRIPE_WEBHOOK_SECRET)
    if secret:
        try:
            finance.verify_stripe_signature(body, request.headers.get("stripe-signature"), secret)
        except finance.SignatureError as exc:
            raise HTTPException(400, str(exc)) from None
    event = _json(body)
    if not isinstance(event, dict) or "id" not in event:
        raise HTTPException(400, "Not a Stripe event")
    return {"received": True, "new": finance.record_event(event)}


@router.post("/calcom")
async def calcom_webhook(request: Request) -> dict[str, Any]:
    body = await request.body()
    secret = webhook_secret("CALCOM_WEBHOOK_SECRET", settings.CALCOM_WEBHOOK_SECRET)
    if secret:
        try:
            sales.verify_calcom_signature(body, request.headers.get("x-cal-signature-256"), secret)
        except sales.SignatureError as exc:
            raise HTTPException(401, str(exc)) from None
    data = _json(body)
    trigger = data.get("triggerEvent")
    if trigger not in ("BOOKING_CREATED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"):
        return {"status": "ignored", "trigger": trigger}
    # Acknowledge fast; Cal.com retries on slow responses.
    process_calcom_event.delay(trigger, data.get("payload") or {})
    return {"status": "accepted", "trigger": trigger}


@router.post("/sendgrid")
async def sendgrid_webhook(request: Request) -> dict[str, Any]:
    body = await request.body()
    key = webhook_secret("SENDGRID_WEBHOOK_PUBLIC_KEY", settings.SENDGRID_WEBHOOK_PUBLIC_KEY)
    if key:
        try:
            deliverability.verify_signature(
                body,
                request.headers.get("x-twilio-email-event-webhook-signature"),
                request.headers.get("x-twilio-email-event-webhook-timestamp"),
                key,
            )
        except deliverability.SignatureError as exc:
            raise HTTPException(403, str(exc)) from None
    batch = _json(body)
    if not isinstance(batch, list):
        raise HTTPException(400, "Expected a JSON array of events")
    return deliverability.process_events(batch)


@router.post("/sentry")
async def sentry_webhook(request: Request) -> dict[str, Any]:
    body = await request.body()
    secret = webhook_secret("SENTRY_CLIENT_SECRET", settings.SENTRY_CLIENT_SECRET)
    if secret:
        try:
            sre.verify_sentry_signature(body, request.headers.get("sentry-hook-signature"), secret)
        except sre.SignatureError as exc:
            raise HTTPException(401, str(exc)) from None
    parsed = sre.parse_sentry_payload(request.headers.get("sentry-hook-resource"), _json(body))
    if parsed is None:
        return {"status": "ignored"}
    handle_incident.delay("sentry", parsed["title"], parsed["culprit"], parsed["environment"], parsed["release"])
    return {"status": "accepted"}
