"""Shared pytest configuration for the services/api test suite.

Uses pytest_configure to:
1. Override DATABASE_URL to an in-memory SQLite URL before any app module imports.
2. Wrap sqlalchemy.create_engine so that SQLite-incompatible pool kwargs are
   stripped automatically (the real app uses PostgreSQL kwargs that SQLite rejects).
"""
import os
import sys


def pytest_configure(config):
    # Must run before any 'from app.*' import happens.
    os.environ["DATABASE_URL"] = "sqlite:///:memory:"
    os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test-key-placeholder")
    os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

    # Ensure the api root (containing 'app') is importable
    api_root = os.path.join(os.path.dirname(__file__), "..")
    if api_root not in sys.path:
        sys.path.insert(0, api_root)

    # Wrap sqlalchemy.create_engine so the PostgreSQL-only pool kwargs don't
    # crash when we substitute a sqlite:// URL.
    import sqlalchemy as sa

    _real_create_engine = sa.create_engine

    _SQLITE_INCOMPATIBLE_KWARGS = frozenset(
        {"pool_size", "max_overflow", "pool_timeout", "pool_recycle", "pool_pre_ping"}
    )

    def _create_engine_for_tests(url, **kwargs):
        url_str = str(url)
        if url_str.startswith("sqlite"):
            for k in _SQLITE_INCOMPATIBLE_KWARGS:
                kwargs.pop(k, None)
        return _real_create_engine(url, **kwargs)

    sa.create_engine = _create_engine_for_tests  # type: ignore[assignment]

    # Also patch the symbol that database.py imports directly
    # (`from sqlalchemy import create_engine` copies the reference at import
    # time, but since no app module has been imported yet, patching the
    # sqlalchemy namespace here is enough).
    try:
        import sqlalchemy.engine.create as _sa_create  # type: ignore[import]
        _sa_create.create_engine = _create_engine_for_tests  # type: ignore[assignment]
    except Exception:
        pass
