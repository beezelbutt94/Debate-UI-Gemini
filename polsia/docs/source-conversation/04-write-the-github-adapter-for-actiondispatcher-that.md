# Write the GitHub adapter for ActionDispatcher that clones a repo, uses Claude Code to apply a fix, and opens a pull request.

> Status in this repo: Implemented: GitHub fix-PR adapter

Here is a production-grade GitHub adapter for the `ActionDispatcher`. It uses **PyGithub** and system `git` to clone the target repository into an isolated temporary workspace, invokes headless **Claude Code** to analyze the issue and apply code modifications, verifies that git changes exist, commits, pushes to an ephemeral branch, and opens a Pull Request.

---

### 1. Additional Dependencies & Configuration

Add `PyGithub` to `requirements.txt`:

```text
PyGithub>=2.1.1
```

Update `app/config.py` with GitHub credentials:

```python
# app/config.py (Additions)
class Settings(BaseSettings):
    # ... existing settings ...
    GITHUB_TOKEN: str = ""                # Personal Access Token or GitHub App token
    GITHUB_ACTOR_NAME: str = "Polsia Bot"
    GITHUB_ACTOR_EMAIL: str = "bot@polsia.ai"
```

> **Token Permissions Required:** `contents:write` and `pull_requests:write` (or `repo` scope for classic PATs).

---

### 2. GitHub Automation Adapter (`app/adapters/github_adapter.py`)

This adapter handles repository lifecycle management, authenticated git interactions, token sanitization, and the headless Claude Code execution pass.

```python
import os
import re
import uuid
import shutil
import tempfile
import subprocess
from typing import Dict, Any, Optional
from github import Github, Auth, GithubException
from app.config import settings
from app.runner import run_claude_headless, ClaudeExecutionError

class GitHubAdapterError(Exception):
    pass

class GitHubAdapter:
    def __init__(self):
        if not settings.GITHUB_TOKEN and not settings.SANDBOX_MODE:
            raise GitHubAdapterError("GITHUB_TOKEN is required when SANDBOX_MODE=False")
        
        self.auth = Auth.Token(settings.GITHUB_TOKEN) if settings.GITHUB_TOKEN else None
        self.gh = Github(auth=self.auth) if self.auth else None

    def _run_git(self, args: list[str], cwd: str) -> str:
        """Executes a git command and scrubs sensitive tokens from error traces."""
        try:
            res = subprocess.run(
                ["git"] + args,
                cwd=cwd,
                capture_output=True,
                text=True,
                check=True
            )
            return res.stdout.strip()
        except subprocess.CalledProcessError as e:
            # Prevent token leakage in logs
            sanitized_err = e.stderr.replace(settings.GITHUB_TOKEN, "***") if settings.GITHUB_TOKEN else e.stderr
            raise GitHubAdapterError(f"Git command failed (git {' '.join(args)}): {sanitized_err}")

    def create_automated_pr(
        self,
        repo_name: str,
        issue_title: str,
        issue_description: str,
        base_branch: str = "main",
        custom_branch_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        1. Clones the repository into an isolated temporary folder.
        2. Branches out.
        3. Spawns Claude Code CLI inside the repo to make the code changes.
        4. Verifies changes, commits, pushes, and opens a GitHub PR.
        """
        short_id = uuid.uuid4().hex[:6]
        clean_title_slug = re.sub(r"[^a-zA-Z0-9_-]", "-", issue_title.lower())[:30].strip("-")
        branch_name = custom_branch_name or f"polsia/{clean_title_slug}-{short_id}"

        # In sandbox mode, bypass destructive network writes
        if settings.SANDBOX_MODE:
            return {
                "status": "simulated",
                "sandbox": True,
                "repo": repo_name,
                "branch": branch_name,
                "pr_url": f"https://github.com/{repo_name}/pull/mock-{short_id}",
                "summary": f"[SANDBOX] Generated patch for: {issue_title}"
            }

        temp_dir = tempfile.mkdtemp(prefix="polsia_git_")

        try:
            # 1. Clone authenticated repository
            clone_url = f"https://x-access-token:{settings.GITHUB_TOKEN}@github.com/{repo_name}.git"
            self._run_git(["clone", "--depth", "50", "--branch", base_branch, clone_url, temp_dir], cwd=".")

            # 2. Configure Git committer identity in the isolated workspace
            self._run_git(["config", "user.name", settings.GITHUB_ACTOR_NAME], cwd=temp_dir)
            self._run_git(["config", "user.email", settings.GITHUB_ACTOR_EMAIL], cwd=temp_dir)

            # 3. Create & switch to feature branch
            self._run_git(["checkout", "-b", branch_name], cwd=temp_dir)

            # 4. Invoke Claude Code Headless CLI in the target repository
            prompt = (
                f"You are an automated software engineer fixing an issue.\n"
                f"Task Title: {issue_title}\n"
                f"Description:\n{issue_description}\n\n"
                "INSTRUCTIONS:\n"
                "1. Inspect the codebase to locate relevant files.\n"
                "2. Make minimal, clean code edits to resolve the issue.\n"
                "3. If tests exist in the project, run them via Bash to verify your fix.\n"
                "4. Do NOT execute 'git commit' or 'git push'; leave modifications unstaged/staged."
            )

            # Claude Code runs inside the cloned repo with full tool permissions
            claude_output = run_claude_headless(
                prompt=prompt,
                cwd=temp_dir,
                allowed_tools=["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
                timeout_seconds=600  # Extended timeout for code compilation & test runs
            )

            # 5. Check if files were actually changed
            status_output = self._run_git(["status", "--porcelain"], cwd=temp_dir)
            if not status_output:
                raise GitHubAdapterError("Claude Code completed without producing any file modifications.")

            # 6. Commit changes
            commit_message = f"fix: {issue_title}\n\nAutonomously generated by Polsia Agent.\n\nTask ID: {short_id}"
            self._run_git(["add", "-A"], cwd=temp_dir)
            self._run_git(["commit", "-m", commit_message], cwd=temp_dir)

            # 7. Push branch to GitHub
            self._run_git(["push", "-u", "origin", branch_name], cwd=temp_dir)

            # 8. Open Pull Request via PyGithub
            pr_body = (
                f"### Automated Pull Request by Polsia\n\n"
                f"**Task Objective:**\n{issue_description}\n\n"
                f"**Claude Code Execution Notes:**\n"
                f"```text\n{claude_output.get('result', 'Execution succeeded without log details.')}\n```\n\n"
                f"---\n*Branch: `{branch_name}` | Committer: `{settings.GITHUB_ACTOR_NAME}`*"
            )

            gh_repo = self.gh.get_repo(repo_name)
            pr = gh_repo.create_pull(
                title=f"fix: {issue_title}",
                body=pr_body,
                head=branch_name,
                base=base_branch
            )

            return {
                "status": "dispatched",
                "sandbox": False,
                "repo": repo_name,
                "branch": branch_name,
                "pr_number": pr.number,
                "pr_url": pr.html_url,
                "summary": f"Created PR #{pr.number}: {pr.html_url}"
            }

        except GithubException as ge:
            raise GitHubAdapterError(f"GitHub API Error: {ge.data.get('message', str(ge))}")
        finally:
            # Clean up the temporary workspace
            shutil.rmtree(temp_dir, ignore_errors=True)
```

---

### 3. Wire into `ActionDispatcher` (`app/dispatcher.py`)

Update `ActionDispatcher` to consume the GitHub adapter when handling `CREATE_PR` operations:

```python
# app/dispatcher.py
import json
import logging
from app.config import settings
from app.adapters.github_adapter import GitHubAdapter

logger = logging.getLogger(__name__)

class ActionDispatcher:
    @staticmethod
    def dispatch(action_type: str, payload_data: dict) -> dict:
        """Executes an action against an external service or mocks it in sandbox mode."""

        if action_type == "CREATE_PR":
            # Expected payload keys:
            # - repo: "owner/repo"
            # - title: "Fix memory leak in Redis listener"
            # - description: "Details or stacktrace..."
            # - base_branch: "main" (optional)
            adapter = GitHubAdapter()
            return adapter.create_automated_pr(
                repo_name=payload_data["repo"],
                issue_title=payload_data["title"],
                issue_description=payload_data.get("description", ""),
                base_branch=payload_data.get("base_branch", "main")
            )

        elif action_type == "POST_TWEET":
            if settings.SANDBOX_MODE:
                logger.info(f"[SANDBOX] Action {action_type}: {json.dumps(payload_data)}")
                return {"status": "simulated", "sandbox": True, "data": payload_data}
            # Real social client call...
            return {"status": "dispatched", "platform": "x"}

        raise ValueError(f"Unknown action type: {action_type}")
```

---

### 4. Create the Code Generation Agent (`app/agents.py`)

Define a dedicated `CodeGenerationAgent` with explicit JSON schema output matching what the `GitHubAdapter` expects:

```python
# app/agents.py (Additions)

CODE_AGENT = BaseAgent(
    name="CodeGenerationAgent",
    role_prompt=(
        "You are an autonomous staff software engineer. When given an issue, bug, or feature request, "
        "your objective is to formulate a structured PR plan. "
        "You MUST specify action_type as 'CREATE_PR' and provide the target repo, a concise PR title, "
        "and clear instructions for the repo runner in payload."
    ),
    requires_approval=True # Always require operator approval for code PRs
)

# Update registry in app/tasks.py:
# AGENT_REGISTRY["CodeGenerationAgent"] = CODE_AGENT
```

---

### 5. End-to-End Execution Trace

#### Step 1: Enqueue an Issue
Trigger an autonomous fix via the dashboard UI or `curl`:

```bash
curl -X POST http://localhost:8000/agents/run \
  -H "Content-Type: application/json" \
  -d '{
    "agent_name": "CodeGenerationAgent",
    "instruction": "Fix issue in owner/repo: Remove unused imports and fix typo in README.md"
  }'
```

#### Step 2: Agent Generates Action Payload
The agent generates:
```json
{
  "thought": "I will clean up unused imports and correct the typos in the project documentation.",
  "action_type": "CREATE_PR",
  "payload": {
    "repo": "owner/repo",
    "title": "Clean up unused imports and fix README typo",
    "description": "Scanned repository files, stripped unreferenced modules, and fixed typos in README.md.",
    "base_branch": "main"
  },
  "summary": "Prepared PR action to fix repository cleanup task."
}
```

#### Step 3: Approval Queue & Dispatch
1. Because `requires_approval=True`, the action lands in the SQLite/PostgreSQL `action_approvals` table.
2. The Next.js dashboard immediately pops up an approval card showing the target repo, proposed branch title, and details.
3. Once the operator clicks **Approve & Dispatch**:
   * FastAPI calls `ActionDispatcher.dispatch("CREATE_PR", payload)`.
   * `GitHubAdapter` clones `owner/repo` to `/tmp/polsia_git_xxxx`.
   * Claude Code opens the workspace, runs `git status`, analyzes files, makes changes, and runs local tests.
   * Changes are committed and pushed to `polsia/clean-up-unused-imports-...`.
   * PyGithub creates the PR and returns the direct pull request URL (e.g., `[https://github.com/owner/repo/pull/42](https://github.com/owner/repo/pull/42)`).
