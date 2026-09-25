"""Human-in-the-loop gate for high-stakes actions."""

from typing import Any

from sqlalchemy import select, update

from app import db, dispatcher, events
from app.models import ActionApproval, AgentRun, IncidentRecord, SupportTicket, iso, utcnow


class ApprovalError(RuntimeError):
    pass


def serialize(a: ActionApproval) -> dict[str, Any]:
    return {
        "id": a.id,
        "run_id": a.run_id,
        "agent": a.agent,
        "action_type": a.action_type,
        "payload": a.payload,
        "reason": a.reason,
        "status": a.status,
        "result": a.result,
        "created_at": iso(a.created_at),
        "resolved_at": iso(a.resolved_at),
    }


def request(agent: str, action_type: str, payload: dict[str, Any], *, run_id: str | None = None, reason: str | None = None) -> str:
    clean = dispatcher.validate(action_type, payload)
    with db.session_scope() as session:
        approval = ActionApproval(agent=agent, action_type=action_type, payload=clean, run_id=run_id, reason=reason)
        session.add(approval)
        session.flush()
        data = serialize(approval)
    events.publish("APPROVAL_REQUESTED", approval=data)
    return data["id"]


def list_pending() -> list[dict[str, Any]]:
    with db.session_scope() as session:
        rows = session.scalars(select(ActionApproval).where(ActionApproval.status == "PENDING").order_by(ActionApproval.created_at))
        return [serialize(a) for a in rows]


def resolve(approval_id: str, decision: str) -> dict[str, Any]:
    if decision not in ("APPROVE", "REJECT"):
        raise ApprovalError("decision must be APPROVE or REJECT")

    # Claim the row atomically so a double-click can't execute an action twice.
    claimed_status = "EXECUTING" if decision == "APPROVE" else "REJECTED"
    with db.session_scope() as session:
        claimed = session.execute(
            update(ActionApproval)
            .where(ActionApproval.id == approval_id, ActionApproval.status == "PENDING")
            .values(status=claimed_status, resolved_at=utcnow())
        ).rowcount
        approval = session.get(ActionApproval, approval_id)
        if approval is None:
            raise LookupError(approval_id)
        if not claimed:
            raise ApprovalError(f"Approval is already {approval.status}")
        action_type, payload, run_id = approval.action_type, dict(approval.payload), approval.run_id

    result: dict[str, Any] | None = None
    if decision == "APPROVE":
        try:
            result = dispatcher.dispatch(action_type, payload, run_id=run_id)
            final = "EXECUTED"
        except Exception as exc:  # adapter failure is recorded, not raised to the reviewer
            result = {"status": "error", "error": str(exc)}
            final = "FAILED"
    else:
        final = "REJECTED"

    from app.agents import serialize_run

    run_data = None
    with db.session_scope() as session:
        approval = session.get(ActionApproval, approval_id)
        approval.status = final
        approval.result = result
        if run_id and (run := session.get(AgentRun, run_id)):
            run.status = final
            run.result = result
            run_data = serialize_run(run)
        _apply_side_effects(session, approval_id, final, result)
        data = serialize(approval)
    # Carry the run so live feeds can update its card without refetching.
    events.publish("APPROVAL_RESOLVED", approval=data, run=run_data)
    return data


def _apply_side_effects(session, approval_id: str, final: str, result: dict[str, Any] | None) -> None:
    incident = session.scalar(select(IncidentRecord).where(IncidentRecord.approval_id == approval_id))
    if incident:
        if final == "EXECUTED":
            incident.status = "REVERT_OPENED"
            incident.revert_pr_url = (result or {}).get("pr_url")
        else:
            incident.status = "REVERT_DECLINED" if final == "REJECTED" else "REVERT_FAILED"
    ticket = session.scalar(select(SupportTicket).where(SupportTicket.approval_id == approval_id))
    if ticket and final == "EXECUTED":
        ticket.status = "FIX_PR_OPENED"
