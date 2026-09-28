"""Support, finance, outreach, ads, sales and competitor endpoints for the dashboard."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import select

from app import bandit, competitors, db, deliverability, finance, sales
from app.models import PreDemoBriefing, SupportTicket, iso
from app.security import require_operator
from app.tasks import generate_briefing, outcome, triage_ticket

router = APIRouter(dependencies=[Depends(require_operator)], tags=["business"])


class TicketRequest(BaseModel):
    customer_email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    subject: str = Field(min_length=3, max_length=300)
    body: str = Field(min_length=3, max_length=20000)


class ArmRequest(BaseModel):
    campaign_id: str
    name: str
    platform: str = "meta"


class ObservationRequest(BaseModel):
    spend_usd: float = Field(gt=0)
    revenue_usd: float = Field(ge=0)


class CompetitorRequest(BaseModel):
    name: str
    url: HttpUrl
    page_type: str = Field("landing", pattern="^(landing|pricing|changelog)$")


@router.post("/support/tickets", status_code=202)
def create_ticket(req: TicketRequest) -> dict[str, Any]:
    with db.session_scope() as session:
        ticket = SupportTicket(customer_email=req.customer_email.lower(), subject=req.subject, body=req.body)
        session.add(ticket)
        session.flush()
        ticket_id = ticket.id
    return outcome(triage_ticket.delay(ticket_id))


@router.get("/support/tickets")
def list_tickets() -> list[dict[str, Any]]:
    with db.session_scope() as session:
        rows = session.scalars(select(SupportTicket).order_by(SupportTicket.created_at.desc()).limit(50))
        return [
            {
                "id": t.id,
                "customer_email": t.customer_email,
                "subject": t.subject,
                "status": t.status,
                "is_bug": t.is_bug,
                "reply_draft": t.reply_draft,
                "approval_id": t.approval_id,
                "created_at": iso(t.created_at),
            }
            for t in rows
        ]


@router.get("/finance/summary")
def finance_summary() -> dict[str, Any]:
    return finance.summary()


@router.get("/deliverability")
def deliverability_overview() -> list[dict[str, Any]]:
    return deliverability.overview()


@router.post("/deliverability/{campaign}/resume")
def resume_campaign(campaign: str) -> dict[str, Any]:
    return deliverability.resume_campaign(campaign)


@router.get("/ads/arms")
def ad_arms() -> dict[str, Any]:
    return {"arms": bandit.state(), "recommendation": bandit.recommend()}


@router.post("/ads/arms", status_code=201)
def register_arm(req: ArmRequest) -> dict[str, str]:
    bandit.register_arm(req.campaign_id, req.name, req.platform)
    return {"campaign_id": req.campaign_id}


@router.post("/ads/arms/{campaign_id}/observations")
def observe_arm(campaign_id: str, req: ObservationRequest) -> dict[str, float]:
    try:
        return bandit.observe(campaign_id, req.spend_usd, req.revenue_usd)
    except LookupError:
        raise HTTPException(404, "Unknown campaign") from None


@router.get("/demos")
def demos() -> list[dict[str, Any]]:
    return sales.upcoming_demos()


@router.post("/demos/{booking_id}/briefing", status_code=202)
def request_briefing(booking_id: str) -> dict[str, Any]:
    return outcome(generate_briefing.delay(booking_id))


@router.get("/briefings/{briefing_id}")
def get_briefing(briefing_id: str) -> dict[str, Any]:
    with db.session_scope() as session:
        briefing = session.get(PreDemoBriefing, briefing_id)
        if briefing is None:
            raise HTTPException(404, "Briefing not found")
        return sales.serialize_briefing(briefing)


@router.get("/competitors")
def competitor_overview() -> dict[str, Any]:
    return {"targets": competitors.list_targets(), "intel": competitors.recent_intel()}


@router.post("/competitors", status_code=201)
def add_competitor(req: CompetitorRequest) -> dict[str, Any]:
    return competitors.add_target(req.name, str(req.url), req.page_type)
