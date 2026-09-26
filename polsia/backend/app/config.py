"""Runtime configuration, read from the environment (and `.env` when present)."""

from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Core infrastructure -------------------------------------------------
    DATABASE_URL: str = f"sqlite:///{BACKEND_DIR / 'polsia.db'}"
    # Empty REDIS_URL runs Celery tasks inline and keeps the live feed in-process.
    # Set it (docker-compose does) to get a real broker and cross-process pub/sub.
    REDIS_URL: str = ""
    CORS_ORIGINS: str = "http://localhost:3000"
    # When set, every operator endpoint (dispatching agents, approving actions,
    # resetting breakers) requires `Authorization: Bearer <OPERATOR_TOKEN>`.
    OPERATOR_TOKEN: str = ""

    # --- Agent execution -----------------------------------------------------
    # "simulated" never calls a model: each agent returns a deterministic,
    # schema-valid decision so the whole pipeline can run with zero credentials.
    # "claude_code" shells out to the headless Claude Code CLI (`claude -p`).
    LLM_MODE: Literal["simulated", "claude_code"] = "simulated"
    CLAUDE_BIN: str = "claude"
    CLAUDE_MODEL: str = "claude-opus-5"
    CLAUDE_TIMEOUT_SECONDS: int = 600
    ANTHROPIC_API_KEY: str = ""
    WORK_DIR: Path = BACKEND_DIR / "workspace"
    SOUL_PATH: Path = BACKEND_DIR / "soul.md"
    KNOWLEDGE_DIR: Path = BACKEND_DIR / "knowledge"

    # SANDBOX_MODE blocks every external side effect (PRs, emails, posts, ad
    # budget changes). Adapters return a "simulated" result instead.
    SANDBOX_MODE: bool = True

    # --- Cost controls -------------------------------------------------------
    DAILY_AGENT_BUDGET_USD: float = 50.0
    DAILY_GLOBAL_BUDGET_USD: float = 200.0

    # --- GitHub --------------------------------------------------------------
    GITHUB_TOKEN: str = ""
    GITHUB_ACTOR_NAME: str = "Polsia Agent"
    GITHUB_ACTOR_EMAIL: str = "agent@example.com"
    DEFAULT_REPO: str = ""

    # --- Outreach / email ----------------------------------------------------
    SENDGRID_API_KEY: str = ""
    # Base64 DER public key from SendGrid's "Signed Event Webhook" settings.
    SENDGRID_WEBHOOK_PUBLIC_KEY: str = ""
    OUTREACH_FROM_EMAIL: str = "outreach@example.com"
    OUTREACH_FROM_NAME: str = "Polsia"
    BOUNCE_RATE_THRESHOLD: float = 0.02
    BOUNCE_MIN_SAMPLE: int = 50
    BOUNCE_WINDOW_DAYS: int = 7

    # --- Social --------------------------------------------------------------
    # OAuth 2.0 user-context token with tweet.write scope.
    X_USER_ACCESS_TOKEN: str = ""

    # --- Ads -----------------------------------------------------------------
    META_ADS_TOKEN: str = ""
    ADS_DAILY_BUDGET_USD: float = 100.0
    ADS_MIN_ARM_SHARE: float = 0.05

    # --- Webhook secrets -----------------------------------------------------
    STRIPE_WEBHOOK_SECRET: str = ""
    CALCOM_WEBHOOK_SECRET: str = ""
    SENTRY_CLIENT_SECRET: str = ""
    # Shared secret CI uses to register deployments. Registration is refused
    # while it is unset, so an unconfigured install can't be fed fake deploys.
    DEPLOYMENT_SECRET: str = ""

    # --- SRE -----------------------------------------------------------------
    # False: an incident files a revert PR as a pending approval.
    # True: the revert PR is opened immediately (still simulated in sandbox).
    AUTO_REVERT: bool = False
    INCIDENT_CORRELATION_WINDOW_MINUTES: int = 120
    SENTRY_AUTH_TOKEN: str = ""
    SENTRY_ORG: str = ""
    SENTRY_PROJECT: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
