"""GitHub: clone a repo, let Claude Code make the change, push a branch, open a PR."""

import re
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Any

from app.config import settings
from app.runner import run_claude


class GitHubAdapterError(RuntimeError):
    pass


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "change"


class GitHubAdapter:
    def __init__(self) -> None:
        self.token = settings.GITHUB_TOKEN

    # --- plumbing ------------------------------------------------------------

    def _scrub(self, text: str) -> str:
        return text.replace(self.token, "***") if self.token else text

    def _git(self, args: list[str], cwd: str | Path) -> str:
        proc = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            raise GitHubAdapterError(f"git {self._scrub(' '.join(args))} failed: {self._scrub(proc.stderr.strip())}")
        return proc.stdout.strip()

    def _clone(self, repo: str, branch: str, dest: str, depth: int) -> None:
        url = f"https://x-access-token:{self.token}@github.com/{repo}.git"
        self._git(["clone", "--depth", str(depth), "--branch", branch, url, dest], cwd=".")
        self._git(["config", "user.name", settings.GITHUB_ACTOR_NAME], cwd=dest)
        self._git(["config", "user.email", settings.GITHUB_ACTOR_EMAIL], cwd=dest)

    def _open_pr(self, repo: str, head: str, base: str, title: str, body: str) -> dict[str, Any]:
        from github import Auth, Github, GithubException

        try:
            pr = Github(auth=Auth.Token(self.token)).get_repo(repo).create_pull(title=title, body=body, head=head, base=base)
        except GithubException as exc:
            message = exc.data.get("message") if isinstance(exc.data, dict) else str(exc)
            raise GitHubAdapterError(f"GitHub API error: {message}") from exc
        return {"pr_number": pr.number, "pr_url": pr.html_url}

    def _require_live(self) -> None:
        if not self.token:
            raise GitHubAdapterError("GITHUB_TOKEN is required when SANDBOX_MODE is off")

    # --- actions -------------------------------------------------------------

    def create_fix_pr(self, repo: str, title: str, description: str, base_branch: str = "main", run_id: str | None = None) -> dict[str, Any]:
        branch = f"polsia/{_slug(title)}-{uuid.uuid4().hex[:6]}"
        if settings.SANDBOX_MODE:
            return {"status": "simulated", "repo": repo, "branch": branch, "pr_url": f"https://github.com/{repo}/pulls?sandbox={branch}"}
        self._require_live()

        workdir = tempfile.mkdtemp(prefix="polsia_pr_")
        try:
            self._clone(repo, base_branch, workdir, depth=50)
            self._git(["checkout", "-b", branch], cwd=workdir)
            notes = run_claude(
                "You are fixing an issue in this repository.\n"
                f"Title: {title}\n\nDescription:\n{description}\n\n"
                "1. Locate the relevant code.\n"
                "2. Make the smallest correct change that resolves the issue.\n"
                "3. If the project has tests, run the relevant ones and make them pass.\n"
                "4. Do NOT commit or push; leave your changes in the working tree.\n"
                "End with a short summary of what you changed and how you verified it.",
                agent="CodeGenerationAgent",
                run_id=run_id,
                cwd=workdir,
                allowed_tools=["Read", "Edit", "Write", "Glob", "Grep", "Bash"],
            ).text
            if not self._git(["status", "--porcelain"], cwd=workdir):
                raise GitHubAdapterError("Claude Code finished without modifying any files")
            self._git(["add", "-A"], cwd=workdir)
            self._git(["commit", "-m", f"fix: {title}\n\n{description[:1000]}"], cwd=workdir)
            self._git(["push", "-u", "origin", branch], cwd=workdir)
            body = f"{description}\n\n### Agent notes\n\n{notes}\n\n---\n_Opened autonomously by {settings.GITHUB_ACTOR_NAME} after human approval._"
            pr = self._open_pr(repo, branch, base_branch, f"fix: {title}", body)
            return {"status": "created", "repo": repo, "branch": branch, **pr}
        finally:
            shutil.rmtree(workdir, ignore_errors=True)

    def create_revert_pr(self, repo: str, commit_sha: str, reason: str, base_branch: str = "main") -> dict[str, Any]:
        branch = f"revert/{commit_sha[:10]}-{uuid.uuid4().hex[:4]}"
        if settings.SANDBOX_MODE:
            return {"status": "simulated", "repo": repo, "branch": branch, "pr_url": f"https://github.com/{repo}/pulls?sandbox={branch}"}
        self._require_live()

        workdir = tempfile.mkdtemp(prefix="polsia_revert_")
        try:
            self._clone(repo, base_branch, workdir, depth=100)
            self._git(["checkout", "-b", branch], cwd=workdir)
            parents = self._git(["rev-list", "--parents", "-n", "1", commit_sha], cwd=workdir).split()
            # A merge commit needs a mainline parent; a squash/regular commit must not get one.
            self._git(["revert", "--no-edit", *(["-m", "1"] if len(parents) > 2 else []), commit_sha], cwd=workdir)
            self._git(["push", "-u", "origin", branch], cwd=workdir)
            body = f"Automated rollback of `{commit_sha}`.\n\n**Reason:** {reason}"
            pr = self._open_pr(repo, branch, base_branch, f"revert: {commit_sha[:10]} ({reason[:60]})", body)
            return {"status": "created", "repo": repo, "branch": branch, **pr}
        finally:
            shutil.rmtree(workdir, ignore_errors=True)
