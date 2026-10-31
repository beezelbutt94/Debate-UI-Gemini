"""Tests for app.core.auth – get_current_user and RoleChecker.

Uses FastAPI's TestClient with a real in-memory SQLite database to verify
the actual dependency graph without requiring PostgreSQL.
"""
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

_API_ROOT = os.path.join(os.path.dirname(__file__), "..")
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.models import User, WorkspaceRole
from app.core.auth import get_current_user, RoleChecker


# ---------------------------------------------------------------------------
# In-memory DB fixture helpers
# ---------------------------------------------------------------------------

# StaticPool forces every checkout to reuse the same underlying connection,
# so all code paths (create_all, seed, request handler) see the same database.
_SQLALCHEMY_DB_URL = "sqlite:///:memory:"
_engine = create_engine(
    _SQLALCHEMY_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


def _override_get_db():
    db = _TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def _create_db_and_tables():
    Base.metadata.create_all(bind=_engine)


def _drop_db_and_tables():
    Base.metadata.drop_all(bind=_engine)


def _seed_user(api_key: str, role: WorkspaceRole = WorkspaceRole.EDITOR, is_active: bool = True) -> User:
    db = _TestingSessionLocal()
    user = User(
        email=f"{api_key}@example.com",
        api_key=api_key,
        role=role,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


# ---------------------------------------------------------------------------
# FastAPI test app factory
# ---------------------------------------------------------------------------

def _build_app(minimum_role: WorkspaceRole | None = None):
    app = FastAPI()
    app.dependency_overrides[get_db] = _override_get_db

    if minimum_role is None:
        @app.get("/whoami")
        def whoami(user: User = Depends(get_current_user)):
            return {"email": user.email, "role": user.role.value}
    else:
        @app.get("/protected")
        def protected(user: User = Depends(RoleChecker(minimum_role))):
            return {"email": user.email}

    return app


# ---------------------------------------------------------------------------
# Setup / teardown
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def reset_db():
    _create_db_and_tables()
    yield
    _drop_db_and_tables()


# ---------------------------------------------------------------------------
# get_current_user tests
# ---------------------------------------------------------------------------

class TestGetCurrentUser:
    def test_returns_user_for_valid_key(self):
        _seed_user("valid-key-abc")
        client = TestClient(_build_app())
        resp = client.get("/whoami", headers={"X-API-Key": "valid-key-abc"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "valid-key-abc@example.com"

    def test_401_when_no_key(self):
        client = TestClient(_build_app())
        resp = client.get("/whoami")
        assert resp.status_code == 401

    def test_401_when_wrong_key(self):
        _seed_user("correct-key")
        client = TestClient(_build_app())
        resp = client.get("/whoami", headers={"X-API-Key": "wrong-key"})
        assert resp.status_code == 401

    def test_401_for_inactive_user(self):
        _seed_user("inactive-key", is_active=False)
        client = TestClient(_build_app())
        resp = client.get("/whoami", headers={"X-API-Key": "inactive-key"})
        assert resp.status_code == 401

    def test_returns_correct_role(self):
        _seed_user("owner-key", role=WorkspaceRole.OWNER)
        client = TestClient(_build_app())
        resp = client.get("/whoami", headers={"X-API-Key": "owner-key"})
        assert resp.status_code == 200
        assert resp.json()["role"] == "owner"


# ---------------------------------------------------------------------------
# RoleChecker tests
# ---------------------------------------------------------------------------

class TestRoleChecker:
    def test_editor_passes_editor_gate(self):
        _seed_user("editor-key", role=WorkspaceRole.EDITOR)
        client = TestClient(_build_app(WorkspaceRole.EDITOR))
        resp = client.get("/protected", headers={"X-API-Key": "editor-key"})
        assert resp.status_code == 200

    def test_admin_passes_editor_gate(self):
        _seed_user("admin-key", role=WorkspaceRole.ADMIN)
        client = TestClient(_build_app(WorkspaceRole.EDITOR))
        resp = client.get("/protected", headers={"X-API-Key": "admin-key"})
        assert resp.status_code == 200

    def test_owner_passes_admin_gate(self):
        _seed_user("owner-key", role=WorkspaceRole.OWNER)
        client = TestClient(_build_app(WorkspaceRole.ADMIN))
        resp = client.get("/protected", headers={"X-API-Key": "owner-key"})
        assert resp.status_code == 200

    def test_viewer_blocked_by_editor_gate(self):
        _seed_user("viewer-key", role=WorkspaceRole.VIEWER)
        client = TestClient(_build_app(WorkspaceRole.EDITOR))
        resp = client.get("/protected", headers={"X-API-Key": "viewer-key"})
        assert resp.status_code == 403

    def test_guest_blocked_by_viewer_gate(self):
        _seed_user("guest-key", role=WorkspaceRole.GUEST)
        client = TestClient(_build_app(WorkspaceRole.VIEWER))
        resp = client.get("/protected", headers={"X-API-Key": "guest-key"})
        assert resp.status_code == 403

    def test_editor_blocked_by_admin_gate(self):
        _seed_user("editor-key2", role=WorkspaceRole.EDITOR)
        client = TestClient(_build_app(WorkspaceRole.ADMIN))
        resp = client.get("/protected", headers={"X-API-Key": "editor-key2"})
        assert resp.status_code == 403

    def test_403_detail_message(self):
        _seed_user("guest-key2", role=WorkspaceRole.GUEST)
        client = TestClient(_build_app(WorkspaceRole.OWNER))
        resp = client.get("/protected", headers={"X-API-Key": "guest-key2"})
        assert resp.status_code == 403
        assert "owner" in resp.json()["detail"].lower()

    def test_no_key_still_gives_401(self):
        client = TestClient(_build_app(WorkspaceRole.EDITOR))
        resp = client.get("/protected")
        assert resp.status_code == 401
