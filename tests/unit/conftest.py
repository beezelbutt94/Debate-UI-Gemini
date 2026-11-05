"""Shared pytest fixtures and mocks for unit tests.

Stubs out heavy optional dependencies (Redis, SQLAlchemy, faster_whisper,
torch, open_clip, mediapipe, cv2) so the pure-logic tests can run without
those packages installed.
"""
import sys
import types
import unittest.mock as mock

# ── Redis stub ────────────────────────────────────────────────────────────────
redis_mod = types.ModuleType('redis')
redis_mod.from_url = mock.MagicMock(return_value=mock.MagicMock())
redis_mod.RedisError = Exception
sys.modules.setdefault('redis', redis_mod)

# ── SQLAlchemy stubs ──────────────────────────────────────────────────────────
for mod_name in ('sqlalchemy', 'sqlalchemy.orm', 'sqlalchemy.dialects',
                 'sqlalchemy.dialects.postgresql', 'alembic', 'alembic.op',
                 'psycopg2'):
    sys.modules.setdefault(mod_name, types.ModuleType(mod_name))

# Restore real sqlalchemy and all its submodules.
# setdefault above may have cached stubs before the real package loaded;
# clear every sqlalchemy.* entry so the real package reimports cleanly.
for _k in [k for k in sys.modules if k == 'sqlalchemy' or k.startswith('sqlalchemy.')]:
    del sys.modules[_k]
import sqlalchemy as _sa_real  # noqa: E402
import sqlalchemy.orm as _sa_orm_real  # noqa: E402
sys.modules['psycopg2'] = types.ModuleType('psycopg2')
sys.modules['psycopg2.extras'] = types.ModuleType('psycopg2.extras')

# ── App database module stub ───────────────────────────────────────────────────
# database.py calls create_engine() at module load time, which needs a live
# PostgreSQL driver (psycopg3).  Stub the module so auth.py / models.py can
# import it without triggering a connection.  models.py imports Base from here,
# so we give it a real declarative_base() so SQLAlchemy Column descriptors work.
_db_mod = types.ModuleType('app.core.database')
_db_mod.get_db = mock.MagicMock()
_db_mod.SessionLocal = mock.MagicMock()
_db_mod.engine = mock.MagicMock()
_db_mod.Base = _sa_orm_real.declarative_base()
sys.modules.setdefault('app.core.database', _db_mod)

# ── Heavy ML stubs ────────────────────────────────────────────────────────────
for heavy in ('faster_whisper', 'torch', 'open_clip', 'mediapipe', 'cv2',
              'numpy'):
    if heavy not in sys.modules:
        sys.modules[heavy] = types.ModuleType(heavy)

# numpy needs at least `mean` for SmartCropEngine
import numpy as _np_real
sys.modules['numpy'] = _np_real   # use the real numpy — it's in requirements.txt

# pytest.approx uses numpy.isscalar; provide it when numpy is a stub (not installed)
if not hasattr(_np_real, 'isscalar'):
    _np_real.isscalar = lambda x: isinstance(x, (int, float, complex, bool))

# ── Starlette / FastAPI lightweight stubs (only if not installed) ─────────────
try:
    import fastapi  # noqa: F401
except ImportError:
    for mod_name in ('fastapi', 'fastapi.security', 'fastapi.security.api_key',
                     'starlette', 'starlette.middleware', 'starlette.middleware.base',
                     'starlette.responses'):
        sys.modules.setdefault(mod_name, types.ModuleType(mod_name))

# ── Anthropic stub ────────────────────────────────────────────────────────────
if 'anthropic' not in sys.modules:
    anthropic_mod = types.ModuleType('anthropic')
    anthropic_mod.AsyncAnthropic = mock.MagicMock
    sys.modules['anthropic'] = anthropic_mod

# ── Celery stub ───────────────────────────────────────────────────────────────
if 'celery' not in sys.modules:
    celery_mod = types.ModuleType('celery')
    celery_mod.Celery = mock.MagicMock
    celery_mod.chord = mock.MagicMock
    celery_mod.group = mock.MagicMock
    sys.modules['celery'] = celery_mod
