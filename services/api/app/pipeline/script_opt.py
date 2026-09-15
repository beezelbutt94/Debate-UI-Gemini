"""Viral hook analyzer & script optimizer: rewrites a raw script for a
disruptive 0-3s hook, fast pacing, and platform-appropriate word density.
"""
import json
import os
from typing import Any, Dict, List

from anthropic import AsyncAnthropic
from pydantic import BaseModel, Field

ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-opus-5")

_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


class ScriptOptimizationReport(BaseModel):
    original_input: str
    optimized_script: str
    hook_score: float = Field(..., ge=0.0, le=100.0)
    hook_rationale: str
    target_platform: str
    estimated_duration_seconds: float
    pacing_wpm: int
    retention_triggers: List[str]


def _extract_json_block(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return text


async def optimize_script_for_virality(
    raw_script: str,
    target_platform: str = "tiktok",
    target_duration_seconds: int = 15,
) -> ScriptOptimizationReport:
    target_words = int((target_duration_seconds / 60.0) * 160)

    prompt = f"""You are an elite short-form algorithmic script consultant specializing in TikTok, Instagram Reels, and YouTube Shorts.
Analyze and rewrite the following input topic/script:

Input Content:
"{raw_script}"

Target Platform: {target_platform}
Target Duration: {target_duration_seconds} seconds (approx {target_words} words)

Execution Rules:
1. First 3 words MUST create an immediate pattern interrupt (no "Hey guys", no "Today I'm going to talk about").
2. Sentence lengths must average 6-9 words to support fast visual cuts and kinetic captions.
3. Hook Score (0-100) must reflect shock value, curiosity gap, and emotional tension.
4. Output strictly valid JSON matching keys: original_input, optimized_script, hook_score,
   hook_rationale, target_platform, estimated_duration_seconds, pacing_wpm, retention_triggers.
"""
    response = await _client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=1500,
        temperature=0.4,
        messages=[{"role": "user", "content": prompt}],
    )

    data: Dict[str, Any] = json.loads(_extract_json_block(response.content[0].text))
    return ScriptOptimizationReport(**data)
