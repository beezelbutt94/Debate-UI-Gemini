import os

# Pin a hermetic configuration before any app module reads settings.
os.environ.update(
    {
        "DATABASE_URL": "sqlite://",
        "REDIS_URL": "",
        "LLM_MODE": "simulated",
        "SANDBOX_MODE": "true",
        "OPERATOR_TOKEN": "",
        "DEPLOYMENT_SECRET": "",
        "DEFAULT_REPO": "",
        "STRIPE_WEBHOOK_SECRET": "",
        "CALCOM_WEBHOOK_SECRET": "",
        "SENTRY_CLIENT_SECRET": "",
        "SENDGRID_WEBHOOK_PUBLIC_KEY": "",
        "AUTO_REVERT": "false",
    }
)

import json  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import db, runner  # noqa: E402
from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    db.init_db()
    yield
    db.Base.metadata.drop_all(bind=db.engine)
    runner.set_simulator(None)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def configure(monkeypatch):
    """configure(FIELD=value, ...) overrides settings for one test."""

    def _set(**values):
        for key, value in values.items():
            monkeypatch.setattr(settings, key, value)

    return _set


@pytest.fixture
def script_model():
    """Script model output: script_model(lambda prompt, agent: {...} | str | None)."""

    def _install(fn):
        def simulator(prompt: str, agent: str):
            out = fn(prompt, agent)
            if out is None or isinstance(out, str):
                return out
            return json.dumps(out)

        runner.set_simulator(simulator)

    return _install
