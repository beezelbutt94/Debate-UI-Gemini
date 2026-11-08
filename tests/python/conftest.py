"""
Shared pytest configuration.

Patches external modules that are either not installed in the CI environment
(anthropic) or would fail at module import without real credentials
(database URL).  All patches are applied before any test module is imported.
"""
import os
import sys
import types
from unittest.mock import MagicMock


# ---------------------------------------------------------------------------
# 1. Stub the `anthropic` package so that importing app.core.anthropic_client
#    does not blow up with ModuleNotFoundError.
# ---------------------------------------------------------------------------
_anthropic_stub = types.ModuleType("anthropic")
_anthropic_stub.AsyncAnthropic = MagicMock()  # type: ignore[attr-defined]
sys.modules.setdefault("anthropic", _anthropic_stub)


# ---------------------------------------------------------------------------
# 2. Point the DATABASE_URL to sqlite so create_engine() doesn't try to
#    resolve a postgres host at import time.
# ---------------------------------------------------------------------------
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_viralengine.db")


# ---------------------------------------------------------------------------
# 3. Add services/api to sys.path so `from app.xxx import yyy` resolves.
# ---------------------------------------------------------------------------
_api_root = os.path.join(os.path.dirname(__file__), "..", "..", "services", "api")
_api_root = os.path.normpath(_api_root)
if _api_root not in sys.path:
    sys.path.insert(0, _api_root)
