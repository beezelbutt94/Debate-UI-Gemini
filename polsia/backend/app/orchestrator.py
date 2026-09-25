"""Master Orchestrator: reads the last 24h of telemetry and delegates the day's work."""

from datetime import timedelta
from typing import Any

from sqlalchemy import func, select

from app import bandit, budget, db, events, finance
from app.models import ActionApproval, AgentRun, DemoBooking, ExecutiveBriefing, IncidentRecord, MarketIntelligence, SupportTicket, iso, utcnow
from app.runner import run_claude

MAX_DELEGATED_TASKS = 5
NAME = "MasterOrchestrator"


def telemetry() -> dict[str, Any]:
    now = utcnow()
    since = now - timedelta(hours=24)
    with db.session_scope() as session:
        runs = dict(session.execute(select(AgentRun.status, func.count(AgentRun.id)).where(AgentRun.created_at >= since).group_by(AgentRun.status)).all())
        pending = session.scalar(select(func.count(ActionApproval.id)).where(ActionApproval.status == "PENDING"))
        tickets = session.scalar(select(func.count(SupportTicket.id)).where(SupportTicket.created_at >= since))
        bugs = session.scalar(select(func.count(SupportTicket.id)).where(SupportTicket.created_at >= since, SupportTicket.is_bug.is_(True)))
        incidents = [i.title for i in session.scalars(select(IncidentRecord).where(IncidentRecord.created_at >= since).limit(5))]
        intel = [
            {"competitor": m.competitor, "threat": m.threat_level, "headline": m.headline}
            for m in session.scalars(select(MarketIntelligence).where(MarketIntelligence.created_at >= since).limit(5))
        ]
        demos = [
            {"company": b.customer.company_name, "start": iso(b.start_time)}
            for b in session.scalars(
                select(DemoBooking).where(DemoBooking.start_time.between(now, now + timedelta(hours=24)), DemoBooking.status == "ACCEPTED")
            )
        ]
    return {
        "agent_runs_24h": runs,
        "pending_approvals": int(pending or 0),
        "support_tickets_24h": int(tickets or 0),
        "bugs_reported_24h": int(bugs or 0),
        "incidents_24h": incidents,
        "competitor_intel_24h": intel,
        "demos_next_24h": demos,
        "finance": finance.summary(),
        "llm_spend_today_usd": float(budget.spend_today()),
        "ad_campaigns": [{"name": a["name"], "daily_budget_usd": a["daily_budget_usd"]} for a in bandit.state()],
    }


def _simulated_plan(snapshot: dict[str, Any]) -> dict[str, Any]:
    tasks = [{"agent": "FinanceAgent", "instruction": "Audit the last 30 days of revenue, churn and failed payments."}]
    if snapshot["ad_campaigns"]:
        tasks.append({"agent": "AdsAgent", "instruction": "Rebalance today's ad budget using the latest ROAS posteriors."})
    focus = "Resolve reported bugs before new growth work" if snapshot["bugs_reported_24h"] else "Grow pipeline while keeping spend flat"
    return {
        "okr_focus": focus,
        "summary": f"{snapshot['pending_approvals']} approvals pending, {snapshot['support_tickets_24h']} tickets and "
        f"{len(snapshot['incidents_24h'])} incidents in 24h. Delegating {len(tasks)} tasks.",
        "delegated_tasks": tasks,
    }


def run_morning_cycle() -> dict[str, Any]:
    from app.agents import AGENTS
    from app.tasks import enqueue_agent_run

    snapshot = telemetry()
    prompt = (
        "You are the Master Orchestrator (CEO) of an autonomous company. Using the telemetry, pick today's "
        f"single OKR focus and delegate at most {MAX_DELEGATED_TASKS} concrete tasks.\n"
        f"Agents you can delegate to: {', '.join(AGENTS)}.\n\n"
        f"Telemetry:\n{snapshot}\n\n"
        'Reply with ONLY: {"okr_focus": "...", "summary": "...", "delegated_tasks": [{"agent": "...", "instruction": "..."}]}'
    )
    plan = run_claude(prompt, agent=NAME, simulated_response=_simulated_plan(snapshot)).json()

    # Only delegate to agents that exist; the model does not get to invent staff.
    tasks = [t for t in plan.get("delegated_tasks", []) if isinstance(t, dict) and t.get("agent") in AGENTS and t.get("instruction")]
    tasks = tasks[:MAX_DELEGATED_TASKS]
    with db.session_scope() as session:
        briefing = ExecutiveBriefing(
            okr_focus=str(plan.get("okr_focus", "")),
            summary=str(plan.get("summary", "")),
            delegated_tasks=tasks,
            metrics_snapshot=snapshot,
        )
        session.add(briefing)
        session.flush()
        briefing_id = briefing.id

    run_ids = [enqueue_agent_run(t["agent"], t["instruction"], trigger="orchestrator") for t in tasks]
    events.publish("MORNING_BRIEFING", briefing_id=briefing_id, okr_focus=plan.get("okr_focus"), delegated=len(run_ids))
    return {"briefing_id": briefing_id, "okr_focus": plan.get("okr_focus"), "run_ids": run_ids}


def latest_briefing() -> dict[str, Any] | None:
    with db.session_scope() as session:
        b = session.scalar(select(ExecutiveBriefing).order_by(ExecutiveBriefing.created_at.desc()).limit(1))
        if b is None:
            return None
        return {
            "id": b.id,
            "okr_focus": b.okr_focus,
            "summary": b.summary,
            "delegated_tasks": b.delegated_tasks,
            "metrics_snapshot": b.metrics_snapshot,
            "created_at": iso(b.created_at),
        }
