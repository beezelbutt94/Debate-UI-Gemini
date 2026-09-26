# How can I configure GitHub Actions to automatically register new releases and commit SHAs with Sentry and our DeploymentRecord database?

> Status in this repo: Implemented: /deployments registration endpoint

To automatically record deployments across both Sentry and Polsia’s `DeploymentRecord` database whenever a Pull Request merges into `main`, implement a two-part setup:

1. **A secured ingestion endpoint in FastAPI** (`POST /deployments/register`) to record the commit SHA, PR number, PR title, and modified file list.
2. **A GitHub Actions deployment workflow** (`.github/workflows/deploy-and-release.yml`) that creates a Sentry release with associated commits and registers the deployment with Polsia.

---

### End-to-End Release Architecture

```
 Pull Request Merged to 'main'
               │
               ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ GitHub Actions Runner (.github/workflows/deploy.yml)        │
 │                                                             │
 │  1. Checkout with `fetch-depth: 2`                          │
 │  2. Extract changed files via `git diff`                    │
 │  3. Extract PR number & title via GitHub CLI (`gh pr view`) │
 └─────────────┬───────────────────────────────┬───────────────┘
               │                               │
               ▼                               ▼
 ┌───────────────────────────┐   ┌───────────────────────────┐
 │ Official Sentry Action    │   │ Polsia API Notification   │
 │ `getsentry/action-release`│   │ `POST /deployments/register`│
 │                           │   │                           │
 │ • Links Commit SHAs       │   │ • Saves `DeploymentRecord`│
 │ • Sets release version    │   │ • Associates changed files│
 │ • Tags environment: prod  │   │ • Ready for SRE Sentinel  │
 └───────────────────────────┘   └───────────────────────────┘
```

---

## 1. Backend Ingestion Endpoint (`app/main.py`)

Add the deployment registration endpoint to your FastAPI backend. Secure it using a constant-time secret comparison header:

```python
# Add to app/main.py:
import hmac
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import Header, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import DeploymentRecord
from app.config import settings

class DeploymentPayload(BaseModel):
    repo: str
    commit_sha: str
    pr_number: Optional[int] = None
    pr_title: Optional[str] = "Direct Commit / Automated Deploy"
    files_changed: List[str] = []

@app.post("/deployments/register")
def register_deployment(
    payload: DeploymentPayload,
    x_deployment_secret: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Registers a production deployment with commit SHA and affected files.
    Called directly by GitHub Actions upon deployment completion.
    """
    configured_secret = getattr(settings, "DEPLOYMENT_SECRET", "")
    if not configured_secret or not hmac.compare_digest(x_deployment_secret or "", configured_secret):
        raise HTTPException(status_code=403, detail="Invalid deployment registration secret")

    record_id = str(uuid.uuid4())
    record = DeploymentRecord(
        id=record_id,
        repo=payload.repo,
        commit_sha=payload.commit_sha,
        pr_number=payload.pr_number,
        pr_title=payload.pr_title,
        files_changed=payload.files_changed,
        deployed_at=datetime.utcnow()
    )
    db.add(record)
    db.commit()

    return {
        "status": "registered",
        "deployment_id": record_id,
        "commit_sha": payload.commit_sha,
        "files_tracked": len(payload.files_changed)
    }
```

Add `DEPLOYMENT_SECRET` to `app/config.py`:

```python
# In app/config.py:
class Settings(BaseSettings):
    # ... existing settings ...
    DEPLOYMENT_SECRET: str = "prod-deploy-secret-replace-in-env"
```

---

## 2. GitHub Actions Workflow (`.github/workflows/deploy-and-release.yml`)

Create this file in your target repository. It triggers on every push to the default branch (merges from PRs), extracts metadata using the built-in `gh` CLI, registers the release with Sentry, and notifies Polsia.

```yaml
name: Production Release & Deployment Registration

on:
  push:
    branches:
      - main

jobs:
  register-release:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          # fetch-depth: 2 allows git diff HEAD~1 to identify modified files
          fetch-depth: 2

      # 1. Extract PR Metadata and Modified Files
      - name: Extract Deployment Metadata
        id: metadata
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # 1. Extract changed files between previous commit and current HEAD as JSON array
          FILES_JSON=$(git diff --name-only HEAD~1 HEAD | jq -R -s -c 'split("\n")[:-1]')
          echo "files_json=$FILES_JSON" >> $GITHUB_OUTPUT

          # 2. Extract merged PR number and title if commit is a merge or squash
          PR_NUMBER=$(gh pr list --state merged --search "${{ github.sha }}" --json number --jq '.[0].number // empty')
          PR_TITLE=$(gh pr list --state merged --search "${{ github.sha }}" --json title --jq '.[0].title // empty')

          if [ -z "$PR_NUMBER" ]; then
            echo "pr_number=null" >> $GITHUB_OUTPUT
            echo "pr_title=Direct commit on main" >> $GITHUB_OUTPUT
          else
            echo "pr_number=$PR_NUMBER" >> $GITHUB_OUTPUT
            echo "pr_title=$PR_TITLE" >> $GITHUB_OUTPUT
          fi

      # 2. Register Release and Link Commits in Sentry
      - name: Register Sentry Release
        uses: getsentry/action-release@v1
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
        with:
          environment: production
          version: ${{ github.sha }}
          # Automatically associates commits between previous release and this SHA
          set_commits: auto
          # Mark deploy as finished in Sentry
          finalize: true

      # 3. Post Deployment Record to Polsia Database
      - name: Register in Polsia Database
        env:
          POLSIA_URL: ${{ secrets.POLSIA_API_URL }}
          DEPLOY_SECRET: ${{ secrets.POLSIA_DEPLOYMENT_SECRET }}
          REPO: ${{ github.repository }}
          COMMIT_SHA: ${{ github.sha }}
          PR_NUM: ${{ steps.metadata.outputs.pr_number }}
          PR_TITLE: ${{ steps.metadata.outputs.pr_title }}
          FILES_JSON: ${{ steps.metadata.outputs.files_json }}
        run: |
          # Construct JSON payload using jq for safe character escaping
          PAYLOAD=$(jq -n \
            --arg repo "$REPO" \
            --arg sha "$COMMIT_SHA" \
            --argjson pr "$PR_NUM" \
            --arg title "$PR_TITLE" \
            --argjson files "$FILES_JSON" \
            '{
              repo: $repo,
              commit_sha: $sha,
              pr_number: $pr,
              pr_title: $title,
              files_changed: $files
            }')

          curl -f -X POST "$POLSIA_URL/deployments/register" \
            -H "Content-Type: application/json" \
            -H "X-Deployment-Secret: $DEPLOY_SECRET" \
            -d "$PAYLOAD"
```

---

## 3. Required GitHub Repository Secrets

Under **Settings > Secrets and variables > Actions**, add the following repository secrets:

| Secret Name | Value Description | Example |
| :--- | :--- | :--- |
| `SENTRY_AUTH_TOKEN` | Sentry User or Internal Integration token with `Release: Admin` and `Project: Read` scopes | `sntrys_eyJ...` |
| `SENTRY_ORG` | Your Sentry organization slug | `polsia-org` |
| `SENTRY_PROJECT` | Your Sentry project slug | `polsia-backend` |
| `POLSIA_API_URL` | Public or internal URL of your Polsia FastAPI service | `[https://api.polsia.ai](https://api.polsia.ai)` |
| `POLSIA_DEPLOYMENT_SECRET` | Must match `DEPLOYMENT_SECRET` configured in Polsia’s `.env` | `prod-deploy-secret-replace-in-env` |

---

## 4. How the Two Systems Coordinate During an Incident

1. **Commit Linkage:** The Sentry action registers release `v_<github.sha>` and associates the full git commit log. When Sentry captures an error, it tags the issue with this exact release and culprit filename.
2. **Incident Correlation:** When Sentry posts an alert to `POST /webhooks/sentry/alert`, `IncidentCorrelator` looks up deployments in `DeploymentRecord`:
   * It matches the stack trace's filename (e.g., `src/api/checkout.py`) directly against `DeploymentRecord.files_changed`.
   * It identifies the exact PR number and merge commit SHA that introduced the code.
3. **Automated Rollback:** Polsia’s `RevertAdapter` uses the stored `commit_sha` to create a clean `revert/incident-...` branch, push it to GitHub, and auto-merge the rollback using the GitHub App's bypass rules.
