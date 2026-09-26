# How can I connect the Google Search Console API to track organic impressions and CTR for each generated comparison page?

> Status in this repo: Deferred: Search Console tracking

To track organic search performance (impressions, clicks, CTR, and average rank position) for each `/vs/[competitor]` comparison page, connect to the **Google Search Console (GSC) Search Analytics API**.

Because GSC data has an inherent **2-to-3-day reporting lag**, this pipeline runs as a daily Celery task that pulls windowed metrics, persists performance history into your relational database, and feeds low-CTR pages back into the autonomous generation loop for title/meta optimization.

---

### Pipeline Architecture

```
 Google Search Console API
  (Scope: webmasters.readonly)
               │
               ▼  Daily sync at 02:00 UTC (Lag window: Day T-3)
 ┌─────────────────────────────────────────────────────────────┐
 │ 1. GSC Search Analytics Adapter                             │
 │    - Dimension filter: page CONTAINS "/vs/"                 │
 │    - Pulls page-level metrics (clicks, impressions, CTR, pos)│
 │    - Pulls query-level breakdown per page                   │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 2. Relational Storage (SEOPagePerformance)                  │
 │    - Daily snapshots keyed by (slug, date)                  │
 │    - Identifies top converting search queries               │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 3. Autonomous Feedback & Re-Optimization Engine             │
 │    - High Impressions + Low CTR (<2%)                       │
 │      ──► Dispatches Claude Code to rewrite meta title/hook  │
 │    - Discovered High-Volume Queries                         │
 │      ──► Appends to ChromaDB competitor memory              │
 └─────────────────────────────────────────────────────────────┘
```

---

## 1. Google Cloud & Search Console Credentials Setup

Automated daemon pipelines should use a **Google Cloud Service Account** rather than interactive OAuth:

1. In the [Google Cloud Console](https://console.cloud.google.com/), enable the **Google Search Console API**.
2. Go to **IAM & Admin > Service Accounts** and create a service account (e.g., `polsia-gsc-reader@project.iam.gserviceaccount.com`).
3. Under the **Keys** tab, click **Add Key > Create New Key > JSON**, and save it locally as `./certs/gsc-service-account.json`.
4. **Grant Access in GSC:** Open [Google Search Console](https://search.google.com/search-console), select your property, go to **Settings > Users and permissions**, click **Add User**, paste the service account email, and grant **Restricted** (read-only) permissions.

Install the official Google client libraries:
```bash
pip install google-api-python-client google-auth
```

---

## 2. Relational Database Schema (`app/models.py`)

Store daily snapshots of page-level metrics and query performance:

```python
# Add to app/models.py:
from sqlalchemy import Column, String, Integer, Float, Date, DateTime, JSON, UniqueConstraint
from datetime import datetime
from app.db import Base

class SEOPageMetric(Base):
    __tablename__ = "seo_page_metrics"

    id = Column(String, primary_key=True, index=True)
    page_url = Column(String, index=True)
    slug = Column(String, index=True)          # e.g., "devagent-ai"
    date = Column(Date, index=True)             # Date of recorded metrics
    clicks = Column(Integer, default=0)
    impressions = Column(Integer, default=0)
    ctr = Column(Float, default=0.0)            # Clicks / Impressions (0.0 to 1.0)
    avg_position = Column(Float, default=0.0)   # Average rank position (1.0 is #1)
    top_queries = Column(JSON, default=list)    # [{"query": "...", "clicks": X, "impressions": Y, "position": Z}]
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("page_url", "date", name="uq_page_date"),
    )
```

---

## 3. Google Search Console API Adapter (`app/adapters/gsc_adapter.py`)

This adapter authenticates via the service account, queries the `searchanalytics` resource with dimension filters for `/vs/`, and handles pagination:

```python
import os
import uuid
from datetime import date, timedelta
from typing import List, Dict, Any
from google.oauth2 import service_account
from googleapiclient.discovery import build
from app.config import settings

SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"] #
CREDENTIALS_PATH = os.path.abspath("./certs/gsc-service-account.json")

class GSCAdapter:
    def __init__(self):
        self.site_url = os.getenv("GSC_SITE_URL", "sc-domain:polsia.ai")
        self.service = None

        if os.path.exists(CREDENTIALS_PATH) and not settings.SANDBOX_MODE:
            creds = service_account.Credentials.from_service_account_file( #
                CREDENTIALS_PATH, scopes=SCOPES
            )
            self.service = build("searchconsole", "v1", credentials=creds, cache_discovery=False) #

    def fetch_daily_comparison_performance(self, target_date: date) -> List[Dict[str, Any]]:
        """
        Pulls metrics for target_date filtered to programmatic comparison pages (/vs/).
        GSC data has a 2-3 day lag; target_date should typically be (today - 3 days).
        """
        if not self.service or settings.SANDBOX_MODE:
            # Deterministic mock responses for testing
            return [
                {
                    "page": "https://polsia.ai/vs/devagent-ai",
                    "slug": "devagent-ai",
                    "clicks": 42,
                    "impressions": 1850,
                    "ctr": 0.0227,
                    "position": 4.8,
                    "top_queries": [
                        {"query": "devagent alternative", "clicks": 28, "impressions": 620, "position": 2.1},
                        {"query": "polsia vs devagent", "clicks": 11, "impressions": 210, "position": 1.4},
                        {"query": "devagent pricing vs polsia", "clicks": 3, "impressions": 450, "position": 8.9}
                    ]
                },
                {
                    "page": "https://polsia.ai/vs/swarmcode",
                    "slug": "swarmcode",
                    "clicks": 4,
                    "impressions": 820,
                    "ctr": 0.0048,  # Underperforming CTR (High impressions, low click-through)
                    "position": 7.2,
                    "top_queries": [
                        {"query": "swarmcode competitors", "clicks": 3, "impressions": 410, "position": 6.5},
                        {"query": "swarmcode alternatives", "clicks": 1, "impressions": 320, "position": 8.1}
                    ]
                }
            ]

        date_str = target_date.strftime("%Y-%m-%d")

        # 1. Page-level query
        page_payload = {
            "startDate": date_str,
            "endDate": date_str,
            "dimensions": ["page"], #
            "dimensionFilterGroups": [{
                "filters": [{
                    "dimension": "page", #
                    "operator": "contains", #
                    "expression": "/vs/"
                }]
            }],
            "rowLimit": 500 #
        }

        page_resp = self.service.searchanalytics().query(siteUrl=self.site_url, body=page_payload).execute() #
        rows = page_resp.get("rows", []) #

        # 2. Query breakdown for search terms per page
        query_payload = {
            "startDate": date_str,
            "endDate": date_str,
            "dimensions": ["page", "query"], #
            "dimensionFilterGroups": [{
                "filters": [{
                    "dimension": "page", #
                    "operator": "contains", #
                    "expression": "/vs/"
                }]
            }],
            "rowLimit": 5000 #
        }
        query_resp = self.service.searchanalytics().query(siteUrl=self.site_url, body=query_payload).execute() #
        query_rows = query_resp.get("rows", []) #

        # Map queries to page URLs
        queries_by_page: Dict[str, list] = {}
        for r in query_rows: #
            pg = r["keys"][0] #
            term = r["keys"][1] #
            queries_by_page.setdefault(pg, []).append({
                "query": term,
                "clicks": r.get("clicks", 0),
                "impressions": r.get("impressions", 0),
                "position": round(r.get("position", 0.0), 1)
            })

        results = []
        for r in rows:
            page_url = r["keys"][0] #
            slug = page_url.rstrip("/").split("/vs/")[-1]
            
            # Sort top queries by impressions descending
            top_q = sorted(
                queries_by_page.get(page_url, []),
                key=lambda x: x["impressions"],
                reverse=True
            )[:10]

            results.append({
                "page": page_url,
                "slug": slug,
                "clicks": r.get("clicks", 0),
                "impressions": r.get("impressions", 0),
                "ctr": round(r.get("ctr", 0.0), 4),
                "position": round(r.get("position", 0.0), 1),
                "top_queries": top_q
            })

        return results
```

---

## 4. Rank Tracking & Autonomous Optimization Loop (`app/seo_tracker.py`)

This service processes the ingested GSC records and triggers optimization loops:
* **CTR Optimization Hook:** If a comparison page ranks in the top 10 (`position < 10.0`) with strong demand (`impressions > 500`) but an unoptimized click-through rate (`CTR < 1.5%`), Claude Code is dispatched to rewrite the headline and meta title to improve organic CTR.
* **ChromaDB Keyword Expansion:** High-volume keywords surfaced by GSC that aren't mentioned in the current MDX file are indexed into semantic memory so future revisions incorporate them.

```python
import uuid
import json
from datetime import date, timedelta
from app.db import SessionLocal
from app.models import SEOPageMetric
from app.adapters.gsc_adapter import GSCAdapter
from app.memory import AgentMemory
from app.runner import run_claude_headless
from app.seo_generator import SEOComparisonGenerator

class SEORankTracker:
    @classmethod
    def sync_recent_performance(cls) -> Dict[str, Any]:
        """Runs daily to ingest Search Console data from 3 days prior."""
        target_date = date.today() - timedelta(days=3)
        adapter = GSCAdapter()
        metrics = adapter.fetch_daily_comparison_performance(target_date)

        db = SessionLocal()
        synced_count = 0
        optimization_candidates = []

        for m in metrics:
            # Check if record already exists (idempotent upsert)
            record = db.query(SEOPageMetric).filter(
                SEOPageMetric.page_url == m["page"],
                SEOPageMetric.date == target_date
            ).first()

            if not record:
                record = SEOPageMetric(
                    id=str(uuid.uuid4()),
                    page_url=m["page"],
                    slug=m["slug"],
                    date=target_date,
                    clicks=m["clicks"],
                    impressions=m["impressions"],
                    ctr=m["ctr"],
                    avg_position=m["position"],
                    top_queries=m["top_queries"]
                )
                db.add(record)
            else:
                record.clicks = m["clicks"]
                record.impressions = m["impressions"]
                record.ctr = m["ctr"]
                record.avg_position = m["position"]
                record.top_queries = m["top_queries"]

            synced_count += 1

            # Check if page qualifies for CTR meta-title re-optimization
            if m["impressions"] >= 500 and m["ctr"] < 0.015 and m["position"] <= 10.0:
                optimization_candidates.append(m)

        db.commit()
        db.close()

        # Trigger re-optimization for underperforming titles
        for cand in optimization_candidates:
            cls._reoptimize_page_meta(cand["slug"], cand)

        return {
            "date_synced": str(target_date),
            "pages_synced": synced_count,
            "reoptimizations_triggered": len(optimization_candidates)
        }

    @classmethod
    def _reoptimize_page_meta(cls, slug: str, perf_data: dict):
        """Uses Claude Code to rewrite page title and description based on proven search queries."""
        top_terms = [q["query"] for q in perf_data.get("top_queries", [])[:5]]
        
        prompt = (
            f"You are an expert technical SEO conversion copywriter.\n"
            f"The programmatic comparison page for '{slug}' has high search impressions ({perf_data['impressions']}) "
            f"and good rank position ({perf_data['position']}), but a poor CTR of {perf_data['ctr']*100:.2f}%.\n\n"
            f"REAL USER SEARCH QUERIES DRIVING IMPRESSIONS:\n{json.dumps(top_terms, indent=2)}\n\n"
            "INSTRUCTIONS:\n"
            "Write an aggressive, high-CTR Meta Title (< 60 chars) and Meta Description (< 155 chars) "
            "that matches search intent and includes primary search terms.\n\n"
            "Return JSON ONLY: {\"metaTitle\": \"...\", \"metaDescription\": \"...\"}"
        )

        res = run_claude_headless(prompt=prompt)
        try:
            suggestions = json.loads(res.get("result", "{}"))
            # Store in semantic memory for the SEO generator's next MDX build
            mem = AgentMemory("SEOOptimizer")
            mem.record_memory(
                content=f"SEO Optimizations for {slug}: Title='{suggestions.get('metaTitle')}', Desc='{suggestions.get('metaDescription')}'",
                metadata={"slug": slug, "type": "CTR_OPTIMIZATION"}
            )
            # Regenerate the page with new hooks
            SEOComparisonGenerator.generate_page_for_competitor(slug.replace("-", " ").title())
        except Exception as e:
            print(f"[SEO Optimizer] Failed re-optimization for {slug}: {e}")
```

---

## 5. Daily Celery Beat Task (`app/celery_app.py` & `app/tasks.py`)

Schedule GSC ingestion at **02:00 UTC daily**:

```python
# Add to celery_app.conf.beat_schedule in app/celery_app.py:

    "gsc-daily-seo-sync": {
        "task": "app.tasks.run_gsc_performance_sync",
        "schedule": crontab(minute=0, hour=2),  # 02:00 UTC daily
    },
```

Wire the task in `app/tasks.py`:

```python
# In app/tasks.py:
from app.seo_tracker import SEORankTracker

@celery_app.task
def run_gsc_performance_sync():
    r.publish("polsia:events", json.dumps({
        "event": "TASK_START",
        "agent": "SEORankTracker",
        "instruction": "Ingest Google Search Console impressions and rank positions."
    }))

    result = SEORankTracker.sync_recent_performance()

    r.publish("polsia:events", json.dumps({
        "event": "TASK_COMPLETE",
        "agent": "SEORankTracker",
        "result": result
    }))
    return result
```

---

## 6. Expose API Endpoints (`app/main.py`)

Provide performance metrics to the frontend and allow manual re-syncing:

```python
# In app/main.py:
from sqlalchemy import func
from app.models import SEOPageMetric
from app.tasks import run_gsc_performance_sync

@app.get("/seo/performance")
def get_seo_performance(db: Session = Depends(get_db)):
    """Returns the latest performance metrics for each comparison page."""
    # Subquery for most recent date per page
    subq = db.query(
        SEOPageMetric.page_url,
        func.max(SEOPageMetric.date).label("max_date")
    ).group_by(SEOPageMetric.page_url).subquery()

    latest_records = db.query(SEOPageMetric).join(
        subq,
        (SEOPageMetric.page_url == subq.c.page_url) & (SEOPageMetric.date == subq.c.max_date)
    ).all()

    return [
        {
            "slug": r.slug,
            "page_url": r.page_url,
            "date": str(r.date),
            "clicks": r.clicks,
            "impressions": r.impressions,
            "ctr": r.ctr,
            "avg_position": r.avg_position,
            "top_queries": r.top_queries[:3]
        }
        for r in latest_records
    ]

@app.post("/seo/sync-gsc")
def trigger_gsc_sync():
    """Manual trigger to sync Search Console data."""
    task = run_gsc_performance_sync.delay()
    return {"status": "enqueued", "task_id": task.id}
```

---

## 7. Next.js SEO Ranking Card (`components/SEOPerformanceDashboard.tsx`)

This component displays organic impressions, average rank positions, CTR health, and query terms for each `/vs/` page:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Search, TrendingUp, MousePointerClick, Eye, ArrowUpRight, AlertCircle, RefreshCw } from "lucide-react";

interface PageMetric {
  slug: string;
  page_url: string;
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avg_position: number;
  top_queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    position: number;
  }>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function SEOPerformanceDashboard() {
  const [metrics, setMetrics] = useState<PageMetric[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${API_URL}/seo/performance`);
      if (res.ok) setMetrics(await res.json());
    } catch (err) {
      console.error("Failed to load SEO metrics", err);
    }
  };

  const handleManualSync = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/seo/sync-gsc`, { method: "POST" });
      setTimeout(fetchMetrics, 3000);
    } catch (err) {
      console.error("GSC Sync failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (metrics.length === 0) return null;

  return (
    <div className="border border-zinc-800 bg-zinc-900/50 backdrop-blur rounded-2xl p-6 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold font-mono text-zinc-100 uppercase tracking-wider">
              Organic Search Performance (GSC)
            </h2>
            <p className="text-xs text-zinc-500 font-mono">
              Tracking /vs/* programmatic pages with 3-day verification lag
            </p>
          </div>
        </div>

        <button
          onClick={handleManualSync}
          disabled={loading}
          className="text-xs font-mono text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 bg-zinc-900 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Sync GSC
        </button>
      </div>

      {/* Pages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.map((m) => {
          const isLowCtr = m.impressions > 500 && m.ctr < 0.015;

          return (
            <div
              key={m.slug}
              className="bg-black/40 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-mono font-bold text-indigo-400">
                    /vs/{m.slug}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      Rank #{m.avg_position.toFixed(1)}
                    </span>
                    {isLowCtr && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Low CTR
                      </span>
                    )}
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-3 gap-2 text-xs font-mono mb-4">
                  <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/60">
                    <span className="text-zinc-500 block text-[10px] flex items-center gap-1">
                      <Eye className="w-3 h-3 text-zinc-400" /> Impressions
                    </span>
                    <span className="text-zinc-200 font-bold mt-1 block">
                      {m.impressions.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/60">
                    <span className="text-zinc-500 block text-[10px] flex items-center gap-1">
                      <MousePointerClick className="w-3 h-3 text-emerald-400" /> Clicks
                    </span>
                    <span className="text-emerald-400 font-bold mt-1 block">
                      {m.clicks}
                    </span>
                  </div>

                  <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/60">
                    <span className="text-zinc-500 block text-[10px]">CTR</span>
                    <span className={`font-bold mt-1 block ${isLowCtr ? "text-amber-400" : "text-zinc-200"}`}>
                      {(m.ctr * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Top Search Terms */}
                {m.top_queries && m.top_queries.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-800/60">
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                      Top Converting Search Queries
                    </span>
                    {m.top_queries.map((q, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                        <span className="truncate max-w-[200px] text-zinc-300">"{q.query}"</span>
                        <div className="flex items-center gap-3">
                          <span>{q.impressions} imp</span>
                          <span className="text-emerald-400 font-medium">#{q.position}</span>
                        </div>
                      </div>
                    ))}
                  </div>
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

Insert `<SEOPerformanceDashboard/>` directly above `<ApprovalQueue/>` in `app/page.tsx`.

---

## 8. Closed-Loop Operation

1. **Scheduled Retrieval (02:00 UTC):** Celery triggers `run_gsc_performance_sync()`, querying GSC for search traffic on day $T-3$.
2. **Database Ingestion:** Records for each comparison page are upserted into `seo_page_metrics`.
3. **Automated Re-Optimization:** If `/vs/swarmcode` receives 820 impressions with an average rank of #7.2 but an organic CTR of only 0.48%, `SEORankTracker` triggers Claude Code to write higher-converting title and description variants tailored to the discovered search terms.
4. **Rebuilding:** `SEOComparisonGenerator` rebuilds the MDX document with updated metadata, completing the loop without human intervention.
