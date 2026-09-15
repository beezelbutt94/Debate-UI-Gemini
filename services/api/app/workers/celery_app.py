"""Celery application, SLA-tiered priority queues, and routing helpers.

Three queues back the render pipeline: `premium_sla` (highest priority,
scaled aggressively by KEDA), `standard_jobs`, and `draft_preview`. See
`k8s/keda-autoscaler.yaml` for the queue-depth-driven autoscaling rules.
"""
import os

from celery import Celery
from kombu import Exchange, Queue

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery("viralvision_workers", broker=REDIS_URL, backend=REDIS_URL)

_default_exchange = Exchange("viralvision_exchange", type="direct")

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_queues=(
        Queue("premium_sla", _default_exchange, routing_key="render.premium", queue_arguments={"x-max-priority": 10}),
        Queue("standard_jobs", _default_exchange, routing_key="render.standard", queue_arguments={"x-max-priority": 5}),
        Queue("draft_preview", _default_exchange, routing_key="render.draft", queue_arguments={"x-max-priority": 1}),
    ),
    task_default_queue="standard_jobs",
    task_default_exchange="viralvision_exchange",
    task_default_routing_key="render.standard",
)

_TIER_ROUTING = {
    "premium": {"queue": "premium_sla", "routing_key": "render.premium", "priority": 9},
    "standard": {"queue": "standard_jobs", "routing_key": "render.standard", "priority": 5},
    "draft": {"queue": "draft_preview", "routing_key": "render.draft", "priority": 1},
}


def dispatch_tiered_render(video_id: str, quality_tier: str) -> None:
    """Enqueues `process_video_task` onto the queue matching the SLA tier."""
    from app.workers.tasks import process_video_task

    route = _TIER_ROUTING.get(quality_tier.lower(), _TIER_ROUTING["draft"])
    process_video_task.apply_async(
        args=[video_id],
        queue=route["queue"],
        routing_key=route["routing_key"],
        priority=route["priority"],
    )
