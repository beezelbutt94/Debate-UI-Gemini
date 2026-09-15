"""Public video generation gateway: dispatch a render job, poll its
status, manage brand kits, and kick off batch generation runs.
"""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.models import BrandKit, User, VideoFile
from app.workers.celery_app import dispatch_tiered_render
from app.workers.tasks import orchestrate_batch_generation

router = APIRouter(prefix="/api/v1/videos", tags=["Video Generation"])

VALID_TIERS = {"draft", "standard", "premium"}


class VideoGenerateRequest(BaseModel):
    source_url: HttpUrl
    quality_tier: str = "standard"
    brand_kit_id: Optional[str] = None


class VideoStatusResponse(BaseModel):
    video_id: str
    status: str
    quality_tier: str
    output_url: Optional[str]
    render_time_seconds: Optional[float]


class BrandKitCreateRequest(BaseModel):
    logo_url: Optional[HttpUrl] = None
    logo_position: str = "bottom_right"
    logo_size: float = 0.15
    logo_opacity: float = 0.80
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    intro_video_url: Optional[HttpUrl] = None
    outro_video_url: Optional[HttpUrl] = None


class BatchGenerateItem(BaseModel):
    source_url: HttpUrl
    quality_tier: str = "standard"
    brand_kit_id: Optional[str] = None


@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
def generate_video(
    payload: VideoGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.quality_tier not in VALID_TIERS:
        raise HTTPException(status_code=400, detail=f"Invalid tier. Must be one of {sorted(VALID_TIERS)}")

    video = VideoFile(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        quality_tier=payload.quality_tier,
        status="queued",
        source_url=str(payload.source_url),
        brand_kit_id=payload.brand_kit_id,
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    dispatch_tiered_render(video.id, video.quality_tier)

    return {"job_id": video.id, "status": video.status, "polling_url": f"/api/v1/videos/{video.id}/status"}


@router.get("/recent")
def list_recent_videos(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    videos = (
        db.query(VideoFile)
        .filter(VideoFile.user_id == current_user.id)
        .order_by(VideoFile.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": v.id,
            "status": v.status,
            "tier": v.quality_tier,
            "durationSeconds": v.duration_seconds,
            "createdAt": v.created_at.isoformat(),
            "outputUrl": v.output_url,
        }
        for v in videos
    ]


@router.get("/{job_id}/status", response_model=VideoStatusResponse)
def get_video_status(job_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    video = db.query(VideoFile).filter(VideoFile.id == job_id, VideoFile.user_id == current_user.id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video job not found")

    return VideoStatusResponse(
        video_id=video.id,
        status=video.status,
        quality_tier=video.quality_tier,
        output_url=video.output_url,
        render_time_seconds=video.render_time_seconds,
    )


@router.post("/batch", status_code=status.HTTP_202_ACCEPTED)
def generate_video_batch(
    items: List[BatchGenerateItem],
    current_user: User = Depends(get_current_user),
):
    if not items:
        raise HTTPException(status_code=400, detail="At least one item is required")

    batch_id = orchestrate_batch_generation(
        user_id=current_user.id,
        items=[item.model_dump(mode="json") for item in items],
    )
    return {"batch_id": batch_id, "status": "processing", "item_count": len(items)}


@router.post("/brand-kits", status_code=status.HTTP_201_CREATED)
def create_brand_kit(
    payload: BrandKitCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    kit = BrandKit(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        logo_url=str(payload.logo_url) if payload.logo_url else None,
        logo_position=payload.logo_position,
        logo_size=payload.logo_size,
        logo_opacity=payload.logo_opacity,
        primary_color=payload.primary_color,
        accent_color=payload.accent_color,
        intro_video_url=str(payload.intro_video_url) if payload.intro_video_url else None,
        outro_video_url=str(payload.outro_video_url) if payload.outro_video_url else None,
    )
    db.add(kit)
    db.commit()
    db.refresh(kit)
    return {"id": kit.id, "message": "Brand kit created successfully"}
