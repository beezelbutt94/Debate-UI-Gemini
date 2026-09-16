"""Competitor account intelligence: asks Claude to estimate hook-archetype
distribution and content gaps for a given handle/platform.
"""
from typing import Any, Dict, List

from pydantic import BaseModel

from app.core.llm import generate_structured


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
        # Decoding is constrained to CompetitorProfile's schema, so the
        # result is already the right shape -- no fence stripping, no parse.
        return await generate_structured(prompt, CompetitorProfile, max_tokens=1500)
