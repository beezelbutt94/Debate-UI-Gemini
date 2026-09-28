"""Headless Claude Code execution.

Every model call in the swarm goes through `run_claude()`: it enforces the
daily budget before the call, runs `claude -p ... --output-format json`, and
attributes the tokens and cost to the calling agent afterwards.
"""

import json
import os
import re
import subprocess
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app import budget
from app.config import settings

# (prompt, agent) -> response text. Tests install one to script model output.
Simulator = Callable[[str, str], str | None]
_simulator: Simulator | None = None


class ClaudeExecutionError(RuntimeError):
    pass


@dataclass
class ClaudeResult:
    text: str
    usage: dict[str, Any] = field(default_factory=dict)
    cost_usd: float = 0.0
    simulated: bool = False
    raw: dict[str, Any] = field(default_factory=dict)

    def json(self) -> dict[str, Any]:
        return parse_json_object(self.text)


def set_simulator(fn: Simulator | None) -> None:
    global _simulator
    _simulator = fn


def run_claude(
    prompt: str,
    *,
    agent: str,
    run_id: str | None = None,
    system_prompt: str | None = None,
    allowed_tools: list[str] | None = None,
    cwd: str | Path | None = None,
    model: str | None = None,
    simulated_response: dict[str, Any] | str | None = None,
    timeout_seconds: int | None = None,
) -> ClaudeResult:
    budget.check_preflight(agent)
    model = model or settings.CLAUDE_MODEL

    if settings.LLM_MODE == "simulated":
        text = _simulator(prompt, agent) if _simulator else None
        if text is None:
            if isinstance(simulated_response, str):
                text = simulated_response
            else:
                text = json.dumps(simulated_response or {"thought": "Simulated run.", "action_type": "NONE", "payload": {}, "summary": "No action."})
        usage = {"input_tokens": len(prompt) // 4, "output_tokens": len(text) // 4}
        budget.record_usage(agent=agent, model=model, run_id=run_id, usage=usage, reported_cost_usd=None, simulated=True)
        return ClaudeResult(text=text, usage=usage, simulated=True)

    # Tools are always pre-approved explicitly; an empty list means "no tools"
    # (pure reasoning), never "bypass permissions".
    cmd = [settings.CLAUDE_BIN, "-p", prompt, "--output-format", "json", "--model", model]
    cmd += ["--allowedTools", ",".join(allowed_tools)] if allowed_tools else ["--tools", ""]
    if system_prompt:
        cmd += ["--append-system-prompt", system_prompt]

    workdir = Path(cwd or settings.WORK_DIR)
    workdir.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    if settings.ANTHROPIC_API_KEY:
        env["ANTHROPIC_API_KEY"] = settings.ANTHROPIC_API_KEY
    try:
        proc = subprocess.run(
            cmd,
            cwd=workdir,
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout_seconds or settings.CLAUDE_TIMEOUT_SECONDS,
            check=False,
        )
    except FileNotFoundError as exc:
        raise ClaudeExecutionError(f"Claude Code CLI not found at '{settings.CLAUDE_BIN}'") from exc
    except subprocess.TimeoutExpired as exc:
        raise ClaudeExecutionError(f"Claude Code timed out after {exc.timeout}s") from exc

    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        data = {"result": proc.stdout.strip(), "is_error": proc.returncode != 0}

    usage = data.get("usage") or {}
    cost = data.get("total_cost_usd")
    recorded = budget.record_usage(agent=agent, model=model, run_id=run_id, usage=usage, reported_cost_usd=cost, simulated=False)

    if proc.returncode != 0 or data.get("is_error"):
        detail = (data.get("result") or proc.stderr or "unknown error").strip()
        raise ClaudeExecutionError(f"Claude Code exited {proc.returncode}: {detail[:500]}")
    return ClaudeResult(text=str(data.get("result", "")), usage=usage, cost_usd=float(recorded), raw=data)


_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def parse_json_object(text: str) -> dict[str, Any]:
    """Pull the first JSON object out of model text (bare, fenced, or embedded in prose)."""
    candidates = [text.strip()]
    candidates += [m.strip() for m in _FENCE.findall(text)]
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        candidates.append(text[start : end + 1])
    for candidate in candidates:
        try:
            value = json.loads(candidate)
        except (json.JSONDecodeError, ValueError):
            continue
        if isinstance(value, dict):
            return value
    raise ValueError(f"No JSON object in model output: {text[:200]!r}")
