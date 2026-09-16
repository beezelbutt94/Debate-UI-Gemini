"""End-to-end eval: do the pipeline steps still produce valid, typed output
on a local model instead of a hosted one?

This is the gate for the Anthropic -> Ollama swap. It does not judge prose
quality (a human does that); it proves the plumbing holds -- schema-constrained
decoding, truncation retry, list wrappers and Pydantic validation.

Run with a real Ollama:  OLLAMA_MODEL=qwen3:8b python tests/eval_local_llm.py
"""
import asyncio
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.llm import LLMError, healthcheck, resolve_model  # noqa: E402
from app.pipeline.competitor import CompetitorIntelligenceEngine, CompetitorProfile  # noqa: E402
from app.pipeline.repurpose import _ClipCandidates  # noqa: E402
from app.pipeline.script_opt import ScriptOptimizationReport, optimize_script_for_virality  # noqa: E402
from app.pipeline.storyboard import StoryboardScene, generate_storyboard_ai  # noqa: E402
from app.core.llm import generate_structured  # noqa: E402

results = []


def record(name, ok, detail=""):
    results.append((name, ok, detail))


async def check(name, coro, validate):
    t = time.time()
    try:
        out = await coro
    except LLMError as exc:
        record(name, False, f"LLMError[{exc.code}] {exc}")
        return
    except Exception as exc:  # noqa: BLE001 - any failure is a failed eval
        record(name, False, f"{type(exc).__name__}: {str(exc)[:120]}")
        return
    ok, detail = validate(out)
    record(name, ok, f"{detail} ({time.time() - t:.0f}s)")


async def main():
    health = await healthcheck()
    print(f"model: {resolve_model()}   health: {health}\n")
    if not health.get("ok"):
        print("Ollama not usable; aborting.")
        return 1

    await check(
        "script_opt -> ScriptOptimizationReport",
        optimize_script_for_virality("how to save money on groceries", "tiktok", 15),
        lambda r: (
            isinstance(r, ScriptOptimizationReport) and 0 <= r.hook_score <= 100,
            f"hook_score={r.hook_score} wpm={r.pacing_wpm} triggers={len(r.retention_triggers)}",
        ),
    )

    await check(
        "storyboard -> List[StoryboardScene] (wrapped)",
        generate_storyboard_ai("a budget cooking channel", "meal prepping on a budget", 15),
        lambda scenes: (
            isinstance(scenes, list) and len(scenes) > 0
            and all(isinstance(s, StoryboardScene) for s in scenes),
            f"{len(scenes)} scenes, first={scenes[0].scene_num if scenes else 'n/a'}",
        ),
    )

    await check(
        "competitor -> CompetitorProfile",
        CompetitorIntelligenceEngine.analyze_account_strategy("@budgetmeals", "tiktok"),
        lambda p: (
            isinstance(p, CompetitorProfile) and len(p.contentGaps) > 0,
            f"gaps={len(p.contentGaps)} hooks={len(p.hookBreakdown)}",
        ),
    )

    # repurpose's engine __init__ loads faster-whisper, which is not needed to
    # prove the LLM contract -- exercise its schema directly.
    await check(
        "repurpose -> _ClipCandidates (wrapped)",
        generate_structured(
            'Pick 3 viral segments from this transcript: '
            '[{"start":0,"end":30,"text":"the one grocery mistake costing you 200 a month"}]. '
            "For each give clip_id, start_second, end_second, duration, hook_text, "
            "virality_rationale, confidence_score between 0 and 1.",
            _ClipCandidates,
            max_tokens=2500,
        ),
        lambda r: (
            len(r.candidates) > 0 and all(0 <= c.confidence_score <= 1 for c in r.candidates),
            f"{len(r.candidates)} candidates",
        ),
    )

    print()
    failed = 0
    for name, ok, detail in results:
        print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"   [{detail}]" if detail else ""))
        failed += 0 if ok else 1
    print(f"\n{len(results) - failed}/{len(results)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
