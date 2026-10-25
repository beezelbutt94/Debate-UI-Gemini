"""Set up an in-memory SQLite engine before any app module is imported.

database.py creates the engine at module level with PostgreSQL-specific pool
arguments that SQLite doesn't support. We monkey-patch create_engine to drop
those arguments so the test suite doesn't need a real database server.
"""
import os
import sys

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

# Patch create_engine before any app module is imported so the module-level
# engine creation in database.py uses SQLite-compatible kwargs only.
import sqlalchemy as _sa

_orig_create_engine = _sa.create_engine
_PG_ONLY_KWARGS = {"pool_size", "max_overflow", "pool_timeout", "pool_recycle", "pool_pre_ping"}


def _sqlite_safe_create_engine(url, **kwargs):
    url_str = str(url)
    if url_str.startswith("sqlite"):
        for k in _PG_ONLY_KWARGS:
            kwargs.pop(k, None)
    return _orig_create_engine(url, **kwargs)


_sa.create_engine = _sqlite_safe_create_engine
