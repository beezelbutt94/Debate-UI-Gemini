"""Agents, runs, approvals, the orchestrator and LLM spend."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select

from app import approvals, budget, db, orchestrator
from app.agents import AGENTS, serialize_run
from app.models import AgentRun
from app.security import require_operator
from app.tasks import enqueue_agent_run, outcome, run_morning_orchestration

router = APIRouter(dependencies=[Depends(require_operator)], tags=["swarm"])


class RunRequest(BaseModel):
    agent: str
    instruction: str = Field(min_length=3, max_length=4000)


class ResolveRequest(BaseModel):
    decision: str = Field(pattern="^(APPROVE|REJECT)$")


@router.get("/agents")
def list_agents() -> list[dict[str, Any]]:
    return [{"name": a.name, "role": a.spec.role, "actions": a.spec.actions} for a in AGENTS.values()]


@router.post("/agents/run", status_code=202)
def run_agent(req: RunRequest) -> dict[str, str]:
    if req.agent not in AGENTS:
        raise HTTPException(404, f"Unknown agent '{req.agent}'")
    return {"run_id": enqueue_agent_run(req.agent, req.instruction, trigger="manual")}


@router.get("/runs")
def list_runs(limit: int = Query(50, le=200), agent: str | None = None) -> list[dict[str, Any]]:
    stmt = select(AgentRun).order_by(AgentRun.created_at.desc()).limit(limit)
    if agent:
        stmt = stmt.where(AgentRun.agent == agent)
    with db.session_scope() as session:
        return [serialize_run(r) for r in session.scalars(stmt)]


@router.get("/runs/{run_id}")
def get_run(run_id: str) -> dict[str, Any]:
    with db.session_scope() as session:
        run = session.get(AgentRun, run_id)
        if run is None:
            raise HTTPException(404, "Run not found")
        return serialize_run(run)


@router.get("/approvals/pending")
def pending_approvals() -> list[dict[str, Any]]:
    return approvals.list_pending()


@router.post("/approvals/{approval_id}/resolve")
def resolve_approval(approval_id: str, req: ResolveRequest) -> dict[str, Any]:
    try:
        return approvals.resolve(approval_id, req.decision)
    except LookupError:
        raise HTTPException(404, "Approval not found") from None
    except approvals.ApprovalError as exc:
        raise HTTPException(409, str(exc)) from None


@router.post("/orchestrator/run", status_code=202)
def trigger_orchestrator() -> dict[str, Any]:
    return outcome(run_morning_orchestration.delay())


@router.get("/orchestrator/briefing")
def latest_briefing() -> dict[str, Any] | None:
    return orchestrator.latest_briefing()


@router.get("/spend")
def spend() -> dict[str, Any]:
    return budget.spend_report()
