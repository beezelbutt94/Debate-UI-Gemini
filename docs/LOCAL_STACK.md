# Local stack migration — Phase 1: hosted LLM → local inference

Replaces the Anthropic API with Ollama running on your own hardware, for the
four pipeline steps that used Claude. No API key, no per-token cost.

**Status:** Phase 1 complete and verified. Phases 2–5 (TTS, storage, ads
removal, publish scheduler) not started.

## Why this works at all

Every one of those four steps wants the same thing: a JSON object matching a
Pydantic model. Ollama can constrain decoding to a JSON Schema, and all four
modules *already had* Pydantic models — so the schema comes straight from
`model_json_schema()` and the model is unable to emit a structurally invalid
document.

That is what makes a small local model viable here. A frontier model writes
better prose, but for "fill this struct correctly" the grammar does the work.
`extract_json_block()` (which stripped ```json fences) is gone — there is no
fence to strip.

## Two things constrained decoding does NOT give you

Both found by running it, not by reading docs.

**1. It guarantees syntax, not completion.** Hit the token cap mid-string and
the response is still truncated — valid as far as it got, invalid as a
document. The first real call failed exactly this way:

```
json.decoder.JSONDecodeError: Unterminated string starting at: line 1 column 71
```

That reads like a grammar bug and sends you debugging the wrong layer. Ollama
reports `done_reason == "length"`, so `llm.py` checks for it explicitly,
retries with double the budget, and if it still cannot finish raises
`LLMError("invalid_output", ...)` naming the cap.

**2. It constrains types, not values.** A schema's `minimum`/`maximum` are not
enforced by the grammar, so a model can return `hook_score: 150` and Pydantic
will reject it. Also retried rather than raised at the call site.

## Model selection

`resolve_model()` picks by detected VRAM, unless `OLLAMA_MODEL` is pinned
(do pin it in production — guessing from whichever GPU a pod landed on is not
a virtue).

| VRAM | Model | Q4 size | Notes |
|---|---|---|---|
| ≥ 12 GB | `qwen3:14b` | ~9 GB | MMLU 74.8; better structured-output consistency |
| < 12 GB | `qwen3:8b` | ~5 GB | MMLU 66.6; faster |
| none | `qwen3:8b` on CPU | — | logs a loud warning; slow but functional |

## Sharing one GPU

The pipeline wants three models resident: the LLM (~9 GB), faster-whisper
(~2–3 GB) and open_clip (~1 GB) — about 13 GB concurrently. That fits a 16 GB
card but not an 8 GB one.

`OLLAMA_KEEP_ALIVE=0` (the default here) evicts the LLM immediately after each
call, so the stages take turns instead of competing. Costs a few seconds of
reload per stage; these run in Celery tasks, so nothing user-facing waits on
it. On a card with room, set `5m` to keep weights resident.

## Verification

Run against a real Ollama:

```
OLLAMA_MODEL=qwen3:8b python services/api/tests/eval_local_llm.py
```

Results on this machine (CPU-only, `qwen3:0.6b` — the *smallest* model there
is, deliberately, as a floor):

```
PASS  script_opt -> ScriptOptimizationReport        [hook_score=65.0 wpm=65 triggers=2]
PASS  storyboard -> List[StoryboardScene] (wrapped) [3 scenes]
PASS  competitor -> CompetitorProfile               [gaps=3 hooks=3]
PASS  repurpose  -> _ClipCandidates (wrapped)       [5 candidates]
4/4 passed
```

Failure paths, separately:

```
PASS  truncation fails cleanly (not a JSON crash)   [code=invalid_output]
PASS  unreachable server raises LLMError            [code=llm_unreachable, has remedy]
```

**What this proves and what it does not.** It proves the *contract* holds:
valid, typed, validated output through every step, and clean typed errors when
it cannot. It does **not** prove content quality — a 0.6B model writes poor
scripts, and it should, at that size. Judging whether 8B/14B output is good
enough to ship is a human call on real prompts.

## Health

`/healthz/llm` reports whether inference is usable right now, separately from
`/healthz`:

```json
{"ok": true,  "model": "qwen3:8b", "vram_mb": 16384}
{"ok": false, "reason": "model_not_pulled", "available": ["qwen3:0.6b"]}   // 503
```

It is deliberately not folded into `/healthz`: most routes never touch the
model, so a missing model should not pull the whole service out of rotation.

## Two top-level wrappers

`storyboard` and `repurpose` return arrays, but constrained decoding needs an
object at the root. `_StoryboardResult.scenes` and `_ClipCandidates.candidates`
wrap them; both callers still get a plain list.
