"""
Patch SQLAlchemy engine creation and the anthropic SDK before any test
module imports them, so that tests run without a live database or API key.
"""
import os
import sys
from unittest.mock import MagicMock, patch

# Point DATABASE_URL at a psycopg2 URL so SQLAlchemy resolves the dialect
# with the psycopg2-binary driver we have installed, not the absent psycopg3.
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/test",
)
os.environ.setdefault("ANTHROPIC_API_KEY", "test_key_for_unit_tests")

# Patch create_engine before database.py is imported, so no actual
# PostgreSQL connection is attempted at import time.
import sqlalchemy  # noqa: E402

_original_create_engine = sqlalchemy.create_engine


def _fake_create_engine(url, **kw):
    mock_engine = MagicMock()
    mock_engine.url = url
    return mock_engine


sqlalchemy.create_engine = _fake_create_engine
