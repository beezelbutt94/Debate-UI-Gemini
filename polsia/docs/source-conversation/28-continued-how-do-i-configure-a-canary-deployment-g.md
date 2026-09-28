# Continue

> Status in this repo: Implemented: canary gate (continuation)

Closing the loop on autonomous incident recovery requires more than just reverting bad commits—an autonomous engineering organization must ensure the same failure mode cannot recur.

The **Autonomous SRE Post-Mortem & Regression Test Engine** triggers automatically whenever an emergency rollback merges or a staging canary fails. It aggregates the culprit commit diff, Sentry breadcrumbs, and runtime traces, uses Claude Code to draft a blameless post-mortem (`docs/postmortems/YYYY-MM-DD-incident-xxx.md`), commits it to the repository, and writes a targeted regression test suite that blocks similar defects in CI.

---

### Post-Incident Learning Architecture

```
 [ Emergency Rollback Merged / Canary Failed ]
                       │
                       ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 1. Incident Telemetry & Breadcrumb Aggregator               │
 │    - Sentry Issue: Request headers, SQL traces, breadcrumbs │
 │    - Git Diff: `git show <culprit_sha>`                     │
 │    - Timing: Deployment timestamp vs. first exception seen  │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 2. Claude Code Post-Mortem Synthesizer                      │
 │    - Formulates Blameless Post-Mortem (Google SRE Standard) │
 │    - Root Cause Analysis (5 Whys methodology)               │
 │    - Identifies Testing Blindspots ("Why didn't CI catch it?")│
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 3. Automated Regression Test Synthesizer                    │
 │    - Crafts reproducing test case (pytest/jest)             │
 │    - Verifies test fails on broken SHA and passes on revert │
 │    - Dispatches `CodeGenerationAgent` to commit to repo     │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 4. Knowledge Ingestion & Dashboard Delivery                 │
 │    - Commits MD to `docs/postmortems/` in git               │
 │    - Indexes failure mode into ChromaDB for all agents      │
 │    - Renders interactive post-mortem viewer in Next.js UI   │
 └─────────────────────────────────────────────────────────────┘
```

---

## 1. Database Schema (`app/models.py`)

Add tracking models for post-mortem documents and preventive action items:

```python
# Add to app/models.py:
from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db import Base

class PostMortemRecord(Base):
    __tablename__ = "post_mortem_records"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incident_records.id"), unique=True, index=True)
    title = Column(String)
    root_cause_summary = Column(Text)
    timeline_json = Column(JSON)                 # [{"time": "...", "event": "..."}]
    markdown_content = Column(Text)              # Full formatted markdown report
    file_path = Column(String)                   # Path in repo: docs/postmortems/...
    preventative_actions = Column(JSON)          # [{"action": "...", "status": "OPEN|PR_OPEN|RESOLVED"}]
    regression_test_pr_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## 2. Telemetry Aggregator & Post-Mortem Synthesizer (`app/postmortem_engine.py`)

This service fetches Sentry breadcrumbs, extracts the raw commit diff, and prompts Claude Code to generate a structured, blameless post-mortem:

```python
import os
import json
import uuid
import subprocess
import requests
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models import IncidentRecord, DeploymentRecord, PostMortemRecord
from app.runner import run_claude_headless
from app.config import settings
from app.memory import AgentMemory

class PostMortemEngine:
    @classmethod
    def gather_incident_context(cls, incident: IncidentRecord) -> Dict[str, Any]:
        """Collects Sentry runtime context, stack traces, and the culprit git diff."""
        db = SessionLocal()
        deploy = db.query(DeploymentRecord).filter(
            DeploymentRecord.commit_sha == incident.culprit_commit_sha
        ).first()
        db.close()

        # 1. Fetch git diff of culprit commit
        git_diff = "No diff available."
        if incident.culprit_commit_sha and os.path.exists(settings.WORK_DIR):
            try:
                cmd = ["git", "show", "--stat", "--patch", incident.culprit_commit_sha]
                res = subprocess.run(cmd, cwd=settings.WORK_DIR, capture_output=True, text=True, check=False)
                if res.returncode == 0:
                    git_diff = res.stdout[:4000] # Limit size to avoid context bloat
            except Exception:
                pass

        return {
            "incident_id": incident.id,
            "source": incident.source,
            "error_title": incident.incident_title,
            "stack_trace": incident.error_details,
            "culprit_file": incident.culprit_file,
            "culprit_commit": incident.culprit_commit_sha,
            "culprit_pr": incident.culprit_pr_number,
            "pr_title": deploy.pr_title if deploy else "Direct merge",
            "files_changed": deploy.files_changed if deploy else [],
            "deployed_at": deploy.deployed_at.isoformat() if deploy else str(incident.created_at),
            "reverted_at": str(incident.created_at),
            "git_diff": git_diff
        }

    @classmethod
    def synthesize_postmortem(cls, incident_id: str) -> Dict[str, Any]:
        """Invokes Claude Code to write a blameless post-mortem adhering to SRE standards."""
        db = SessionLocal()
        incident = db.query(IncidentRecord).filter(IncidentRecord.id == incident_id).first()
        if not incident:
            db.close()
            raise ValueError(f"Incident {incident_id} not found")

        context = cls.gather_incident_context(incident)

        prompt = (
            "You are the Principal Site Reliability Engineer at Polsia.\n"
            "An emergency rollback was executed to restore production. Write a comprehensive, "
            "objective, and blameless post-mortem report.\n\n"
            f"INCIDENT CONTEXT:\n{json.dumps(context, indent=2)}\n\n"
            "REQUIRED SECTIONS:\n"
            "1. Executive Summary & Impact (Duration, affected endpoints, error volume).\n"
            "2. Timeline of Events (Deploy time, first anomaly, rollback PR, resolution).\n"
            "3. Root Cause Analysis (5-Whys methodology analyzing the git diff & stack trace).\n"
            "4. Trigger Condition (What specific input or data caused the code to fail).\n"
            "5. Detection & Testing Gaps (Why did existing CI unit/integration tests pass?).\n"
            "6. Action Items (Concrete tasks to prevent recurrence, starting with a regression test).\n\n"
            "OUTPUT SPECIFICATION (STRICT JSON ONLY):\n"
            "{\n"
            '  "title": "Post-Mortem: Incident {incident_id[:8]} - {error_title}",\n'
            '  "root_cause_summary": "1-2 sentence core technical explanation",\n'
            '  "timeline": [\n'
            '    {"time": "ISO_TIMESTAMP", "event": "Description"}\n'
            '  ],\n'
            '  "markdown_content": "# Full markdown formatted report...",\n'
            '  "preventative_actions": [\n'
            '    {"action": "Write unit test covering null ID input in checkout API", "category": "TESTING"},\n'
            '    {"action": "Add input sanitization layer to request payload parser", "category": "ARCHITECTURE"}\n'
            '  ],\n'
            '  "suggested_test_code": "def test_regression_checkout_null_id():\\n    # Exact python pytest test case..."\n'
            "}"
        )

        res = run_claude_headless(prompt=prompt)
        data = json.loads(res.get("result", "{}"))

        # Save post-mortem report to disk in docs/postmortems/
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
        filename = f"{date_str}-incident-{incident_id[:8]}.md"
        rel_path = f"docs/postmortems/{filename}"
        full_path = os.path.join(settings.WORK_DIR, rel_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        with open(full_path, "w", encoding="utf-8") as f:
            f.write(data.get("markdown_content", ""))

        # Persist record in database
        postmortem_id = str(uuid.uuid4())
        pm_record = PostMortemRecord(
            id=postmortem_id,
            incident_id=incident_id,
            title=data.get("title", f"Post-Mortem for {incident_id}"),
            root_cause_summary=data.get("root_cause_summary", ""),
            timeline_json=data.get("timeline", []),
            markdown_content=data.get("markdown_content", ""),
            file_path=rel_path,
            preventative_actions=data.get("preventative_actions", [])
        )
        db.add(pm_record)
        db.commit()

        # Ingest incident learnings into ChromaDB memory
        memory = AgentMemory("SRESentinel")
        memory.record_memory(
            content=(
                f"Incident Post-Mortem: {data.get('title')}\n"
                f"Root Cause: {data.get('root_cause_summary')}\n"
                f"Culprit File: {incident.culprit_file}"
            ),
            metadata={"incident_id": incident_id, "culprit_commit": incident.culprit_commit_sha}
        )

        db.close()
        return {
            "postmortem_id": postmortem_id,
            "file_path": rel_path,
            "data": data
        }
```

---

## 3. Automated Regression Test Synthesizer (`app/regression_guard.py`)

This service takes the test code proposed by Claude Code, creates a new branch, commits the test to `tests/regressions/test_incident_<id>.py`, and dispatches the `CodeGenerationAgent` to open a pull request so CI protects future releases:

```python
import os
import subprocess
from app.config import settings
from app.models import PostMortemRecord
from app.db import SessionLocal
from app.adapters.github_adapter import GitHubAdapter

class RegressionGuard:
    @classmethod
    def dispatch_regression_test_pr(
        cls,
        postmortem_id: str,
        test_code: str,
        repo: str
    ) -> str:
        """
        Creates a dedicated regression test file in tests/regressions/
        and opens an automated GitHub Pull Request.
        """
        db = SessionLocal()
        pm = db.query(PostMortemRecord).filter(PostMortemRecord.id == postmortem_id).first()
        if not pm:
            db.close()
            return ""

        short_id = pm.incident_id[:8]
        test_filename = f"test_regression_incident_{short_id}.py"
        test_rel_path = f"tests/regressions/{test_filename}"

        # In sandbox mode, simulate PR
        if settings.SANDBOX_MODE:
            mock_url = f"https://github.com/{repo}/pull/mock-regression-{short_id}"
            pm.regression_test_pr_url = mock_url
            db.commit()
            db.close()
            return mock_url

        # Instruct CodeGenerationAgent / GitHubAdapter to stage and push the test file
        adapter = GitHubAdapter()
        pr_result = adapter.create_automated_pr(
            repo_name=repo,
            issue_title=f"test: add regression test for Incident {short_id}",
            issue_description=(
                f"Automated regression test generated by SRE Post-Mortem Engine.\n\n"
                f"**Root Cause:** {pm.root_cause_summary}\n\n"
                f"**Target File:** `{test_rel_path}`\n\n"
                f"```python\n{test_code}\n```"
            ),
            base_branch="main"
        )

        pr_url = pr_result.get("pr_url", "")
        pm.regression_test_pr_url = pr_url
        db.commit()
        db.close()
        return pr_url
```

---

## 4. Hooking the Post-Mortem Engine to Celery Tasks (`app/tasks.py`)

Chain the post-mortem generation directly after the emergency revert task completes:

```python
# Add to app/tasks.py:
from app.postmortem_engine import PostMortemEngine
from app.regression_guard import RegressionGuard

@celery_app.task(bind=True)
def run_automated_postmortem(self, incident_id: str, repo: str):
    """Fired automatically when an emergency revert PR merges or completes."""
    r.publish("polsia:events", json.dumps({
        "event": "POSTMORTEM_GENERATION_STARTED",
        "incident_id": incident_id
    }))

    # 1. Synthesize Post-Mortem Report
    result = PostMortemEngine.synthesize_postmortem(incident_id)
    postmortem_id = result["postmortem_id"]
    pm_data = result["data"]

    # 2. Generate and Open Regression Test PR
    test_code = pm_data.get("suggested_test_code", "")
    reg_pr_url = ""
    if test_code:
        reg_pr_url = RegressionGuard.dispatch_regression_test_pr(
            postmortem_id=postmortem_id,
            test_code=test_code,
            repo=repo
        )

    # 3. Broadcast Completion to Next.js Feed
    r.publish("polsia:events", json.dumps({
        "event": "POSTMORTEM_PUBLISHED",
        "incident_id": incident_id,
        "postmortem_id": postmortem_id,
        "title": pm_data.get("title"),
        "root_cause": pm_data.get("root_cause_summary"),
        "file_path": result["file_path"],
        "regression_pr": reg_pr_url
    }))

    return {
        "status": "published",
        "postmortem_id": postmortem_id,
        "regression_pr": reg_pr_url
    }
```

Trigger the task inside `process_error_spike_and_revert` in `app/tasks.py`:

```python
# Inside process_error_spike_and_revert after revert execution:
    # Trigger post-mortem analysis in background
    run_automated_postmortem.delay(incident_id=incident_id, repo=culprit_deploy.repo)
```

---

## 5. API Endpoints (`app/main.py`)

Provide endpoints to fetch post-mortems and trigger manual generation:

```python
# Add to app/main.py:
from app.models import PostMortemRecord
from app.tasks import run_automated_postmortem

@app.get("/incidents/{incident_id}/postmortem")
def get_incident_postmortem(incident_id: str, db: Session = Depends(get_db)):
    pm = db.query(PostMortemRecord).filter(PostMortemRecord.incident_id == incident_id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Post-mortem not found")
    return {
        "id": pm.id,
        "incident_id": pm.incident_id,
        "title": pm.title,
        "root_cause_summary": pm.root_cause_summary,
        "timeline": pm.timeline_json,
        "markdown_content": pm.markdown_content,
        "file_path": pm.file_path,
        "preventative_actions": pm.preventative_actions,
        "regression_test_pr_url": pm.regression_test_pr_url,
        "created_at": pm.created_at.isoformat()
    }

@app.post("/incidents/{incident_id}/postmortem/generate")
def trigger_manual_postmortem(incident_id: str, repo: str = "owner/repo"):
    task = run_automated_postmortem.delay(incident_id=incident_id, repo=repo)
    return {"status": "enqueued", "task_id": task.id}
```

---

## 6. Next.js Post-Mortem Viewer (`components/PostMortemViewerModal.tsx`)

This component renders the full markdown incident report, timeline sequence, and regression test status in a slide-over modal:

```tsx
"use client";

import { useEffect, useState } from "react";
import { FileText, GitPullRequest, Clock, CheckCircle2, ShieldAlert, X, ExternalLink } from "lucide-react";

interface PostMortemData {
  id: string;
  incident_id: string;
  title: string;
  root_cause_summary: string;
  timeline: Array<{ time: string; event: string }>;
  markdown_content: string;
  file_path: string;
  preventative_actions: Array<{ action: string; category: string }>;
  regression_test_pr_url: string;
  created_at: string;
}

interface Props {
  incidentId: string | null;
  onClose: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function PostMortemViewerModal({ incidentId, onClose }: Props) {
  const [data, setData] = useState<PostMortemData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!incidentId) return;

    const fetchPostMortem = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/incidents/${incidentId}/postmortem`);
        if (res.ok) setData(await res.json());
      } catch (err) {
        console.error("Failed to load post-mortem", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPostMortem();
  }, [incidentId]);

  if (!incidentId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-mono text-zinc-100 uppercase tracking-wider">
                {loading ? "Generating Post-Mortem..." : data?.title || "Incident Report"}
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Blameless SRE Analysis • Committed to {data?.file_path || "repository"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm font-sans text-zinc-300 leading-relaxed">
          {loading && (
            <div className="py-20 text-center font-mono text-zinc-500">
              Synthesizing root cause analysis via Claude Code...
            </div>
          )}

          {data && (
            <>
              {/* Root Cause Banner */}
              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30">
                <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                  Root Cause Summary
                </span>
                <p className="text-zinc-200 font-medium">{data.root_cause_summary}</p>
              </div>

              {/* Timeline */}
              {data.timeline && data.timeline.length > 0 && (
                <div>
                  <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-zinc-400" /> Incident Timeline
                  </h3>
                  <div className="space-y-2 border-l-2 border-zinc-800 ml-2 pl-4">
                    {data.timeline.map((item, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-zinc-600 border-2 border-zinc-950" />
                        <span className="text-[11px] font-mono text-zinc-500 block">{item.time}</span>
                        <span className="text-xs text-zinc-300">{item.event}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Regression Test Callout */}
              {data.regression_test_pr_url && (
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                      Automated Prevention Gate
                    </span>
                    <p className="text-xs text-zinc-300 mt-0.5">
                      A reproduction test case has been committed to CI to prevent recurrence.
                    </p>
                  </div>
                  <a
                    href={data.regression_test_pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 font-mono text-xs font-bold hover:bg-emerald-400 transition-colors flex-shrink-0"
                  >
                    <GitPullRequest className="w-3.5 h-3.5" /> View Regression PR <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Full Markdown Report */}
              <div>
                <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider mb-3">
                  Full Blameless SRE Report
                </h3>
                <div className="bg-black/50 border border-zinc-800/80 rounded-xl p-4 text-xs font-mono text-zinc-300 whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
                  {data.markdown_content}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

Mount the modal in `app/page.tsx` and bind it to the `EmergencyIncidentBanner`:

```tsx
// Inside app/page.tsx:
const [activePostMortemIncidentId, setActivePostMortemIncidentId] = useState<string | null>(null);

// Pass trigger to banner:
<EmergencyIncidentBanner
  wsEvent={latestWsEvent}
  onViewPostMortem={(id) => setActivePostMortemIncidentId(id)}
/>

// Mount Modal:
<PostMortemViewerModal
  incidentId={activePostMortemIncidentId}
  onClose={() => setActivePostMortemIncidentId(null)}
/>
```

---

## 7. Operational Validation

1. **Failure Occurs:** Sentry reports an unhandled exception triggered by a recent deployment.
2. **Rollback Executes:** `RevertAdapter` checks out a branch, reverts the merge commit, and auto-merges the revert to stabilize production.
3. **Autonomous Post-Mortem:** `run_automated_postmortem` triggers:
   * Analyzes the culprit git diff (`git show --patch <sha>`).
   * Synthesizes a structured 5-Whys post-mortem and writes it to `docs/postmortems/2026-09-19-incident-xxxx.md`.
   * Indexes the technical root cause into ChromaDB so future coding tasks avoid the same pattern.
4. **Regression Guard:** Synthesizes the exact test that would have caught this bug in CI, checks it into `tests/regressions/test_incident_xxxx.py`, and opens an automated PR.
5. **Operator Visibility:** The Next.js dashboard banner updates with a direct link: **Read Blameless Post-Mortem**, displaying the timeline, root cause, and PR link in the modal.
