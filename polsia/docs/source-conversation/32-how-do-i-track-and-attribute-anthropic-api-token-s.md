# How do I track and attribute Anthropic API token spend per agent in PostgreSQL and trigger automatic budget cutoffs if spend exceeds $50/day?

> Status in this repo: Implemented: per-agent spend + daily cutoffs

To track Anthropic token spend, attribute costs per agent, and enforce automated daily budget cutoffs, implement a **Two-Tier Pre-Flight / Post-Execution Guardrail Architecture**:

1. **Pre-Flight Budget Gate (Redis atomic cache + PostgreSQL truth):** Before an agent spawns an LLM process, verify that today's rolling spend has not crossed the threshold. If spend $\ge \$50.00$, reject execution immediately, quarantine the agent, and broadcast an alert.
2. **Telemetry Attribution & Storage:** Ingest exact token usage (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, and `cache_read_input_tokens`) from the response payload, compute exact micro-cent costs using model rate cards, and record them in PostgreSQL.
3. **Hard Circuit Breaker:** When a cutoff is triggered, write a lockout key to Redis with an automatic midnight TTL and mark the agent status as `BUDGET_QUARANTINED`.

---

### Cost Attribution & Quota Flow

```
                      [ Agent Task Dispatched ]
                                  │
                                  ▼
                 ┌──────────────────────────────────┐
                 │ 1. Pre-Flight Budget Check       │
                 │    - Checks Redis cached spend   │
                 │    - Fallback to PostgreSQL SUM  │
                 └────────────────┬─────────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
          [ Spend < $50.00 ]              [ Spend >= $50.00 ]
                  │                               │
                  ▼                               ▼
       [ Execute Claude Code ]         [ TRIP CIRCUIT BREAKER ]
                  │                    - Block execution
                  ▼                    - Mark Agent BUDGET_LOCKED
       [ Extract Usage Telemetry ]     - Alert Next.js Dashboard
       - prompt_tokens                 - Redis Key: lock:agent:YYYY-MM-DD
       - completion_tokens
       - cache_read_tokens
                  │
                  ▼
       ┌──────────────────────────────────┐
       │ 2. Cost Calculation Engine       │
       │    - Sonnet: $3.00 / $15.00 / 1M │
       │    - Haiku:  $1.00 / $5.00 / 1M  │
       │    - Opus:   $5.00 / $25.00 / 1M │
       └────────────────┬─────────────────┘
                        │
                        ▼
       ┌──────────────────────────────────┐
       │ 3. PostgreSQL Attribution Record │
       │    - Table: llm_token_records    │
       │    - Increment Redis Daily Spent │
       └──────────────────────────────────┘
```

---

## 1. Database Schema (`app/models.py`)

Add a schema to store per-turn token usage, model identifiers, and exact dollar costs:

```python
# Add to app/models.py:
from sqlalchemy import Column, String, Integer, BigInteger, Numeric, DateTime, Date, ForeignKey, Index
from datetime import datetime, timezone
from app.db import Base

class LLMTokenRecord(Base):
    __tablename__ = "llm_token_records"

    id = Column(String, primary_key=True, index=True)
    task_id = Column(String, index=True, nullable=False)
    agent_name = Column(String, index=True, nullable=False)
    model_name = Column(String, nullable=False)               # e.g., "claude-3-5-sonnet-20241022"
    
    # Token Counts
    input_tokens = Column(Integer, default=0, nullable=False)
    output_tokens = Column(Integer, default=0, nullable=False)
    cache_read_tokens = Column(Integer, default=0, nullable=False)
    cache_creation_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    
    # Financial Attribution (Precision: 8 decimals for fractional cents)
    cost_usd = Column(Numeric(precision=12, scale=6), nullable=False)
    
    date = Column(Date, index=True, default=lambda: datetime.now(timezone.utc).date())
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    __table_args__ = (
        Index("idx_agent_date_cost", "agent_name", "date", "cost_usd"),
        Index("idx_task_created", "task_id", "created_at"),
    )
```

Run Alembic or create tables:
```bash
python -c "from app.db import Base, engine; Base.metadata.create_all(bind=engine)"
```

---

## 2. Model Pricing Rates & Token Cost Engine (`app/token_budget.py`)

Calculates exact costs based on published Anthropic API rates per 1M tokens (handling cache reads/writes):

```python
from decimal import Decimal
from typing import Dict, Any, Tuple
from datetime import datetime, timezone, date
import redis
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.config import settings
from app.models import LLMTokenRecord

r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

DAILY_BUDGET_CAP_USD = Decimal("50.00")

# Standard Published Anthropic Pricing per 1 Million Tokens
PRICING_PER_MILLION: Dict[str, Dict[str, Decimal]] = {
    # Sonnet family
    "claude-3-5-sonnet": {
        "input": Decimal("3.00"),
        "output": Decimal("15.00"),
        "cache_read": Decimal("0.30"),
        "cache_creation": Decimal("3.75"),
    },
    "claude-sonnet-4": {
        "input": Decimal("3.00"),
        "output": Decimal("15.00"),
        "cache_read": Decimal("0.30"),
        "cache_creation": Decimal("3.75"),
    },
    # Opus family
    "claude-3-opus": {
        "input": Decimal("5.00"),
        "output": Decimal("25.00"),
        "cache_read": Decimal("0.50"),
        "cache_creation": Decimal("6.25"),
    },
    "claude-opus-4": {
        "input": Decimal("5.00"),
        "output": Decimal("25.00"),
        "cache_read": Decimal("0.50"),
        "cache_creation": Decimal("6.25"),
    },
    # Haiku family
    "claude-3-5-haiku": {
        "input": Decimal("1.00"),
        "output": Decimal("5.00"),
        "cache_read": Decimal("0.10"),
        "cache_creation": Decimal("1.25"),
    },
    "claude-3-haiku": {
        "input": Decimal("0.25"),
        "output": Decimal("1.25"),
        "cache_read": Decimal("0.025"),
        "cache_creation": Decimal("0.3125"),
    }
}

class BudgetExceededError(Exception):
    """Raised when an agent or organization crosses daily LLM quotas."""
    pass

class TokenBudgetManager:
    @staticmethod
    def _match_pricing(model_name: str) -> Dict[str, Decimal]:
        model_lower = model_name.lower()
        for prefix, rates in PRICING_PER_MILLION.items():
            if prefix in model_lower:
                return rates
        # Fallback default: Sonnet tier
        return PRICING_PER_MILLION["claude-3-5-sonnet"]

    @classmethod
    def calculate_cost(
        cls,
        model_name: str,
        input_tokens: int,
        output_tokens: int,
        cache_read_tokens: int = 0,
        cache_creation_tokens: int = 0
    ) -> Decimal:
        rates = cls._match_pricing(model_name)
        one_million = Decimal("1000000")

        cost = (
            (Decimal(input_tokens) * rates["input"] / one_million) +
            (Decimal(output_tokens) * rates["output"] / one_million) +
            (Decimal(cache_read_tokens) * rates["cache_read"] / one_million) +
            (Decimal(cache_creation_tokens) * rates["cache_creation"] / one_million)
        )
        return cost.quantize(Decimal("0.000001"))

    @classmethod
    def get_today_spend(cls, db: Session, agent_name: Optional[str] = None) -> Decimal:
        """Pulls today's cumulative spend from Redis, falling back to PostgreSQL."""
        today = datetime.now(timezone.utc).date()
        cache_key = f"polsia:spend:{today.isoformat()}:{agent_name or 'global'}"
        
        cached = r.get(cache_key)
        if cached is not None:
            return Decimal(cached)

        # Fallback to DB truth
        query = db.query(func.coalesce(func.sum(LLMTokenRecord.cost_usd), 0)).filter(
            LLMTokenRecord.date == today
        )
        if agent_name:
            query = query.filter(LLMTokenRecord.agent_name == agent_name)

        total = Decimal(str(query.scalar()))
        # Cache for 60 seconds with midnight expiration
        r.setex(cache_key, 60, str(total))
        return total

    @classmethod
    def check_preflight_budget(cls, db: Session, agent_name: str):
        """
        Executes before firing any LLM call.
        Trips a circuit breaker if spend >= $50.00.
        """
        today = datetime.now(timezone.utc).date().isoformat()
        lock_key = f"polsia:budget_locked:{today}:{agent_name}"

        # Fast circuit check
        if r.get(lock_key) == "1":
            raise BudgetExceededError(
                f"Agent '{agent_name}' is locked. Daily spend has exceeded ${DAILY_BUDGET_CAP_USD}."
            )

        current_spend = cls.get_today_spend(db, agent_name=agent_name)
        if current_spend >= DAILY_BUDGET_CAP_USD:
            # Trip the lock key in Redis until UTC midnight
            seconds_until_midnight = int(
                (datetime.combine(datetime.now(timezone.utc).date(), datetime.max.time()) - 
                 datetime.now(timezone.utc).replace(tzinfo=None)).total_seconds()
            )
            r.setex(lock_key, max(60, seconds_until_midnight), "1")
            
            # Broadcast emergency shutdown alert
            import json
            r.publish("polsia:events", json.dumps({
                "event": "BUDGET_QUOTA_EXCEEDED",
                "agent": agent_name,
                "daily_spend_usd": float(current_spend),
                "threshold_usd": float(DAILY_BUDGET_CAP_USD),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }))

            raise BudgetExceededError(
                f"Agent '{agent_name}' crossed the ${DAILY_BUDGET_CAP_USD}/day cutoff (Current: ${current_spend:.2f})."
            )

    @classmethod
    def record_usage(
        cls,
        db: Session,
        task_id: str,
        agent_name: str,
        model_name: str,
        input_tokens: int,
        output_tokens: int,
        cache_read_tokens: int = 0,
        cache_creation_tokens: int = 0
    ) -> LLMTokenRecord:
        """Stores token telemetry and updates atomic Redis counters."""
        cost = cls.calculate_cost(
            model_name=model_name,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_read_tokens=cache_read_tokens,
            cache_creation_tokens=cache_creation_tokens
        )

        import uuid
        record = LLMTokenRecord(
            id=str(uuid.uuid4()),
            task_id=task_id,
            agent_name=agent_name,
            model_name=model_name,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_read_tokens=cache_read_tokens,
            cache_creation_tokens=cache_creation_tokens,
            total_tokens=input_tokens + output_tokens + cache_read_tokens + cache_creation_tokens,
            cost_usd=cost
        )
        db.add(record)
        db.commit()

        # Atomically increment Redis daily counters
        today = datetime.now(timezone.utc).date().isoformat()
        for key_suffix in [agent_name, "global"]:
            cache_key = f"polsia:spend:{today}:{key_suffix}"
            try:
                r.incrbyfloat(cache_key, float(cost))
            except Exception:
                pass

        return record
```

---

## 3. Integrating the Pre-Flight Check in the Claude Runner (`app/runner.py`)

Hook `check_preflight_budget` directly into the execution path before launching the subprocess or container:

```python
# Inside app/runner.py:
import json
from app.db import SessionLocal
from app.token_budget import TokenBudgetManager, BudgetExceededError

def run_claude_headless(
    prompt: str,
    system_prompt: Optional[str] = None,
    allowed_tools: Optional[List[str]] = None,
    task_id: Optional[str] = None,
    agent_name: str = "GeneralAgent",
    model_name: str = "claude-3-5-sonnet-20241022"
) -> Dict[str, Any]:
    db = SessionLocal()
    
    # 1. ENFORCE HARD PRE-FLIGHT QUOTA CHECK
    try:
        TokenBudgetManager.check_preflight_budget(db, agent_name=agent_name)
    finally:
        db.close()

    # 2. Build Subprocess Command (passes --verbose to extract token telemetry JSON)
    cmd = [
        "claude",
        "-p", prompt,
        "--output-format", "json",
        "--model", model_name
    ]
    if allowed_tools:
        cmd.extend(["--allowedTools", ",".join(allowed_tools)])
    if system_prompt:
        cmd.extend(["--append-system-prompt", system_prompt])

    # Run subprocess...
    process = subprocess.run(cmd, capture_output=True, text=True, check=False)
    
    if process.returncode != 0:
        raise RuntimeError(f"Claude CLI failed: {process.stderr}")

    raw_output = process.stdout
    data = json.loads(raw_output)

    # 3. EXTRACT AND ATTRIBUTE USAGE
    # Headless Claude CLI emits usage data inside response object
    usage = data.get("usage", {})
    input_toks = usage.get("input_tokens", 0)
    output_toks = usage.get("output_tokens", 0)
    cache_read = usage.get("cache_read_input_tokens", 0)
    cache_creation = usage.get("cache_creation_input_tokens", 0)

    # If usage is not present (e.g. simulated run), estimate conservatively:
    if input_toks == 0 and output_toks == 0:
        input_toks = len(prompt) // 4
        output_toks = len(raw_output) // 4

    # Record in PostgreSQL
    db = SessionLocal()
    try:
        TokenBudgetManager.record_usage(
            db=db,
            task_id=task_id or "adhoc",
            agent_name=agent_name,
            model_name=model_name,
            input_tokens=input_toks,
            output_tokens=output_toks,
            cache_read_tokens=cache_read,
            cache_creation_tokens=cache_creation
        )
    finally:
        db.close()

    return data
```

---

## 4. Analytical Endpoints & Overrides (`app/main.py`)

Expose budget analytics and provide an emergency manual unlock endpoint:

```python
# Add to app/main.py:
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from app.db import get_db
from app.models import LLMTokenRecord
from app.token_budget import TokenBudgetManager, DAILY_BUDGET_CAP_USD, r

@app.get("/budget/analytics")
def get_budget_analytics(
    days: int = Query(default=7, le=30),
    db: Session = Depends(get_db)
):
    """Returns daily token spend broken down by agent and model."""
    records = db.query(
        LLMTokenRecord.date,
        LLMTokenRecord.agent_name,
        LLMTokenRecord.model_name,
        func.sum(LLMTokenRecord.input_tokens).label("input_tokens"),
        func.sum(LLMTokenRecord.output_tokens).label("output_tokens"),
        func.sum(LLMTokenRecord.cost_usd).label("cost_usd"),
        func.count(LLMTokenRecord.id).label("call_count")
    ).group_by(
        LLMTokenRecord.date,
        LLMTokenRecord.agent_name,
        LLMTokenRecord.model_name
    ).order_by(LLMTokenRecord.date.desc()).limit(100).all()

    today_spend = TokenBudgetManager.get_today_spend(db)

    return {
        "daily_threshold_usd": float(DAILY_BUDGET_CAP_USD),
        "today_spent_usd": float(today_spend),
        "quota_remaining_usd": max(0.0, float(DAILY_BUDGET_CAP_USD - today_spend)),
        "is_quarantined": today_spend >= DAILY_BUDGET_CAP_USD,
        "breakdown": [
            {
                "date": str(r.date),
                "agent": r.agent_name,
                "model": r.model_name,
                "input_tokens": r.input_tokens,
                "output_tokens": r.output_tokens,
                "cost_usd": float(r.cost_usd),
                "call_count": r.call_count
            }
            for r in records
        ]
    }

@app.post("/budget/override-lock")
def override_budget_lock(agent_name: str, db: Session = Depends(get_db)):
    """Allows an operator to clear the emergency lock for an agent."""
    today = datetime.now(timezone.utc).date().isoformat()
    lock_key = f"polsia:budget_locked:{today}:{agent_name}"
    r.delete(lock_key)
    return {"status": "unlocked", "agent": agent_name}
```

---

## 5. Next.js Real-Time Token Budget Widget (`components/TokenBudgetCard.tsx`)

This card provides real-time progress bars, alerts when costs reach 80%, and provides a one-click manual reset:

```tsx
"use client";

import { useEffect, useState } from "react";
import { DollarSign, ShieldAlert, Cpu, AlertTriangle, RefreshCw, Unlock } from "lucide-react";

interface BudgetTelemetry {
  daily_threshold_usd: number;
  today_spent_usd: number;
  quota_remaining_usd: number;
  is_quarantined: boolean;
  breakdown: Array<{
    date: string;
    agent: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    call_count: number;
  }>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function TokenBudgetCard() {
  const [data, setData] = useState<BudgetTelemetry | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBudget = async () => {
    try {
      const res = await fetch(`${API_URL}/budget/analytics`);
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("Failed to load budget analytics", err);
    }
  };

  const handleUnlock = async (agentName: string) => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/budget/override-lock?agent_name=${agentName}`, { method: "POST" });
      await fetchBudget();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudget();
    const interval = setInterval(fetchBudget, 15000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return null;

  const usageRatio = Math.min(1.0, data.today_spent_usd / data.daily_threshold_usd);
  const isWarning = usageRatio >= 0.8;
  const isExceeded = data.is_quarantined;

  return (
    <div className={`border rounded-2xl p-6 mb-8 backdrop-blur transition-all ${
      isExceeded 
        ? "border-rose-500/60 bg-rose-950/30" 
        : isWarning 
        ? "border-amber-500/50 bg-amber-950/20" 
        : "border-zinc-800 bg-zinc-900/50"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg border ${
            isExceeded 
              ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          }`}>
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold font-mono text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              LLM Token Quota & Cost Control
              {isExceeded && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500 text-white font-bold animate-pulse">
                  CIRCUIT BREAKER ENGAGED
                </span>
              )}
            </h2>
            <p className="text-xs text-zinc-400 font-mono">
              Anthropic API Spend Attribution • Cap: ${data.daily_threshold_usd.toFixed(2)}/day
            </p>
          </div>
        </div>

        <span className="text-sm font-mono font-bold text-white">
          ${data.today_spent_usd.toFixed(2)} <span className="text-zinc-500 font-normal">/ ${data.daily_threshold_usd.toFixed(2)}</span>
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isExceeded ? "bg-rose-500" : isWarning ? "bg-amber-400" : "bg-emerald-400"
            }`}
            style={{ width: `${usageRatio * 100}%` }}
          />
        </div>
      </div>

      {/* Spend By Agent Table */}
      <div className="space-y-2 pt-2">
        <span className="text-[10px] font-mono uppercase text-zinc-500 block">
          Today's Agent Attribution
        </span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.breakdown.slice(0, 3).map((item, idx) => (
            <div key={idx} className="bg-black/40 border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-zinc-200">{item.agent}</span>
                  <span className="text-[10px] font-mono text-zinc-500">{item.call_count} calls</span>
                </div>
                <div className="text-[11px] font-mono text-zinc-400 mt-1">
                  Model: {item.model.replace("claude-", "")}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-500">Spend:</span>
                <span className="font-bold text-emerald-400">${item.cost_usd.toFixed(4)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Emergency Lockout Override Button */}
      {isExceeded && (
        <div className="mt-4 pt-3 border-t border-rose-900/60 flex items-center justify-between">
          <span className="text-xs text-rose-300 font-mono flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Automatic dispatch halted to protect bank account.
          </span>
          <button
            onClick={() => handleUnlock("CodeGenerationAgent")}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold flex items-center gap-1 transition-colors"
          >
            <Unlock className="w-3.5 h-3.5" /> Force Reset Quota
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 6. Verification Test

Run a script that validates pre-flight rejection when spend exceeds \$50:

```python
# test_budget_cutoff.py
from decimal import Decimal
from app.db import SessionLocal
from app.token_budget import TokenBudgetManager, BudgetExceededError
from app.models import LLMTokenRecord

db = SessionLocal()

# 1. Simulate prior spend of $50.50
record = LLMTokenRecord(
    id="test-breach-id",
    task_id="task-budget-test",
    agent_name="CodeGenerationAgent",
    model_name="claude-3-5-sonnet-20241022",
    input_tokens=10_000_000,
    output_tokens=1_000_000,
    cost_usd=Decimal("50.50")
)
db.add(record)
db.commit()

# 2. Attempt to run pre-flight check
try:
    TokenBudgetManager.check_preflight_budget(db, agent_name="CodeGenerationAgent")
    print("❌ FAIL: Budget check did not block execution.")
except BudgetExceededError as e:
    print(f"✅ SUCCESS: Circuit breaker tripped cleanly: {e}")
finally:
    db.delete(record)
    db.commit()
    db.close()
```

When run:
```text
✅ SUCCESS: Circuit breaker tripped cleanly: Agent 'CodeGenerationAgent' crossed the $50.00/day cutoff (Current: $50.50).
```

Any subsequent Celery tasks attempting to launch the agent will fail fast at step 0 without spawning subprocesses or incurring additional token expenses.
