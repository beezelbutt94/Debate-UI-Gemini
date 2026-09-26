"""Inbound automation triggers (Zapier/Make.com) and outbound webhook
subscription management + test delivery.
"""
import time
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session

from app.core.auth import RoleChecker, get_current_user
from app.core.database import get_db
from app.core.models import User, VideoFile, WebhookSubscription, WorkspaceRole
from app.workers.celery_app import dispatch_tiered_render
from app.workers.webhooks import deliver_with_retries, generate_signature

router = APIRouter(prefix="/api/v1/integrations", tags=["Integrations & Automations"])


class AutomationGeneratePayload(BaseModel):
    title: str
    script_text: str
    target_duration: int = 30
    aspect_ratio: str = "9:16"
    brand_kit_id: Optional[str] = None
    quality_tier: str = "standard"
    callback_webhook_url: Optional[HttpUrl] = None


class WebhookTestPayload(BaseModel):
    targetUrl: HttpUrl
    secret: str


class RegisterWebhookPayload(BaseModel):
    target_url: HttpUrl
    secret_key: str
    events: List[str] = ["*"]


@router.post("/zapier/triggers/generate", status_code=status.HTTP_202_ACCEPTED)
def zapier_generate_trigger(
    payload: AutomationGeneratePayload,
    authorization: str = Header(..., description="Bearer <USER_API_KEY>"),
    db: Session = Depends(get_db),
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token schema")

    token = authorization.split("Bearer ", 1)[1].strip()
    user = db.query(User).filter(User.api_key == token).first()
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized automation token")

    video = VideoFile(
        id=str(uuid.uuid4()),
        user_id=user.id,
        quality_tier=payload.quality_tier,
        status="queued",
        brand_kit_id=payload.brand_kit_id,
    )
    db.add(video)
    db.commit()

    dispatch_tiered_render(video.id, video.quality_tier)

    return {
        "success": True,
        "job_id": video.id,
        "status": "queued",
        "estimated_completion_seconds": 120 if payload.quality_tier == "standard" else 300,
        "check_status_url": f"/api/v1/videos/{video.id}/status",
    }


@router.post("/webhooks/test")
def test_webhook_delivery(payload: WebhookTestPayload):
    delivered = deliver_with_retries(
        target_url=str(payload.targetUrl),
        secret=payload.secret,
        event="system.ping",
        data={"message": "Viral Trending webhook pipeline verified"},
    )
    if not delivered:
        raise HTTPException(status_code=502, detail="Webhook delivery failed after retries")
    return {"delivered": True}


@router.post("/webhooks/subscriptions", status_code=status.HTTP_201_CREATED)
def register_subscription(
    payload: RegisterWebhookPayload,
    current_user: User = Depends(RoleChecker(WorkspaceRole.ADMIN)),
    db: Session = Depends(get_db),
):
    sub = WebhookSubscription(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        target_url=str(payload.target_url),
        secret_key=payload.secret_key,
        subscribed_events=payload.events,
        is_active=True,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "status": "active"}


@router.post("/webhooks/verify-signature")
def verify_signature_helper(secret: str, payload_json: str):
    """Developer utility: shows the expected `X-Signature-256` for a given
    secret + raw JSON body, so integrators can debug their receivers."""
    return {"expected_signature": generate_signature(secret, payload_json.encode("utf-8")), "timestamp": int(time.time())}
