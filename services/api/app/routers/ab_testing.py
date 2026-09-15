"""Bayesian (Thompson Sampling) multi-armed bandit for hook A/B testing.

Routes impressions to the variant with the best sampled posterior, tracks
outcomes, and declares a winner once a variant's probability of being
optimal clears 95% with at least 100 impressions.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.models import ABExperiment, VideoFile, VideoVariant

router = APIRouter(prefix="/api/v1/ab", tags=["A/B Testing & Dynamic Optimization"])

ALPHA_PRIOR = 1.0
BETA_PRIOR = 1.0
MIN_IMPRESSIONS_FOR_WINNER = 100
WINNER_PROBABILITY_THRESHOLD = 0.95
MONTE_CARLO_DRAWS = 10000


class CreateExperimentPayload(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    duration_hours: int = Field(default=72, ge=1, le=720)
    variants: List[Dict[str, str]] = Field(..., min_length=2)


class InteractionEventPayload(BaseModel):
    experiment_id: str
    variant_id: str
    event_type: str = Field(..., pattern="^(impression|hook_view_3s|completion|share)$")


class BayesianBanditRouter:
    @staticmethod
    def _counts(variant: VideoVariant) -> Tuple[int, int]:
        return variant.impressions, variant.hook_views_3s

    @classmethod
    def select_variant_for_impression(cls, db: Session, experiment_id: str) -> Optional[VideoVariant]:
        experiment = db.query(ABExperiment).filter(ABExperiment.id == experiment_id).first()
        if not experiment:
            return None

        variants: List[VideoVariant] = db.query(VideoVariant).filter(VideoVariant.experiment_id == experiment_id).all()
        if not variants:
            return None

        if experiment.winner_variant_id:
            winner = next((v for v in variants if v.id == experiment.winner_variant_id), None)
            if winner:
                cls.record_event(db, winner.id, "impression")
                return winner

        payoffs = []
        for variant in variants:
            impressions, successes = cls._counts(variant)
            failures = max(0, impressions - successes)
            payoffs.append(np.random.beta(ALPHA_PRIOR + successes, BETA_PRIOR + failures))

        selected = variants[int(np.argmax(payoffs))]
        cls.record_event(db, selected.id, "impression")
        return selected

    @staticmethod
    def record_event(db: Session, variant_id: str, event_type: str) -> None:
        variant = db.query(VideoVariant).filter(VideoVariant.id == variant_id).first()
        if not variant:
            return

        if event_type == "impression":
            variant.impressions += 1
        elif event_type == "hook_view_3s":
            variant.hook_views_3s += 1
        elif event_type == "completion":
            variant.completions += 1
        elif event_type == "share":
            variant.shares += 1

        if variant.impressions > 0:
            variant.engagement_rate = round((variant.hook_views_3s / variant.impressions) * 100.0, 2)

        db.commit()

    @classmethod
    def compute_bayesian_statistics(cls, db: Session, experiment_id: str):
        variants: List[VideoVariant] = db.query(VideoVariant).filter(VideoVariant.experiment_id == experiment_id).all()
        if not variants:
            return [], False, None

        posteriors = []
        stats = []
        for v in variants:
            impressions, successes = cls._counts(v)
            failures = max(0, impressions - successes)
            alpha, beta = ALPHA_PRIOR + successes, BETA_PRIOR + failures
            posteriors.append((alpha, beta))
            draws = np.random.beta(alpha, beta, size=5000)
            stats.append({
                "model": v,
                "impressions": impressions,
                "successes": successes,
                "conversion_rate": round((successes / impressions) * 100.0, 2) if impressions else 0.0,
                "alpha": alpha,
                "beta": beta,
                "ci": (round(float(np.percentile(draws, 2.5)), 4), round(float(np.percentile(draws, 97.5)), 4)),
            })

        draws_matrix = np.zeros((MONTE_CARLO_DRAWS, len(variants)))
        for idx, (alpha, beta) in enumerate(posteriors):
            draws_matrix[:, idx] = np.random.beta(alpha, beta, size=MONTE_CARLO_DRAWS)
        win_probabilities = [float(np.mean(np.argmax(draws_matrix, axis=1) == i)) for i in range(len(variants))]

        reports = []
        has_converged = False
        winner_id = None
        for idx, s in enumerate(stats):
            v: VideoVariant = s["model"]
            win_prob = win_probabilities[idx]
            reports.append({
                "variant_id": v.id,
                "variant_label": v.variant_label,
                "hook_type": v.hook_type,
                "video_file_id": v.video_file_id,
                "impressions": s["impressions"],
                "hook_views_3s": s["successes"],
                "conversion_rate_3s": s["conversion_rate"],
                "completions": v.completions,
                "shares": v.shares,
                "posterior_alpha": s["alpha"],
                "posterior_beta": s["beta"],
                "probability_of_being_optimal": round(win_prob, 4),
                "credible_interval_95": s["ci"],
            })
            if win_prob >= WINNER_PROBABILITY_THRESHOLD and s["impressions"] >= MIN_IMPRESSIONS_FOR_WINNER:
                has_converged = True
                winner_id = v.id

        return reports, has_converged, winner_id


@router.post("/experiments", status_code=status.HTTP_201_CREATED)
def create_ab_experiment(payload: CreateExperimentPayload, db: Session = Depends(get_db)):
    exp_id = str(uuid.uuid4())
    concludes_at = datetime.now(timezone.utc) + timedelta(hours=payload.duration_hours)

    db.add(ABExperiment(id=exp_id, title=payload.title, status="active", created_at=datetime.now(timezone.utc), concludes_at=concludes_at))
    for item in payload.variants:
        db.add(VideoVariant(
            id=str(uuid.uuid4()),
            experiment_id=exp_id,
            variant_label=item["variant_label"],
            hook_type=item["hook_type"],
            video_file_id=item["video_file_id"],
        ))
    db.commit()
    return {"experiment_id": exp_id, "status": "active", "concludes_at": concludes_at}


@router.get("/experiments/{experiment_id}/route")
def route_impression(experiment_id: str, db: Session = Depends(get_db)):
    variant = BayesianBanditRouter.select_variant_for_impression(db, experiment_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Active experiment or variants not found")

    video = db.query(VideoFile).filter(VideoFile.id == variant.video_file_id).first()
    return {
        "experiment_id": experiment_id,
        "variant_id": variant.id,
        "variant_label": variant.variant_label,
        "hook_type": variant.hook_type,
        "video_file_id": variant.video_file_id,
        "video_url": video.output_url if video else None,
    }


@router.post("/events")
def log_interaction_event(payload: InteractionEventPayload, db: Session = Depends(get_db)):
    BayesianBanditRouter.record_event(db, payload.variant_id, payload.event_type)
    return {"status": "recorded"}


@router.get("/experiments/{experiment_id}/status")
def get_experiment_telemetry(experiment_id: str, db: Session = Depends(get_db)):
    experiment = db.query(ABExperiment).filter(ABExperiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    reports, has_converged, winner_id = BayesianBanditRouter.compute_bayesian_statistics(db, experiment_id)

    if has_converged and experiment.status == "active":
        experiment.status = "concluded"
        experiment.winner_variant_id = winner_id
        db.commit()

    return {
        "experiment_id": experiment.id,
        "title": experiment.title,
        "status": experiment.status,
        "winner_variant_id": experiment.winner_variant_id or winner_id,
        "has_converged": has_converged,
        "total_impressions": sum(r["impressions"] for r in reports),
        "variants": reports,
    }
