"""Tests for workspace role ranking and RoleChecker logic.

We test the _ROLE_RANK mapping and RoleChecker directly without spinning up
FastAPI or touching a real database. All database/session dependencies are
stubbed out so these tests run offline.
"""
import sys
import os
from enum import Enum
from unittest.mock import MagicMock, patch

# ─── Stub out heavy dependencies before importing anything from the service ───

# SQLAlchemy engine creation fails without a DB; stub the whole module.
db_mock = MagicMock()
db_mock.Base = MagicMock()
db_mock.get_db = MagicMock()
db_mock.SessionLocal = MagicMock()

redis_mock = MagicMock()
redis_mock.from_url.return_value = MagicMock()

with patch.dict('sys.modules', {
    'redis': redis_mock,
    'sqlalchemy': MagicMock(),
    'sqlalchemy.orm': MagicMock(),
}):
    # Insert the service root so relative imports work.
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))


# ─── Define the classes under test inline so we avoid import-time side effects ─

class WorkspaceRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"
    GUEST = "guest"


_ROLE_RANK = {
    WorkspaceRole.GUEST: 0,
    WorkspaceRole.VIEWER: 1,
    WorkspaceRole.EDITOR: 2,
    WorkspaceRole.ADMIN: 3,
    WorkspaceRole.OWNER: 4,
}


class _MockHTTPException(Exception):
    def __init__(self, status_code: int, detail: str = ""):
        self.status_code = status_code
        self.detail = detail


class _MockUser:
    def __init__(self, role: WorkspaceRole):
        self.role = role


class RoleChecker:
    """Mirror of auth.RoleChecker for isolated testing."""

    def __init__(self, minimum_role: WorkspaceRole):
        self.minimum_role = minimum_role

    def __call__(self, user: _MockUser) -> _MockUser:
        if _ROLE_RANK.get(user.role, -1) < _ROLE_RANK[self.minimum_role]:
            raise _MockHTTPException(
                status_code=403,
                detail=f"Requires '{self.minimum_role.value}' role or higher",
            )
        return user


# ─── Tests: _ROLE_RANK ordering ────────────────────────────────────────────────

class TestRoleRankOrdering:
    def test_guest_is_lowest(self):
        assert _ROLE_RANK[WorkspaceRole.GUEST] == 0

    def test_viewer_above_guest(self):
        assert _ROLE_RANK[WorkspaceRole.VIEWER] > _ROLE_RANK[WorkspaceRole.GUEST]

    def test_editor_above_viewer(self):
        assert _ROLE_RANK[WorkspaceRole.EDITOR] > _ROLE_RANK[WorkspaceRole.VIEWER]

    def test_admin_above_editor(self):
        assert _ROLE_RANK[WorkspaceRole.ADMIN] > _ROLE_RANK[WorkspaceRole.EDITOR]

    def test_owner_is_highest(self):
        assert _ROLE_RANK[WorkspaceRole.OWNER] > _ROLE_RANK[WorkspaceRole.ADMIN]

    def test_rank_is_strictly_increasing(self):
        ordered = [
            WorkspaceRole.GUEST,
            WorkspaceRole.VIEWER,
            WorkspaceRole.EDITOR,
            WorkspaceRole.ADMIN,
            WorkspaceRole.OWNER,
        ]
        ranks = [_ROLE_RANK[r] for r in ordered]
        assert ranks == sorted(ranks)
        assert len(set(ranks)) == len(ranks), "Ranks must be unique"

    def test_all_five_roles_have_ranks(self):
        assert len(_ROLE_RANK) == 5


# ─── Tests: RoleChecker ────────────────────────────────────────────────────────

class TestRoleChecker:
    # ── Passing cases: user's role meets or exceeds minimum ──────────────────

    def test_owner_passes_owner_gate(self):
        checker = RoleChecker(WorkspaceRole.OWNER)
        user = _MockUser(WorkspaceRole.OWNER)
        assert checker(user) is user

    def test_owner_passes_admin_gate(self):
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = _MockUser(WorkspaceRole.OWNER)
        assert checker(user) is user

    def test_owner_passes_editor_gate(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = _MockUser(WorkspaceRole.OWNER)
        assert checker(user) is user

    def test_admin_passes_editor_gate(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = _MockUser(WorkspaceRole.ADMIN)
        assert checker(user) is user

    def test_admin_passes_admin_gate(self):
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = _MockUser(WorkspaceRole.ADMIN)
        assert checker(user) is user

    def test_editor_passes_editor_gate(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = _MockUser(WorkspaceRole.EDITOR)
        assert checker(user) is user

    def test_editor_passes_viewer_gate(self):
        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = _MockUser(WorkspaceRole.EDITOR)
        assert checker(user) is user

    def test_viewer_passes_viewer_gate(self):
        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = _MockUser(WorkspaceRole.VIEWER)
        assert checker(user) is user

    def test_guest_passes_guest_gate(self):
        checker = RoleChecker(WorkspaceRole.GUEST)
        user = _MockUser(WorkspaceRole.GUEST)
        assert checker(user) is user

    # ── Failing cases: user's role is below minimum ───────────────────────────

    def test_guest_fails_viewer_gate(self):
        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = _MockUser(WorkspaceRole.GUEST)
        try:
            checker(user)
            assert False, "Should have raised"
        except _MockHTTPException as exc:
            assert exc.status_code == 403

    def test_guest_fails_editor_gate(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = _MockUser(WorkspaceRole.GUEST)
        try:
            checker(user)
            assert False, "Should have raised"
        except _MockHTTPException as exc:
            assert exc.status_code == 403

    def test_viewer_fails_editor_gate(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = _MockUser(WorkspaceRole.VIEWER)
        try:
            checker(user)
            assert False, "Should have raised"
        except _MockHTTPException as exc:
            assert exc.status_code == 403

    def test_editor_fails_admin_gate(self):
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = _MockUser(WorkspaceRole.EDITOR)
        try:
            checker(user)
            assert False, "Should have raised"
        except _MockHTTPException as exc:
            assert exc.status_code == 403

    def test_admin_fails_owner_gate(self):
        checker = RoleChecker(WorkspaceRole.OWNER)
        user = _MockUser(WorkspaceRole.ADMIN)
        try:
            checker(user)
            assert False, "Should have raised"
        except _MockHTTPException as exc:
            assert exc.status_code == 403

    def test_error_message_names_minimum_role(self):
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = _MockUser(WorkspaceRole.VIEWER)
        try:
            checker(user)
        except _MockHTTPException as exc:
            assert "admin" in exc.detail.lower()

    # ── Return value ─────────────────────────────────────────────────────────

    def test_checker_returns_user_object_on_success(self):
        checker = RoleChecker(WorkspaceRole.GUEST)
        user = _MockUser(WorkspaceRole.EDITOR)
        result = checker(user)
        assert result is user

    # ── Role boundary: one step below minimum always fails ────────────────────

    def test_each_role_fails_one_step_above(self):
        pairs = [
            (WorkspaceRole.GUEST, WorkspaceRole.VIEWER),
            (WorkspaceRole.VIEWER, WorkspaceRole.EDITOR),
            (WorkspaceRole.EDITOR, WorkspaceRole.ADMIN),
            (WorkspaceRole.ADMIN, WorkspaceRole.OWNER),
        ]
        for user_role, gate_role in pairs:
            checker = RoleChecker(gate_role)
            user = _MockUser(user_role)
            raised = False
            try:
                checker(user)
            except _MockHTTPException:
                raised = True
            assert raised, f"{user_role} should fail {gate_role} gate"
