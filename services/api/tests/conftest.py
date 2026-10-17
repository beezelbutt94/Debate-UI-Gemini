"""pytest conftest: redirect the database engine to SQLite before any imports
so tests can run without a live Postgres instance.
"""
import os

# Must happen before any app module is imported, since database.py reads
# DATABASE_URL at module load time and calls create_engine() immediately.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
