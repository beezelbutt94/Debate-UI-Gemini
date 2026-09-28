"""Celery application, SLA-tiered priority queues, and routing helpers.

Three queues back the render pipeline: `premium_sla` (highest priority,
scaled aggressively by KEDA), `standard_jobs`, and `draft_preview`. See
`k8s/keda-autoscaler.yaml` for the queue-depth-driven autoscaling rules.
"""
import os

from celery import Celery
from kombu import Exchange, Queue

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery("viral_trending_workers", broker=REDIS_URL, backend=REDIS_URL)

_default_exchange = Exchange("viral_trending_exchange", type="direct")

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Retry the broker on startup as well as mid-run. Without this Celery 5
    # logs a CPendingDeprecationWarning on every boot, and a worker that
    # starts fractionally before Redis is reachable dies instead of waiting.
    broker_connection_retry_on_startup=True,
    # The default is 100 retries with the backoff capped at 32s, i.e. roughly
    # 45 minutes of a worker that is *up* but consuming nothing. That was
    # observed in production on Railway: the managed Redis restarted and
    # rotated its password, and because REDIS_URL is injected into the
    # container's environment at deploy time, the running worker kept
    # presenting the old credentials --
    #
    #   consumer: Cannot connect to redis://default:**@redis.railway.internal:6379//:
    #   invalid username-password pair or user is disabled..
    #   Trying again in 32.00 seconds... (16/100)
    #
    # No amount of retrying fixes stale credentials. The worker has to exit so
    # the platform restarts it and re-injects the current REDIS_URL. A worker
    # serves no HTTP, so no health check catches this state -- it looks alive.
    # Failing fast and letting the restart policy do its job is the recovery
    # path; sitting in a retry loop is not.
    broker_connection_max_retries=5,
    task_queues=(
        Queue("premium_sla", _default_exchange, routing_key="render.premium", queue_arguments={"x-max-priority": 10}),
        Queue("standard_jobs", _default_exchange, routing_key="render.standard", queue_arguments={"x-max-priority": 5}),
        Queue("draft_preview", _default_exchange, routing_key="render.draft", queue_arguments={"x-max-priority": 1}),
    ),
    task_default_queue="standard_jobs",
    task_default_exchange="viral_trending_exchange",
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
