# How can I configure GitHub App permissions and auto-merge rules to bypass review requirements for emergency SRE revert PRs?

> Status in this repo: Deferred: GitHub App auto-merge for reverts

To allow automated SRE rollbacks to merge without human review, configure a **dedicated GitHub App** paired with modern **Repository Rulesets**. 

Unlike legacy branch protection rules—which force you to disable protections globally or grant insecure admin rights—Rulesets allow you to designate the specific GitHub App on an **explicit bypass list** while keeping required review gates enforced for human developers.

---

## 1. GitHub App Permissions Setup

Create an internal GitHub App (e.g., `polsia-sre-sentinel`) in your GitHub Organization (**Settings > Developer settings > GitHub Apps > New GitHub App**).

### Required Permissions Table

| Category | Permission | Level | Justification |
| :--- | :--- | :--- | :--- |
| **Repository** | `Pull requests` | **Read & write** | Open, update, and merge emergency PRs. |
| **Repository** | `Contents` | **Read & write** | Push `revert/*` branches and commit git revert trees. |
| **Repository** | `Metadata` | **Read-only** | Mandatory base permission for repository inspection. |
| **Repository** | `Commit statuses` | **Read & write** | Optional: write emergency bypass status checks if required. |

### Configuration Checklist
* **Disable Webhooks:** Uncheck "Active" under Webhook settings (this app only initiates outbound API actions).
* **Where can this GitHub App be installed?:** Select **Only on this account**.
* **Generate Private Key:** Under **General > Private keys**, click **Generate a private key**. Save the downloaded `.pem` file to `./certs/github-app.pem`.
* **Note Credentials:** Copy the **App ID** and **Installation ID** (visible in the URL after installing the App onto your target repository: `[https://github.com/organizations/](https://github.com/organizations/)<org>/settings/installations/<installation_id>`).

---

## 2. GitHub Repository Ruleset Configuration

Replace or augment legacy branch protections with a **Repository Ruleset** targeting production branches:

1. Navigate to your repository: **Settings > Rules > Rulesets > New branch ruleset**.
2. **Ruleset Name:** `Enforce Main Protection with SRE Emergency Bypass`.
3. **Enforcement Status:** `Active`.
4. **Target Branches:** Select **Add target > Include default branch** (or specify `refs/heads/main`).
5. **Configure the Bypass List:**
   * Click **Add bypass**.
   * Choose **App**.
   * Search for and select your created app: `polsia-sre-sentinel`.
   * Under the **Bypass mode** dropdown, select **Always**.
6. **Enable Standard Human Protections:**
   * Check **Require a pull request before merging** (e.g., minimum 1 review approval).
   * Check **Block force pushes**.
   * Check **Require status checks to pass** (CI/CD build, unit tests).

> When your regular engineering team opens a PR to `main`, they are blocked by the review gate. When the `polsia-sre-sentinel` App initiates a merge, GitHub recognizes its identity in the bypass list and skips the required review requirement.

---

## 3. Dynamic App Authentication (`app/adapters/github_app_auth.py`)

GitHub Apps do not use static tokens. They mint short-lived RS256 JWTs to request ephemeral **1-hour Installation Access Tokens**:

```python
import os
import time
import jwt
import requests
from typing import Dict, Any
from app.config import settings

class GitHubAppAuth:
    def __init__(self):
        self.app_id = os.getenv("GITHUB_APP_ID", "")
        self.installation_id = os.getenv("GITHUB_APP_INSTALLATION_ID", "")
        self.private_key_path = os.getenv("GITHUB_APP_PRIVATE_KEY_PATH", "./certs/github-app.pem")

    def _generate_jwt(self) -> str:
        """Mints an RS256 JWT valid for 9 minutes."""
        with open(self.private_key_path, "r") as f:
            private_key = f.read()

        now = int(time.time())
        payload = {
            "iat": now - 60,       # Issued 60s in the past to account for clock drift
            "exp": now + (9 * 60), # 9 minutes expiry
            "iss": self.app_id
        }
        return jwt.encode(payload, private_key, algorithm="RS256")

    def get_installation_token(self) -> str:
        """Exchanges JWT for a short-lived 1-hour Installation Access Token."""
        if settings.SANDBOX_MODE or not self.app_id:
            return "mock_gh_installation_token_7f8a9"

        jwt_token = self._generate_jwt()
        url = f"https://api.github.com/app/installations/{self.installation_id}/access_tokens"
        headers = {
            "Authorization": f"Bearer {jwt_token}",
            "Accept": "application/vnd.github+json"
        }

        resp = requests.post(url, headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json()["token"]
```

---

## 4. Emergency Auto-Merge Implementation (`app/adapters/emergency_merge.py`)

This engine implements the two supported auto-merge patterns:
1. **Direct Immediate Bypass Merge (REST):** Uses the App's bypass authority to merge immediately without waiting for checks or reviews.
2. **GraphQL Auto-Merge Enablement (`enablePullRequestAutoMerge`):** Flags the PR to merge automatically as soon as required CI status checks pass.

```python
import requests
from typing import Dict, Any, Optional
from app.adapters.github_app_auth import GitHubAppAuth
from app.config import settings

class EmergencyMergeEngine:
    def __init__(self):
        self.auth = GitHubAppAuth()

    def merge_immediately_with_bypass(
        self,
        repo: str,
        pr_number: int,
        commit_title: str,
        commit_message: str
    ) -> Dict[str, Any]:
        """
        Executes a direct REST merge on the pull request.
        Because the GitHub App is on the Ruleset Bypass list,
        GitHub immediately applies the merge commit without requiring review approvals.
        """
        if settings.SANDBOX_MODE:
            return {
                "status": "simulated",
                "merged": True,
                "sha": "mock_merge_commit_sha_12345",
                "message": "Pull Request successfully merged (Simulated)"
            }

        token = self.auth.get_installation_token()
        url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}/merge"
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json"
        }
        payload = {
            "commit_title": commit_title,
            "commit_message": commit_message,
            "merge_method": "merge"  # or "squash", "rebase"
        }

        resp = requests.put(url, headers=headers, json=payload, timeout=15)
        if resp.status_code != 200:
            raise RuntimeError(f"Direct merge failed ({resp.status_code}): {resp.text}")

        return resp.json()

    def enable_graphql_auto_merge(
        self,
        pr_node_id: str,
        commit_headline: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Enables GitHub Native Auto-Merge via GraphQL.
        The PR will auto-merge the moment all non-review status checks (e.g. CI build) pass.
        Requires 'Allow auto-merge' enabled in Repository General Settings.
        """
        if settings.SANDBOX_MODE:
            return {"status": "simulated", "auto_merge_enabled": True}

        token = self.auth.get_installation_token()
        url = "https://api.github.com/graphql"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        query = """
        mutation EnableAutoMerge($pullRequestId: ID!, $commitHeadline: String) {
          enablePullRequestAutoMerge(input: {
            pullRequestId: $pullRequestId,
            mergeMethod: MERGE,
            commitHeadline: $commitHeadline
          }) {
            pullRequest {
              id
              autoMergeRequest {
                enabledAt
                enabledBy {
                  login
                }
              }
            }
          }
        }
        """

        payload = {
            "query": query,
            "variables": {
                "pullRequestId": pr_node_id,
                "commitHeadline": commit_headline or "Emergency SRE Revert Auto-Merge"
            }
        }

        resp = requests.post(url, headers=headers, json=payload, timeout=15)
        resp.raise_for_status()
        return resp.json()
```

---

## 5. Integrating Auto-Merge into the SRE Rollback Task

Update `app/tasks.py` to automatically execute the bypass merge when `AUTO_MERGE_REVERTS=True`:

```python
# In app/tasks.py (Inside process_error_spike_and_revert):

    # 4. Open Emergency Revert PR via RevertAdapter
    adapter = RevertAdapter()
    revert_result = adapter.create_revert_pr(
        repo_name=culprit_deploy.repo,
        commit_sha=culprit_deploy.commit_sha,
        pr_number=culprit_deploy.pr_number,
        incident_id=incident_id,
        error_title=error_title
    )

    revert_pr_num = revert_result.get("pr_number")
    incident.revert_pr_url = revert_result.get("pr_url")
    incident.status = "REVERT_PR_OPEN"
    db.commit()

    # 5. Check if automated merge policy is enabled
    auto_merge_enabled = os.getenv("AUTO_MERGE_EMERGENCY_REVERTS", "false").lower() == "true"

    if auto_merge_enabled and revert_pr_num:
        from app.adapters.emergency_merge import EmergencyMergeEngine
        merge_engine = EmergencyMergeEngine()

        try:
            merge_response = merge_engine.merge_immediately_with_bypass(
                repo=culprit_deploy.repo,
                pr_number=revert_pr_num,
                commit_title=f"🚨 [AUTO-MERGE REVERT] Revert PR #{culprit_deploy.pr_number}",
                commit_message=f"Autonomous rollback initiated by SRE Sentinel for Incident {incident_id}."
            )
            incident.status = "AUTO_MERGED"
            db.commit()
            
            # Broadcast emergency auto-merge success to WebSocket feed
            r.publish("polsia:events", json.dumps({
                "event": "PRODUCTION_ROLLBACK_MERGED",
                "incident_id": incident_id,
                "repo": culprit_deploy.repo,
                "pr_number": revert_pr_num,
                "merge_sha": merge_response.get("sha")
            }))
        except Exception as merge_err:
            # Fallback: leave PR open for manual intervention if merge conflicts occur
            incident.status = "AUTO_MERGE_FAILED_MANUAL_REQUIRED"
            db.commit()
            print(f"[Sentinel Error] Auto-merge failed: {merge_err}")

    db.close()
```

---

## 6. Security Boundaries & Guardrails

Bypassing code review introduces severe supply chain risk if not locked down. Enforce these four programmatic guardrails:

1. **Strict Branch Pattern Matching:** Configure the `RevertAdapter` so it only commits and pushes to branches strictly matching the regex `^revert/incident-[a-f0-9]{6}-pr-\d+$`.
2. **Emergency Merge Cooldown (Rate Limiting):** Limit automated bypass merges in `EmergencyMergeEngine` to a maximum of **1 merge per 30 minutes per repository**. If a second incident fires within the window, flag it for manual human intervention to prevent cascading rollback loops.
3. **Automated CI Workflow Exclusions:** Do not grant the GitHub App the `Workflows` permission. This ensures that even in an automated revert, the agent cannot modify `.github/workflows/*.yml` files.
4. **Audit Log Retention:** Ensure all auto-merges record the triggering Sentry/Datadog event ID in the git commit message body for compliance and retrospective auditing.
