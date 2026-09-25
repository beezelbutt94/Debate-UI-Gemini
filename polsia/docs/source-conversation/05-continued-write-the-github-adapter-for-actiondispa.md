# Continue

> Status in this repo: Implemented: telemetry, orchestrator, briefings

To bring the system to life as a self-directing company, we will build the core cognitive engine of Polsia: **The Master Orchestrator ("CEO") Agent**.

In Polsia, individual agents (Social, Code, Support, Finance) do not just run arbitrary hard-coded prompts. Instead, a **Master Orchestrator** runs on a dual-cadence schedule (morning 06:00 and evening 20:00):
1. **Morning Run (06:00 UTC):** Pulls state from all sub-systems, audits yesterday’s metrics, reviews strategic OKRs, generates an executive operational plan, and dynamically dispatches tasks to the agent swarm.
2. **Evening Run (20:00 UTC):** Evaluates completed actions, measures execution velocity, and dual-writes lessons learned into ChromaDB for the next day's context.

---

### File Tree Updates

```text
polsia-core/
├── app/
│   ├── analytics.py             # System telemetry & state aggregator
│   ├── models.py                # Added ExecutiveBriefing DB schema
│   ├── orchestrator.py          # CEO Agent logic & dynamic task fan-out
│   ├── celery_app.py            # Beat schedule for 06:00 / 20:00 cadence
│   ├── main.py                  # API endpoints for briefings
frontend/
└── components/
    └── ExecutiveBriefingCard.tsx # Daily strategic plan UI widget
```

---

## 1. System Telemetry Aggregator (`app/analytics.py`)

The CEO agent needs objective operational data to plan effectively. This module gathers telemetry from the relational database and the vector store:

```python
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models import ActionApproval
from app.memory import AgentMemory

class SystemTelemetry:
    @staticmethod
    def get_24h_summary() -> dict:
        """Collects operational metrics from the last 24 hours."""
        db: Session = SessionLocal()
        since = datetime.utcnow() - timedelta(hours=24)

        approvals = db.query(ActionApproval).filter(ActionApproval.created_at >= since).all()
        db.close()

        total_actions = len(approvals)
        executed = sum(1 for a in approvals if a.status == "EXECUTED")
        rejected = sum(1 for a in approvals if a.status == "REJECTED")
        pending = sum(1 for a in approvals if a.status == "PENDING")

        # Query recent memory entries to understand historical context
        social_mem = AgentMemory("SocialMediaAgent").search_context("recent updates", n_results=2)
        code_mem = AgentMemory("CodeGenerationAgent").search_context("recent bugfixes and PRs", n_results=2)

        return {
            "period": "Last 24 Hours",
            "total_actions_proposed": total_actions,
            "actions_executed": executed,
            "actions_rejected": rejected,
            "actions_pending_approval": pending,
            "recent_context": {
                "social": social_mem,
                "code": code_mem,
            },
        }
```

---

## 2. Briefing Database Schema (`app/models.py`)

Add the `ExecutiveBriefing` model to store the CEO's plans:

```python
# Add to app/models.py:
from sqlalchemy import Column, String, Text, DateTime, JSON
from app.db import Base

class ExecutiveBriefing(Base):
    __tablename__ = "executive_briefings"

    id = Column(String, primary_key=True, index=True)
    briefing_type = Column(String)  # "MORNING_STRATEGY" or "EVENING_RETROSPECTIVE"
    summary = Column(Text)
    okr_focus = Column(String)
    tasks_dispatched = Column(JSON)  # List of dispatched task IDs and targets
    metrics_snapshot = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## 3. The Orchestrator CEO Agent (`app/orchestrator.py`)

The Orchestrator queries Claude Code with broad context, produces a structured JSON plan, and dynamically invokes Celery tasks for the child agents.

```python
import json
import uuid
from datetime import datetime
from app.runner import run_claude_headless
from app.config import settings
from app.memory import AgentMemory
from app.analytics import SystemTelemetry
from app.db import SessionLocal
from app.models import ExecutiveBriefing

def load_soul() -> str:
    with open(settings.SOUL_PATH, "r") as f:
        return f.read()

class MasterOrchestrator:
    def __init__(self):
        self.name = "MasterOrchestrator"
        self.memory = AgentMemory("Orchestrator")
        self.soul = load_soul()

    def run_morning_cycle(self) -> dict:
        """
        06:00 AM Cycle:
        1. Ingest 24h telemetry and past lessons.
        2. Synthesize daily operational priorities (OKRs).
        3. Formulate concrete directives for specific agents.
        4. Fan-out tasks into Celery.
        """
        telemetry = SystemTelemetry.get_24h_summary()
        strategic_lessons = self.memory.search_context("operational efficiency and failures", n_results=3)

        prompt = (
            "You are the Master Orchestrator (CEO) of an autonomous software company.\n"
            "Your job is to set the daily operational plan and delegate specific tasks to specialized agents.\n\n"
            f"STRATEGIC LESSONS FROM PREVIOUS DAYS:\n{strategic_lessons}\n\n"
            f"SYSTEM TELEMETRY (PAST 24H):\n{json.dumps(telemetry, indent=2)}\n\n"
            "AVAILABLE WORKERS:\n"
            "- SocialMediaAgent: X/Twitter updates, engineering announcements, content marketing.\n"
            "- CodeGenerationAgent: Bugfixes, refactoring, documentation patches via automated GitHub PRs.\n"
            "- FinanceAgent: Ledger auditing, burn calculation, anomaly detection.\n\n"
            "OUTPUT SPECIFICATION:\n"
            "You must return a STRICT JSON object matching this schema:\n"
            "{\n"
            '  "briefing_type": "MORNING_STRATEGY",\n'
            '  "okr_focus": "Core objective for today (e.g. Fix stability, ramp up user acquisition)",\n'
            '  "summary": "High-level CEO directive for the day",\n'
            '  "delegated_tasks": [\n'
            '    {\n'
            '      "agent": "SocialMediaAgent" | "CodeGenerationAgent" | "FinanceAgent",\n'
            '      "instruction": "Specific, actionable instruction for this agent"\n'
            '    }\n'
            '  ]\n'
            "}"
        )

        result = run_claude_headless(
            prompt=prompt,
            system_prompt=self.soul,
            allowed_tools=[]
        )

        try:
            plan = json.loads(result.get("result", "{}"))
        except Exception:
            plan = {
                "briefing_type": "MORNING_STRATEGY",
                "okr_focus": "Maintain system baseline operations",
                "summary": "Fallback plan triggered due to parsing failure.",
                "delegated_tasks": []
            }

        # Dynamic task fan-out via Celery
        dispatched = []
        from app.tasks import execute_agent_task  # Local import to avoid circular dependencies

        for item in plan.get("delegated_tasks", []):
            task_call = execute_agent_task.delay(item["agent"], item["instruction"])
            dispatched.append({
                "task_id": task_call.id,
                "agent": item["agent"],
                "instruction": item["instruction"]
            })

        # Persist executive briefing to relational storage
        briefing_id = str(uuid.uuid4())
        db = SessionLocal()
        briefing_record = ExecutiveBriefing(
            id=briefing_id,
            briefing_type="MORNING_STRATEGY",
            summary=plan.get("summary", ""),
            okr_focus=plan.get("okr_focus", ""),
            tasks_dispatched=dispatched,
            metrics_snapshot=telemetry,
            created_at=datetime.utcnow()
        )
        db.add(briefing_record)
        db.commit()
        db.close()

        # Commit plan to semantic vector memory
        self.memory.record_memory(
            content=f"Daily Plan: {plan.get('okr_focus')}. Summary: {plan.get('summary')}",
            metadata={"briefing_id": briefing_id, "type": "MORNING_STRATEGY"}
        )

        return {
            "briefing_id": briefing_id,
            "plan": plan,
            "dispatched_count": len(dispatched)
        }

    def run_evening_cycle(self) -> dict:
        """
        20:00 PM Cycle:
        Audits execution metrics, logs operational retrospective, and records learnings.
        """
        telemetry = SystemTelemetry.get_24h_summary()

        prompt = (
            "You are the Master Orchestrator (CEO). It is 20:00 UTC (End of Day).\n"
            "Review today's throughput and formulate key learnings to guide future planning.\n\n"
            f"DAILY RESULTS:\n{json.dumps(telemetry, indent=2)}\n\n"
            "Return a JSON object:\n"
            "{\n"
            '  "briefing_type": "EVENING_RETROSPECTIVE",\n'
            '  "summary": "Evaluation of throughput, velocity, and bottlenecks",\n'
            '  "key_learnings": "Strategic takeaways for tomorrow"\n'
            "}"
        )

        result = run_claude_headless(prompt=prompt, system_prompt=self.soul)
        data = json.loads(result.get("result", "{}"))

        # Save to memory so morning run learns over time
        self.memory.record_memory(
            content=f"Retrospective: {data.get('summary')} | Lessons: {data.get('key_learnings')}",
            metadata={"type": "EVENING_RETROSPECTIVE"}
        )

        return data
```

---

## 4. Scheduling the Cadence in Celery (`app/celery_app.py`)

Add the morning sync (06:00 UTC) and evening retrospective (20:00 UTC) directly to Celery Beat:

```python
# Add to celery_app.conf.beat_schedule in app/celery_app.py:

    "orchestrator-morning-planning": {
        "task": "app.tasks.run_morning_orchestration",
        "schedule": crontab(minute=0, hour=6),  # Daily at 06:00 UTC
    },
    "orchestrator-evening-review": {
        "task": "app.tasks.run_evening_retrospective",
        "schedule": crontab(minute=0, hour=20), # Daily at 20:00 UTC
    },
```

Wire the tasks in `app/tasks.py`:

```python
# In app/tasks.py:
from app.orchestrator import MasterOrchestrator

orchestrator = MasterOrchestrator()

@celery_app.task
def run_morning_orchestration():
    result = orchestrator.run_morning_cycle()
    r.publish("polsia:events", json.dumps({
        "event": "EXECUTIVE_BRIEFING",
        "type": "MORNING_STRATEGY",
        "data": result
    }))
    return result

@celery_app.task
def run_evening_retrospective():
    result = orchestrator.run_evening_cycle()
    r.publish("polsia:events", json.dumps({
        "event": "EXECUTIVE_BRIEFING",
        "type": "EVENING_RETROSPECTIVE",
        "data": result
    }))
    return result
```

---

## 5. Expose Briefing APIs (`app/main.py`)

Enable the frontend to retrieve historical briefings and trigger immediate orchestration on demand:

```python
# In app/main.py:
from app.models import ExecutiveBriefing
from app.tasks import run_morning_orchestration

@app.get("/briefings/latest")
def get_latest_briefing(db: Session = Depends(get_db)):
    briefing = db.query(ExecutiveBriefing).order_by(ExecutiveBriefing.created_at.desc()).first()
    if not briefing:
        return None
    return {
        "id": briefing.id,
        "briefing_type": briefing.briefing_type,
        "okr_focus": briefing.okr_focus,
        "summary": briefing.summary,
        "tasks_dispatched": briefing.tasks_dispatched,
        "created_at": briefing.created_at.isoformat()
    }

@app.post("/briefings/trigger-morning")
def trigger_morning_briefing():
    """Manually trigger CEO planning outside of the 06:00 schedule."""
    task = run_morning_orchestration.delay()
    return {"status": "enqueued", "task_id": task.id}
```

---

## 6. Next.js Executive Briefing Widget (`components/ExecutiveBriefingCard.tsx`)

This component displays the CEO’s strategic focus, active OKR, and dispatched tasks at the top of the frontend dashboard:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Compass, Sparkles, Target, RefreshCw } from "lucide-react";

interface BriefingData {
  id: string;
  briefing_type: string;
  okr_focus: string;
  summary: string;
  tasks_dispatched: Array<{
    task_id: string;
    agent: string;
    instruction: string;
  }>;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function ExecutiveBriefingCard() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBriefing = async () => {
    try {
      const res = await fetch(`${API_URL}/briefings/latest`);
      if (res.ok) {
        const data = await res.json();
        setBriefing(data);
      }
    } catch (err) {
      console.error("Failed to load executive briefing", err);
    }
  };

  const handleManualTrigger = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/briefings/trigger-morning`, { method: "POST" });
      setTimeout(fetchBriefing, 4000); // Poll for updated plan
    } catch (err) {
      console.error("Trigger failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, []);

  if (!briefing) return null;

  return (
    <div className="border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-zinc-900/60 to-zinc-950 rounded-2xl p-6 backdrop-blur mb-8">
      {/* Card Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 font-mono flex items-center gap-2">
              EXECUTIVE DIRECTIVE
              <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {briefing.briefing_type}
              </span>
            </h2>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              Synced {new Date(briefing.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
            </p>
          </div>
        </div>

        <button
          onClick={handleManualTrigger}
          disabled={loading}
          className="text-xs font-mono text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Run Strategy Cycle
        </button>
      </div>

      {/* OKR Banner */}
      <div className="flex items-start gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 mb-4">
        <Target className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
        <div>
          <span className="text-xs font-semibold text-indigo-300 font-mono uppercase tracking-wider block">
            Primary OKR Target
          </span>
          <p className="text-sm text-zinc-200 font-medium mt-0.5">{briefing.okr_focus}</p>
        </div>
      </div>

      {/* CEO Executive Summary */}
      <p className="text-sm text-zinc-300 leading-relaxed mb-4">
        {briefing.summary}
      </p>

      {/* Delegated Sub-Tasks */}
      {briefing.tasks_dispatched && briefing.tasks_dispatched.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-zinc-800/60">
          <div className="flex items-center gap-1 text-xs text-zinc-400 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Dispatched Swarm Tasks ({briefing.tasks_dispatched.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {briefing.tasks_dispatched.map((t, idx) => (
              <div
                key={idx}
                className="bg-black/30 border border-zinc-800/80 rounded-lg p-2.5 flex flex-col justify-between text-xs font-mono"
              >
                <span className="text-indigo-400 font-semibold mb-1">{t.agent}</span>
                <span className="text-zinc-400 line-clamp-2">{t.instruction}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

Add `<ExecutiveBriefingCard/>` directly above `<ApprovalQueue/>` inside `app/page.tsx`:

```tsx
// Inside frontend/app/page.tsx:
<main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12">
  <div className="max-w-4xl mx-auto space-y-8">
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
      {/* ... header contents ... */}
    </header>

    {/* Executive Directive & OKR Focus */}
    <ExecutiveBriefingCard />

    {/* Operator Approvals */}
    <ApprovalQueue />

    {/* Task Trigger Bar */}
    <TaskTriggerModal />

    {/* Task Stream Feed */}
    {/* ... list of TaskCards ... */}
  </div>
</main>
```

---

## 7. How the Complete Autonomous Loop Operates

```
[06:00 UTC Celery Beat]
         │
         ▼
[Master Orchestrator] ──(Reads)──> [24h Telemetry + ChromaDB Memories]
         │
         ├── Generates Daily OKR & Strategic Directive
         │
         └── Fans out tasks via execute_agent_task.delay()
                 │
                 ├──> SocialMediaAgent  ──(Drafts)──> [Requires Approval] ──> Operator Approves ──> Posts to X
                 ├──> CodeGenerationAgent ──(Clones)──> Claude Code CLI ──> Pushes branch ──> Opens GitHub PR
                 └──> FinanceAgent      ──(Audits)──> Ledger verification ──> Logs stats into ChromaDB
         │
[20:00 UTC Celery Beat]
         │
         ▼
[Evening Retrospective] ──(Evaluates Velocity & Rejections)──> Persists learnings into ChromaDB
```

The system now functions as a closed-loop autonomous operating system:
* **The Orchestrator** governs priority setting and task generation.
* **The Swarm Workers** generate artifacts and interact with tools (git, CLI, APIs).
* **The Human Operator** retains safety controls through the pending approval queue.
* **ChromaDB and SQLite** ensure state and learnings persist continuously across operational cycles.
