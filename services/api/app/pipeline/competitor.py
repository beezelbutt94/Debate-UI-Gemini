"""Competitor account intelligence: asks Claude to estimate hook-archetype
distribution and content gaps for a given handle/platform.
"""
import json
from typing import Any, Dict, List

from pydantic import BaseModel

from app.core.anthropic_client import ANTHROPIC_MODEL, extract_json_block, get_anthropic_client


class CompetitorProfile(BaseModel):
    handle: str
    platform: str
    sampleSize: int
    avgViews: int
    engagementRate: float
    hookBreakdown: List[Dict[str, Any]]
    contentGaps: List[str]


class CompetitorIntelligenceEngine:
    @staticmethod
    async def analyze_account_strategy(handle: str, platform: str) -> CompetitorProfile:
        prompt = f"""You are an elite short-form video strategist analyzing competitor performance.
Competitor Handle: {handle}
Platform: {platform}

Analyze typical high-performing content structures in this niche and return:
1. Estimated sample size (30-50 videos).
2. Average view count and engagement benchmark.
3. Frequency distribution of hook archetypes: "Contrarian Thesis", "Speed Visual Cut", "Curiosity Question", "Standard Greeting".
4. Exactly 3 actionable content gap opportunities where this creator underperforms.

Output strictly valid JSON matching keys: handle, platform, sampleSize, avgViews, engagementRate, hookBreakdown
(array of {{"name": str, "frequency": number}}), contentGaps (array of 3 strings).
"""
        # No `temperature`: sampling parameters are rejected with a 400 on
        # claude-opus-5 and the rest of the current model family.
        response = await get_anthropic_client().messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )

        return CompetitorProfile(**json.loads(extract_json_block(response.content[0].text)))
