"""Configure sys.path and test environment before any app modules are imported."""
import os
import sys

# Add services/api to path so `app.*` imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Use psycopg2 dialect so SQLAlchemy doesn't try to import psycopg (v3).
# database.py creates the engine at module-import time, so the URL must be
# set before any test module imports `app.core.database`.
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/viralvision_test",
)
