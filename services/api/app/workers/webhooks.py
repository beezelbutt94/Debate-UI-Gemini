"""HMAC-SHA256 signed outbound webhook delivery, shared by the video
pipeline and the integrations router's manual "test delivery" endpoint.
"""
import hashlib
import hmac
import json
import time

import requests
from sqlalchemy.orm import Session

from app.core.models import WebhookSubscription

RETRY_SCHEDULE_SECONDS = [1, 2, 4, 8, 16]


def generate_signature(secret: str, payload_bytes: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()


def dispatch_webhooks(db: Session, user_id: str, event: str, data: dict) -> None:
    """Fires `event` to every active subscription the user has for it.

    Best-effort, single attempt per subscription -- callers running inside a
    Celery task should prefer `dispatch_webhook_task.delay(...)`, which
    retries with the schedule above.
    """
    subs = (
        db.query(WebhookSubscription)
        .filter(WebhookSubscription.user_id == user_id, WebhookSubscription.is_active.is_(True))
        .all()
    )

    payload = {"event": event, "timestamp": int(time.time()), "data": data}
    encoded = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    for sub in subs:
        if "*" not in sub.subscribed_events and event not in sub.subscribed_events:
            continue

        signature = generate_signature(sub.secret_key, encoded)
        headers = {
            "Content-Type": "application/json",
            "X-ViralVision-Event": event,
            "X-Signature-256": signature,
        }
        try:
            requests.post(sub.target_url, data=encoded, headers=headers, timeout=5)
        except requests.RequestException:
            pass


def deliver_with_retries(target_url: str, secret: str, event: str, data: dict) -> bool:
    """Synchronous delivery with the platform's standard backoff schedule.

    Intended to run inside a Celery task (`dispatch_webhook_task`), never on
    the request thread.
    """
    payload = {"event": event, "timestamp": int(time.time()), "data": data}
    encoded = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "X-ViralVision-Event": event,
        "X-Signature-256": generate_signature(secret, encoded),
    }

    for attempt, delay in enumerate(RETRY_SCHEDULE_SECONDS):
        try:
            response = requests.post(target_url, data=encoded, headers=headers, timeout=5)
            if 200 <= response.status_code < 300:
                return True
        except requests.RequestException:
            pass

        if attempt < len(RETRY_SCHEDULE_SECONDS) - 1:
            time.sleep(delay)

    return False
