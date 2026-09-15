"""Shared, lazily-created Anthropic client.

Constructing `AsyncAnthropic()` at module import time coupled the whole
service's startup to this SDK: a missing key or an SDK/httpx version skew
took down every route, including ones that never call Claude. This mirrors
the lazy `getStripe()` in the Next.js app -- a misconfiguration surfaces on
first use, not at import.
"""
import os
from functools import lru_cache

from anthropic import AsyncAnthropic

# Verify against Anthropic's current model list before deploying; pin an
# explicit model rather than tracking a moving default.
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-opus-5")


@lru_cache(maxsize=1)
def get_anthropic_client() -> AsyncAnthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Set it before using any AI pipeline "
            "step (storyboarding, script optimization, competitor analysis, "
            "long-form repurposing)."
        )
    return AsyncAnthropic(api_key=api_key)


def extract_json_block(raw: str) -> str:
    """Strips a ```json fence if the model wrapped its reply in one."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return text
