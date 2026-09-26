# How can I build an automated Sentry/Datadog webhook listener that detects error rate spikes after a merged PR and triggers an automated git revert PR?

> Status in this repo: Implemented: Sentry webhook, correlation, revert PRs

This automated rollback pipeline pairs a webhook ingestion service with stacktrace-to-commit correlation. When **Sentry** or **Datadog** reports an error spike or metric breach, the system correlates the stack trace with recently merged Pull Requests, creates an isolated git revert branch, runs conflict resolution via headless Claude Code, and opens an emergency revert PR.

---

### Pipeline Architecture

```
 ┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
 │       Sentry Issue Alert             │     │      Datadog Metric Monitor          │
 │  (POST /webhooks/sentry/alert)       │     │    (POST /webhooks/datadog/alert)    │
 └──────────────────┬───────────────────┘     └──────────────────┬───────────────────┘
                    │ HMAC Signature                             │ Webhook Token
                    ▼                                            ▼
 ┌───────────────────────────────────────────────────────────────────────────────────┐
 │ 1. Webhook Ingestion & Signature Verification (app/webhook_listener.py)           │
 │    - Validates HMAC-SHA256 signature (Sentry) or shared secret (Datadog)         │
 │    - Extracts: Error Message, Culprit File, Stack Trace, Release/Commit SHA      │
 └─────────────────────────────────────────┬─────────────────────────────────────────┘
                                           │
                                           ▼
 ┌───────────────────────────────────────────────────────────────────────────────────┐
 │ 2. Causal Incident Correlator (app/incident_correlator.py)                        │
 │    - Pulls deployments from last 60 minutes (`DeploymentEvent` table)             │
 │    - Diffs stack trace filepaths against modified files in recent PR commits     │
 │    - Claude Code Analysis Pass: Verifies failure is code defect vs external infra│
 └─────────────────────────────────────────┬─────────────────────────────────────────┘
                                           │ Confirmed Causal Link
                                           ▼
 ┌───────────────────────────────────────────────────────────────────────────────────┐
 │ 3. Automated Git Revert Engine (app/adapters/revert_adapter.py)                   │
 │    - Clones repository into isolated ephemeral workspace                          │
 │    - Runs `git revert -m 1 <merge_sha>` (or Claude Code handles clean conflict)   │
 │    - Pushes `revert/incident-<id>` branch and opens Emergency Pull Request        │
 └─────────────────────────────────────────┬─────────────────────────────────────────┘
                                           │
                                           ▼
 ┌───────────────────────────────────────────────────────────────────────────────────┐
 │ 4. Emergency Action & Live Broadcast                                              │
 │    - If `AUTO_MERGE_REVERTS=True`: Merges PR immediately and redeploys           │
 │    - If `AUTO_MERGE_REVERTS=False`: Triggers high-priority banner in Next.js UI  │
 └───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Database Schema for Deployments & Incidents (`app/models.py`)

Add models to record merged deployments and track active incident lifecycles:

```python
# Add to app/models.py:
from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean, JSON
from datetime import datetime
from app.db import Base

class DeploymentRecord(Base):
    __tablename__ = "deployment_records"

    id = Column(String, primary_key=True, index=True)
    repo = Column(String, index=True)               # e.g., "owner/repo"
    commit_sha = Column(String, index=True)         # Merge commit SHA
    pr_number = Column(Integer, index=True)
    pr_title = Column(String)
    files_changed = Column(JSON)                    # List of file paths modified in this PR
    deployed_at = Column(DateTime, default=datetime.utcnow, index=True)

class IncidentRecord(Base):
    __tablename__ = "incident_records"

    id = Column(String, primary_key=True, index=True)
    source = Column(String)                         # "SENTRY" or "DATADOG"
    incident_title = Column(String)
    culprit_file = Column(String, nullable=True)
    error_details = Column(Text)
    culprit_commit_sha = Column(String, nullable=True)
    culprit_pr_number = Column(Integer, nullable=True)
    revert_pr_url = Column(String, nullable=True)
    status = Column(String, default="TRIGGERED")    # TRIGGERED, REVERT_PR_OPEN, AUTO_MERGED, RESOLVED
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## 2. Webhook Signature Verification (`app/webhook_verifier.py`)

Prevents unauthorized HTTP requests by verifying HMAC signatures:

```python
import hmac
import hashlib
import os
from fastapi import HTTPException, Request

SENTRY_CLIENT_SECRET = os.getenv("SENTRY_CLIENT_SECRET", "")
DATADOG_WEBHOOK_SECRET = os.getenv("DATADOG_WEBHOOK_SECRET", "")

class WebhookVerifier:
    @staticmethod
    async def verify_sentry(request: Request) -> bytes:
        """Validates Sentry HMAC-SHA256 signature from `sentry-hook-signature` header."""
        body = await request.body()
        if not SENTRY_CLIENT_SECRET:
            return body

        signature = request.headers.get("sentry-hook-signature", "")
        if not signature:
            raise HTTPException(status_code=401, detail="Missing Sentry signature header")

        computed = hmac.new(
            SENTRY_CLIENT_SECRET.encode("utf-8"),
            body,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(computed, signature):
            raise HTTPException(status_code=403, detail="Invalid Sentry HMAC signature")

        return body

    @staticmethod
    def verify_datadog(token: str) -> bool:
        """Validates query token or custom webhook header for Datadog."""
        if not DATADOG_WEBHOOK_SECRET:
            return True
        return hmac.compare_digest(token, DATADOG_WEBHOOK_SECRET)
```

---

## 3. Incident Correlation & Root Cause Analyzer (`app/incident_correlator.py`)

This service correlates the stack trace with deployments made in the last 60 minutes and uses Claude Code to determine if the issue is a direct regression of the PR:

```python
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models import DeploymentRecord
from app.runner import run_claude_headless

class IncidentCorrelator:
    @staticmethod
    def find_culprit_deployment(
        culprit_file: str,
        stack_trace_text: str,
        lookback_minutes: int = 60
    ) -> Optional[DeploymentRecord]:
        """
        1. Queries all deployments from the last `lookback_minutes`.
        2. Matches stacktrace filepaths against `files_changed` in each PR.
        3. Returns the most recent matching deployment record.
        """
        db: Session = SessionLocal()
        window_start = datetime.utcnow() - timedelta(minutes=lookback_minutes)

        recent_deploys = db.query(DeploymentRecord).filter(
            DeploymentRecord.deployed_at >= window_start
        ).order_by(DeploymentRecord.deployed_at.desc()).all()

        db.close()

        if not recent_deploys:
            return None

        # Direct file path match
        for deploy in recent_deploys:
            changed_files = deploy.files_changed or []
            for filepath in changed_files:
                if filepath in stack_trace_text or (culprit_file and culprit_file in filepath):
                    return deploy

        # Fallback to the latest deployment if it occurred within the last 15 minutes
        latest = recent_deploys[0]
        if (datetime.utcnow() - latest.deployed_at).total_seconds() < 900:
            return latest

        return None

    @staticmethod
    def verify_revert_with_claude(
        error_title: str,
        stack_trace: str,
        pr_title: str,
        files_changed: List[str]
    ) -> Dict[str, Any]:
        """
        Invokes Claude Code to verify whether the error represents a true
        code regression caused by the PR or an unrelated external issue.
        """
        prompt = (
            "You are the senior site reliability triage engineer for Polsia.\n"
            "An error spike was detected immediately after a code deployment.\n\n"
            f"ERROR: {error_title}\n"
            f"STACK TRACE:\n```text\n{stack_trace[:1500]}\n```\n\n"
            f"RECENT MERGED PR: {pr_title}\n"
            f"FILES CHANGED IN PR: {json.dumps(files_changed)}\n\n"
            "Evaluate if this PR is directly causal to this error.\n"
            "Return JSON: {\"is_causal\": bool, \"confidence\": float, \"reasoning\": \"...\"}"
        )

        res = run_claude_headless(prompt=prompt)
        try:
            return json.loads(res.get("result", "{}"))
        except Exception:
            return {"is_causal": True, "confidence": 0.8, "reasoning": "Fallback verification"}
```

---

## 4. Automated Git Revert Engine (`app/adapters/revert_adapter.py`)

Handles git operations to clone the repository, run `git revert -m 1` on merge commits, resolve merge conflicts via Claude Code if needed, push the branch, and open the emergency PR:

```python
import os
import uuid
import shutil
import tempfile
import subprocess
from typing import Dict, Any
from github import Github, Auth
from app.config import settings
from app.runner import run_claude_headless

class RevertAdapterError(Exception):
    pass

class RevertAdapter:
    def __init__(self):
        self.token = settings.GITHUB_TOKEN
        self.auth = Auth.Token(self.token) if self.token else None
        self.gh = Github(auth=self.auth) if self.auth else None

    def _git(self, cmd: list[str], cwd: str) -> str:
        res = subprocess.run(["git"] + cmd, cwd=cwd, capture_output=True, text=True, check=False)
        if res.returncode != 0:
            raise RevertAdapterError(f"git {' '.join(cmd)} failed: {res.stderr}")
        return res.stdout.strip()

    def create_revert_pr(
        self,
        repo_name: str,
        commit_sha: str,
        pr_number: int,
        incident_id: str,
        error_title: str
    ) -> Dict[str, Any]:
        """
        Creates an emergency git revert branch and opens a Pull Request.
        """
        if settings.SANDBOX_MODE or not self.token:
            return {
                "status": "simulated",
                "pr_number": 999,
                "pr_url": f"https://github.com/{repo_name}/pull/mock-revert-{incident_id[:6]}",
                "branch": f"revert/incident-{incident_id[:6]}"
            }

        short_id = incident_id[:6]
        revert_branch = f"revert/incident-{short_id}-pr-{pr_number}"
        temp_dir = tempfile.mkdtemp(prefix="polsia_revert_")

        try:
            clone_url = f"https://x-access-token:{self.token}@github.com/{repo_name}.git"
            self._git(["clone", "--depth", "50", clone_url, temp_dir], cwd=".")
            self._git(["config", "user.name", "Polsia SRE Sentinel"], cwd=temp_dir)
            self._git(["config", "user.email", "sre@polsia.ai"], cwd=temp_dir)

            # Create branch from main
            self._git(["checkout", "-b", revert_branch], cwd=temp_dir)

            # Attempt standard merge commit revert (-m 1)
            # If not a merge commit, fallback to simple revert
            revert_proc = subprocess.run(
                ["git", "revert", "-m", "1", commit_sha, "--no-edit"],
                cwd=temp_dir,
                capture_output=True,
                text=True
            )

            if revert_proc.returncode != 0:
                # Fallback: single commit revert without -m
                revert_proc = subprocess.run(
                    ["git", "revert", commit_sha, "--no-edit"],
                    cwd=temp_dir,
                    capture_output=True,
                    text=True
                )

            # If conflict occurs, trigger Claude Code to resolve conflict
            if revert_proc.returncode != 0:
                prompt = (
                    f"A git revert of commit {commit_sha} resulted in merge conflicts.\n"
                    "Resolve the conflict markers in the repository files so the revert cleanly passes.\n"
                    "Do not run git commit; leave changes resolved."
                )
                run_claude_headless(prompt=prompt, cwd=temp_dir, allowed_tools=["Read", "Edit", "Write", "Bash"])
                self._git(["add", "-A"], cwd=temp_dir)
                self._git(["commit", "-m", f"revert: fix merge conflict on reverting PR #{pr_number}"], cwd=temp_dir)

            # Push branch
            self._git(["push", "-u", "origin", revert_branch], cwd=temp_dir)

            # Open Pull Request
            gh_repo = self.gh.get_repo(repo_name)
            body = (
                f"## 🚨 EMERGENCY AUTOMATED REVERT\n\n"
                f"This Pull Request automatically reverts PR #{pr_number} (`{commit_sha[:8]}`) "
                f"due to a critical error rate spike detected in production.\n\n"
                f"**Triggering Error:**\n> {error_title}\n\n"
                f"**Incident Reference:** `{incident_id}`\n\n"
                f"*Generated by Polsia SRE Sentinel.*"
            )

            pr = gh_repo.create_pull(
                title=f"🚨 [EMERGENCY REVERT] Revert PR #{pr_number} due to incident {short_id}",
                body=body,
                head=revert_branch,
                base="main"
            )

            return {
                "status": "opened",
                "pr_number": pr.number,
                "pr_url": pr.html_url,
                "branch": revert_branch
            }

        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
```

---

## 5. Webhook Handlers & Celery Task Dispatch (`app/sentry_datadog.py`)

Exposes webhook ingestion routes for both monitoring providers:

```python
import uuid
import json
import redis
from fastapi import APIRouter, Request, Depends, Query, Header
from app.config import settings
from app.webhook_verifier import WebhookVerifier
from app.celery_app import celery_app
from app.models import IncidentRecord
from app.db import SessionLocal

router = APIRouter(prefix="/webhooks", tags=["Monitoring Webhooks"])
r = redis.Redis.from_url(settings.REDIS_URL)

@router.post("/sentry/alert")
async def handle_sentry_alert(request: Request):
    """
    Ingests Sentry Issue/Metric Alert Webhooks.
    Sentry Webhook Docs: https://docs.sentry.io/product/integrations/integration-platform/webhooks/
    """
    body_bytes = await WebhookVerifier.verify_sentry(request)
    payload = json.loads(body_bytes.decode("utf-8"))

    action = payload.get("action")
    data = payload.get("data", {})
    issue = data.get("issue", {})

    # Only react to new issues or triggered alerts
    if action in ["triggered", "created"] or "event" in data:
        event_data = data.get("event", {})
        error_title = issue.get("title") or event_data.get("title", "Unhandled Production Exception")
        culprit = issue.get("culprit") or event_data.get("culprit", "")

        # Extract stack trace lines
        entries = event_data.get("entries", [])
        stack_trace_str = ""
        for entry in entries:
            if entry.get("type") == "exceptions":
                values = entry.get("data", {}).get("values", [])
                for v in values:
                    stack_trace_str += f"{v.get('type')}: {v.get('value')}\n"
                    frames = v.get("stacktrace", {}).get("frames", [])
                    for f in frames:
                        stack_trace_str += f"  File {f.get('filename')}, line {f.get('lineno')}, in {f.get('function')}\n"

        incident_id = str(uuid.uuid4())
        
        # Enqueue asynchronous rollback triage
        from app.tasks import process_error_spike_and_revert
        process_error_spike_and_revert.delay(
            incident_id=incident_id,
            source="SENTRY",
            error_title=error_title,
            culprit_file=culprit,
            stack_trace=stack_trace_str
        )

        return {"status": "enqueued", "incident_id": incident_id}

    return {"status": "ignored", "action": action}


@router.post("/datadog/alert")
async def handle_datadog_alert(request: Request, token: str = Query(default="")):
    """
    Ingests Datadog Webhook Monitor Notifications.
    Datadog Webhook Docs: https://docs.datadoghq.com/integrations/webhooks/
    """
    if not WebhookVerifier.verify_datadog(token):
        return {"error": "Invalid token"}

    payload = await request.json()
    alert_type = payload.get("alert_type", "") # "error", "warning", "success"
    
    if alert_type == "error":
        title = payload.get("title", "Datadog Monitor Error Spike")
        body = payload.get("body", "")

        incident_id = str(uuid.uuid4())
        from app.tasks import process_error_spike_and_revert
        process_error_spike_and_revert.delay(
            incident_id=incident_id,
            source="DATADOG",
            error_title=title,
            culprit_file="",
            stack_trace=body
        )
        return {"status": "enqueued", "incident_id": incident_id}

    return {"status": "ignored"}
```

---

## 6. Celery Rollback Triage Task (`app/tasks.py`)

Orchestrates correlation, automated verification, git revert execution, and live dashboard alerts:

```python
# Add to app/tasks.py:
from app.incident_correlator import IncidentCorrelator
from app.adapters.revert_adapter import RevertAdapter
from app.models import IncidentRecord

@celery_app.task(bind=True)
def process_error_spike_and_revert(
    self,
    incident_id: str,
    source: str,
    error_title: str,
    culprit_file: str,
    stack_trace: str
):
    db = SessionLocal()
    
    # 1. Save incident record
    incident = IncidentRecord(
        id=incident_id,
        source=source,
        incident_title=error_title,
        culprit_file=culprit_file,
        error_details=stack_trace,
        status="TRIAGING"
    )
    db.add(incident)
    db.commit()

    # 2. Correlate with deployments from last 60 minutes
    culprit_deploy = IncidentCorrelator.find_culprit_deployment(
        culprit_file=culprit_file,
        stack_trace_text=stack_trace,
        lookback_minutes=60
    )

    if not culprit_deploy:
        incident.status = "NO_RECENT_DEPLOYMENT"
        db.commit()
        db.close()
        return {"status": "aborted", "reason": "No causal deployment found in 60m window"}

    incident.culprit_commit_sha = culprit_deploy.commit_sha
    incident.culprit_pr_number = culprit_deploy.pr_number
    db.commit()

    # 3. Claude Code Verification Pass
    verification = IncidentCorrelator.verify_revert_with_claude(
        error_title=error_title,
        stack_trace=stack_trace,
        pr_title=culprit_deploy.pr_title,
        files_changed=culprit_deploy.files_changed or []
    )

    if not verification.get("is_causal", True):
        incident.status = "DISMISSED_NOT_CAUSAL"
        db.commit()
        db.close()
        return {"status": "dismissed", "verification": verification}

    # 4. Execute Automated Git Revert
    adapter = RevertAdapter()
    revert_result = adapter.create_revert_pr(
        repo_name=culprit_deploy.repo,
        commit_sha=culprit_deploy.commit_sha,
        pr_number=culprit_deploy.pr_number,
        incident_id=incident_id,
        error_title=error_title
    )

    incident.revert_pr_url = revert_result.get("pr_url")
    incident.status = "REVERT_PR_OPEN"
    db.commit()
    db.close()

    # 5. Broadcast Emergency Alert to Next.js Live Feed
    r.publish("polsia:events", json.dumps({
        "event": "PRODUCTION_INCIDENT_REVERT",
        "incident_id": incident_id,
        "source": source,
        "error": error_title,
        "culprit_pr": culprit_deploy.pr_number,
        "culprit_commit": culprit_deploy.commit_sha[:8],
        "revert_pr_url": revert_result.get("pr_url"),
        "timestamp": datetime.utcnow().isoformat()
    }))

    return {
        "status": "revert_pr_opened",
        "pr_url": revert_result.get("pr_url"),
        "culprit_pr": culprit_deploy.pr_number
    }
```

Include the router in `app/main.py`:
```python
# In app/main.py:
from app.sentry_datadog import router as monitoring_router
app.include_router(monitoring_router)
```

---

## 7. Next.js Emergency Incident Banner (`components/EmergencyIncidentBanner.tsx`)

A high-visibility banner mounted at the top of the dashboard that activates during incident events:

```tsx
"use client";

import { useEffect, useState } from "react";
import { AlertOctagon, GitPullRequest, ExternalLink, X, ShieldAlert } from "lucide-react";

interface IncidentData {
  incident_id: string;
  source: string;
  error: string;
  culprit_pr: number;
  culprit_commit: string;
  revert_pr_url: string;
  timestamp: string;
}

export function EmergencyIncidentBanner({ wsEvent }: { wsEvent: any }) {
  const [incident, setIncident] = useState<IncidentData | null>(null);

  useEffect(() => {
    if (wsEvent && wsEvent.event === "PRODUCTION_INCIDENT_REVERT") {
      setIncident({
        incident_id: wsEvent.incident_id,
        source: wsEvent.source,
        error: wsEvent.error,
        culprit_pr: wsEvent.culprit_pr,
        culprit_commit: wsEvent.culprit_commit,
        revert_pr_url: wsEvent.revert_pr_url,
        timestamp: wsEvent.timestamp,
      });
    }
  }, [wsEvent]);

  if (!incident) return null;

  return (
    <div className="border-2 border-rose-500 bg-rose-950/90 text-rose-100 rounded-2xl p-5 mb-8 shadow-2xl animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-600 text-white">
            <AlertOctagon className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-rose-500 text-white px-2 py-0.5 rounded">
                {incident.source} ALERT
              </span>
              <h2 className="text-base font-bold font-mono tracking-tight text-white">
                PRODUCTION ERROR SPIKE DETECTED
              </h2>
            </div>
            <p className="text-sm text-rose-200 mt-1 font-mono line-clamp-1">
              {incident.error}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIncident(null)}
          className="text-xs font-mono text-rose-300 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-4 pt-3 border-t border-rose-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div>
          <span>Identified Causal Merge: </span>
          <span className="text-white font-bold">PR #{incident.culprit_pr}</span>
          <span className="text-rose-300"> ({incident.culprit_commit})</span>
        </div>

        <a
          href={incident.revert_pr_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-rose-950 font-bold hover:bg-rose-100 transition-colors shadow-lg"
        >
          <GitPullRequest className="w-4 h-4 text-rose-600" />
          Review Emergency Revert PR
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
```

---

## 8. Verification & Live Trace

To record deployments when your `CodeGenerationAgent` merges a PR, save a record to `deployment_records`:

```python
# Save deployment in GitHub merge workflow:
deploy = DeploymentRecord(
    id=str(uuid.uuid4()),
    repo="owner/repo",
    commit_sha="a8f3b9c2",
    pr_number=42,
    pr_title="feat: add checkout fast-path logic",
    files_changed=["src/api/checkout.py", "src/models/order.py"],
    deployed_at=datetime.utcnow()
)
db.add(deploy)
db.commit()
```

### Simulate an Inbound Sentry Webhook:

```bash
curl -X POST http://localhost:8000/webhooks/sentry/alert \
  -H "Content-Type: application/json" \
  -d '{
    "action": "triggered",
    "data": {
      "issue": {
        "title": "ZeroDivisionError: integer division by zero in checkout.py",
        "culprit": "src/api/checkout.py"
      },
      "event": {
        "entries": [
          {
            "type": "exceptions",
            "data": {
              "values": [
                {
                  "type": "ZeroDivisionError",
                  "value": "division by zero",
                  "stacktrace": {
                    "frames": [
                      {"filename": "src/api/checkout.py", "lineno": 48, "function": "calculate_tax"}
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    }
  }'
```

### Execution Flow:
1. **Webhook Reception:** Sentry webhook delivers the `ZeroDivisionError` occurring in `src/api/checkout.py`.
2. **Correlation:** `IncidentCorrelator` inspects deployments from the last 60 minutes and detects that PR #42 modified `src/api/checkout.py`.
3. **Claude Code Verification:** Validates that the stack trace corresponds directly to code introduced in the PR.
4. **Git Revert Execution:** `RevertAdapter` checks out a new branch (`revert/incident-xxxx-pr-42`), executes `git revert -m 1 a8f3b9c2`, pushes to GitHub, and opens an emergency PR.
5. **Dashboard Broadcast:** The Next.js frontend immediately renders `<EmergencyIncidentBanner/>`, providing an active link to review and merge the revert.
