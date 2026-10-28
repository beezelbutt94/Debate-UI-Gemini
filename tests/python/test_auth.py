"""Tests for the auth module — specifically the role-rank ordering and
RoleChecker gate logic, without spinning up a database or HTTP server.
"""
import sys
import os
import pytest
from unittest.mock import MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

# Patch only the pieces that need a live DB/process to import
import unittest.mock as mock

# app.core.database uses create_engine which would connect; stub it out
sys.modules.setdefault('app.core.database', MagicMock(Base=MagicMock()))

from app.core.models import WorkspaceRole  # noqa: E402 — needs sys.path first

# get_db also tries to connect; stub it before importing auth
with mock.patch('app.core.database.get_db', return_value=iter([MagicMock()])):
    from app.core.auth import _ROLE_RANK, RoleChecker


class TestRoleRank:
    """The _ROLE_RANK dict must establish a strict ordering across all five roles."""

    def test_all_roles_present(self):
        for role in WorkspaceRole:
            assert role in _ROLE_RANK, f"{role} missing from _ROLE_RANK"

    def test_guest_is_lowest(self):
        guest_rank = _ROLE_RANK[WorkspaceRole.GUEST]
        for role in WorkspaceRole:
            if role != WorkspaceRole.GUEST:
                assert _ROLE_RANK[role] > guest_rank

    def test_owner_is_highest(self):
        owner_rank = _ROLE_RANK[WorkspaceRole.OWNER]
        for role in WorkspaceRole:
            if role != WorkspaceRole.OWNER:
                assert _ROLE_RANK[role] < owner_rank

    def test_strict_ordering(self):
        expected_order = [
            WorkspaceRole.GUEST,
            WorkspaceRole.VIEWER,
            WorkspaceRole.EDITOR,
            WorkspaceRole.ADMIN,
            WorkspaceRole.OWNER,
        ]
        ranks = [_ROLE_RANK[r] for r in expected_order]
        assert ranks == sorted(ranks), "Roles are not in strictly ascending rank order"

    def test_all_ranks_distinct(self):
        ranks = list(_ROLE_RANK.values())
        assert len(ranks) == len(set(ranks)), "Two roles share the same rank value"

    def test_viewer_outranks_guest(self):
        assert _ROLE_RANK[WorkspaceRole.VIEWER] > _ROLE_RANK[WorkspaceRole.GUEST]

    def test_editor_outranks_viewer(self):
        assert _ROLE_RANK[WorkspaceRole.EDITOR] > _ROLE_RANK[WorkspaceRole.VIEWER]

    def test_admin_outranks_editor(self):
        assert _ROLE_RANK[WorkspaceRole.ADMIN] > _ROLE_RANK[WorkspaceRole.EDITOR]

    def test_owner_outranks_admin(self):
        assert _ROLE_RANK[WorkspaceRole.OWNER] > _ROLE_RANK[WorkspaceRole.ADMIN]


class TestRoleChecker:
    """RoleChecker.__call__ must pass users at or above the minimum role and
    raise HTTP 403 for users below it.
    """

    def _make_user(self, role: WorkspaceRole):
        user = MagicMock()
        user.role = role
        return user

    def _http_exception_class(self):
        from fastapi import HTTPException
        return HTTPException

    def _get_http_exc(self):
        try:
            from fastapi import HTTPException
            return HTTPException
        except ImportError:
            # If fastapi isn't installed in test env, the module already
            # imported it (mock handles it), so we check the exception directly.
            return None

    def test_owner_passes_owner_gate(self):
        checker = RoleChecker(WorkspaceRole.OWNER)
        user = self._make_user(WorkspaceRole.OWNER)
        result = checker(user)
        assert result is user

    def test_owner_passes_editor_gate(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = self._make_user(WorkspaceRole.OWNER)
        result = checker(user)
        assert result is user

    def test_editor_passes_editor_gate(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = self._make_user(WorkspaceRole.EDITOR)
        result = checker(user)
        assert result is user

    def test_editor_passes_viewer_gate(self):
        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = self._make_user(WorkspaceRole.EDITOR)
        result = checker(user)
        assert result is user

    def test_guest_passes_guest_gate(self):
        checker = RoleChecker(WorkspaceRole.GUEST)
        user = self._make_user(WorkspaceRole.GUEST)
        result = checker(user)
        assert result is user

    def test_admin_passes_admin_gate(self):
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = self._make_user(WorkspaceRole.ADMIN)
        result = checker(user)
        assert result is user

    def test_guest_blocked_by_viewer_gate(self):
        from fastapi import HTTPException
        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = self._make_user(WorkspaceRole.GUEST)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_viewer_blocked_by_editor_gate(self):
        from fastapi import HTTPException
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = self._make_user(WorkspaceRole.VIEWER)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_editor_blocked_by_admin_gate(self):
        from fastapi import HTTPException
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = self._make_user(WorkspaceRole.EDITOR)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_admin_blocked_by_owner_gate(self):
        from fastapi import HTTPException
        checker = RoleChecker(WorkspaceRole.OWNER)
        user = self._make_user(WorkspaceRole.ADMIN)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_guest_blocked_by_owner_gate(self):
        from fastapi import HTTPException
        checker = RoleChecker(WorkspaceRole.OWNER)
        user = self._make_user(WorkspaceRole.GUEST)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_403_message_mentions_required_role(self):
        from fastapi import HTTPException
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = self._make_user(WorkspaceRole.VIEWER)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert 'admin' in exc_info.value.detail.lower()

    def test_checker_returns_user_object_on_pass(self):
        checker = RoleChecker(WorkspaceRole.GUEST)
        user = self._make_user(WorkspaceRole.VIEWER)
        assert checker(user) is user

    def test_checker_is_callable(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        assert callable(checker)

    def test_multiple_checkers_independent(self):
        from fastapi import HTTPException
        editor_gate = RoleChecker(WorkspaceRole.EDITOR)
        admin_gate = RoleChecker(WorkspaceRole.ADMIN)
        user = self._make_user(WorkspaceRole.EDITOR)

        # Passes editor gate
        assert editor_gate(user) is user

        # Blocked by admin gate
        with pytest.raises(HTTPException):
            admin_gate(user)
