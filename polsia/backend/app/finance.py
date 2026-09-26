"""Stripe webhook ingestion and revenue telemetry."""

import hashlib
import hmac
import time
from datetime import timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app import db, events
from app.models import FinancialTransaction, utcnow

STRIPE_TOLERANCE_SECONDS = 300
REVENUE_EVENTS = {"invoice.paid", "invoice.payment_succeeded"}


class SignatureError(ValueError):
    pass


def verify_stripe_signature(payload: bytes, header: str | None, secret: str, now: float | None = None) -> None:
    """Stripe's scheme: `t=<ts>,v1=<hex hmac_sha256(secret, f"{t}.{payload}")>`."""
    if not header:
        raise SignatureError("Missing Stripe-Signature header")
    parts: dict[str, list[str]] = {}
    for item in header.split(","):
        key, _, value = item.partition("=")
        parts.setdefault(key.strip(), []).append(value.strip())
    try:
        timestamp = int(parts["t"][0])
    except (KeyError, ValueError) as exc:
        raise SignatureError("Malformed Stripe-Signature header") from exc
    if abs((now or time.time()) - timestamp) > STRIPE_TOLERANCE_SECONDS:
        raise SignatureError("Stripe signature timestamp outside tolerance")
    expected = hmac.new(secret.encode(), f"{timestamp}.".encode() + payload, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(expected, sig) for sig in parts.get("v1", [])):
        raise SignatureError("Stripe signature mismatch")


def record_event(event: dict[str, Any]) -> bool:
    """Idempotently store one Stripe event. Returns False for a redelivery."""
    obj = event.get("data", {}).get("object", {})
    event_type = event.get("type", "")
    if event_type in REVENUE_EVENTS:
        amount = int(obj.get("amount_paid") or 0)
    elif event_type == "charge.refunded":
        amount = -int(obj.get("amount_refunded") or 0)
    else:
        amount = 0
    try:
        with db.session_scope() as session:
            session.add(
                FinancialTransaction(
                    stripe_event_id=event["id"],
                    event_type=event_type,
                    customer_id=obj.get("customer"),
                    amount_cents=amount,
                    currency=obj.get("currency", "usd"),
                )
            )
    except IntegrityError:
        return False
    events.publish("FINANCE_EVENT", event_type=event_type, amount_cents=amount)
    return True


def summary() -> dict[str, Any]:
    since = utcnow() - timedelta(days=30)
    with db.session_scope() as session:
        revenue = session.scalar(
            select(func.coalesce(func.sum(FinancialTransaction.amount_cents), 0)).where(
                FinancialTransaction.created_at >= since,
                FinancialTransaction.event_type.in_(REVENUE_EVENTS | {"charge.refunded"}),
            )
        )
        churned = session.scalar(
            select(func.count(FinancialTransaction.id)).where(
                FinancialTransaction.created_at >= since,
                FinancialTransaction.event_type == "customer.subscription.deleted",
            )
        )
        failed = session.scalar(
            select(func.count(FinancialTransaction.id)).where(
                FinancialTransaction.created_at >= since,
                FinancialTransaction.event_type == "invoice.payment_failed",
            )
        )
    return {
        # Trailing-30-day net collected revenue is the MRR proxy until
        # subscription objects are modeled directly.
        "net_revenue_30d_usd": int(revenue or 0) / 100,
        "churned_subscriptions_30d": int(churned or 0),
        "failed_payments_30d": int(failed or 0),
    }
