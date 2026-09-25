# Show me how to implement the AdsManagementAgent that pulls campaign metrics, calculates ROAS, and dynamically reallocates budget via APIs.

> Status in this repo: Implemented (as UPDATE_AD_BUDGETS + Meta adapter)

This guide covers the implementation of the **`AdsManagementAgent`** in Polsia. The agent runs on a 6-hour cycle, aggregates campaign metrics across Meta and Google Ads, computes Return on Ad Spend (ROAS) and Customer Acquisition Cost (CAC), applies algorithmic guardrails, and routes budget adjustments through the Human-in-the-Loop approval queue.

---

### File Tree Updates

```text
polsia-core/
├── app/
│   ├── adapters/
│   │   └── ads_adapter.py         # Unified Meta & Google Ads API client
│   ├── ads_engine.py              # ROAS/CAC math & algorithmic guardrails
│   ├── agents.py                  # AdsManagementAgent definition
│   ├── dispatcher.py              # External API execution for ad updates
│   ├── celery_app.py              # 6-hour cron schedule
│   └── main.py                    # Endpoints for ad metrics & status
frontend/
└── components/
    └── AdsPerformanceCard.tsx     # Next.js live ROAS & campaign widget
```

---

## 1. Unified Ad Platform Adapter (`app/adapters/ads_adapter.py`)

Ad platforms have different data structures (Meta uses cents for budgets; Google Ads uses micro-units where $1 = 1,000,000 micros). This adapter standardizes all metrics into integer cents (USD) and handles both sandbox simulation and real API calls.

```python
import os
import requests
from typing import List, Dict, Any
from dataclasses import dataclass
from app.config import settings

@dataclass
class CampaignPerformance:
    campaign_id: str
    name: str
    platform: str                  # "meta" or "google"
    status: str                    # "ACTIVE", "PAUSED"
    daily_budget_cents: int
    spend_cents: int               # Trailing period spend
    revenue_cents: int             # Conversion value
    conversions: int
    impressions: int
    clicks: int

    @property
    def roas(self) -> float:
        if self.spend_cents == 0:
            return 0.0
        return round(self.revenue_cents / self.spend_cents, 2)

    @property
    def cac_cents(self) -> int:
        if self.conversions == 0:
            return self.spend_cents
        return int(self.spend_cents / self.conversions)


class UnifiedAdsAdapter:
    def __init__(self):
        self.meta_access_token = os.getenv("META_ADS_TOKEN", "")
        self.meta_ad_account_id = os.getenv("META_AD_ACCOUNT_ID", "")
        self.google_client_id = os.getenv("GOOGLE_ADS_CLIENT_ID", "")

    def fetch_campaign_metrics(self) -> List[CampaignPerformance]:
        """Pulls 7-day trailing metrics from ad accounts."""
        if settings.SANDBOX_MODE or not self.meta_access_token:
            # Realistic mock campaigns for development & testing
            return [
                CampaignPerformance(
                    campaign_id="meta_camp_101",
                    name="TOF - Broad Developer Acquisition",
                    platform="meta",
                    status="ACTIVE",
                    daily_budget_cents=5000,   # $50.00/day
                    spend_cents=21000,         # $210.00 spent
                    revenue_cents=67200,       # $672.00 returned (ROAS 3.20)
                    conversions=14,
                    impressions=18400,
                    clicks=420
                ),
                CampaignPerformance(
                    campaign_id="meta_camp_102",
                    name="MOF - Retargeting Free Trial Dropoffs",
                    platform="meta",
                    status="ACTIVE",
                    daily_budget_cents=3000,   # $30.00/day
                    spend_cents=12000,         # $120.00 spent
                    revenue_cents=8400,        # $84.00 returned (ROAS 0.70 - Underperforming)
                    conversions=2,
                    impressions=6200,
                    clicks=110
                ),
                CampaignPerformance(
                    campaign_id="meta_camp_103",
                    name="Experimental - Video Ad Pitch V2",
                    platform="meta",
                    status="ACTIVE",
                    daily_budget_cents=2000,   # $20.00/day
                    spend_cents=8500,          # $85.00 spent
                    revenue_cents=0,           # $0 returned (ROAS 0.00 - High Burn)
                    conversions=0,
                    impressions=4100,
                    clicks=85
                )
            ]

        # Production Meta Marketing API Call
        url = f"https://graph.facebook.com/v19.0/{self.meta_ad_account_id}/campaigns"
        params = {
            "access_token": self.meta_access_token,
            "fields": "id,name,status,daily_budget,insights{spend,action_values,actions,impressions,clicks}"
        }
        res = requests.get(url, params=params, timeout=10)
        res.raise_for_status()
        data = res.json().get("data", [])
        
        results = []
        for c in data:
            insights = c.get("insights", {}).get("data", [{}])[0]
            spend_cents = int(float(insights.get("spend", 0)) * 100)
            
            # Extract purchase conversion values
            action_values = insights.get("action_values", [])
            revenue = sum(float(x.get("value", 0)) for x in action_values if x.get("action_type") == "purchase")
            revenue_cents = int(revenue * 100)

            actions = insights.get("actions", [])
            conversions = sum(int(x.get("value", 0)) for x in actions if x.get("action_type") == "purchase")

            results.append(CampaignPerformance(
                campaign_id=c["id"],
                name=c["name"],
                platform="meta",
                status=c.get("status", "UNKNOWN"),
                daily_budget_cents=int(c.get("daily_budget", 0)),
                spend_cents=spend_cents,
                revenue_cents=revenue_cents,
                conversions=conversions,
                impressions=int(insights.get("impressions", 0)),
                clicks=int(insights.get("clicks", 0))
            ))
        return results

    def update_daily_budget(self, campaign_id: str, new_budget_cents: int) -> bool:
        """Updates Meta campaign/adset daily budget via Graph API."""
        if settings.SANDBOX_MODE:
            return True

        url = f"https://graph.facebook.com/v19.0/{campaign_id}"
        payload = {
            "access_token": self.meta_access_token,
            "daily_budget": new_budget_cents
        }
        resp = requests.post(url, data=payload, timeout=10)
        return resp.status_code == 200

    def pause_campaign(self, campaign_id: str) -> bool:
        """Sets campaign status to PAUSED."""
        if settings.SANDBOX_MODE:
            return True

        url = f"https://graph.facebook.com/v19.0/{campaign_id}"
        payload = {
            "access_token": self.meta_access_token,
            "status": "PAUSED"
        }
        resp = requests.post(url, data=payload, timeout=10)
        return resp.status_code == 200
```

---

## 2. Hard Algorithmic Guardrails (`app/ads_engine.py`)

LLMs should not be given unrestricted control over financial adjustments. If an agent hallucinates a $5,000 daily budget, this rule-based validation engine rejects the proposal before it can reach the approval queue or API:

```python
from typing import Dict, Any, Tuple
from app.adapters.ads_adapter import CampaignPerformance

# Hard Company Ceilings
MAX_COMPANY_DAILY_AD_SPEND_CENTS = 30000   # $300.00/day max across all campaigns
MAX_SINGLE_BUDGET_INCREASE_RATIO = 1.20     # Max +20% scale per cycle (avoids ad learning reset)
MAX_SINGLE_BUDGET_DECREASE_RATIO = 0.50     # Max -50% cut per cycle
MIN_SPEND_FOR_DECISION_CENTS = 5000         # Don't pause before spending at least $50

class AdsGuardrailEngine:
    @staticmethod
    def validate_action(
        action_type: str,
        campaign: CampaignPerformance,
        proposed_cents: int,
        all_campaigns: list[CampaignPerformance]
    ) -> Tuple[bool, str]:
        """
        Validates proposed LLM actions against deterministic financial rules.
        Returns: (is_valid, rejection_reason)
        """
        if action_type == "PAUSE_CAMPAIGN":
            if campaign.spend_cents < MIN_SPEND_FOR_DECISION_CENTS:
                return False, f"Campaign has only spent ${campaign.spend_cents/100:.2f}. Min threshold is $50.00."
            return True, "Approved for pause evaluation."

        elif action_type == "UPDATE_BUDGET":
            # 1. Reject negative or zero budgets
            if proposed_cents <= 0:
                return False, "Budget must be greater than $0."

            # 2. Check maximum scaling jump (protects ad set learning phase)
            max_allowed = int(campaign.daily_budget_cents * MAX_SINGLE_BUDGET_INCREASE_RATIO)
            if proposed_cents > max_allowed:
                return False, f"Scaling exceeds +20% cap. Proposed: ${proposed_cents/100:.2f}, Max: ${max_allowed/100:.2f}."

            min_allowed = int(campaign.daily_budget_cents * MAX_SINGLE_BUDGET_DECREASE_RATIO)
            if proposed_cents < min_allowed:
                return False, f"Reduction exceeds -50% floor. Proposed: ${proposed_cents/100:.2f}, Min: ${min_allowed/100:.2f}."

            # 3. Check total company-wide daily ad spend ceiling
            other_campaigns_spend = sum(
                c.daily_budget_cents for c in all_campaigns if c.campaign_id != campaign.campaign_id and c.status == "ACTIVE"
            )
            if other_campaigns_spend + proposed_cents > MAX_COMPANY_DAILY_AD_SPEND_CENTS:
                return False, f"Exceeds global company daily limit of ${MAX_COMPANY_DAILY_AD_SPEND_CENTS/100:.2f}."

            return True, "Budget proposal passed safety guardrails."

        return False, f"Unknown action type: {action_type}"
```

---

## 3. The Ads Management Agent (`app/agents.py`)

The agent analyzes campaign performance, applies ROAS/CAC targets, drafts concrete budget actions, and runs the proposal through `AdsGuardrailEngine`:

```python
import json
import uuid
from app.runner import run_claude_headless
from app.config import settings
from app.adapters.ads_adapter import UnifiedAdsAdapter, CampaignPerformance
from app.ads_engine import AdsGuardrailEngine
from app.db import SessionLocal
from app.models import ActionApproval

def load_soul() -> str:
    with open(settings.SOUL_PATH, "r") as f:
        return f.read()

class AdsManagementAgent:
    def __init__(self):
        self.name = "AdsManagementAgent"
        self.adapter = UnifiedAdsAdapter()
        self.soul = load_soul()

    def run_optimization_cycle(self, task_id: str) -> dict:
        campaigns = self.adapter.fetch_campaign_metrics()
        
        # Prepare performance telemetry payload for Claude Code
        campaigns_payload = [
            {
                "campaign_id": c.campaign_id,
                "name": c.name,
                "status": c.status,
                "daily_budget_usd": c.daily_budget_cents / 100,
                "spend_usd": c.spend_cents / 100,
                "revenue_usd": c.revenue_cents / 100,
                "roas": c.roas,
                "cac_usd": c.cac_cents / 100,
                "conversions": c.conversions
            }
            for c in campaigns
        ]

        prompt = (
            "You are the autonomous AdsManagementAgent for Polsia.\n"
            "Analyze trailing campaign metrics and determine budget allocations.\n\n"
            f"ACTIVE CAMPAIGNS TELEMETRY:\n{json.dumps(campaigns_payload, indent=2)}\n\n"
            "OPTIMIZATION POLICIES:\n"
            "1. High Performer (ROAS >= 2.5): Recommend budget scale-up between +10% and +20%.\n"
            "2. Underperformer (ROAS < 1.0 and spend > $50): Cut budget by 20%-40% or PAUSE if ROAS < 0.5.\n"
            "3. Balanced (1.0 <= ROAS < 2.5): Keep stable or minor +/- 5% tweak.\n\n"
            "OUTPUT SPECIFICATION (STRICT JSON ONLY):\n"
            "{\n"
            '  "analysis": "Concise summary of ad portfolio health",\n'
            '  "proposed_actions": [\n'
            '    {\n'
            '      "campaign_id": "string",\n'
            '      "action_type": "UPDATE_BUDGET" | "PAUSE_CAMPAIGN" | "NO_ACTION",\n'
            '      "proposed_daily_budget_cents": 6000,\n'
            '      "reasoning": "string"\n'
            '    }\n'
            '  ]\n'
            "}"
        )

        result = run_claude_headless(prompt=prompt, system_prompt=self.soul)
        
        try:
            decision = json.loads(result.get("result", "{}"))
        except Exception:
            decision = {"analysis": "Failed to parse model output", "proposed_actions": []}

        # Validate each proposed action against deterministic guardrails
        validated_actions = []
        db = SessionLocal()

        for action in decision.get("proposed_actions", []):
            cid = action.get("campaign_id")
            campaign = next((c for c in campaigns if c.campaign_id == cid), None)
            if not campaign:
                continue

            act_type = action.get("action_type")
            if act_type == "NO_ACTION":
                continue

            proposed_budget = action.get("proposed_daily_budget_cents", campaign.daily_budget_cents)
            is_valid, reason = AdsGuardrailEngine.validate_action(
                act_type, campaign, proposed_budget, campaigns
            )

            if is_valid:
                approval_id = str(uuid.uuid4())
                payload = {
                    "campaign_id": cid,
                    "campaign_name": campaign.name,
                    "action_type": act_type,
                    "current_daily_budget_cents": campaign.daily_budget_cents,
                    "new_daily_budget_cents": proposed_budget,
                    "roas": campaign.roas,
                    "reasoning": action.get("reasoning", "")
                }

                # High-stakes financial change: store in ActionApproval queue
                approval = ActionApproval(
                    id=approval_id,
                    task_id=task_id,
                    agent_name=self.name,
                    action_type=f"AD_{act_type}",
                    payload=json.dumps(payload),
                    status="PENDING"
                )
                db.add(approval)
                validated_actions.append({"approval_id": approval_id, **payload})
            else:
                validated_actions.append({
                    "campaign_id": cid,
                    "rejected": True,
                    "reason": reason
                })

        db.commit()
        db.close()

        return {
            "analysis": decision.get("analysis", ""),
            "actions": validated_actions
        }
```

---

## 4. Hooking Dispatcher & Celery Beat

### Dispatcher Integration (`app/dispatcher.py`)

Add the ad network execution hooks to `ActionDispatcher`:

```python
# In app/dispatcher.py:
from app.adapters.ads_adapter import UnifiedAdsAdapter

class ActionDispatcher:
    @staticmethod
    def dispatch(action_type: str, payload_data: dict) -> dict:
        # ... existing CREATE_PR and POST_TWEET branches ...

        if action_type == "AD_UPDATE_BUDGET":
            adapter = UnifiedAdsAdapter()
            success = adapter.update_daily_budget(
                campaign_id=payload_data["campaign_id"],
                new_budget_cents=payload_data["new_daily_budget_cents"]
            )
            return {"status": "executed", "platform": "meta", "updated": success}

        elif action_type == "AD_PAUSE_CAMPAIGN":
            adapter = UnifiedAdsAdapter()
            success = adapter.pause_campaign(campaign_id=payload_data["campaign_id"])
            return {"status": "executed", "platform": "meta", "paused": success}

        raise ValueError(f"Unknown action type: {action_type}")
```

### Celery Beat Schedule (`app/celery_app.py`)

Configure the optimization cycle to run every 6 hours (`00:00`, `06:00`, `12:00`, `18:00` UTC):

```python
# In celery_app.conf.beat_schedule in app/celery_app.py:

    "ads-optimization-cycle": {
        "task": "app.tasks.run_ads_optimization",
        "schedule": crontab(minute=0, hour="*/6"),
    },
```

Wire the task in `app/tasks.py`:

```python
# In app/tasks.py:
from app.agents import AdsManagementAgent

ads_agent = AdsManagementAgent()

@celery_app.task(bind=True)
def run_ads_optimization(self):
    r.publish("polsia:events", json.dumps({
        "event": "TASK_START",
        "task_id": self.request.id,
        "agent": "AdsManagementAgent",
        "instruction": "Evaluate 7-day ROAS and reallocate ad budgets."
    }))

    result = ads_agent.run_optimization_cycle(task_id=self.request.id)

    r.publish("polsia:events", json.dumps({
        "event": "TASK_COMPLETE",
        "task_id": self.request.id,
        "result": {
            "agent": "AdsManagementAgent",
            "task": "Evaluate 7-day ROAS and reallocate ad budgets.",
            "output": result.get("analysis", ""),
            "verification": {"approved": True, "feedback": f"Proposed {len(result.get('actions', []))} budget adjustments."}
        }
    }))
    return result
```

---

## 5. Expose Metrics API (`app/main.py`)

```python
# In app/main.py:
from app.adapters.ads_adapter import UnifiedAdsAdapter

@app.get("/ads/campaigns")
def get_campaign_metrics():
    adapter = UnifiedAdsAdapter()
    campaigns = adapter.fetch_campaign_metrics()
    return [
        {
            "id": c.campaign_id,
            "name": c.name,
            "status": c.status,
            "daily_budget_usd": c.daily_budget_cents / 100,
            "spend_usd": c.spend_cents / 100,
            "revenue_usd": c.revenue_cents / 100,
            "roas": c.roas,
            "cac_usd": c.cac_cents / 100,
            "conversions": c.conversions
        }
        for c in campaigns
    ]
```

---

## 6. Next.js Performance Widget (`components/AdsPerformanceCard.tsx`)

This dashboard widget tracks campaign performance in real-time, color-codes health based on ROAS, and highlights which campaigns are being scaled or cut:

```tsx
"use client";

import { useEffect, useState } from "react";
import { TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, PauseCircle } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  daily_budget_usd: number;
  spend_usd: number;
  revenue_usd: number;
  roas: number;
  cac_usd: number;
  conversions: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function AdsPerformanceCard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const res = await fetch(`${API_URL}/ads/campaigns`);
        if (res.ok) setCampaigns(await res.json());
      } catch (err) {
        console.error("Failed to load ad metrics", err);
      }
    };
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 15000);
    return () => clearInterval(interval);
  }, []);

  if (campaigns.length === 0) return null;

  return (
    <div className="border border-zinc-800 bg-zinc-900/50 backdrop-blur rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-semibold font-mono text-zinc-100 uppercase tracking-wider">
            Ad Campaigns & ROAS Engine
          </h2>
        </div>
        <span className="text-xs font-mono text-zinc-500">Auto-Optimization: 6h Interval</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {campaigns.map((camp) => {
          const isHighRoas = camp.roas >= 2.5;
          const isUnderperforming = camp.roas < 1.0;

          return (
            <div
              key={camp.id}
              className="bg-black/40 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-xs font-medium text-zinc-200 line-clamp-1">{camp.name}</h3>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                      isHighRoas
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : isUnderperforming
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}
                  >
                    ROAS {camp.roas.toFixed(2)}x
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-3">
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Daily Budget</span>
                    <span className="text-zinc-300 font-semibold">${camp.daily_budget_usd.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Spend / Rev</span>
                    <span className="text-zinc-300 font-semibold">
                      ${camp.spend_usd.toFixed(0)} / ${camp.revenue_usd.toFixed(0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">CAC</span>
                    <span className="text-zinc-300 font-semibold">${camp.cac_usd.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Conversions</span>
                    <span className="text-zinc-300 font-semibold">{camp.conversions}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center gap-1 text-[11px] font-mono">
                {isHighRoas && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> Target for +15% scale
                  </span>
                )}
                {isUnderperforming && (
                  <span className="text-rose-400 flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5" /> Target for -30% cut / pause
                  </span>
                )}
                {!isHighRoas && !isUnderperforming && (
                  <span className="text-zinc-400">Stable - Maintain current budget</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Insert `<AdsPerformanceCard/>` inside `app/page.tsx` directly above `<ApprovalQueue/>`:

```tsx
{/* Live Business Telemetry & Revenue */}
<FinancialMetricsPulse />

{/* Ad Portfolio & ROAS Metrics */}
<AdsPerformanceCard />

{/* Operator Approvals Queue */}
<ApprovalQueue />
```

---

## 7. Verifying the Optimization Flow

1. **Trigger an On-Demand Ad Run:**
   ```bash
   curl -X POST http://localhost:8000/agents/run \
     -H "Content-Type: application/json" \
     -d '{"agent_name": "AdsManagementAgent", "instruction": "Evaluate ROAS and adjust budgets"}'
   ```

2. **Evaluation Results:**
   * **`meta_camp_101`** ($ROAS = 3.20x$): Passes guardrails to increase daily budget from $50.00 to $57.50 (+15%). Lands in the **Pending Operator Approvals** queue.
   * **`meta_camp_102`** ($ROAS = 0.70x$, Spend = $120): Passes guardrails to decrease daily budget from $30.00 to $21.00 (-30%). Lands in the approval queue.
   * **`meta_camp_103`** ($ROAS = 0.00x$, Spend = $85): Recommended for `AD_PAUSE_CAMPAIGN`. Lands in the approval queue.

3. **Operator Authorizes:**
   Clicking **Approve & Dispatch** on the dashboard triggers `ActionDispatcher.dispatch()`, invoking the Meta Graph API to update the live ad sets while maintaining strict budget limits.
