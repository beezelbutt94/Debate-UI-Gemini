"""Viral hook analyzer & script optimizer: rewrites a raw script for a
disruptive 0-3s hook, fast pacing, and platform-appropriate word density.
"""
import json
from typing import Any, Dict, List

from pydantic import BaseModel, Field

from app.core.anthropic_client import ANTHROPIC_MODEL, extract_json_block, get_anthropic_client


class ScriptOptimizationReport(BaseModel):
    original_input: str
    optimized_script: str
    hook_score: float = Field(..., ge=0.0, le=100.0)
    hook_rationale: str
    target_platform: str
    estimated_duration_seconds: float
    pacing_wpm: int
    retention_triggers: List[str]


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
    # No `temperature`: sampling parameters are rejected with a 400 on
    # claude-opus-5 and the rest of the current model family.
    response = await get_anthropic_client().messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    data: Dict[str, Any] = json.loads(extract_json_block(response.content[0].text))
    return ScriptOptimizationReport(**data)
