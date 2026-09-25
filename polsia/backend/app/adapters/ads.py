"""Meta Marketing API: set a campaign's daily budget."""

from typing import Any

import httpx

from app.config import settings

GRAPH_URL = "https://graph.facebook.com/v21.0"


def set_daily_budget(campaign_id: str, daily_budget_usd: float) -> dict[str, Any]:
    if daily_budget_usd < 0:
        raise ValueError("Budget cannot be negative")
    cents = round(daily_budget_usd * 100)
    if settings.SANDBOX_MODE:
        return {"status": "simulated", "campaign_id": campaign_id, "daily_budget_cents": cents}
    if not settings.META_ADS_TOKEN:
        raise RuntimeError("META_ADS_TOKEN is required when SANDBOX_MODE is off")
    resp = httpx.post(
        f"{GRAPH_URL}/{campaign_id}",
        data={"daily_budget": str(cents), "access_token": settings.META_ADS_TOKEN},
        timeout=15,
    )
    resp.raise_for_status()
    return {"status": "updated", "campaign_id": campaign_id, "daily_budget_cents": cents}
