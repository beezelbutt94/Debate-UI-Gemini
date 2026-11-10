"""Test configuration: redirect SQLAlchemy to SQLite in memory so tests run
without a real Postgres instance. Must happen before any app module is imported.
"""
import os

# Point SQLAlchemy at a throwaway in-memory SQLite database before any module
# that calls create_engine() at import time is loaded. This avoids the need
# for psycopg2/psycopg (the Postgres driver) in the test environment.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
# Suppress Redis connection errors in rate-limit module (tests patch redis anyway)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
