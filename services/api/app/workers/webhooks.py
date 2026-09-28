"""HMAC-SHA256 signed outbound webhook delivery, shared by the video
pipeline and the integrations router's manual "test delivery" endpoint.
"""
import hashlib
import hmac
import ipaddress
import json
import logging
import socket
import time
from urllib.parse import urlsplit

import requests
from sqlalchemy.orm import Session

from app.core.models import WebhookSubscription

logger = logging.getLogger(__name__)

RETRY_SCHEDULE_SECONDS = [1, 2, 4, 8, 16]


class UnsafeWebhookTarget(ValueError):
    """A subscription URL that must never be requested from this server."""


def assert_safe_webhook_url(target_url: str) -> None:
    """Rejects webhook targets that point back inside our own network.

    Subscription URLs are supplied by users, and this process reaches
    places the public internet cannot: the cloud metadata endpoint
    (169.254.169.254, which hands out instance credentials), the Postgres
    and Redis hosts, the Kubernetes API, other internal services. Posting a
    signed payload to one of those turns our own webhook sender into a
    proxy for scanning and exfiltrating the private network.

    Resolution happens here rather than trusting the hostname: a name the
    attacker controls can simply have an A record of 127.0.0.1.
    """
    parts = urlsplit(target_url)

    if parts.scheme not in ("http", "https"):
        raise UnsafeWebhookTarget(f"unsupported scheme {parts.scheme!r}; use http or https")
    if not parts.hostname:
        raise UnsafeWebhookTarget("no hostname in webhook URL")

    try:
        resolved = socket.getaddrinfo(parts.hostname, parts.port or (443 if parts.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise UnsafeWebhookTarget(f"could not resolve {parts.hostname!r}: {exc}") from exc

    for family, _type, _proto, _canon, sockaddr in resolved:
        ip = ipaddress.ip_address(sockaddr[0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local      # 169.254.0.0/16 -- cloud metadata lives here
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise UnsafeWebhookTarget(
                f"{parts.hostname!r} resolves to non-public address {ip}; refusing to deliver"
            )


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
            "X-Viral-Trending-Event": event,
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
        "X-Viral-Trending-Event": event,
        "X-Signature-256": generate_signature(secret, encoded),
    }

    try:
        assert_safe_webhook_url(target_url)
    except UnsafeWebhookTarget as exc:
        # Not retried: a target that resolves inside the network will still
        # be inside the network in sixteen seconds.
        logger.error("refusing webhook delivery to %s: %s", target_url, exc)
        return False

    for attempt, delay in enumerate(RETRY_SCHEDULE_SECONDS):
        try:
            # allow_redirects=False for the same reason the target is
            # resolved above: a public URL that 302s to 169.254.169.254
            # would otherwise walk straight past the check.
            response = requests.post(
                target_url, data=encoded, headers=headers, timeout=5, allow_redirects=False
            )
            if 200 <= response.status_code < 300:
                return True
        except requests.RequestException:
            pass

        if attempt < len(RETRY_SCHEDULE_SECONDS) - 1:
            time.sleep(delay)

    return False
