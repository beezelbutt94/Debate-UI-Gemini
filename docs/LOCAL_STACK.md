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

---

# Phase 2 — hosted TTS and storage → local

**Status:** complete and verified.

## Text-to-speech: ElevenLabs → local

`app/core/tts.py` replaces the ElevenLabs HTTP call. Backends are pluggable
because the licences differ in ways that matter commercially:

| Backend | Licence | Cloning | Notes |
|---|---|---|---|
| **kokoro** (default) | Apache-2.0 | no | 54 preset voices, faster than realtime on CPU |
| **chatterbox** | MIT | yes, ~5s reference | when a creator wants their own voice |
| **piper** | MIT | no | tiny and very fast, lower fidelity |

**Deliberately not offered: XTTS-v2.** It is the best-known open cloning
model, but its weights ship under the Coqui Public Model License, which is
**non-commercial** — shipping it in a paid product would be a licence
violation. Chatterbox covers the same need under MIT.

`AvatarPipeline` lost its `stability` / `similarity_boost` arguments. Those
were ElevenLabs-specific and no local backend has an equivalent; keeping them
as silently-ignored parameters would have been worse than removing them.

Verified by generating real audio (CPU, kokoro):

```
PASS  synthesis returns a path
PASS  file is non-trivially sized              [330044 bytes]
PASS  decodes as real audio                    [6.9s @ 24000Hz, 1ch]
PASS  duration is plausible for the text       [6.9s from 19 words]
PASS  empty text rejected                      [code=empty_input]
PASS  unknown backend rejected                 [code=unknown_backend]
6/6 passed
```

espeak-ng is a hard system dependency for kokoro's phonemizer. Without it you
get a confusing failure deep inside the phonemizer, so `tts.py` checks for the
binary up front and returns `espeak_missing` with the apt line.

## Storage: any S3-compatible store

**MinIO is not the answer any more.** Its community server was archived in
April 2026 — no features, no compatibility updates, no security patches. The
maintained self-hosted options are **SeaweedFS** (Apache-2.0, adopted by
Kubeflow Pipelines as its default after MinIO's retreat) and **Garage**
(AGPL-3.0, single Rust binary).

Rather than swap one hardcoded vendor for another, `storage.py` is now
endpoint-agnostic. Two real bugs were blocking that:

1. **`addressing_style` was hardcoded to `"virtual"`.** Virtual-host
   addressing (`bucket.host`) needs a wildcard DNS record, which a
   self-hosted store on an IP or single hostname does not have — every
   request resolves nowhere. It now follows the endpoint: `path` when
   `S3_ENDPOINT_URL` is set, `virtual` for AWS.
2. **The returned object URL was hardcoded to `amazonaws.com`.** For any
   non-AWS backend that handed callers a link to a bucket that does not
   exist. `public_url_for()` now derives it, with `S3_PUBLIC_BASE_URL` as an
   override for CDN/reverse-proxy setups.

Verified against a real SeaweedFS S3 gateway with a full presigned multipart
round-trip:

```
PASS  addressing style follows endpoint        [path]
PASS  public URL is not hardcoded to AWS       [http://127.0.0.1:8333/evalbucket/...]
PASS  multipart upload initiates
PASS  presigned part PUTs accepted             [2 parts]
PASS  reassembled object matches byte-for-byte [5243904 bytes]
PASS  cleanup
6/6 passed
```

## Health

`/healthz/tts` joins `/healthz/llm`, both separate from `/healthz` for the
same reason — most routes touch neither.

```
/healthz      -> {"status":"ok"}                                        200
/healthz/llm  -> {"ok":true,"model":"qwen3:8b","vram_mb":16384}         200
/healthz/tts  -> {"ok":true,"backend":"kokoro","default_voice":"af_heart"} 200
```

## Remaining paid dependencies after Phase 2

Stripe only (kept deliberately — you want revenue, and card acceptance has no
self-hosted equivalent without PCI-DSS). The ad-platform gateway is still
present and comes out in Phase 3.
