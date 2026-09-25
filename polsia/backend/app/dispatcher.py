"""Validates action payloads and routes them to the adapter that executes them."""

import logging
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, Field, ValidationError, field_validator

from app.config import settings

logger = logging.getLogger("polsia.dispatcher")


class CreatePR(BaseModel):
    repo: str = Field(pattern=r"^[\w.-]+/[\w.-]+$")
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10)
    base_branch: str = "main"


class RevertCommit(BaseModel):
    repo: str = Field(pattern=r"^[\w.-]+/[\w.-]+$")
    commit_sha: str = Field(pattern=r"^[0-9a-fA-F]{7,40}$")
    reason: str
    base_branch: str = "main"


class SendEmail(BaseModel):
    to_email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    subject: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=20)
    campaign: str = "default"


class PostThread(BaseModel):
    posts: list[str] = Field(min_length=1, max_length=10)


class AdBudgetChange(BaseModel):
    campaign_id: str
    daily_budget_usd: float = Field(ge=0)

    @field_validator("daily_budget_usd")
    @classmethod
    def within_cap(cls, value: float) -> float:
        if value > settings.ADS_DAILY_BUDGET_USD:
            raise ValueError(f"exceeds ADS_DAILY_BUDGET_USD ({settings.ADS_DAILY_BUDGET_USD})")
        return value


class UpdateAdBudgets(BaseModel):
    allocations: list[AdBudgetChange] = Field(min_length=1)


class InvalidActionError(ValueError):
    pass


def _create_pr(p: CreatePR, run_id: str | None) -> dict[str, Any]:
    from app.adapters.github import GitHubAdapter

    return GitHubAdapter().create_fix_pr(p.repo, p.title, p.description, p.base_branch, run_id=run_id)


def _revert(p: RevertCommit, run_id: str | None) -> dict[str, Any]:
    from app.adapters.github import GitHubAdapter

    return GitHubAdapter().create_revert_pr(p.repo, p.commit_sha, p.reason, p.base_branch)


def _email(p: SendEmail, run_id: str | None) -> dict[str, Any]:
    from app.adapters.email import send_email

    return send_email(p.to_email, p.subject, p.body, p.campaign)


def _thread(p: PostThread, run_id: str | None) -> dict[str, Any]:
    from app.adapters.social import post_thread

    return post_thread(p.posts)


def _ad_budgets(p: UpdateAdBudgets, run_id: str | None) -> dict[str, Any]:
    from app import bandit
    from app.adapters.ads import set_daily_budget

    results = [set_daily_budget(a.campaign_id, a.daily_budget_usd) for a in p.allocations]
    bandit.record_applied_budgets({a.campaign_id: a.daily_budget_usd for a in p.allocations})
    return {"status": results[0]["status"], "changes": results}


ACTIONS: dict[str, tuple[type[BaseModel], Callable[[Any, str | None], dict[str, Any]]]] = {
    "CREATE_PR": (CreatePR, _create_pr),
    "REVERT_COMMIT": (RevertCommit, _revert),
    "SEND_EMAIL": (SendEmail, _email),
    "POST_THREAD": (PostThread, _thread),
    "UPDATE_AD_BUDGETS": (UpdateAdBudgets, _ad_budgets),
}


def validate(action_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    if action_type not in ACTIONS:
        raise InvalidActionError(f"Unknown action '{action_type}'")
    schema, _ = ACTIONS[action_type]
    try:
        return schema.model_validate(payload).model_dump()
    except ValidationError as exc:
        raise InvalidActionError(f"Invalid {action_type} payload: {exc.errors(include_url=False)}") from exc


def failure_summary(action_type: str, exc: Exception) -> str:
    """Log the full failure server-side; return only what is safe to show an operator.

    Adapter exceptions can carry request URLs, headers or tokens, so their text
    stays in the logs and API responses get the exception type alone.
    """
    logger.error("%s failed", action_type, exc_info=exc)
    return f"{action_type} failed ({type(exc).__name__}); see server logs for details"


def dispatch(action_type: str, payload: dict[str, Any], run_id: str | None = None) -> dict[str, Any]:
    clean = validate(action_type, payload)
    schema, handler = ACTIONS[action_type]
    logger.info("Dispatching %s (sandbox=%s)", action_type, settings.SANDBOX_MODE)
    return handler(schema.model_validate(clean), run_id)
