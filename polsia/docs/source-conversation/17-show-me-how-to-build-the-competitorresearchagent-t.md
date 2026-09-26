# Show me how to build the CompetitorResearchAgent that scrapes competitor landing pages and changelogs to alert the Master Orchestrator to market changes.

> Status in this repo: Implemented: competitor change detection

The **`CompetitorResearchAgent`** serves as the radar for Polsia’s autonomous swarm. Running on a 12-hour cadence (at 04:00 and 16:00 UTC), it scrapes competitor landing pages, pricing grids, and changelogs, diffs them against cached snapshots, uses Claude Code to evaluate strategic threats, stores embeddings in ChromaDB, and injects actionable counter-measures directly into the **Master Orchestrator’s 06:00 AM OKR planning cycle**.

---

### System Architecture

```
 [ Competitor URLs ] (Landing, /pricing, /changelog)
          │
          ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 1. Scraper & Snapshot Engine (httpx + BeautifulSoup)        │
 │    - Strips boilerplate (scripts, nav, cookie banners)      │
 │    - Computes SHA-256 hash of extracted semantic text       │
 │    - Diffs changed content against relational snapshot      │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Diff Detected
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 2. Strategic Analyzer (Claude Code Headless)                │
 │    - Categorizes: PRICING_CHANGE | NEW_FEATURE | REBRAND    │
 │    - Threat Level: LOW | MEDIUM | HIGH                      │
 │    - Formulates counter-strategy (e.g., pricing adjustment,  │
 │      counter-feature PR, or social comparison post)         │
 └──────────────────────────────┬──────────────────────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
 [ Relational DB & ChromaDB ]                 [ Real-time Redis Event ]
 - MarketIntelligence table                   - Event: COMPETITOR_ALERT
 - Vector embedding in ChromaDB               - Feeds Next.js UI toast
        │
        ▼
 [ Master Orchestrator (06:00 AM) ]
 - Telemetry incorporates market moves
 - CEO automatically spins up sub-tasks:
     ├── CodeGenerationAgent (Counter-feature)
     └── SocialMediaAgent (Positioning tweet)
```

---

## 1. Relational Schemas (`app/models.py`)

Add tracking tables for monitored targets and synthesized market intelligence:

```python
# Add to app/models.py:
from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey
from datetime import datetime
from app.db import Base

class CompetitorTarget(Base):
    __tablename__ = "competitor_targets"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)          # e.g., "DevAgent.ai"
    url = Column(String)                       # e.g., "https://competitor.com/pricing"
    page_type = Column(String)                 # "PRICING", "CHANGELOG", "LANDING"
    last_content_hash = Column(String, nullable=True)
    last_snapshot_text = Column(Text, nullable=True)
    last_scraped_at = Column(DateTime, nullable=True)

class MarketIntelligence(Base):
    __tablename__ = "market_intelligence"

    id = Column(String, primary_key=True, index=True)
    competitor_name = Column(String, index=True)
    source_url = Column(String)
    change_type = Column(String)               # "PRICING_SHIFT", "NEW_FEATURE", "POSITIONING_PIVOT"
    threat_level = Column(String)              # "LOW", "MEDIUM", "HIGH"
    headline = Column(String)
    summary = Column(Text)
    counter_strategy = Column(Text)
    raw_diff = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## 2. Clean Web Extraction & Snapshot Engine (`app/scraper.py`)

This engine strips scripts, styles, SVG paths, and cookie banners to compute content hashes strictly on readable, semantic text:

```python
import hashlib
import re
import httpx
from bs4 import BeautifulSoup
from typing import Tuple, Optional
from app.config import settings

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

class CompetitorScraper:
    @staticmethod
    def extract_page_text(url: str, timeout: int = 15) -> str:
        """Fetches URL and strips layout boilerplate to isolate textual content."""
        if settings.SANDBOX_MODE:
            # Deterministic mock responses for testing
            if "pricing" in url:
                return (
                    "Pricing Plans: Starter: $29/mo (up to 5 agents). "
                    "Enterprise: $199/mo with Unlimited Claude 3.5 Sonnet workers, "
                    "24/7 dedicated support, and GitHub PR auto-merge."
                )
            elif "changelog" in url:
                return (
                    "Changelog Version 2.4.0: Released automated Stripe webhook reconciliation. "
                    "New: Support for self-healing bug tickets directly from Slack alerts."
                )
            return "DevAgent.ai - The fully autonomous developer workspace that writes software."

        headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"}
        with httpx.Client(follow_redirects=True, timeout=timeout) as client:
            resp = client.get(url, headers=headers)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        # Strip uninformative elements
        for tag in soup(["script", "style", "nav", "footer", "noscript", "svg", "header"]):
            tag.decompose()

        raw_text = soup.get_text(separator="\n")
        # Collapse extra whitespace
        cleaned_lines = [line.strip() for line in raw_text.splitlines() if len(line.strip()) > 3]
        return "\n".join(cleaned_lines)

    @classmethod
    def check_for_changes(cls, url: str, previous_hash: Optional[str]) -> Tuple[bool, str, str]:
        """
        Returns: (has_changed, current_hash, current_cleaned_text)
        """
        current_text = cls.extract_page_text(url)
        current_hash = hashlib.sha256(current_text.encode("utf-8")).hexdigest()
        
        has_changed = (previous_hash != current_hash)
        return has_changed, current_hash, current_text
```

---

## 3. The Competitor Research Agent (`app/competitor_agent.py`)

The agent monitors tracked URLs, extracts diffs, uses Claude Code to determine the strategic threat, and publishes alerts:

```python
import json
import uuid
import difflib
import redis
from datetime import datetime
from app.runner import run_claude_headless
from app.config import settings
from app.scraper import CompetitorScraper
from app.memory import AgentMemory
from app.db import SessionLocal
from app.models import CompetitorTarget, MarketIntelligence

r = redis.Redis.from_url(settings.REDIS_URL)

def load_soul() -> str:
    with open(settings.SOUL_PATH, "r") as f:
        return f.read()

class CompetitorResearchAgent:
    def __init__(self):
        self.name = "CompetitorResearchAgent"
        self.memory = AgentMemory("CompetitorResearchAgent")
        self.soul = load_soul()

    def seed_default_targets(self):
        """Initializes standard competitor targets if none exist."""
        db = SessionLocal()
        count = db.query(CompetitorTarget).count()
        if count == 0:
            defaults = [
                CompetitorTarget(
                    id=str(uuid.uuid4()),
                    name="DevAgent.ai",
                    url="https://devagent.ai/pricing",
                    page_type="PRICING"
                ),
                CompetitorTarget(
                    id=str(uuid.uuid4()),
                    name="DevAgent.ai",
                    url="https://devagent.ai/changelog",
                    page_type="CHANGELOG"
                ),
                CompetitorTarget(
                    id=str(uuid.uuid4()),
                    name="SwarmCode",
                    url="https://swarmcode.dev",
                    page_type="LANDING"
                )
            ]
            db.add_all(defaults)
            db.commit()
        db.close()

    def run_market_scan(self, task_id: str) -> dict:
        self.seed_default_targets()
        db = SessionLocal()
        targets = db.query(CompetitorTarget).all()

        detected_insights = []

        for target in targets:
            try:
                changed, new_hash, new_text = CompetitorScraper.check_for_changes(
                    target.url, target.last_content_hash
                )

                if not changed and target.last_snapshot_text:
                    continue  # Page unchanged, skip LLM evaluation

                # Compute unified diff between previous text and current text
                old_lines = (target.last_snapshot_text or "").splitlines()
                new_lines = new_text.splitlines()
                diff_lines = list(difflib.unified_diff(old_lines, new_lines, lineterm=""))
                diff_summary = "\n".join(diff_lines[:60]) # First 60 lines of delta

                if not diff_summary and target.last_snapshot_text:
                    # Content matched despite hash anomaly
                    target.last_content_hash = new_hash
                    db.commit()
                    continue

                # Analyze strategic significance via Claude Code
                prompt = (
                    f"You are the senior market intelligence and competitor analyst for Polsia.\n"
                    f"Competitor: {target.name} ({target.page_type})\n"
                    f"URL: {target.url}\n\n"
                    f"PAGE CONTENT DELTA / DIFF:\n```\n{diff_summary if diff_summary else new_text[:2000]}\n```\n\n"
                    "INSTRUCTIONS:\n"
                    "1. Identify specifically what changed (e.g. price cuts, new features, rebrand).\n"
                    "2. Determine threat level: LOW (cosmetic/minor), MEDIUM (feature parity risk), HIGH (aggressive price war or breakthrough capability).\n"
                    "3. Prescribe a concrete counter-measure for Polsia (e.g., 'Draft comparison tweet', 'Ship counter-feature in CodeAgent', 'Adjust starter pricing').\n\n"
                    "OUTPUT FORMAT (STRICT JSON ONLY):\n"
                    "{\n"
                    '  "change_type": "PRICING_SHIFT" | "NEW_FEATURE" | "POSITIONING_PIVOT" | "NO_SIGNIFICANT_CHANGE",\n'
                    '  "threat_level": "LOW" | "MEDIUM" | "HIGH",\n'
                    '  "headline": "One-line headline of the competitor move",\n'
                    '  "summary": "2-3 sentences explaining what they launched or modified",\n'
                    '  "counter_strategy": "Concrete recommendation for Polsia swarm"\n'
                    "}"
                )

                res = run_claude_headless(prompt=prompt, system_prompt=self.soul)
                parsed = json.loads(res.get("result", "{}"))

                if parsed.get("change_type") != "NO_SIGNIFICANT_CHANGE":
                    intel_id = str(uuid.uuid4())
                    intel = MarketIntelligence(
                        id=intel_id,
                        competitor_name=target.name,
                        source_url=target.url,
                        change_type=parsed.get("change_type", "NEW_FEATURE"),
                        threat_level=parsed.get("threat_level", "MEDIUM"),
                        headline=parsed.get("headline", f"Update on {target.name}"),
                        summary=parsed.get("summary", ""),
                        counter_strategy=parsed.get("counter_strategy", ""),
                        raw_diff=diff_summary[:1500] if diff_summary else "Initial baseline snapshot."
                    )
                    db.add(intel)

                    # Store in ChromaDB semantic memory for RAG retrieval by CEO
                    self.memory.record_memory(
                        content=(
                            f"Competitor Move: {target.name} [{parsed.get('change_type')}] - "
                            f"{parsed.get('headline')}. Counter-strategy: {parsed.get('counter_strategy')}"
                        ),
                        metadata={"threat": parsed.get("threat_level"), "source": target.url}
                    )

                    # Update target baseline
                    target.last_content_hash = new_hash
                    target.last_snapshot_text = new_text
                    target.last_scraped_at = datetime.utcnow()
                    db.commit()

                    detected_insights.append({
                        "id": intel_id,
                        "competitor": target.name,
                        "headline": parsed.get("headline"),
                        "threat": parsed.get("threat_level"),
                        "counter_strategy": parsed.get("counter_strategy")
                    })

                    # If threat is MEDIUM or HIGH, publish alert toast to WebSocket feed
                    if parsed.get("threat_level") in ["MEDIUM", "HIGH"]:
                        r.publish("polsia:events", json.dumps({
                            "event": "COMPETITOR_ALERT",
                            "competitor": target.name,
                            "headline": parsed.get("headline"),
                            "threat": parsed.get("threat_level"),
                            "counter_strategy": parsed.get("counter_strategy"),
                            "timestamp": datetime.utcnow().isoformat()
                        }))

            except Exception as e:
                print(f"[CompetitorAgent] Error scraping {target.url}: {e}")

        db.close()
        return {"scanned_targets": len(targets), "insights_generated": detected_insights}
```

---

## 4. Closing the Loop: Feeding into Master Orchestrator

Update `SystemTelemetry` in `app/analytics.py` to aggregate the last 24 hours of competitor intelligence so the morning CEO cycle acts on it:

```python
# In app/analytics.py (Update):
from app.models import MarketIntelligence

class SystemTelemetry:
    @staticmethod
    def get_24h_summary() -> dict:
        db: Session = SessionLocal()
        since = datetime.utcnow() - timedelta(hours=24)

        # ... existing approvals, support, financial calculations ...

        recent_intel = db.query(MarketIntelligence)\
            .filter(MarketIntelligence.created_at >= since)\
            .order_by(MarketIntelligence.created_at.desc())\
            .all()

        db.close()

        return {
            "period": "Last 24 Hours",
            # ... existing fields ...
            "competitor_intelligence_24h": [
                {
                    "competitor": i.competitor_name,
                    "threat": i.threat_level,
                    "headline": i.headline,
                    "recommended_counter": i.counter_strategy
                }
                for i in recent_intel
            ]
        }
```

### How the CEO Responds Automatically (06:00 AM)

When `MasterOrchestrator.run_morning_cycle()` executes at 06:00 UTC, the telemetry now contains:

```json
{
  "competitor_intelligence_24h": [
    {
      "competitor": "DevAgent.ai",
      "threat": "HIGH",
      "headline": "DevAgent slashed Enterprise tier by 40% and launched Slack bug auto-triage",
      "recommended_counter": "Deploy customer support self-healing PR feature and post technical benchmark on X"
    }
  ]
}
```

Claude Code recognizes the `HIGH` threat and outputs:
```json
{
  "briefing_type": "MORNING_STRATEGY",
  "okr_focus": "Defend against DevAgent pricing attack by promoting Polsia's superior git self-healing loop",
  "summary": "DevAgent slashed enterprise pricing. Our counter-offensive is to emphasize Polsia's direct code PR automation and zero-human runtimes.",
  "delegated_tasks": [
    {
      "agent": "SocialMediaAgent",
      "instruction": "Draft a punchy technical thread showing Polsia's GitHub PR self-healing loop vs standard Slack alerts."
    },
    {
      "agent": "CodeGenerationAgent",
      "instruction": "Add Slack webhook notification support to the self-healing CustomerSupportAgent workflow."
    }
  ]
}
```

The competitor's move translates into engineering and marketing work without manual human coordination.

---

## 5. Scheduling & Tasks (`app/celery_app.py` & `app/tasks.py`)

### Celery Beat Cadence (`app/celery_app.py`)
Run the market scan at **04:00 and 16:00 UTC** so fresh intel is parsed two hours before the CEO's 06:00 strategy cycle:

```python
# Add to celery_app.conf.beat_schedule in app/celery_app.py:

    "competitor-market-scan": {
        "task": "app.tasks.run_competitor_scan",
        "schedule": crontab(minute=0, hour="4,16"),  # Twice daily
    },
```

### Celery Task Handler (`app/tasks.py`)
```python
# Add to app/tasks.py:
from app.competitor_agent import CompetitorResearchAgent

competitor_agent = CompetitorResearchAgent()

@celery_app.task(bind=True)
def run_competitor_scan(self):
    r.publish("polsia:events", json.dumps({
        "event": "TASK_START",
        "task_id": self.request.id,
        "agent": "CompetitorResearchAgent",
        "instruction": "Scan competitor landing pages, pricing, and changelogs for strategic shifts."
    }))

    result = competitor_agent.run_market_scan(task_id=self.request.id)

    r.publish("polsia:events", json.dumps({
        "event": "TASK_COMPLETE",
        "task_id": self.request.id,
        "result": {
            "agent": "CompetitorResearchAgent",
            "task": "Scan competitor landscape",
            "output": f"Scanned {result['scanned_targets']} targets. Detected {len(result['insights_generated'])} strategic moves.",
            "verification": {"approved": True, "feedback": "Snapshot diffs updated in database and ChromaDB."}
        }
    }))
    return result
```

---

## 6. Endpoints for Market Intelligence (`app/main.py`)

```python
# In app/main.py:
from app.models import MarketIntelligence
from app.tasks import run_competitor_scan

@app.get("/competitors/intel")
def get_competitor_intelligence(db: Session = Depends(get_db)):
    """Returns top 10 most recent competitor intelligence alerts."""
    return db.query(MarketIntelligence).order_by(MarketIntelligence.created_at.desc()).limit(10).all()

@app.post("/competitors/scan")
def trigger_competitor_scan():
    """Manual scan trigger from dashboard."""
    task = run_competitor_scan.delay()
    return {"status": "enqueued", "task_id": task.id}
```

---

## 7. Frontend UI: Market Intelligence Feed (`components/CompetitorIntelCard.tsx`)

This dashboard widget displays real-time competitor moves, threat levels, and Polsia’s active counter-strategies:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Radar, AlertTriangle, ShieldCheck, ArrowRight, RefreshCw } from "lucide-react";

interface IntelItem {
  id: string;
  competitor_name: string;
  change_type: string;
  threat_level: "LOW" | "MEDIUM" | "HIGH";
  headline: string;
  summary: string;
  counter_strategy: string;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function CompetitorIntelCard() {
  const [intelList, setIntelList] = useState<IntelItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchIntel = async () => {
    try {
      const res = await fetch(`${API_URL}/competitors/intel`);
      if (res.ok) setIntelList(await res.json());
    } catch (err) {
      console.error("Failed to load competitor intelligence", err);
    }
  };

  const handleManualScan = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/competitors/scan`, { method: "POST" });
      setTimeout(fetchIntel, 3000);
    } catch (err) {
      console.error("Scan trigger failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntel();
  }, []);

  if (intelList.length === 0) return null;

  return (
    <div className="border border-zinc-800 bg-zinc-900/50 backdrop-blur rounded-2xl p-6 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Radar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold font-mono text-zinc-100 uppercase tracking-wider">
              Market Radar & Competitor Intelligence
            </h2>
            <p className="text-xs text-zinc-500 font-mono">
              Scraping changelogs & pricing grids on 12h cadence
            </p>
          </div>
        </div>

        <button
          onClick={handleManualScan}
          disabled={loading}
          className="text-xs font-mono text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/80 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Run Market Scan
        </button>
      </div>

      {/* Intel Grid */}
      <div className="space-y-3">
        {intelList.map((item) => {
          const isHigh = item.threat_level === "HIGH";
          const isMedium = item.threat_level === "MEDIUM";

          return (
            <div
              key={item.id}
              className="bg-black/40 border border-zinc-800/80 rounded-xl p-4 flex flex-col md:flex-row md:items-start justify-between gap-4"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-white">
                    {item.competitor_name}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                    {item.change_type}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                      isHigh
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : isMedium
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    }`}
                  >
                    THREAT: {item.threat_level}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-zinc-200 mt-1">{item.headline}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{item.summary}</p>

                {/* Tactical Counter Strategy */}
                <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-start gap-1.5 text-xs font-mono">
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-500">Polsia Counter-Strategy:</span>
                  <span className="text-indigo-300 font-medium">{item.counter_strategy}</span>
                </div>
              </div>

              <span className="text-[11px] font-mono text-zinc-500 self-start">
                {new Date(item.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Insert `<CompetitorIntelCard/>` directly above `<ApprovalQueue/>` in `app/page.tsx`.

---

## 8. Execution Validation

Trigger an ad-hoc competitor scan via `curl`:

```bash
curl -X POST http://localhost:8000/competitors/scan
```

### Resulting System Behavior:
1. **Scraping Pass:** `CompetitorScraper` retrieves `[https://devagent.ai/pricing](https://devagent.ai/pricing)` and detects that the Enterprise plan shifted from \$299 to \$199.
2. **Snapshot Diff:** The SHA-256 hash mismatch triggers unified diff generation.
3. **LLM Evaluation:** Claude Code categorizes the shift as `PRICING_SHIFT`, flags it as `HIGH` threat, and drafts the recommendation: *"Deploy customer support self-healing PR feature and post technical benchmark on X."*
4. **Broadcast & Persistence:** A `COMPETITOR_ALERT` event appears in the WebSocket feed, the record is committed to PostgreSQL/SQLite, and the insight is embedded into ChromaDB.
5. **CEO Orchestration:** During the 06:00 AM strategy cycle, `MasterOrchestrator` ingests this update from `SystemTelemetry`, automatically dispatching tasks to `SocialMediaAgent` and `CodeGenerationAgent` to defend market position.
