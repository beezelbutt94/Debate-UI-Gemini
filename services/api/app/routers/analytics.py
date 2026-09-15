"""Competitor scan endpoint. The trend-breakout endpoints live in
`app.routers.trends` (both are mounted under `/api/v1/analytics`).
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.models import User
from app.pipeline.competitor import CompetitorIntelligenceEngine

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics & Intelligence"])


class CompetitorScanPayload(BaseModel):
    handle: str
    platform: str = "tiktok"


@router.post("/competitor-scan")
async def scan_competitor_account(payload: CompetitorScanPayload, current_user: User = Depends(get_current_user)):
    result = await CompetitorIntelligenceEngine.analyze_account_strategy(handle=payload.handle, platform=payload.platform)
    return result.model_dump()
