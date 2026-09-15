"""Timestamped video review comments and client sign-off / approval."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.models import User, VideoApprovalRecord, VideoReviewComment

router = APIRouter(prefix="/api/v1/videos/{video_id}/reviews", tags=["Video Reviews"])


class CommentCreatePayload(BaseModel):
    second_mark: float = Field(..., ge=0.0)
    comment_text: str = Field(..., min_length=1, max_length=2000)


class ApprovalPayload(BaseModel):
    approved: bool
    notes: str = ""


@router.get("/comments")
def get_comments(video_id: str, db: Session = Depends(get_db)):
    return (
        db.query(VideoReviewComment)
        .filter(VideoReviewComment.video_id == video_id)
        .order_by(VideoReviewComment.second_mark.asc())
        .all()
    )


@router.post("/comments", status_code=status.HTTP_201_CREATED)
def post_comment(
    video_id: str,
    payload: CommentCreatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = VideoReviewComment(
        id=str(uuid.uuid4()),
        video_id=video_id,
        author_id=current_user.id,
        second_mark=payload.second_mark,
        comment_text=payload.comment_text,
        resolved=False,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.patch("/comments/{comment_id}/resolve")
def resolve_comment(video_id: str, comment_id: str, db: Session = Depends(get_db)):
    comment = (
        db.query(VideoReviewComment)
        .filter(VideoReviewComment.id == comment_id, VideoReviewComment.video_id == video_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment.resolved = True
    db.commit()
    return {"status": "resolved"}


@router.post("/approval")
def submit_approval(
    video_id: str,
    payload: ApprovalPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(VideoApprovalRecord).filter(VideoApprovalRecord.video_id == video_id).first()
    status_label = "approved" if payload.approved else "changes_requested"

    if not record:
        record = VideoApprovalRecord(
            id=str(uuid.uuid4()),
            video_id=video_id,
            approver_id=current_user.id,
            status=status_label,
            decision_notes=payload.notes,
            decided_at=datetime.utcnow(),
        )
        db.add(record)
    else:
        record.status = status_label
        record.decision_notes = payload.notes
        record.decided_at = datetime.utcnow()

    db.commit()
    return {"status": record.status}
