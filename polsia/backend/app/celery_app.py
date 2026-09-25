"""Celery application and the swarm's autonomous schedule."""

from celery import Celery
from celery.schedules import crontab
from celery.signals import worker_init

from app.config import settings

celery_app = Celery("polsia", broker=settings.REDIS_URL or "memory://", backend=settings.REDIS_URL or None, include=["app.tasks"])

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Without a broker (local dev, tests) tasks run inline in the caller.
    task_always_eager=not settings.REDIS_URL,
    task_eager_propagates=False,
    beat_schedule={
        "morning-orchestration": {"task": "app.tasks.run_morning_orchestration", "schedule": crontab(minute=0, hour=6)},
        "finance-audit": {
            "task": "app.tasks.execute_agent_task",
            "schedule": crontab(minute=0, hour=8),
            "args": (None, "FinanceAgent", "Audit revenue, churn and failed payments for the last 30 days.", "schedule"),
        },
        "ads-rebalance": {
            "task": "app.tasks.execute_agent_task",
            "schedule": crontab(minute=30, hour=9),
            "args": (None, "AdsAgent", "Rebalance today's ad budget using the latest ROAS posteriors.", "schedule"),
        },
        "competitor-scan": {"task": "app.tasks.scan_competitors", "schedule": crontab(minute=15, hour="*/6")},
        "pre-demo-briefings": {"task": "app.tasks.generate_due_briefings", "schedule": crontab(minute="*/15")},
        "canary-sweep": {"task": "app.tasks.sweep_canaries", "schedule": crontab(minute="*")},
    },
)


@worker_init.connect
def _ensure_schema(**_: object) -> None:
    # Beat can fire before the API has ever started against a fresh database.
    from app.db import init_db

    init_db()
