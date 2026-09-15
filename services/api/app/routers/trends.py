"""Breakout trend velocity tracking: ingests periodic post-count snapshots
for sounds/hashtags/formats and flags early viral breakouts.
"""
import math
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.models import TrendRecord

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics & Intelligence"])


class TrendSnapshot(BaseModel):
    platform: str
    trend_type: str
    external_identifier: str
    title: str
    current_post_count: int
    interval_hours: float


class TrendAnalyzer:
    @staticmethod
    def calculate_velocity(current_count: int, previous_count: int, interval_hours: float) -> float:
        if interval_hours <= 0 or previous_count <= 0:
            return 0.0
        delta = current_count - previous_count
        hourly_growth_rate = (delta / previous_count) / interval_hours
        scaled = min(math.log10(max(delta, 1)) * (hourly_growth_rate * 100), 100.0)
        return round(max(scaled, 0.0), 2)

    @classmethod
    def ingest_snapshot(cls, db: Session, snapshot: TrendSnapshot) -> Optional[Dict[str, Any]]:
        trend = (
            db.query(TrendRecord)
            .filter(TrendRecord.platform == snapshot.platform, TrendRecord.external_identifier == snapshot.external_identifier)
            .first()
        )
        now = datetime.utcnow()

        if not trend:
            db.add(TrendRecord(
                id=str(uuid.uuid4()),
                platform=snapshot.platform,
                trend_type=snapshot.trend_type,
                external_identifier=snapshot.external_identifier,
                title=snapshot.title,
                velocity_score=10.0,
                current_post_count=snapshot.current_post_count,
                previous_post_count=snapshot.current_post_count,
                is_rising=True,
                detected_at=now,
                last_updated_at=now,
            ))
            db.commit()
            return None

        velocity = cls.calculate_velocity(snapshot.current_post_count, trend.current_post_count, snapshot.interval_hours)
        trend.previous_post_count = trend.current_post_count
        trend.current_post_count = snapshot.current_post_count
        trend.velocity_score = velocity
        trend.is_rising = velocity > 25.0
        trend.last_updated_at = now
        db.commit()

        if trend.is_rising and velocity >= 75.0:
            return {
                "alert": "VIRAL_BREAKOUT_DETECTED",
                "platform": trend.platform,
                "title": trend.title,
                "velocity_score": velocity,
                "posts": trend.current_post_count,
            }
        return None

    @staticmethod
    def get_active_breakouts(db: Session, trend_type: str = "all", limit: int = 20) -> List[Dict[str, Any]]:
        query = db.query(TrendRecord).filter(TrendRecord.is_rising.is_(True))
        if trend_type != "all":
            query = query.filter(TrendRecord.trend_type == trend_type)

        results = query.order_by(TrendRecord.velocity_score.desc()).limit(limit).all()
        return [
            {
                "id": r.id,
                "platform": r.platform,
                "trend_type": r.trend_type,
                "external_identifier": r.external_identifier,
                "title": r.title,
                "velocity_score": r.velocity_score,
                "current_post_count": r.current_post_count,
                "is_rising": r.is_rising,
                "detected_at": r.detected_at.strftime("%Y-%m-%d %H:%M"),
            }
            for r in results
        ]


@router.post("/trends/ingest")
def ingest_trend_snapshot(payload: TrendSnapshot, db: Session = Depends(get_db)):
    alert = TrendAnalyzer.ingest_snapshot(db, payload)
    return {"status": "ingested", "alert": alert}


@router.get("/trends")
def get_active_breakout_trends(type: Optional[str] = Query("all", alias="type"), db: Session = Depends(get_db)):
    return TrendAnalyzer.get_active_breakouts(db=db, trend_type=type or "all", limit=20)
