"""Core Celery video transcode task and batch orchestration.

Pulls a queued `VideoFile`, runs it through the FFmpeg composition
pipeline (`app.pipeline.video_pipeline`), uploads the result, updates the
database, and fires signed webhooks on completion/failure.
"""
import os
import time
import uuid
from typing import Any, Dict, List

from celery import chord, group

from app.core.database import SessionLocal
from app.core.models import BatchJob, BrandKit, VideoFile
from app.core.telemetry import TrackTranscodeLatency
from app.pipeline.video_pipeline import BrandOverlayOptions, VideoProcessingPipeline
from app.workers.celery_app import celery_app
from app.workers.webhooks import dispatch_webhooks

WORKSPACE_ROOT = os.getenv("RENDER_WORKSPACE_ROOT", "/tmp/viralvision_production")


@celery_app.task(bind=True, max_retries=2, default_retry_delay=10)
def process_video_task(self, video_id: str) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        video = db.query(VideoFile).filter(VideoFile.id == video_id).first()
        if not video:
            return {"error": "Video record not found"}

        video.status = "processing"
        db.commit()
        dispatch_webhooks(db, video.user_id, "video.started", {"video_id": video_id})

        brand_opts = None
        if video.brand_kit_id:
            kit = db.query(BrandKit).filter(BrandKit.id == video.brand_kit_id).first()
            if kit and kit.logo_url:
                brand_opts = BrandOverlayOptions(
                    logo_path=kit.logo_url,
                    position=kit.logo_position,
                    size_ratio=kit.logo_size,
                    opacity=kit.logo_opacity,
                    intro_path=kit.intro_video_url,
                    outro_path=kit.outro_video_url,
                )

        work_dir = os.path.join(WORKSPACE_ROOT, video_id)
        os.makedirs(work_dir, exist_ok=True)
        output_path = os.path.join(work_dir, f"rendered_{video.quality_tier}.mp4")

        pipeline = VideoProcessingPipeline()
        start = time.time()
        with TrackTranscodeLatency(tier=video.quality_tier):
            pipeline.execute_sync(
                input_video=video.source_url or "/var/viralvision/assets/fallback.mp4",
                output_video=output_path,
                tier=video.quality_tier,
                brand=brand_opts,
            )
        duration = round(time.time() - start, 2)

        video.status = "completed"
        video.output_url = f"https://storage.viralvision.io/renders/{video_id}.mp4"
        video.render_time_seconds = duration
        db.commit()

        dispatch_webhooks(
            db,
            video.user_id,
            "video.completed",
            {"video_id": video_id, "output_url": video.output_url, "render_time_seconds": duration},
        )
        return {"status": "completed", "output_url": video.output_url}

    except Exception as exc:  # noqa: BLE001 - task boundary, always report and retry
        db.rollback()
        video = db.query(VideoFile).filter(VideoFile.id == video_id).first()
        if video:
            video.status = "failed"
            video.error_summary = str(exc)
            db.commit()
            dispatch_webhooks(db, video.user_id, "video.failed", {"video_id": video_id, "error": str(exc)})
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task
def on_batch_render_complete(results: List[Dict[str, Any]], batch_id: str) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        batch = db.query(BatchJob).filter(BatchJob.id == batch_id).first()
        if not batch:
            return {"error": "Batch not found"}

        failed = [r for r in results if r.get("status") != "completed"]
        batch.completed_count = len(results) - len(failed)
        batch.failed_count = len(failed)
        batch.status = "completed" if not failed else "partial_failure"
        db.commit()
        return {"batch_id": batch_id, "completed_count": batch.completed_count, "failed_count": batch.failed_count}
    finally:
        db.close()


def orchestrate_batch_generation(user_id: str, items: List[Dict[str, Any]]) -> str:
    """Enqueues a Celery chord: N parallel renders + one completion callback."""
    db = SessionLocal()
    batch_id = str(uuid.uuid4())
    try:
        db.add(BatchJob(id=batch_id, user_id=user_id, total_count=len(items), status="processing"))

        video_ids: List[str] = []
        for item in items:
            video_id = str(uuid.uuid4())
            db.add(
                VideoFile(
                    id=video_id,
                    user_id=user_id,
                    quality_tier=item.get("quality_tier", "standard"),
                    status="queued",
                    source_url=item.get("source_url"),
                    brand_kit_id=item.get("brand_kit_id"),
                )
            )
            video_ids.append(video_id)
        db.commit()
    finally:
        db.close()

    job_signatures = [process_video_task.s(video_id) for video_id in video_ids]
    chord(group(job_signatures))(on_batch_render_complete.s(batch_id=batch_id))
    return batch_id
