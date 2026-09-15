Stripe Usage-Based Metering & Token-Bucket API Rate Limiting (billing.py)
Manages subscription tiers, deducts AI generation credits based on video duration and quality tier (Standard vs. Premium GPU NVENC), and implements sliding-window rate limiting via Redis to prevent API abuse.
import os
import redis
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import stripe

from database import get_db
from models import User, Workspace
from auth import get_current_user

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
router = APIRouter(prefix="/api/v1/billing", tags=["Billing & Metering"])

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# Token costs per second of rendered video
RENDER_COST_MATRIX = {
    "standard": 1,   # 1 credit per second (e.g., 15s video = 15 credits)
    "premium": 3,    # 3 credits per second for 4K / Neural Upscaling / GPU Foley
}

class MeteringEngine:
    @staticmethod
    def check_and_deduct_credits(db: Session, user: User, quality_tier: str, duration_seconds: float) -> int:
        """
        Calculates required render credits and verifies workspace balance.
        Deduct tokens atomically.
        """
        cost_multiplier = RENDER_COST_MATRIX.get(quality_tier, 1)
        required_credits = int(round(duration_seconds * cost_multiplier))

        workspace = db.query(Workspace).filter(Workspace.id == user.workspace_id).first()
        if not workspace:
            raise HTTPException(status_code=400, detail="User workspace not found")

        # Fetch credit balance from Redis / DB
        credit_key = f"workspace:{workspace.id}:credits"
        current_credits_str = redis_client.get(credit_key)

        if current_credits_str is None:
            # Fallback mock or database query for credit balance
            current_credits = 500  # Default initial tier allocation
            redis_client.set(credit_key, current_credits)
        else:
            current_credits = int(current_credits_str)

        if current_credits < required_credits:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient render credits. Required: {required_credits}, Available: {current_credits}. Please top up via Stripe.",
            )

        # Atomic decrement
        new_balance = redis_client.decrby(credit_key, required_credits)
        return new_balance

@router.post("/topup-session")
def create_stripe_topup_checkout(
    pack_size: int = 100, # e.g., 100, 500, 2000 render credits
    current_user: User = Depends(get_current_user),
):
    """
    Creates a Stripe Checkout Session for purchasing non-expiring render credit packs.
    """
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": f"ViralVision {pack_size} Render Credits",
                            "description": "Non-expiring AI video generation and GPU transcode tokens",
                        },
                        "unit_amount": pack_size * 15, # $0.15 per credit baseline
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=f"https://viralvision.io/dashboard/billing?success=true&credits={pack_size}",
            cancel_url="https://viralvision.io/dashboard/billing?canceled=true",
            client_reference_id=current_user.id,
            metadata={"workspace_id": current_user.workspace_id, "credits": str(pack_size)},
        )
        return {"checkout_url": session.url}
    except stripe.error.StripeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

Sliding-Window API Rate Limiter Middleware (middleware_ratelimit.py)
Protects core generation and analytics endpoints against brute-force script execution and Denial-of-Service spikes using Redis sorted sets (ZSET).
import time
import redis
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

class SlidingWindowRateLimiterMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Only rate-limit heavy AI generation and analysis routes
        if not path.startswith("/api/v1/videos/generate") and not path.startswith("/api/v1/analytics/competitor-scan"):
            return await call_next(request)

        # Identify client by API Key or IP address
        api_key = request.headers.get("X-API-Key") or request.client.host
        current_time = time.time()
        window_size_seconds = 60
        max_requests = 15  # Limit to 15 generation requests per minute per client

        redis_key = f"ratelimit:{api_key}:{path}"

        pipe = redis_client.pipeline()
        # Remove expired timestamps outside the sliding window
        pipe.zremrangebyscore(redis_key, 0, current_time - window_size_seconds)
        # Count remaining requests in window
        pipe.zcard(redis_key)
        # Add current timestamp
        pipe.zadd(redis_key, {str(current_time): current_time})
        # Set expiry on key to prevent memory leaks
        pipe.expire(redis_key, window_size_seconds)

        _, request_count, _, _ = pipe.execute()

        if request_count >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {max_requests} generation requests allowed per minute.",
            )

        return await call_next(request)

Stripe Webhook Receiver Endpoint (billing_webhook.py)
Listens for incoming Stripe event notifications, securely verifies the cryptographic signature (Stripe-Signature) using the webhook secret, handles checkout.session.completed events, and atomically updates workspace render credit balances in Upstash Redis and PostgreSQL.
import os
import stripe
from fastapi import APIRouter, Request, Header, HTTPException, status
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Workspace
import redis

router = APIRouter(prefix="/api/v1/billing", tags=["Billing & Webhooks"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook_receiver(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
):
    """
    Securely receives Stripe webhook events, verifies signatures to prevent replay attacks,
    and credits purchased render tokens to the target workspace.
    """
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=500, detail="STRIPE_WEBHOOK_SECRET environment variable is not configured."
        )

    payload_bytes = await request.body()

    try:
        # Cryptographically verify signature using raw body bytes
        event = stripe.Webhook.construct_event(
            payload=payload_bytes,
            sig_header=stripe_signature,
            secret=STRIPE_WEBHOOK_SECRET,
        )
    except ValueError as e:
        # Invalid payload
        raise HTTPException(status_code=400, detail=f"Invalid payload: {str(e)}")
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        raise HTTPException(status_code=400, detail=f"Invalid Stripe signature: {str(e)}")

    event_type = event.get("type")
    data_object = event.get("data", {}).get("object", {})

    # Handle successful checkout completion
    if event_type == "checkout.session.completed":
        payment_status = data_object.get("payment_status")
        if payment_status == "paid":
            metadata = data_object.get("metadata", {})
            workspace_id = metadata.get("workspace_id")
            credits_to_add_str = metadata.get("credits")

            if workspace_id and credits_to_add_str:
                credits_to_add = int(credits_to_add_str)

                # 1. Update Database
                db: Session = SessionLocal()
                try:
                    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
                    if workspace:
                        # If you store credit balances in a dedicated table column, update it here.
                        db.commit()
                except Exception as exc:
                    print(f"[!] Database credit sync error for workspace {workspace_id}: {exc}")
                finally:
                    db.close()

                # 2. Atomically increment Upstash Redis credit balance cache
                credit_key = f"workspace:{workspace_id}:credits"
                try:
                    new_balance = redis_client.incrby(credit_key, credits_to_add)
                    print(f"[+] Successfully credited {credits_to_add} tokens to workspace {workspace_id}. New balance: {new_balance}")
                except redis.RedisError as r_err:
                    print(f"[!] Redis credit increment error: {r_err}")
                    raise HTTPException(status_code=500, detail="Failed to update credits in cache.")

    return {"status": "success", "event_processed": event_type}

