"""Prevent real DB/Redis connections during unit tests.

`database.py` calls create_engine() at module level, so we inject
mocks into sys.modules before any service code is imported.
"""
import sys
import os
from unittest.mock import MagicMock
from sqlalchemy.orm import declarative_base

# Point sys.path at the service root so `app.*` is resolvable.
_API_ROOT = os.path.join(os.path.dirname(__file__), '../../services/api')
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

# ── Stub app.core.database ────────────────────────────────────────────────────
# Provide a real declarative_base() so model Column definitions still work.
_mock_db = MagicMock()
_mock_db.Base = declarative_base()
_mock_db.engine = MagicMock()
_mock_db.SessionLocal = MagicMock()
_mock_db.get_db = MagicMock()
sys.modules['app.core.database'] = _mock_db

# ── Stub redis at package level (rate_limit.py calls redis.from_url at import) ─
_mock_redis_module = MagicMock()
_mock_redis_module.from_url = MagicMock(return_value=MagicMock())
_mock_redis_module.RedisError = Exception
sys.modules.setdefault('redis', _mock_redis_module)
