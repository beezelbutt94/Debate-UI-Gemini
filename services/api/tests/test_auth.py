"""Unit tests for app.core.auth – get_current_user and RoleChecker.

All tests use a real in-memory SQLite database via SQLAlchemy so there is
no external dependency. The FastAPI/Starlette dependency injection machinery
is bypassed: dependencies are called directly with a real Session.
"""
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.core.models import User, Workspace, WorkspaceRole
from app.core.auth import get_current_user, RoleChecker, _ROLE_RANK


# ---------------------------------------------------------------------------
# In-memory SQLite engine / session factory
# ---------------------------------------------------------------------------

_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
Base.metadata.create_all(_engine)
_Session = sessionmaker(bind=_engine)


@pytest.fixture()
def db():
    session = _Session()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_workspace(db, name="Test WS", slug="test-ws"):
    ws = Workspace(name=name, slug=slug)
    db.add(ws)
    db.flush()
    return ws


def _make_user(db, api_key="key123", role=WorkspaceRole.EDITOR, is_active=True):
    ws = _make_workspace(db, slug=f"ws-{api_key}")
    user = User(
        email=f"{api_key}@example.com",
        api_key=api_key,
        role=role,
        is_active=is_active,
        workspace_id=ws.id,
    )
    db.add(user)
    db.flush()
    return user


# ---------------------------------------------------------------------------
# get_current_user
# ---------------------------------------------------------------------------

class TestGetCurrentUser:
    def test_returns_user_for_valid_api_key(self, db):
        _make_user(db, api_key="valid-key")
        user = get_current_user(api_key="valid-key", db=db)
        assert user.api_key == "valid-key"

    def test_raises_401_when_api_key_is_none(self, db):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(api_key=None, db=db)
        assert exc_info.value.status_code == 401

    def test_raises_401_when_api_key_is_empty_string(self, db):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(api_key="", db=db)
        assert exc_info.value.status_code == 401

    def test_raises_401_for_unknown_api_key(self, db):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(api_key="no-such-key", db=db)
        assert exc_info.value.status_code == 401

    def test_raises_401_for_inactive_user(self, db):
        _make_user(db, api_key="inactive-key", is_active=False)
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(api_key="inactive-key", db=db)
        assert exc_info.value.status_code == 401

    def test_401_detail_mentions_missing_key(self, db):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(api_key=None, db=db)
        assert "Missing" in exc_info.value.detail or "missing" in exc_info.value.detail.lower()

    def test_401_detail_mentions_invalid_key(self, db):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(api_key="wrong", db=db)
        assert "Invalid" in exc_info.value.detail or "invalid" in exc_info.value.detail.lower()

    def test_case_sensitive_api_key(self, db):
        _make_user(db, api_key="CaseSensitive")
        with pytest.raises(HTTPException):
            get_current_user(api_key="casesensitive", db=db)

    def test_does_not_return_other_users_record(self, db):
        _make_user(db, api_key="user-a-key")
        _make_user(db, api_key="user-b-key")
        user = get_current_user(api_key="user-a-key", db=db)
        assert user.api_key == "user-a-key"


# ---------------------------------------------------------------------------
# _ROLE_RANK
# ---------------------------------------------------------------------------

class TestRoleRank:
    def test_owner_has_highest_rank(self):
        assert _ROLE_RANK[WorkspaceRole.OWNER] > _ROLE_RANK[WorkspaceRole.ADMIN]

    def test_admin_outranks_editor(self):
        assert _ROLE_RANK[WorkspaceRole.ADMIN] > _ROLE_RANK[WorkspaceRole.EDITOR]

    def test_editor_outranks_viewer(self):
        assert _ROLE_RANK[WorkspaceRole.EDITOR] > _ROLE_RANK[WorkspaceRole.VIEWER]

    def test_viewer_outranks_guest(self):
        assert _ROLE_RANK[WorkspaceRole.VIEWER] > _ROLE_RANK[WorkspaceRole.GUEST]

    def test_all_roles_present(self):
        for role in WorkspaceRole:
            assert role in _ROLE_RANK

    def test_guest_has_lowest_rank(self):
        assert _ROLE_RANK[WorkspaceRole.GUEST] == min(_ROLE_RANK.values())


# ---------------------------------------------------------------------------
# RoleChecker
# ---------------------------------------------------------------------------

class TestRoleChecker:
    def test_owner_passes_owner_check(self, db):
        user = _make_user(db, api_key="owner-key", role=WorkspaceRole.OWNER)
        checker = RoleChecker(minimum_role=WorkspaceRole.OWNER)
        result = checker(user=user)
        assert result is user

    def test_admin_passes_editor_check(self, db):
        user = _make_user(db, api_key="admin-key", role=WorkspaceRole.ADMIN)
        checker = RoleChecker(minimum_role=WorkspaceRole.EDITOR)
        result = checker(user=user)
        assert result is user

    def test_viewer_fails_editor_check(self, db):
        user = _make_user(db, api_key="viewer-key", role=WorkspaceRole.VIEWER)
        checker = RoleChecker(minimum_role=WorkspaceRole.EDITOR)
        with pytest.raises(HTTPException) as exc_info:
            checker(user=user)
        assert exc_info.value.status_code == 403

    def test_guest_fails_viewer_check(self, db):
        user = _make_user(db, api_key="guest-key", role=WorkspaceRole.GUEST)
        checker = RoleChecker(minimum_role=WorkspaceRole.VIEWER)
        with pytest.raises(HTTPException) as exc_info:
            checker(user=user)
        assert exc_info.value.status_code == 403

    def test_editor_passes_editor_check(self, db):
        user = _make_user(db, api_key="editor-key", role=WorkspaceRole.EDITOR)
        checker = RoleChecker(minimum_role=WorkspaceRole.EDITOR)
        result = checker(user=user)
        assert result is user

    def test_guest_passes_guest_check(self, db):
        user = _make_user(db, api_key="g-key", role=WorkspaceRole.GUEST)
        checker = RoleChecker(minimum_role=WorkspaceRole.GUEST)
        result = checker(user=user)
        assert result is user

    def test_owner_passes_guest_check(self, db):
        user = _make_user(db, api_key="o-key", role=WorkspaceRole.OWNER)
        checker = RoleChecker(minimum_role=WorkspaceRole.GUEST)
        result = checker(user=user)
        assert result is user

    def test_403_detail_mentions_required_role(self, db):
        user = _make_user(db, api_key="v-key2", role=WorkspaceRole.VIEWER)
        checker = RoleChecker(minimum_role=WorkspaceRole.ADMIN)
        with pytest.raises(HTTPException) as exc_info:
            checker(user=user)
        assert "admin" in exc_info.value.detail.lower()

    def test_viewer_fails_owner_check(self, db):
        user = _make_user(db, api_key="v-key3", role=WorkspaceRole.VIEWER)
        checker = RoleChecker(minimum_role=WorkspaceRole.OWNER)
        with pytest.raises(HTTPException) as exc_info:
            checker(user=user)
        assert exc_info.value.status_code == 403
