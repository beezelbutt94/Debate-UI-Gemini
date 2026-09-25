"""The agent loop: recall -> generate -> verify -> gate -> dispatch.

Every agent proposes at most one action per run. The proposal is checked
twice before anything happens: structurally (the payload must validate against
the action's schema and the action must be on the agent's allow-list) and by
a separate verifier pass that audits it against the soul contract. Actions an
agent may take on its own execute immediately; everything else becomes a
pending approval for a human.
"""

import json
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal

from app import approvals, bandit, db, dispatcher, events, finance
from app.budget import BudgetExceededError
from app.config import settings
from app.memory import AgentMemory
from app.models import AgentRun, iso, utcnow
from app.runner import ClaudeExecutionError, run_claude

Gate = Literal["approval", "auto"]


def load_soul() -> str:
    try:
        return settings.SOUL_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        return "Reply with a single JSON object: thought, action_type, payload, summary."


@dataclass
class AgentSpec:
    name: str
    role: str
    actions: dict[str, Gate] = field(default_factory=dict)
    tools: list[str] = field(default_factory=list)
    context: Callable[[], str] | None = None
    # Deterministic decision used in LLM_MODE=simulated: (instruction) -> decision
    simulate: Callable[[str], dict[str, Any]] | None = None


def serialize_run(run: AgentRun) -> dict[str, Any]:
    return {
        "id": run.id,
        "agent": run.agent,
        "instruction": run.instruction,
        "trigger": run.trigger,
        "status": run.status,
        "thought": run.thought,
        "summary": run.summary,
        "action_type": run.action_type,
        "action_payload": run.action_payload,
        "verification": run.verification,
        "result": run.result,
        "error": run.error,
        "cost_usd": run.cost_usd,
        "created_at": iso(run.created_at),
        "finished_at": iso(run.finished_at),
    }


def create_run(agent: str, instruction: str, trigger: str = "manual") -> str:
    with db.session_scope() as session:
        run = AgentRun(agent=agent, instruction=instruction, trigger=trigger)
        session.add(run)
        session.flush()
        data = serialize_run(run)
    events.publish("TASK_QUEUED", run=data)
    return data["id"]


def _update_run(run_id: str, **fields: Any) -> dict[str, Any]:
    with db.session_scope() as session:
        run = session.get(AgentRun, run_id)
        for key, value in fields.items():
            setattr(run, key, value)
        return serialize_run(run)


class Agent:
    def __init__(self, spec: AgentSpec):
        self.spec = spec
        self.memory = AgentMemory(spec.name)

    @property
    def name(self) -> str:
        return self.spec.name

    # --- prompts -------------------------------------------------------------

    def _action_catalog(self) -> str:
        if not self.spec.actions:
            return "You have no external actions. Always use action_type NONE and put your analysis in summary."
        lines = []
        for action, gate in self.spec.actions.items():
            schema = dispatcher.ACTIONS[action][0].model_json_schema()
            gate_note = "executes immediately" if gate == "auto" else "queued for human approval"
            lines.append(f"- {action} ({gate_note}); payload schema: {json.dumps(schema, separators=(',', ':'))}")
        return "Allowed actions (or NONE):\n" + "\n".join(lines)

    def _generate_prompt(self, instruction: str, recall: str, context: str, feedback: str | None) -> str:
        parts = [
            f"You are {self.name}. Role: {self.spec.role}",
            self._action_catalog(),
            f"Relevant memory from earlier runs:\n{recall}",
        ]
        if context:
            parts.append(f"Live context:\n{context}")
        parts.append(f"Task:\n{instruction}")
        if feedback:
            parts.append(f"Your previous proposal was rejected by the verifier:\n{feedback}\nAddress this.")
        parts.append('Reply with ONLY: {"thought": "...", "action_type": "...", "payload": {...}, "summary": "..."}')
        return "\n\n".join(parts)

    def _verify(self, instruction: str, decision: dict[str, Any], run_id: str) -> dict[str, Any]:
        prompt = (
            "You are the verifier for an autonomous agent. Audit the proposed action below "
            "against the operating contract in your system prompt.\n"
            f"Agent: {self.name}\nTask: {instruction}\n"
            f"Proposal:\n{json.dumps(decision, indent=2)}\n\n"
            "Reject if it invents facts, contains hype or filler, is unsafe or irreversible without "
            "cause, exceeds spend limits, or does not address the task.\n"
            'Reply with ONLY: {"approved": true|false, "feedback": "one or two sentences"}'
        )
        result = run_claude(
            prompt,
            agent=self.name,
            run_id=run_id,
            system_prompt=load_soul(),
            simulated_response={"approved": True, "feedback": "Proposal is specific and within bounds."},
        )
        verdict = result.json()
        return {"approved": bool(verdict.get("approved")), "feedback": str(verdict.get("feedback", ""))}

    # --- loop ----------------------------------------------------------------

    def _propose(self, instruction: str, run_id: str, recall: str, context: str, feedback: str | None) -> dict[str, Any]:
        simulated = self.spec.simulate(instruction) if self.spec.simulate else None
        result = run_claude(
            self._generate_prompt(instruction, recall, context, feedback),
            agent=self.name,
            run_id=run_id,
            system_prompt=load_soul(),
            allowed_tools=self.spec.tools,
            simulated_response=simulated,
        )
        decision = result.json()
        decision.setdefault("action_type", "NONE")
        decision.setdefault("payload", {})
        decision["action_type"] = str(decision["action_type"] or "NONE").upper()
        return decision

    def _check(self, instruction: str, decision: dict[str, Any], run_id: str) -> dict[str, Any]:
        """Structural validation first (free), then the verifier model pass."""
        action = decision["action_type"]
        if action == "NONE":
            return {"approved": True, "feedback": "No action proposed."}
        if action not in self.spec.actions:
            return {"approved": False, "feedback": f"{action} is not an allowed action for {self.name}."}
        try:
            decision["payload"] = dispatcher.validate(action, decision["payload"])
        except dispatcher.InvalidActionError as exc:
            return {"approved": False, "feedback": str(exc)}
        return self._verify(instruction, decision, run_id)

    def run(self, instruction: str, run_id: str | None = None, trigger: str = "manual") -> dict[str, Any]:
        run_id = run_id or create_run(self.name, instruction, trigger)
        started = _update_run(run_id, status="RUNNING")
        events.publish("TASK_START", run=started)
        try:
            recall = self.memory.recall(instruction)
            context = self.spec.context() if self.spec.context else ""
            decision = self._propose(instruction, run_id, recall, context, None)
            verification = self._check(instruction, decision, run_id)
            if not verification["approved"]:
                decision = self._propose(instruction, run_id, recall, context, verification["feedback"])
                verification = self._check(instruction, decision, run_id)
            final = self._act(decision, verification, run_id)
        except BudgetExceededError as exc:
            final = {"status": "BLOCKED", "error": str(exc)}
            decision, verification = {}, None
        except (ClaudeExecutionError, ValueError) as exc:
            final = {"status": "FAILED", "error": str(exc)}
            decision, verification = {}, None

        summary = decision.get("summary")
        if summary:
            self.memory.remember(f"Task: {instruction[:300]} | Outcome ({final['status']}): {summary[:500]}", run_id)
        finished = _update_run(
            run_id,
            status=final["status"],
            thought=decision.get("thought"),
            summary=summary,
            action_type=decision.get("action_type"),
            action_payload=decision.get("payload") or None,
            verification=verification,
            result=final.get("result"),
            error=final.get("error"),
            cost_usd=_run_cost(run_id),
            finished_at=utcnow(),
        )
        events.publish("TASK_COMPLETE", run=finished)
        return finished

    def _act(self, decision: dict[str, Any], verification: dict[str, Any], run_id: str) -> dict[str, Any]:
        action = decision["action_type"]
        if not verification["approved"]:
            return {"status": "REJECTED", "error": f"Verifier rejected twice: {verification['feedback']}"}
        if action == "NONE":
            return {"status": "COMPLETED"}
        if self.spec.actions[action] == "approval":
            approval_id = approvals.request(self.name, action, decision["payload"], run_id=run_id, reason=decision.get("summary"))
            return {"status": "APPROVAL_REQUIRED", "result": {"approval_id": approval_id}}
        try:
            return {"status": "EXECUTED", "result": dispatcher.dispatch(action, decision["payload"], run_id=run_id)}
        except Exception as exc:
            return {"status": "FAILED", "error": f"{action} failed: {exc}"}


def _run_cost(run_id: str) -> float:
    from sqlalchemy import func, select

    from app.models import LLMTokenRecord

    with db.session_scope() as session:
        return float(session.scalar(select(func.coalesce(func.sum(LLMTokenRecord.cost_usd), 0)).where(LLMTokenRecord.run_id == run_id)))


# --- Catalog -----------------------------------------------------------------

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def _sim_code(instruction: str) -> dict[str, Any]:
    repo = settings.DEFAULT_REPO or "acme/app"
    title = instruction.strip().split("\n")[0][:80]
    return {
        "thought": f"The task describes a code change in {repo}; a PR is the right vehicle.",
        "action_type": "CREATE_PR",
        "payload": {"repo": repo, "title": title, "description": f"Requested change: {instruction.strip()}"},
        "summary": f"Proposed a PR against {repo}: {title}",
    }


def _sim_social(instruction: str) -> dict[str, Any]:
    topic = instruction.strip().rstrip(".")[:180]
    return {
        "thought": "A two-post thread keeps the update concrete.",
        "action_type": "POST_THREAD",
        "payload": {"posts": [f"Shipping log: {topic}.", "Details and changelog are on the blog. Feedback welcome."]},
        "summary": f"Drafted a 2-post thread about: {topic[:80]}",
    }


def _sim_outreach(instruction: str) -> dict[str, Any]:
    match = _EMAIL.search(instruction)
    if not match:
        return {"thought": "No recipient address in the task.", "action_type": "NONE", "payload": {}, "summary": "Skipped: no recipient email provided."}
    to = match.group(0).rstrip(".")
    return {
        "thought": f"Personalised first-touch email to {to}.",
        "action_type": "SEND_EMAIL",
        "payload": {
            "to_email": to,
            "subject": "Running ops without adding headcount",
            "body": "Hi,\n\nWe run engineering, support and growth tasks with an agent swarm that asks a human before anything irreversible. "
            "Worth a 20-minute look?\n\nThanks",
        },
        "summary": f"Drafted outreach email to {to}.",
    }


def _sim_finance(instruction: str) -> dict[str, Any]:
    s = finance.summary()
    return {
        "thought": "Summarising the ledger.",
        "action_type": "NONE",
        "payload": {},
        "summary": f"Net revenue 30d ${s['net_revenue_30d_usd']:.2f}; {s['churned_subscriptions_30d']} churned; {s['failed_payments_30d']} failed payments.",
    }


def _sim_ads(instruction: str) -> dict[str, Any]:
    plan = bandit.recommend(seed=7)
    if not plan:
        return {"thought": "No campaigns registered.", "action_type": "NONE", "payload": {}, "summary": "No ad campaigns to optimise."}
    return {
        "thought": "Allocating by Thompson-sampling probability of being the best arm.",
        "action_type": "UPDATE_AD_BUDGETS",
        "payload": {"allocations": [{"campaign_id": p["campaign_id"], "daily_budget_usd": p["daily_budget_usd"]} for p in plan]},
        "summary": "Rebalanced: " + ", ".join(f"{p['name']} ${p['daily_budget_usd']:.0f}" for p in plan),
    }


def _ads_context() -> str:
    plan = bandit.recommend(seed=None)
    return "Thompson-sampling recommendation (share of daily budget):\n" + json.dumps(plan, indent=1) if plan else "No campaigns registered."


def _finance_context() -> str:
    return json.dumps(finance.summary())


SPECS = [
    AgentSpec(
        name="CodeGenerationAgent",
        role="Turns bug reports and feature requests into small, reviewed pull requests.",
        actions={"CREATE_PR": "approval"},
        tools=["Read", "Glob", "Grep"],
        simulate=_sim_code,
    ),
    AgentSpec(
        name="SocialMediaAgent",
        role="Writes build-in-public updates grounded in what actually shipped.",
        actions={"POST_THREAD": "approval"},
        simulate=_sim_social,
    ),
    AgentSpec(
        name="OutreachAgent",
        role="Writes short, specific first-touch sales emails to named prospects.",
        actions={"SEND_EMAIL": "approval"},
        simulate=_sim_outreach,
    ),
    AgentSpec(
        name="FinanceAgent",
        role="Audits revenue, churn and failed payments and flags anomalies.",
        context=_finance_context,
        simulate=_sim_finance,
    ),
    AgentSpec(
        name="AdsAgent",
        role="Reallocates the daily ad budget toward campaigns with the best return.",
        actions={"UPDATE_AD_BUDGETS": "approval"},
        context=_ads_context,
        simulate=_sim_ads,
    ),
]

AGENTS: dict[str, Agent] = {spec.name: Agent(spec) for spec in SPECS}


def get_agent(name: str) -> Agent:
    try:
        return AGENTS[name]
    except KeyError:
        raise LookupError(f"Unknown agent '{name}'. Known: {', '.join(AGENTS)}") from None
