"""Local LLM client (Ollama) for the structured-output pipeline steps.

Replaces the hosted Anthropic client. Every pipeline step that used Claude
wants exactly one thing: a JSON object matching a Pydantic model. Ollama can
constrain decoding to a JSON Schema, so the model is *unable* to emit
syntactically invalid JSON -- which is why a small local model is viable
here even though its prose is weaker than a frontier model's.

Two things that constraint does NOT give you, both learned by running it:

1. **It guarantees syntax, not completion.** If generation hits the token
   cap mid-string the response is still truncated, and `json.loads` reports
   it as "Unterminated string" -- which reads like a grammar bug and sends
   you debugging the wrong thing. Ollama reports `done_reason == "length"`,
   so that is checked explicitly and retried with a larger budget.
2. **It constrains types, not values.** A schema's `minimum`/`maximum` are
   not enforced by the grammar, so a model can return hook_score: 150 and
   Pydantic will reject it. That is also retried rather than raised at the
   caller.
"""
import json
import logging
import os
import shutil
import subprocess
from functools import lru_cache
from typing import Type, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")

# Generation is slow on modest hardware and these run inside Celery tasks,
# not request handlers, so the timeout is generous on purpose.
OLLAMA_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "600"))

# How long Ollama keeps weights resident after a request. "0" evicts
# immediately, which is what makes a single small GPU able to run the LLM,
# faster-whisper and CLIP in the same pipeline -- they take turns instead of
# competing. On a card with room to spare, set this to "5m" to skip the
# reload between steps.
OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "0")

# Chosen by available VRAM unless pinned explicitly. Quality per GB is the
# whole reason these two are the candidates; see docs/LOCAL_STACK.md.
MODEL_LARGE = os.getenv("OLLAMA_MODEL_LARGE", "qwen3:14b")   # ~9GB at Q4
MODEL_SMALL = os.getenv("OLLAMA_MODEL_SMALL", "qwen3:8b")    # ~5GB at Q4
MIN_VRAM_MB_FOR_LARGE = int(os.getenv("MIN_VRAM_MB_FOR_LARGE", "12000"))


class LLMError(RuntimeError):
    """A pipeline step could not get usable structured output."""

    def __init__(self, code: str, message: str, remedy: str = ""):
        super().__init__(message)
        self.code = code
        self.remedy = remedy


def _detect_vram_mb() -> int | None:
    """Total VRAM of the largest visible GPU, or None if there isn't one."""
    if not shutil.which("nvidia-smi"):
        return None
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10, check=True,
        ).stdout
        return max(int(line.strip()) for line in out.splitlines() if line.strip())
    except (subprocess.SubprocessError, ValueError) as exc:
        logger.warning("Could not read VRAM from nvidia-smi: %s", exc)
        return None


@lru_cache(maxsize=1)
def resolve_model() -> str:
    """Picks the largest model this machine can actually hold.

    Pinning OLLAMA_MODEL skips detection entirely -- do that in production,
    where guessing from whatever GPU the pod landed on is not a virtue.
    """
    pinned = os.getenv("OLLAMA_MODEL")
    if pinned:
        return pinned

    vram = _detect_vram_mb()
    if vram is None:
        # Not fatal: Ollama runs on CPU. It is slow enough that it is worth
        # saying so loudly once rather than leaving someone wondering why a
        # render takes twenty minutes.
        logger.warning(
            "No GPU detected; %s will run on CPU and generation will be slow. "
            "Pin OLLAMA_MODEL to a smaller model if this is a workstation.",
            MODEL_SMALL,
        )
        return MODEL_SMALL

    chosen = MODEL_LARGE if vram >= MIN_VRAM_MB_FOR_LARGE else MODEL_SMALL
    logger.info("Detected %d MB VRAM; using %s.", vram, chosen)
    return chosen


@lru_cache(maxsize=1)
def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=OLLAMA_HOST, timeout=OLLAMA_TIMEOUT_SECONDS)


async def generate_structured(
    prompt: str,
    schema_model: Type[T],
    *,
    max_tokens: int = 2000,
    max_attempts: int = 3,
) -> T:
    """Returns a validated `schema_model` instance, or raises `LLMError`.

    The caller never has to strip code fences or parse JSON -- the schema is
    enforced during decoding, so what comes back is already the right shape.
    """
    schema = schema_model.model_json_schema()
    model = resolve_model()
    budget = max_tokens
    last_problem = ""

    for attempt in range(1, max_attempts + 1):
        try:
            response = await _client().post(
                "/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "format": schema,
                    "options": {"num_predict": budget},
                    "keep_alive": OLLAMA_KEEP_ALIVE,
                },
            )
        except httpx.HTTPError as exc:
            raise LLMError(
                "llm_unreachable",
                f"Could not reach Ollama at {OLLAMA_HOST}: {exc}",
                "Start it with `ollama serve`, or set OLLAMA_HOST to point at the inference box.",
            ) from exc

        if response.status_code == 404:
            raise LLMError(
                "model_not_pulled",
                f"Ollama has no model named '{model}'.",
                f"Run `ollama pull {model}` on the inference host.",
            )
        if response.status_code >= 400:
            raise LLMError(
                "llm_error",
                f"Ollama returned {response.status_code}: {response.text[:200]}",
                "Check the Ollama server logs.",
            )

        body = response.json()
        raw = body.get("response", "")

        # Truncation: the grammar kept the prefix valid, but it never got to
        # close the document. Retrying with the same budget would truncate
        # identically, so the budget grows.
        if body.get("done_reason") == "length":
            last_problem = f"hit the {budget}-token cap"
            budget *= 2
            logger.warning(
                "%s truncated at %d tokens (attempt %d/%d); retrying with %d.",
                model, body.get("eval_count", budget), attempt, max_attempts, budget,
            )
            continue

        try:
            return schema_model(**json.loads(raw))
        except (json.JSONDecodeError, ValidationError) as exc:
            # Type-correct but value-invalid (a score outside its range, an
            # empty required list). Worth one more roll of the dice.
            last_problem = f"{type(exc).__name__}: {str(exc)[:200]}"
            logger.warning(
                "%s returned unusable output (attempt %d/%d): %s",
                model, attempt, max_attempts, last_problem,
            )

    raise LLMError(
        "invalid_output",
        f"{model} did not produce valid {schema_model.__name__} in {max_attempts} attempts "
        f"(last: {last_problem}).",
        "Try a larger model via OLLAMA_MODEL, or raise max_tokens for this step.",
    )


async def healthcheck() -> dict:
    """Reports whether the configured model is actually usable right now."""
    model = resolve_model()
    try:
        response = await _client().get("/api/tags")
        response.raise_for_status()
    except httpx.HTTPError as exc:
        return {"ok": False, "reason": f"unreachable: {exc}", "model": model}

    available = {m["name"] for m in response.json().get("models", [])}
    if model not in available:
        return {"ok": False, "reason": "model_not_pulled", "model": model,
                "available": sorted(available)}
    return {"ok": True, "model": model, "vram_mb": _detect_vram_mb()}
