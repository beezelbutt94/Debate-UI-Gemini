"""Competitor account intelligence: asks Claude to estimate hook-archetype
distribution and content gaps for a given handle/platform.
"""
import json
import os
from typing import Any, Dict, List

from anthropic import AsyncAnthropic
from pydantic import BaseModel

ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-opus-5")

_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


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
        response = await _client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=1500,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}],
        )

        content = response.content[0].text.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        return CompetitorProfile(**json.loads(content))
