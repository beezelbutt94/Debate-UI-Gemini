"""Thompson-sampling budget allocation across ad campaigns.

Each campaign's log(ROAS) has a Normal posterior. A reporting period with spend
`s` and revenue `r` is one observation y = log(r / s) whose noise shrinks as
spend grows (more spend -> more conversions -> a steadier ratio). Budget is
split in proportion to each arm's probability of being the best arm, with a
floor so no campaign is starved of the data needed to change our mind.
"""

import math
import random
from typing import Any

from sqlalchemy import select

from app import db
from app.config import settings
from app.models import AdArm

PRIOR_MU = math.log(1.5)  # prior belief: campaigns return ~1.5x
PRIOR_SIGMA = 0.6
OBS_SIGMA_AT_REF = 0.5  # noise of one observation at REF_SPEND
REF_SPEND = 100.0


def register_arm(campaign_id: str, name: str, platform: str = "meta") -> None:
    with db.session_scope() as session:
        if session.get(AdArm, campaign_id) is None:
            session.add(AdArm(campaign_id=campaign_id, name=name, platform=platform, mu=PRIOR_MU, sigma=PRIOR_SIGMA))


def observe(campaign_id: str, spend_usd: float, revenue_usd: float) -> dict[str, float]:
    if spend_usd <= 0:
        raise ValueError("spend must be positive to observe ROAS")
    y = math.log(max(revenue_usd, 0.01) / spend_usd)
    obs_var = OBS_SIGMA_AT_REF**2 * (REF_SPEND / spend_usd)
    with db.session_scope() as session:
        arm = session.get(AdArm, campaign_id)
        if arm is None:
            raise LookupError(campaign_id)
        prior_prec = 1 / arm.sigma**2
        post_prec = prior_prec + 1 / obs_var
        arm.mu = (arm.mu * prior_prec + y / obs_var) / post_prec
        arm.sigma = math.sqrt(1 / post_prec)
        arm.total_spend_usd += spend_usd
        arm.total_revenue_usd += revenue_usd
        return {"mu": arm.mu, "sigma": arm.sigma}


def _arms() -> list[AdArm]:
    with db.session_scope() as session:
        return list(session.scalars(select(AdArm).order_by(AdArm.campaign_id)))


def recommend(total_budget_usd: float | None = None, draws: int = 4000, seed: int | None = None) -> list[dict[str, Any]]:
    arms = _arms()
    if not arms:
        return []
    total = settings.ADS_DAILY_BUDGET_USD if total_budget_usd is None else total_budget_usd
    rng = random.Random(seed)
    wins = [0] * len(arms)
    for _ in range(draws):
        samples = [rng.gauss(a.mu, a.sigma) for a in arms]
        wins[samples.index(max(samples))] += 1

    floor = min(settings.ADS_MIN_ARM_SHARE, 1 / len(arms))
    free = 1 - floor * len(arms)
    out = []
    for arm, w in zip(arms, wins, strict=True):
        p_best = w / draws
        share = floor + free * p_best
        out.append(
            {
                "campaign_id": arm.campaign_id,
                "name": arm.name,
                "p_best": round(p_best, 4),
                "share": round(share, 4),
                "daily_budget_usd": round(total * share, 2),
                "expected_roas": round(math.exp(arm.mu + arm.sigma**2 / 2), 3),
                "roas_90ci": [round(math.exp(arm.mu - 1.645 * arm.sigma), 3), round(math.exp(arm.mu + 1.645 * arm.sigma), 3)],
                "current_budget_usd": arm.daily_budget_usd,
            }
        )
    return out


def record_applied_budgets(budgets: dict[str, float]) -> None:
    with db.session_scope() as session:
        for campaign_id, amount in budgets.items():
            if arm := session.get(AdArm, campaign_id):
                arm.daily_budget_usd = amount


def state() -> list[dict[str, Any]]:
    return [
        {
            "campaign_id": a.campaign_id,
            "name": a.name,
            "platform": a.platform,
            "mu": a.mu,
            "sigma": a.sigma,
            "total_spend_usd": a.total_spend_usd,
            "total_revenue_usd": a.total_revenue_usd,
            "daily_budget_usd": a.daily_budget_usd,
        }
        for a in _arms()
    ]
