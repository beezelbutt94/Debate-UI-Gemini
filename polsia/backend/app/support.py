"""Support triage: answer from the knowledge base, and turn real bugs into fix PRs."""

import re
from typing import Any

from app import approvals, db, events
from app.config import settings
from app.memory import KnowledgeBase
from app.models import SupportTicket
from app.runner import run_claude

NAME = "SupportAgent"
_BUG_SIGNALS = re.compile(r"\b(error|exception|crash|500|broken|typeerror|traceback|fails?|bug)\b", re.I)


def _simulated_triage(subject: str, body: str) -> dict[str, Any]:
    is_bug = bool(_BUG_SIGNALS.search(f"{subject} {body}"))
    result: dict[str, Any] = {
        "reply_draft": "Thanks for the report. We've reproduced this and an engineer-reviewed fix is in progress."
        if is_bug
        else "Thanks for reaching out. The answer is in our FAQ; reply here if anything is still unclear.",
        "is_bug": is_bug,
        "escalate": False,
    }
    if is_bug:
        result["bug"] = {"title": subject[:80], "description": f"Customer report: {body}"}
    return result


def triage(ticket_id: str) -> dict[str, Any]:
    with db.session_scope() as session:
        ticket = session.get(SupportTicket, ticket_id)
        if ticket is None:
            raise LookupError(ticket_id)
        email, subject, body = ticket.customer_email, ticket.subject, ticket.body

    docs = KnowledgeBase().search(f"{subject}\n{body}")
    prompt = (
        "You are the customer support agent. Draft a reply grounded ONLY in the documentation below; "
        "if the docs don't cover it, say a human will follow up. Decide whether this is a product bug.\n\n"
        f"From: {email}\nSubject: {subject}\n\n{body}\n\nDocumentation:\n{docs}\n\n"
        'Reply with ONLY: {"reply_draft": "...", "is_bug": true|false, "escalate": true|false, '
        '"bug": {"title": "...", "description": "steps, expected, actual"} (only when is_bug)}'
    )
    result = run_claude(prompt, agent=NAME, simulated_response=_simulated_triage(subject, body)).json()

    approval_id = None
    bug = result.get("bug") if result.get("is_bug") else None
    if bug and settings.DEFAULT_REPO:
        approval_id = approvals.request(
            "CodeGenerationAgent",
            "CREATE_PR",
            {
                "repo": settings.DEFAULT_REPO,
                "title": str(bug.get("title") or subject)[:200],
                "description": f"{bug.get('description') or body}\n\nReported by {email} (ticket {ticket_id}).",
            },
            reason=f"Bug reported in support ticket {ticket_id}",
        )

    escalate = bool(result.get("escalate")) or (bug is not None and approval_id is None)
    with db.session_scope() as session:
        ticket = session.get(SupportTicket, ticket_id)
        ticket.reply_draft = str(result.get("reply_draft", ""))
        ticket.is_bug = bool(result.get("is_bug"))
        ticket.escalate = escalate
        ticket.approval_id = approval_id
        ticket.status = "ESCALATED" if escalate else "TRIAGED"
        out = {
            "ticket_id": ticket_id,
            "status": ticket.status,
            "is_bug": ticket.is_bug,
            "reply_draft": ticket.reply_draft,
            "approval_id": approval_id,
        }
    events.publish("SUPPORT_TRIAGED", ticket=out)
    return out
