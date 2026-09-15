"""Live masterclass / community events: LiveKit room listing and signed
join-token issuance.
"""
import os
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.models import ConferenceSessionRecord, User

router = APIRouter(prefix="/api/v1/community/events", tags=["Community & Events"])

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")


class JoinTokenRequest(BaseModel):
    as_speaker: bool = False


@router.get("/rooms")
def list_conference_rooms(db: Session = Depends(get_db)):
    rooms = db.query(ConferenceSessionRecord).order_by(ConferenceSessionRecord.scheduled_at.asc()).all()
    return [
        {
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "room_name": r.room_name,
            "is_live": r.is_live,
            "max_participants": r.max_participants,
            "scheduled_at": r.scheduled_at.isoformat(),
        }
        for r in rooms
    ]


@router.post("/rooms/{event_id}/token")
def generate_stage_token(
    event_id: str,
    payload: JoinTokenRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not (LIVEKIT_API_KEY and LIVEKIT_API_SECRET):
        raise HTTPException(status_code=503, detail="LiveKit is not configured on this deployment")

    from livekit import api  # optional dependency, only needed when LiveKit is configured

    session = db.query(ConferenceSessionRecord).filter(ConferenceSessionRecord.id == event_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Conference session not found")

    is_host = session.host_id == current_user.id
    can_publish = is_host or payload.as_speaker

    grant = api.VideoGrants(
        room_join=True, room=session.room_name, can_publish=can_publish, can_subscribe=True,
        can_publish_data=True, room_admin=is_host,
    )
    token = api.AccessToken(api_key=LIVEKIT_API_KEY, api_secret=LIVEKIT_API_SECRET)
    token.with_identity(current_user.id).with_name(current_user.email.split("@")[0])
    token.with_grants(grant).with_ttl(timedelta(hours=4))

    return {"server_url": LIVEKIT_URL, "token": token.to_jwt(), "room_name": session.room_name, "is_host": is_host}
