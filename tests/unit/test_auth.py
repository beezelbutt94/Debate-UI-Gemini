"""Tests for auth role-ranking logic and RoleChecker.

We load auth.py from its file path via importlib to avoid needing a live DB,
mocking the FastAPI/SQLAlchemy import chain first.
"""
import importlib.util
import sys
from unittest.mock import MagicMock
from enum import Enum

import pytest

# ── Replicate WorkspaceRole so we can reference it in assertions ──────────────

class WorkspaceRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"
    GUEST = "guest"


# ── Stub dependencies before loading auth.py ─────────────────────────────────

class _FakeHTTPException(Exception):
    def __init__(self, status_code=None, detail=None):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


_status_mock = MagicMock()
_status_mock.HTTP_401_UNAUTHORIZED = 401
_status_mock.HTTP_403_FORBIDDEN = 403

_fastapi_mod = MagicMock()
_fastapi_mod.HTTPException = _FakeHTTPException
_fastapi_mod.status = _status_mock
_fastapi_mod.Depends = lambda f: f
_fastapi_mod.Security = lambda fn, **kw: fn

_api_key_header_instance = MagicMock(return_value=None)
_fastapi_security_mod = MagicMock()
_fastapi_security_mod.APIKeyHeader = MagicMock(return_value=_api_key_header_instance)

_models_mod = MagicMock()
_models_mod.User = MagicMock()
_models_mod.WorkspaceRole = WorkspaceRole

_db_mod = MagicMock()
_db_mod.get_db = MagicMock()

sys.modules["fastapi"] = _fastapi_mod
sys.modules["fastapi.security"] = _fastapi_security_mod
sys.modules["fastapi.security.api_key"] = _fastapi_security_mod
sys.modules["sqlalchemy"] = MagicMock()
sys.modules["sqlalchemy.orm"] = MagicMock()
sys.modules["app.core.models"] = _models_mod
sys.modules["app.core.database"] = _db_mod

# Load app.core.auth from file path
_AUTH_PATH = "/home/circleci/project/services/api/app/core/auth.py"
_spec = importlib.util.spec_from_file_location("app.core.auth", _AUTH_PATH)
_auth_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_auth_module)

RoleChecker = _auth_module.RoleChecker
_ROLE_RANK = _auth_module._ROLE_RANK


# ── Tests for _ROLE_RANK ──────────────────────────────────────────────────────

class TestRoleRank:
    def test_all_roles_present(self):
        for role in WorkspaceRole:
            assert role in _ROLE_RANK, f"Missing role: {role}"

    def test_owner_has_highest_rank(self):
        owner_rank = _ROLE_RANK[WorkspaceRole.OWNER]
        for role, rank in _ROLE_RANK.items():
            assert owner_rank >= rank, f"Owner should outrank {role}"

    def test_guest_has_lowest_rank(self):
        guest_rank = _ROLE_RANK[WorkspaceRole.GUEST]
        for role, rank in _ROLE_RANK.items():
            assert guest_rank <= rank, f"Guest should have lowest rank vs {role}"

    def test_owner_outranks_admin(self):
        assert _ROLE_RANK[WorkspaceRole.OWNER] > _ROLE_RANK[WorkspaceRole.ADMIN]

    def test_admin_outranks_editor(self):
        assert _ROLE_RANK[WorkspaceRole.ADMIN] > _ROLE_RANK[WorkspaceRole.EDITOR]

    def test_editor_outranks_viewer(self):
        assert _ROLE_RANK[WorkspaceRole.EDITOR] > _ROLE_RANK[WorkspaceRole.VIEWER]

    def test_viewer_outranks_guest(self):
        assert _ROLE_RANK[WorkspaceRole.VIEWER] > _ROLE_RANK[WorkspaceRole.GUEST]

    def test_strict_ordering_no_ties_between_adjacent_roles(self):
        ordered = [
            WorkspaceRole.GUEST,
            WorkspaceRole.VIEWER,
            WorkspaceRole.EDITOR,
            WorkspaceRole.ADMIN,
            WorkspaceRole.OWNER,
        ]
        ranks = [_ROLE_RANK[r] for r in ordered]
        assert ranks == sorted(ranks), "Ranks are not strictly ascending"
        assert len(set(ranks)) == len(ranks), "Duplicate rank values found"

    def test_rank_values_are_integers(self):
        for role, rank in _ROLE_RANK.items():
            assert isinstance(rank, int), f"Rank for {role} is not an int"

    def test_rank_values_are_non_negative(self):
        for role, rank in _ROLE_RANK.items():
            assert rank >= 0, f"Rank for {role} is negative"

    def test_five_distinct_roles(self):
        assert len(_ROLE_RANK) == 5


# ── Tests for RoleChecker ─────────────────────────────────────────────────────

def _make_user(role: WorkspaceRole) -> MagicMock:
    user = MagicMock()
    user.role = role
    return user


class TestRoleCheckerInit:
    def test_stores_minimum_role(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        assert checker.minimum_role == WorkspaceRole.EDITOR

    def test_can_be_created_for_all_roles(self):
        for role in WorkspaceRole:
            checker = RoleChecker(role)
            assert checker.minimum_role == role


class TestRoleCheckerAllows:
    def test_owner_allowed_on_owner_gate(self):
        checker = RoleChecker(WorkspaceRole.OWNER)
        user = _make_user(WorkspaceRole.OWNER)
        result = checker(user)
        assert result is user

    def test_owner_allowed_on_admin_gate(self):
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = _make_user(WorkspaceRole.OWNER)
        assert checker(user) is user

    def test_owner_allowed_on_editor_gate(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = _make_user(WorkspaceRole.OWNER)
        assert checker(user) is user

    def test_owner_allowed_on_viewer_gate(self):
        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = _make_user(WorkspaceRole.OWNER)
        assert checker(user) is user

    def test_owner_allowed_on_guest_gate(self):
        checker = RoleChecker(WorkspaceRole.GUEST)
        user = _make_user(WorkspaceRole.OWNER)
        assert checker(user) is user

    def test_admin_allowed_on_admin_gate(self):
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = _make_user(WorkspaceRole.ADMIN)
        assert checker(user) is user

    def test_admin_allowed_on_editor_gate(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = _make_user(WorkspaceRole.ADMIN)
        assert checker(user) is user

    def test_editor_allowed_on_editor_gate(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = _make_user(WorkspaceRole.EDITOR)
        assert checker(user) is user

    def test_editor_allowed_on_viewer_gate(self):
        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = _make_user(WorkspaceRole.EDITOR)
        assert checker(user) is user

    def test_viewer_allowed_on_viewer_gate(self):
        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = _make_user(WorkspaceRole.VIEWER)
        assert checker(user) is user

    def test_viewer_allowed_on_guest_gate(self):
        checker = RoleChecker(WorkspaceRole.GUEST)
        user = _make_user(WorkspaceRole.VIEWER)
        assert checker(user) is user

    def test_guest_allowed_on_guest_gate(self):
        checker = RoleChecker(WorkspaceRole.GUEST)
        user = _make_user(WorkspaceRole.GUEST)
        assert checker(user) is user


class TestRoleCheckerDenies:
    def _assert_raises_403(self, checker: RoleChecker, user: MagicMock) -> None:
        with pytest.raises(_FakeHTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_guest_denied_on_viewer_gate(self):
        self._assert_raises_403(RoleChecker(WorkspaceRole.VIEWER), _make_user(WorkspaceRole.GUEST))

    def test_guest_denied_on_editor_gate(self):
        self._assert_raises_403(RoleChecker(WorkspaceRole.EDITOR), _make_user(WorkspaceRole.GUEST))

    def test_guest_denied_on_admin_gate(self):
        self._assert_raises_403(RoleChecker(WorkspaceRole.ADMIN), _make_user(WorkspaceRole.GUEST))

    def test_guest_denied_on_owner_gate(self):
        self._assert_raises_403(RoleChecker(WorkspaceRole.OWNER), _make_user(WorkspaceRole.GUEST))

    def test_viewer_denied_on_editor_gate(self):
        self._assert_raises_403(RoleChecker(WorkspaceRole.EDITOR), _make_user(WorkspaceRole.VIEWER))

    def test_viewer_denied_on_admin_gate(self):
        self._assert_raises_403(RoleChecker(WorkspaceRole.ADMIN), _make_user(WorkspaceRole.VIEWER))

    def test_editor_denied_on_admin_gate(self):
        self._assert_raises_403(RoleChecker(WorkspaceRole.ADMIN), _make_user(WorkspaceRole.EDITOR))

    def test_editor_denied_on_owner_gate(self):
        self._assert_raises_403(RoleChecker(WorkspaceRole.OWNER), _make_user(WorkspaceRole.EDITOR))

    def test_admin_denied_on_owner_gate(self):
        self._assert_raises_403(RoleChecker(WorkspaceRole.OWNER), _make_user(WorkspaceRole.ADMIN))


class TestRoleCheckerReturnValue:
    def test_returns_user_object_on_success(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = _make_user(WorkspaceRole.EDITOR)
        assert checker(user) is user

    def test_returned_user_has_same_role(self):
        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = _make_user(WorkspaceRole.ADMIN)
        returned = checker(user)
        assert returned.role == WorkspaceRole.ADMIN

    def test_error_detail_mentions_role(self):
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = _make_user(WorkspaceRole.VIEWER)
        with pytest.raises(_FakeHTTPException) as exc_info:
            checker(user)
        assert "admin" in str(exc_info.value.detail).lower()
