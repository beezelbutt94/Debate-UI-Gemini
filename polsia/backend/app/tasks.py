"""Celery tasks. Each is a thin shell around a domain module so the logic stays testable."""

import logging

from app import competitors, sales, sre, support
from app.agents import create_run, get_agent
from app.celery_app import celery_app

logger = logging.getLogger("polsia.tasks")


def outcome(result) -> dict:
    """Inline (eager) runs return their result; queued runs return the task id."""
    if not result.ready():
        return {"task_id": result.id, "status": "queued"}
    if result.failed():
        raise RuntimeError(f"Task failed: {result.result}")
    return result.result


def enqueue_agent_run(agent: str, instruction: str, trigger: str = "manual") -> str:
    get_agent(agent)  # fail fast on unknown agents, before a run row exists
    run_id = create_run(agent, instruction, trigger)
    execute_agent_task.delay(run_id, agent, instruction, trigger)
    return run_id


@celery_app.task(name="app.tasks.execute_agent_task")
def execute_agent_task(run_id: str | None, agent: str, instruction: str, trigger: str = "manual") -> dict:
    return get_agent(agent).run(instruction, run_id=run_id, trigger=trigger)


@celery_app.task(name="app.tasks.run_morning_orchestration")
def run_morning_orchestration() -> dict:
    from app.orchestrator import run_morning_cycle

    return run_morning_cycle()


@celery_app.task(name="app.tasks.triage_ticket")
def triage_ticket(ticket_id: str) -> dict:
    return support.triage(ticket_id)


@celery_app.task(name="app.tasks.process_calcom_event")
def process_calcom_event(trigger: str, payload: dict) -> dict:
    return sales.handle_booking_event(trigger, payload)


@celery_app.task(name="app.tasks.generate_due_briefings")
def generate_due_briefings() -> list[str]:
    done = []
    for booking_id in sales.due_bookings():
        try:
            sales.generate_briefing(booking_id)
            done.append(booking_id)
        except Exception:
            logger.exception("Briefing failed for booking %s", booking_id)
    return done


@celery_app.task(name="app.tasks.generate_briefing")
def generate_briefing(booking_id: str) -> dict:
    return sales.generate_briefing(booking_id)


@celery_app.task(name="app.tasks.handle_incident")
def handle_incident(source: str, title: str, culprit: str | None, environment: str | None, release: str | None) -> dict:
    return sre.handle_incident(source, title, culprit, environment, release)


@celery_app.task(name="app.tasks.evaluate_canary")
def evaluate_canary(canary_id: str) -> dict:
    return sre.evaluate_canary(canary_id)


@celery_app.task(name="app.tasks.sweep_canaries")
def sweep_canaries() -> list[dict]:
    return sre.sweep_canaries()


@celery_app.task(name="app.tasks.scan_competitors")
def scan_competitors() -> list[dict]:
    results = []
    for target in competitors.list_targets():
        try:
            results.append(competitors.check_target(target["id"]))
        except Exception as exc:
            logger.exception("Competitor check failed for %s", target["name"])
            results.append({"target": target["name"], "status": "error", "error": str(exc)})
    return results
