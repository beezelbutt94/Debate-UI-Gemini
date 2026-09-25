"""Per-agent token spend attribution and daily budget cutoffs."""

from decimal import Decimal

from sqlalchemy import func, select

from app import db
from app.config import settings
from app.models import LLMTokenRecord, utcnow

# USD per million tokens. Used only when the CLI result carries no
# `total_cost_usd`. Cache reads bill at 0.1x input, cache writes at 1.25x.
PRICING_PER_MTOK: dict[str, tuple[Decimal, Decimal]] = {
    "claude-fable-5-1": (Decimal("10"), Decimal("50")),
    "claude-opus-5-5": (Decimal("4"), Decimal("20")),
    "claude-opus-5": (Decimal("5"), Decimal("25")),
    "claude-sonnet-5": (Decimal("2"), Decimal("10")),
    "claude-haiku-4-5": (Decimal("1"), Decimal("5")),
}


class BudgetExceededError(RuntimeError):
    pass


def estimate_cost(model: str, input_tokens: int, output_tokens: int, cache_read: int = 0, cache_creation: int = 0) -> Decimal:
    # Longest prefix first so "claude-opus-5-5" doesn't match "claude-opus-5".
    rates = next(
        (r for key, r in sorted(PRICING_PER_MTOK.items(), key=lambda kv: -len(kv[0])) if model.startswith(key)),
        PRICING_PER_MTOK["claude-opus-5"],
    )
    input_rate, output_rate = rates
    million = Decimal(1_000_000)
    cost = (
        Decimal(input_tokens) * input_rate
        + Decimal(output_tokens) * output_rate
        + Decimal(cache_read) * input_rate * Decimal("0.1")
        + Decimal(cache_creation) * input_rate * Decimal("1.25")
    ) / million
    return cost.quantize(Decimal("0.000001"))


def spend_today(agent: str | None = None) -> Decimal:
    today = utcnow().date()
    stmt = select(func.coalesce(func.sum(LLMTokenRecord.cost_usd), 0)).where(LLMTokenRecord.day == today)
    if agent:
        stmt = stmt.where(LLMTokenRecord.agent == agent)
    with db.session_scope() as session:
        return Decimal(str(session.execute(stmt).scalar_one()))


def check_preflight(agent: str) -> None:
    """Refuse to start a model call once the agent or the whole swarm is over budget."""
    agent_spend = spend_today(agent)
    if agent_spend >= Decimal(str(settings.DAILY_AGENT_BUDGET_USD)):
        raise BudgetExceededError(f"{agent} spent ${agent_spend:.2f} today; cap is ${settings.DAILY_AGENT_BUDGET_USD:.2f}")
    total = spend_today()
    if total >= Decimal(str(settings.DAILY_GLOBAL_BUDGET_USD)):
        raise BudgetExceededError(f"Swarm spent ${total:.2f} today; global cap is ${settings.DAILY_GLOBAL_BUDGET_USD:.2f}")


def record_usage(
    *,
    agent: str,
    model: str,
    run_id: str | None,
    usage: dict,
    reported_cost_usd: float | None,
    simulated: bool,
) -> Decimal:
    input_tokens = int(usage.get("input_tokens") or 0)
    output_tokens = int(usage.get("output_tokens") or 0)
    cache_read = int(usage.get("cache_read_input_tokens") or 0)
    cache_creation = int(usage.get("cache_creation_input_tokens") or 0)
    if simulated:
        cost = Decimal(0)
    elif reported_cost_usd is not None:
        cost = Decimal(str(reported_cost_usd)).quantize(Decimal("0.000001"))
    else:
        cost = estimate_cost(model, input_tokens, output_tokens, cache_read, cache_creation)
    with db.session_scope() as session:
        session.add(
            LLMTokenRecord(
                run_id=run_id,
                agent=agent,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cache_read_tokens=cache_read,
                cache_creation_tokens=cache_creation,
                cost_usd=cost,
                simulated=simulated,
            )
        )
    return cost


def spend_report() -> dict:
    today = utcnow().date()
    stmt = (
        select(
            LLMTokenRecord.agent,
            func.coalesce(func.sum(LLMTokenRecord.cost_usd), 0),
            func.coalesce(func.sum(LLMTokenRecord.input_tokens + LLMTokenRecord.output_tokens), 0),
            func.count(LLMTokenRecord.id),
        )
        .where(LLMTokenRecord.day == today)
        .group_by(LLMTokenRecord.agent)
    )
    with db.session_scope() as session:
        rows = session.execute(stmt).all()
    agents = [
        {
            "agent": agent,
            "cost_usd": float(cost),
            "tokens": int(tokens),
            "calls": int(calls),
            "cap_usd": settings.DAILY_AGENT_BUDGET_USD,
            "locked": float(cost) >= settings.DAILY_AGENT_BUDGET_USD,
        }
        for agent, cost, tokens, calls in rows
    ]
    return {
        "day": today.isoformat(),
        "total_usd": sum(a["cost_usd"] for a in agents),
        "global_cap_usd": settings.DAILY_GLOBAL_BUDGET_USD,
        "agents": sorted(agents, key=lambda a: -a["cost_usd"]),
    }
