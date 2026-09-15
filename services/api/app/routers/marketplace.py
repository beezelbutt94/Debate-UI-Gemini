"""Video template marketplace: browsing, publishing, Stripe Connect
checkout with a 70/30 creator/platform revenue split, and creator payouts.
"""
import os
from typing import List, Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import RoleChecker, get_current_user
from app.core.database import get_db
from app.core.models import TemplatePurchase, User, VideoTemplate, WorkspaceRole

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
PLATFORM_FEE_PERCENTAGE = 0.30
ALLOWED_PRICES = {0.0, 9.99, 19.99, 49.99}

router = APIRouter(prefix="/api/v1/templates", tags=["Marketplace"])
creator_router = APIRouter(prefix="/api/v1/marketplace/creator", tags=["Creator Payouts"])


class CreateTemplatePayload(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: str
    category: str
    tags: List[str]
    price: float
    template_file_url: str
    preview_video_url: str


@router.get("")
def browse_templates(category: Optional[str] = None, limit: int = 30, offset: int = 0, db: Session = Depends(get_db)):
    query = db.query(VideoTemplate).filter(VideoTemplate.published.is_(True), VideoTemplate.approved.is_(True))
    if category and category.lower() != "all":
        query = query.filter(VideoTemplate.category == category.lower())

    templates = query.order_by(VideoTemplate.downloads.desc()).offset(offset).limit(limit).all()
    return [_serialize_template(t) for t in templates]


@router.get("/{template_id}")
def get_template_details(template_id: str, db: Session = Depends(get_db)):
    template = db.query(VideoTemplate).filter(VideoTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return {**_serialize_template(template), "template_file_url": template.template_file_url}


@router.post("", status_code=status.HTTP_201_CREATED)
def publish_template(
    payload: CreateTemplatePayload,
    current_user: User = Depends(RoleChecker(WorkspaceRole.EDITOR)),
    db: Session = Depends(get_db),
):
    if payload.price not in ALLOWED_PRICES:
        raise HTTPException(status_code=400, detail=f"Price must be one of: {sorted(ALLOWED_PRICES)}")

    template = VideoTemplate(
        creator_id=current_user.id,
        title=payload.title,
        description=payload.description,
        category=payload.category.lower(),
        tags=payload.tags,
        price=payload.price,
        template_file_url=payload.template_file_url,
        preview_video_url=payload.preview_video_url,
        published=True,
        approved=True,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return {"id": template.id, "status": "published"}


@router.post("/{template_id}/purchase")
def purchase_template(template_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    template = db.query(VideoTemplate).filter(VideoTemplate.id == template_id).first()
    if not template or not template.published:
        raise HTTPException(status_code=404, detail="Template unavailable")

    creator = db.query(User).filter(User.id == template.creator_id).first()
    if not creator:
        raise HTTPException(status_code=400, detail="Creator record missing")

    if template.price == 0.0:
        purchase = TemplatePurchase(
            template_id=template.id,
            buyer_id=current_user.id,
            purchase_price=0.0,
            creator_revenue=0.0,
            platform_revenue=0.0,
            payout_processed=True,
        )
        template.downloads += 1
        db.add(purchase)
        db.commit()
        return {"session_id": "free_grant", "checkout_url": None}

    if not creator.stripe_connected_account_id:
        raise HTTPException(status_code=400, detail="Creator has not completed Stripe Connect onboarding")

    price_cents = int(template.price * 100)
    platform_fee_cents = int(price_cents * PLATFORM_FEE_PERCENTAGE)
    app_url = os.getenv("NEXT_PUBLIC_APP_URL", "")

    checkout_session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        mode="payment",
        customer_email=current_user.email,
        line_items=[{
            "price_data": {
                "currency": "usd",
                "unit_amount": price_cents,
                "product_data": {"name": template.title, "description": template.description or "ViralVision Video Template"},
            },
            "quantity": 1,
        }],
        payment_intent_data={
            "application_fee_amount": platform_fee_cents,
            "transfer_data": {"destination": creator.stripe_connected_account_id},
            "metadata": {"template_id": template.id, "buyer_id": current_user.id},
        },
        success_url=f"{app_url}/templates/{template.id}?success=true",
        cancel_url=f"{app_url}/templates/{template.id}?canceled=true",
    )
    return {"checkout_url": checkout_session.url, "session_id": checkout_session.id}


@creator_router.get("/earnings")
def get_creator_earnings_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    template_ids = [
        t.id for t in db.query(VideoTemplate.id).filter(VideoTemplate.creator_id == current_user.id).all()
    ]
    if not template_ids:
        return {"totalRevenue": 0.0, "availableBalance": 0.0, "pendingBalance": 0.0, "totalSalesCount": 0, "recentTransactions": []}

    purchases = (
        db.query(TemplatePurchase, VideoTemplate.title)
        .join(VideoTemplate, TemplatePurchase.template_id == VideoTemplate.id)
        .filter(TemplatePurchase.template_id.in_(template_ids))
        .order_by(TemplatePurchase.purchased_at.desc())
        .all()
    )

    total_revenue = sum(p.TemplatePurchase.creator_revenue for p in purchases)
    available = sum(p.TemplatePurchase.creator_revenue for p in purchases if p.TemplatePurchase.payout_processed)
    pending = sum(p.TemplatePurchase.creator_revenue for p in purchases if not p.TemplatePurchase.payout_processed)

    return {
        "totalRevenue": round(total_revenue, 2),
        "availableBalance": round(available, 2),
        "pendingBalance": round(pending, 2),
        "totalSalesCount": len(purchases),
        "recentTransactions": [
            {
                "id": p.TemplatePurchase.id,
                "itemTitle": p.title,
                "grossAmount": p.TemplatePurchase.purchase_price,
                "creatorShare": p.TemplatePurchase.creator_revenue,
                "platformFee": p.TemplatePurchase.platform_revenue,
                "purchasedAt": p.TemplatePurchase.purchased_at.strftime("%Y-%m-%d %H:%M"),
            }
            for p in purchases[:10]
        ],
    }


@creator_router.post("/payout-link")
def create_stripe_express_login_link(current_user: User = Depends(get_current_user)):
    if not current_user.stripe_connected_account_id:
        raise HTTPException(status_code=400, detail="No connected Stripe Express account. Onboard via Settings first.")

    try:
        login_link = stripe.Account.create_login_link(current_user.stripe_connected_account_id)
        return {"stripe_url": login_link.url}
    except stripe.error.StripeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _serialize_template(t: VideoTemplate) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "category": t.category,
        "tags": t.tags,
        "price": t.price,
        "preview_video_url": t.preview_video_url,
        "downloads": t.downloads,
        "rating": t.rating,
        "review_count": t.review_count,
        "creator_id": t.creator_id,
    }
