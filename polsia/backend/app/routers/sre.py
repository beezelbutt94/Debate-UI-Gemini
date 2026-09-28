"""CI-facing deployment and canary endpoints, plus the incident list."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app import sre
from app.security import require_deployment_secret, require_operator
from app.tasks import evaluate_canary

ci = APIRouter(dependencies=[Depends(require_deployment_secret)], tags=["ci"])
ops = APIRouter(dependencies=[Depends(require_operator)], tags=["sre"])

SHA = r"^[0-9a-fA-F]{7,40}$"
REPO = r"^[\w.-]+/[\w.-]+$"


class DeploymentRequest(BaseModel):
    repo: str = Field(pattern=REPO)
    commit_sha: str = Field(pattern=SHA)
    environment: str = "production"
    pr_number: int | None = None
    pr_title: str | None = None
    files_changed: list[str] = []


class CanaryRequest(BaseModel):
    repo: str = Field(pattern=REPO)
    commit_sha: str = Field(pattern=SHA)
    environment: str = "staging"
    duration_minutes: int = Field(15, ge=1, le=240)
    max_allowed_errors: int = Field(0, ge=0)


@ci.post("/deployments", status_code=201)
def register_deployment(req: DeploymentRequest) -> dict[str, Any]:
    return sre.register_deployment(**req.model_dump())


@ci.post("/canary", status_code=201)
def start_canary(req: CanaryRequest) -> dict[str, Any]:
    canary = sre.start_canary(**req.model_dump())
    # The beat sweep re-checks every minute; this is just the on-time evaluation.
    evaluate_canary.apply_async((canary["id"],), countdown=req.duration_minutes * 60)
    return canary


@ci.get("/canary/{canary_id}")
def get_canary(canary_id: str) -> dict[str, Any]:
    try:
        return sre.get_canary(canary_id)
    except LookupError:
        raise HTTPException(404, "Canary not found") from None


@ops.get("/incidents")
def incidents() -> list[dict[str, Any]]:
    return sre.recent_incidents()
