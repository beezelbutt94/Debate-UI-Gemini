# How do I configure a canary deployment gate where Polsia monitors Sentry for 15 minutes on staging before promoting to production?

> Status in this repo: Implemented: canary gate

This canary deployment architecture uses **Fast-Fail Analysis**: Polsia continuously monitors Sentry during a **15-minute soak window** on staging. If a critical or unhandled exception occurs at any point during the window, it fails immediately to avoid waiting the full 15 minutes. If the soak window completes with zero critical regressions, Polsia marks the gate as `PASSED`, allowing GitHub Actions to promote the release to production.

---

### Canary Gate Architecture

```
                       [ GitHub Actions: Deploy to Staging ]
                                         │
                                         ▼
                 ┌──────────────────────────────────────────────┐
                 │ 1. Initiate Gate (POST /canary/start)        │
                 │    - Commit SHA, Staging URL, 15m Duration   │
                 └───────────────────────┬──────────────────────┘
                                         │ Returns canary_id
                                         ▼
                 ┌──────────────────────────────────────────────┐
                 │ 2. GitHub Actions Wait Loop                  │
                 │    - Polls GET /canary/status/{id} every 30s │
                 └───────────────────────┬──────────────────────┘
                                         │
          ┌──────────────────────────────┴──────────────────────────────┐
          │                                                             │
          ▼ (Background Polsia Celery Monitor)                          ▼
┌───────────────────────────────────────────┐         ┌───────────────────────────────────┐
│ 3. Sentry Telemetry Poller (Every 30s)    │         │ Sentry Webhook Fast-Path          │
│    Query: `environment:staging`           │         │ (POST /webhooks/sentry/alert)     │
│           `release:<sha>` `is:unresolved` │         │ Real-time error trigger           │
└─────────────────────┬─────────────────────┘         └─────────────────┬─────────────────┘
                      │                                                 │
                      └────────────────────────┬────────────────────────┘
                                               │
                           ┌───────────────────┴───────────────────┐
                           ▼                                       ▼
                 [ Critical Error Detected ]             [ 15 Minutes Clean ]
                 - Mark status: FAILED                   - Mark status: PASSED
                 - Cancel production gate                - Promote to Production
                 - Alert Next.js Dashboard               - Trigger post-deploy checks
```

---

## 1. Database Schema (`app/models.py`)

Add a model to track the state, error count, and lifecycle of canary runs:

```python
# Add to app/models.py:
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, JSON
from datetime import datetime
from app.db import Base

class CanaryEvaluationRecord(Base):
    __tablename__ = "canary_evaluations"

    id = Column(String, primary_key=True, index=True)
    repo = Column(String, index=True)
    commit_sha = Column(String, index=True)
    environment = Column(String, default="staging")
    status = Column(String, default="MONITORING") # MONITORING, PASSED, FAILED, TIMED_OUT
    duration_minutes = Column(Integer, default=15)
    
    # Error Thresholds
    max_allowed_errors = Column(Integer, default=0) # Zero-tolerance for unhandled errors
    observed_error_count = Column(Integer, default=0)
    failure_reason = Column(Text, nullable=True)
    error_summary = Column(JSON, default=list)

    started_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, index=True)
    resolved_at = Column(DateTime, nullable=True)
```

---

## 2. Sentry Canary Health Adapter (`app/adapters/sentry_canary_adapter.py`)

This adapter queries Sentry's Search Issues API, filtering specifically for the target commit SHA, environment, and timeframe:

```python
import os
import requests
from datetime import datetime
from typing import Dict, Any, List
from app.config import settings

class SentryCanaryAdapter:
    def __init__(self):
        self.auth_token = os.getenv("SENTRY_AUTH_TOKEN", "")
        self.org_slug = os.getenv("SENTRY_ORG", "polsia-org")
        self.project_slug = os.getenv("SENTRY_PROJECT", "polsia-backend")

    def evaluate_release_health(
        self,
        commit_sha: str,
        environment: str = "staging",
        since_iso: str = ""
    ) -> Dict[str, Any]:
        """
        Queries Sentry issues API to detect errors introduced in this release:
        - environment:{environment}
        - release:{commit_sha}
        - is:unresolved
        """
        if settings.SANDBOX_MODE or not self.auth_token:
            # Deterministic simulation for tests/dev
            return {
                "unhandled_errors": 0,
                "issues": []
            }

        headers = {
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json"
        }

        # Build Sentry search query syntax
        query_parts = [
            f"environment:{environment}",
            f"release:{commit_sha}",
            "is:unresolved"
        ]
        if since_iso:
            query_parts.append(f"firstSeen:>={since_iso}")

        query_str = " ".join(query_parts)
        url = f"https://sentry.io/api/0/projects/{self.org_slug}/{self.project_slug}/issues/"
        params = {"query": query_str, "limit": 25}

        resp = requests.get(url, headers=headers, params=params, timeout=10)
        resp.raise_for_status()
        issues = resp.json()

        critical_issues = []
        total_events = 0

        for issue in issues:
            event_count = int(issue.get("count", 1))
            total_events += event_count
            critical_issues.append({
                "issue_id": issue.get("id"),
                "title": issue.get("title"),
                "culprit": issue.get("culprit"),
                "event_count": event_count,
                "permalink": issue.get("permalink")
            })

        return {
            "unhandled_errors": total_events,
            "issues": critical_issues
        }
```

---

## 3. Canary Soak & Evaluation Task (`app/tasks.py`)

A Celery task runs throughout the 15-minute window. It checks health every 30 seconds to support **fast-fail** (terminating immediately if an error occurs) or completes the 15 minutes before marking the release as `PASSED`:

```python
# Add to app/tasks.py:
import time
import json
from datetime import datetime, timedelta
from app.celery_app import celery_app
from app.db import SessionLocal
from app.models import CanaryEvaluationRecord
from app.adapters.sentry_canary_adapter import SentryCanaryAdapter

@celery_app.task(bind=True)
def run_canary_soak_monitor(self, canary_id: str):
    """
    Monitors Sentry on staging for duration_minutes.
    Exits immediately with FAILED if error_count > threshold.
    Marks PASSED only if the entire window completes without regressions.
    """
    db = SessionLocal()
    canary = db.query(CanaryEvaluationRecord).filter_by(id=canary_id).first()
    if not canary:
        db.close()
        return {"status": "error", "message": "Canary record not found"}

    sentry = SentryCanaryAdapter()
    poll_interval_seconds = 30
    start_iso = canary.started_at.strftime("%Y-%m-%dT%H:%M:%S")

    while datetime.utcnow() < canary.expires_at:
        # Check Sentry for unresolved errors on this release
        report = sentry.evaluate_release_health(
            commit_sha=canary.commit_sha,
            environment=canary.environment,
            since_iso=start_iso
        )

        unhandled = report.get("unhandled_errors", 0)

        # FAST-FAIL CONDITION: Error count exceeds threshold
        if unhandled > canary.max_allowed_errors:
            canary.status = "FAILED"
            canary.observed_error_count = unhandled
            canary.failure_reason = f"Detected {unhandled} unhandled exceptions in Sentry during staging soak."
            canary.error_summary = report.get("issues", [])
            canary.resolved_at = datetime.utcnow()
            db.commit()

            # Broadcast failure to dashboard
            r.publish("polsia:events", json.dumps({
                "event": "CANARY_GATE_FAILED",
                "canary_id": canary_id,
                "commit_sha": canary.commit_sha,
                "reason": canary.failure_reason,
                "issues": canary.error_summary
            }))
            db.close()
            return {"status": "FAILED", "issues": canary.error_summary}

        time.sleep(poll_interval_seconds)

    # SUCCESS: Window completed without exceeding threshold
    canary.status = "PASSED"
    canary.resolved_at = datetime.utcnow()
    db.commit()

    r.publish("polsia:events", json.dumps({
        "event": "CANARY_GATE_PASSED",
        "canary_id": canary_id,
        "commit_sha": canary.commit_sha,
        "promoted_at": canary.resolved_at.isoformat()
    }))
    db.close()
    return {"status": "PASSED"}
```

---

## 4. FastAPI Gate Endpoints (`app/main.py`)

Expose endpoints for GitHub Actions to initiate the canary window and poll for resolution:

```python
# Add to app/main.py:
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.models import CanaryEvaluationRecord

class CanaryStartRequest(BaseModel):
    repo: str
    commit_sha: str
    environment: str = "staging"
    duration_minutes: int = 15
    max_allowed_errors: int = 0

@app.post("/canary/start")
def start_canary_gate(req: CanaryStartRequest, db: Session = Depends(get_db)):
    """Starts the 15-minute Sentry staging evaluation window."""
    canary_id = str(uuid.uuid4())
    expires = datetime.utcnow() + timedelta(minutes=req.duration_minutes)

    canary = CanaryEvaluationRecord(
        id=canary_id,
        repo=req.repo,
        commit_sha=req.commit_sha,
        environment=req.environment,
        duration_minutes=req.duration_minutes,
        max_allowed_errors=req.max_allowed_errors,
        status="MONITORING",
        started_at=datetime.utcnow(),
        expires_at=expires
    )
    db.add(canary)
    db.commit()

    # Launch asynchronous Celery soak monitor
    from app.tasks import run_canary_soak_monitor
    run_canary_soak_monitor.delay(canary_id=canary_id)

    return {
        "status": "initiated",
        "canary_id": canary_id,
        "commit_sha": req.commit_sha,
        "duration_minutes": req.duration_minutes,
        "expires_at": expires.isoformat()
    }

@app.get("/canary/status/{canary_id}")
def get_canary_status(canary_id: str, db: Session = Depends(get_db)):
    """Poll endpoint used by GitHub Actions to decide promotion."""
    canary = db.query(CanaryEvaluationRecord).filter_by(id=canary_id).first()
    if not canary:
        raise HTTPException(status_code=404, detail="Canary evaluation not found")

    return {
        "canary_id": canary.id,
        "status": canary.status, # MONITORING | PASSED | FAILED
        "observed_errors": canary.observed_error_count,
        "failure_reason": canary.failure_reason,
        "started_at": canary.started_at.isoformat(),
        "expires_at": canary.expires_at.isoformat(),
        "resolved_at": canary.resolved_at.isoformat() if canary.resolved_at else None
    }
```

---

## 5. GitHub Actions Multi-Stage Workflow (`.github/workflows/deploy-pipeline.yml`)

This multi-job pipeline executes the canary sequence:
1. Deploys code to staging.
2. Triggers the Polsia canary gate and enters a poll loop (polling every 30 seconds for up to 18 minutes).
3. If Polsia returns `PASSED`, the production deployment job executes.
4. If Polsia returns `FAILED`, the pipeline aborts immediately and triggers a staging rollback.

```yaml
name: Staging Canary & Production Promotion

on:
  push:
    branches:
      - main

jobs:
  # -----------------------------------------------------------
  # STAGE 1: Deploy to Staging Environment
  # -----------------------------------------------------------
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging
    outputs:
      commit_sha: ${{ github.sha }}
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Deploy to Staging Cluster
        run: |
          echo "Deploying commit ${{ github.sha }} to staging.internal.polsia.ai..."
          # Insert your deployment command here (e.g. helm upgrade, kubectl apply, or docker compose)
          sleep 5

  # -----------------------------------------------------------
  # STAGE 2: 15-Minute Sentry Canary Gate via Polsia
  # -----------------------------------------------------------
  canary-evaluation-gate:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - name: Initiate Polsia Canary Gate
        id: start_gate
        run: |
          RESP=$(curl -f -s -X POST "${{ secrets.POLSIA_API_URL }}/canary/start" \
            -H "Content-Type: application/json" \
            -d '{
              "repo": "${{ github.repository }}",
              "commit_sha": "${{ github.sha }}",
              "environment": "staging",
              "duration_minutes": 15,
              "max_allowed_errors": 0
            }')

          CANARY_ID=$(echo "$RESP" | jq -r '.canary_id')
          echo "canary_id=$CANARY_ID" >> $GITHUB_OUTPUT
          echo "Canary gate started with ID: $CANARY_ID"

      - name: Wait and Poll Canary Status (15 min soak + buffer)
        env:
          CANARY_ID: ${{ steps.start_gate.outputs.canary_id }}
          POLSIA_URL: ${{ secrets.POLSIA_API_URL }}
        run: |
          echo "Monitoring staging error rates via Sentry for 15 minutes..."
          MAX_ATTEMPTS=36 # 36 attempts * 30s = 18 minutes total timeout
          ATTEMPT=0

          while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
            STATUS_RESP=$(curl -f -s "$POLSIA_URL/canary/status/$CANARY_ID")
            STATUS=$(echo "$STATUS_RESP" | jq -r '.status')
            ERRORS=$(echo "$STATUS_RESP" | jq -r '.observed_errors')

            echo "[$((ATTEMPT * 30))s] Status: $STATUS (Errors detected: $ERRORS)"

            if [ "$STATUS" = "PASSED" ]; then
              echo "✅ Canary soak passed with zero errors. Safe to promote."
              exit 0
            elif [ "$STATUS" = "FAILED" ]; then
              REASON=$(echo "$STATUS_RESP" | jq -r '.failure_reason')
              echo "🚨 CANARY FAILED: $REASON"
              exit 1
            fi

            ATTEMPT=$((ATTEMPT + 1))
            sleep 30
          done

          echo "❌ Timed out waiting for canary evaluation."
          exit 1

  # -----------------------------------------------------------
  # STAGE 3: Production Promotion (Only runs if Stage 2 PASSED)
  # -----------------------------------------------------------
  deploy-production:
    needs: canary-evaluation-gate
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Promote to Production
        run: |
          echo "Promoting commit ${{ github.sha }} to production.polsia.ai..."
          # Insert production deployment script here

  # -----------------------------------------------------------
  # STAGE 4: Automated Staging Rollback (Only runs if Stage 2 FAILED)
  # -----------------------------------------------------------
  rollback-staging:
    needs: canary-evaluation-gate
    if: failure()
    runs-on: ubuntu-latest
    steps:
      - name: Rollback Staging Deployment
        run: |
          echo "Rolling back staging cluster to previous healthy SHA..."
          # Insert rollback logic here
```

---

## 6. Next.js Real-Time Canary Soak Card (`components/CanaryGateCard.tsx`)

This component renders the active 15-minute countdown, error counters, and pass/fail states on the Next.js dashboard:

```tsx
"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, AlertOctagon, Loader2, CheckCircle2, Clock } from "lucide-react";

interface CanaryState {
  canary_id: string;
  status: "MONITORING" | "PASSED" | "FAILED";
  commit_sha: string;
  observed_errors: number;
  failure_reason?: string;
  started_at: string;
  expires_at: string;
}

export function CanaryGateCard({ wsEvent }: { wsEvent: any }) {
  const [canary, setCanary] = useState<CanaryState | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  useEffect(() => {
    if (wsEvent?.event === "CANARY_GATE_STARTED") {
      setCanary({
        canary_id: wsEvent.canary_id,
        status: "MONITORING",
        commit_sha: wsEvent.commit_sha,
        observed_errors: 0,
        started_at: new Date().toISOString(),
        expires_at: wsEvent.expires_at,
      });
    }

    if (wsEvent?.event === "CANARY_GATE_FAILED") {
      setCanary((prev) => prev ? {
        ...prev,
        status: "FAILED",
        failure_reason: wsEvent.reason,
        observed_errors: wsEvent.issues?.length || 1
      } : null);
    }

    if (wsEvent?.event === "CANARY_GATE_PASSED") {
      setCanary((prev) => prev ? { ...prev, status: "PASSED" } : null);
    }
  }, [wsEvent]);

  // Countdown clock calculation
  useEffect(() => {
    if (!canary || canary.status !== "MONITORING") return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(canary.expires_at).getTime() - Date.now()) / 1000));
      setSecondsRemaining(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [canary]);

  if (!canary) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  return (
    <div className={`border rounded-2xl p-5 mb-8 backdrop-blur transition-all ${
      canary.status === "FAILED"
        ? "border-rose-500/50 bg-rose-950/40 text-rose-100"
        : canary.status === "PASSED"
        ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-100"
        : "border-amber-500/50 bg-amber-950/30 text-amber-100"
    }`}>
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
        <div className="flex items-center gap-2">
          {canary.status === "MONITORING" && <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />}
          {canary.status === "PASSED" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {canary.status === "FAILED" && <AlertOctagon className="w-5 h-5 text-rose-400" />}
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider">
              Staging Canary Gate ({canary.status})
            </h3>
            <span className="text-[11px] font-mono text-zinc-400">
              SHA: {canary.commit_sha.slice(0, 7)} • Sentry Telemetry Verification
            </span>
          </div>
        </div>

        {canary.status === "MONITORING" && (
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber-300 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")} remaining
          </div>
        )}
      </div>

      <div className="text-xs font-mono">
        {canary.status === "MONITORING" && (
          <p className="text-zinc-300">
            Evaluating staging traffic for unhandled exceptions. Zero-tolerance threshold enforced.
          </p>
        )}
        {canary.status === "PASSED" && (
          <p className="text-emerald-300">
            15-minute soak completed with 0 errors. Promotion to production authorized.
          </p>
        )}
        {canary.status === "FAILED" && (
          <p className="text-rose-300 font-semibold">
            {canary.failure_reason} (Promotion halted; triggering rollback)
          </p>
        )}
      </div>
    </div>
  );
}
```

---

## 7. Execution Walkthrough

1. **Staging Release:** A developer merges a PR into `main`. GitHub Actions deploys the commit to staging and calls `POST /canary/start`.
2. **Soak Window Begins:** Polsia creates a record in `canary_evaluations` and launches the Celery monitoring task with an expiration set for $T+15$ minutes.
3. **Continuous Sentry Auditing:** Every 30 seconds, `SentryCanaryAdapter` checks for unresolved issues tagged with `environment:staging` and `release:<commit_sha>`.
4. **Fast-Fail Evaluation:**
   * **Scenario A (Bug on Staging):** At minute 2, a user hits a staging endpoint that throws an unhandled exception. The poller detects `unhandled_errors > 0`, immediately updates status to `FAILED`, and sends a failure response to the GitHub Actions polling step. GitHub Actions exits with code 1, halts the pipeline, and runs `rollback-staging`.
   * **Scenario B (Clean Release):** All 15 minutes complete with 0 unhandled errors. Polsia sets status to `PASSED`. The next poll from GitHub Actions receives `PASSED` (exit code 0) and proceeds to `deploy-production`.
