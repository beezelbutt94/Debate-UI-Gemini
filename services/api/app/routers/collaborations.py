"""Brand sponsorship briefs with escrow settlement (10% platform take
rate), and 1-on-1 creator mentorship booking.
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.models import BrandBrief, BriefSubmission, MentorshipBooking, MentorshipSlot, User

router = APIRouter(prefix="/api/v1/collaborations", tags=["Brand Marketplace"])
mentorship_router = APIRouter(prefix="/api/v1/mentorship", tags=["Mentorship"])

PLATFORM_TAKE_RATE = 0.10


class CreateBriefSchema(BaseModel):
    title: str
    budget_usd: float = Field(..., gt=50.0)
    requirements: str
    target_creators: int = 1


class SubmitPitchSchema(BaseModel):
    video_file_id: Optional[str] = None
    proposal_notes: Optional[str] = None


@router.post("/briefs", status_code=status.HTTP_201_CREATED)
def create_brief(payload: CreateBriefSchema, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    brief = BrandBrief(
        id=str(uuid.uuid4()),
        brand_id=current_user.id,
        title=payload.title,
        budget_usd=payload.budget_usd,
        requirements=payload.requirements,
        target_creators=payload.target_creators,
    )
    db.add(brief)
    db.commit()
    db.refresh(brief)
    return brief


@router.post("/briefs/{brief_id}/submit")
def submit_collaboration_pitch(
    brief_id: str,
    payload: SubmitPitchSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    brief = db.query(BrandBrief).filter(BrandBrief.id == brief_id, BrandBrief.status == "open").first()
    if not brief:
        raise HTTPException(status_code=404, detail="Active brief not found")

    gross_share = brief.budget_usd / max(1, brief.target_creators)
    commission = round(gross_share * PLATFORM_TAKE_RATE, 2)
    net_payout = round(gross_share - commission, 2)

    submission = BriefSubmission(
        id=str(uuid.uuid4()),
        brief_id=brief.id,
        creator_id=current_user.id,
        video_file_id=payload.video_file_id,
        proposal_notes=payload.proposal_notes,
        payout_amount=net_payout,
        commission_fee=commission,
        status="submitted",
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


class EscrowSettlementEngine:
    @classmethod
    def release_submission_escrow(cls, db: Session, submission_id: str) -> dict:
        submission = db.query(BriefSubmission).filter(BriefSubmission.id == submission_id).first()
        if not submission or submission.payout_released:
            raise ValueError("Invalid submission or escrow already released")

        submission.status = "approved"
        submission.payout_released = True
        db.commit()

        return {
            "submission_id": submission.id,
            "creator_net_payout": submission.payout_amount,
            "platform_fee": submission.commission_fee,
        }


@router.post("/submissions/{submission_id}/release-escrow")
def release_escrow(submission_id: str, db: Session = Depends(get_db)):
    try:
        return EscrowSettlementEngine.release_submission_escrow(db, submission_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@mentorship_router.get("/slots")
def list_open_mentorship_slots(db: Session = Depends(get_db)):
    return db.query(MentorshipSlot).filter(MentorshipSlot.is_booked.is_(False)).order_by(MentorshipSlot.start_time.asc()).all()


@mentorship_router.post("/slots/{slot_id}/book")
def book_mentorship_slot(slot_id: str, meeting_link: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    slot = db.query(MentorshipSlot).filter(MentorshipSlot.id == slot_id, MentorshipSlot.is_booked.is_(False)).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot unavailable")

    slot.is_booked = True
    booking = MentorshipBooking(
        id=str(uuid.uuid4()),
        slot_id=slot.id,
        mentor_id=slot.mentor_id,
        mentee_id=current_user.id,
        meeting_link=meeting_link,
        status="confirmed",
        booked_at=datetime.utcnow(),
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking
