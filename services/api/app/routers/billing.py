"""Stripe usage-based render-credit metering and top-up checkout, plus the
webhook receiver that credits a workspace once a top-up payment clears.

Rate limiting for the generation/analytics endpoints lives in
`app.middleware.rate_limit`, not here.
"""
import os

import redis
import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.models import User, Workspace

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

router = APIRouter(prefix="/api/v1/billing", tags=["Billing & Metering"])

# Render credits consumed per second of output video, by quality tier.
RENDER_COST_PER_SECOND = {"standard": 1, "premium": 3}
DEFAULT_INITIAL_CREDITS = 500


class MeteringEngine:
    @staticmethod
    def check_and_deduct_credits(db: Session, user: User, quality_tier: str, duration_seconds: float) -> int:
        cost_multiplier = RENDER_COST_PER_SECOND.get(quality_tier, 1)
        required_credits = int(round(duration_seconds * cost_multiplier))

        workspace = db.query(Workspace).filter(Workspace.id == user.workspace_id).first()
        if not workspace:
            raise HTTPException(status_code=400, detail="User workspace not found")

        credit_key = f"workspace:{workspace.id}:credits"
        current = redis_client.get(credit_key)
        if current is None:
            current_credits = DEFAULT_INITIAL_CREDITS
            redis_client.set(credit_key, current_credits)
        else:
            current_credits = int(current)

        if current_credits < required_credits:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient render credits. Required: {required_credits}, available: {current_credits}.",
            )

        return redis_client.decrby(credit_key, required_credits)


@router.post("/topup-session")
def create_stripe_topup_checkout(pack_size: int = 100, current_user: User = Depends(get_current_user)):
    """Creates a Stripe Checkout Session for a non-expiring render-credit pack."""
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"ViralVision {pack_size} Render Credits",
                        "description": "Non-expiring AI video generation and GPU transcode tokens",
                    },
                    "unit_amount": pack_size * 15,  # $0.15 / credit baseline
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{os.getenv('NEXT_PUBLIC_APP_URL', '')}/dashboard/settings/billing?success=true&credits={pack_size}",
            cancel_url=f"{os.getenv('NEXT_PUBLIC_APP_URL', '')}/dashboard/settings/billing?canceled=true",
            client_reference_id=current_user.id,
            metadata={"workspace_id": current_user.workspace_id, "credits": str(pack_size)},
        )
        return {"checkout_url": session.url}
    except stripe.error.StripeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook_receiver(request: Request, stripe_signature: str = Header(None, alias="Stripe-Signature")):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="STRIPE_WEBHOOK_SECRET is not configured")

    payload_bytes = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload_bytes, stripe_signature, STRIPE_WEBHOOK_SECRET)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {exc}") from exc
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid Stripe signature: {exc}") from exc

    event_type = event.get("type")
    data_object = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed" and data_object.get("payment_status") == "paid":
        metadata = data_object.get("metadata", {})
        workspace_id = metadata.get("workspace_id")
        credits_to_add = metadata.get("credits")

        if workspace_id and credits_to_add:
            try:
                redis_client.incrby(f"workspace:{workspace_id}:credits", int(credits_to_add))
            except redis.RedisError as exc:
                raise HTTPException(status_code=500, detail="Failed to update credits in cache") from exc

    return {"status": "success", "event_processed": event_type}
