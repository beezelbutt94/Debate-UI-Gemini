"""Tests for RoleChecker and _ROLE_RANK in services/api/app/core/auth.py"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'services', 'api'))

import pytest
import unittest.mock as mock

# Stub out the database module so SQLAlchemy's `get_db` dependency
# doesn't need a real DB connection during tests.
_fake_db_module = mock.MagicMock()
_fake_db_module.get_db = mock.MagicMock()
# Base must be a real object with metadata; provide a lightweight stub.
_fake_db_module.Base = mock.MagicMock()
sys.modules.setdefault('app.core.database', _fake_db_module)

from app.core.models import WorkspaceRole
from app.core.auth import _ROLE_RANK, RoleChecker


class TestRoleRank:
    """_ROLE_RANK defines a strict total order on WorkspaceRole values."""

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

    def test_all_roles_represented(self):
        roles = {WorkspaceRole.GUEST, WorkspaceRole.VIEWER, WorkspaceRole.EDITOR,
                 WorkspaceRole.ADMIN, WorkspaceRole.OWNER}
        assert set(_ROLE_RANK.keys()) == roles

    def test_rank_values_are_unique(self):
        values = list(_ROLE_RANK.values())
        assert len(values) == len(set(values))

    def test_rank_values_are_non_negative(self):
        for role, rank in _ROLE_RANK.items():
            assert rank >= 0, f"{role} has negative rank {rank}"

    def test_transitivity_guest_below_owner(self):
        assert _ROLE_RANK[WorkspaceRole.GUEST] < _ROLE_RANK[WorkspaceRole.OWNER]

    def test_transitivity_viewer_below_admin(self):
        assert _ROLE_RANK[WorkspaceRole.VIEWER] < _ROLE_RANK[WorkspaceRole.ADMIN]

    def test_owner_rank_is_four(self):
        """Explicit check so any accidental re-ordering fails loudly."""
        assert _ROLE_RANK[WorkspaceRole.OWNER] == 4

    def test_guest_rank_is_zero(self):
        assert _ROLE_RANK[WorkspaceRole.GUEST] == 0


class TestRoleChecker:
    """RoleChecker.__call__ raises 403 when user rank < minimum, returns user otherwise."""

    def _make_user(self, role: WorkspaceRole):
        u = mock.MagicMock()
        u.role = role
        return u

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

    def test_admin_passes_admin_gate(self):
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = self._make_user(WorkspaceRole.ADMIN)
        result = checker(user)
        assert result is user

    def test_editor_passes_viewer_gate(self):
        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = self._make_user(WorkspaceRole.EDITOR)
        result = checker(user)
        assert result is user

    def test_guest_fails_viewer_gate(self):
        from fastapi import HTTPException
        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = self._make_user(WorkspaceRole.GUEST)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_viewer_fails_editor_gate(self):
        from fastapi import HTTPException
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = self._make_user(WorkspaceRole.VIEWER)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_editor_fails_admin_gate(self):
        from fastapi import HTTPException
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = self._make_user(WorkspaceRole.EDITOR)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_admin_fails_owner_gate(self):
        from fastapi import HTTPException
        checker = RoleChecker(WorkspaceRole.OWNER)
        user = self._make_user(WorkspaceRole.ADMIN)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_403_detail_mentions_required_role(self):
        from fastapi import HTTPException
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = self._make_user(WorkspaceRole.GUEST)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert 'admin' in exc_info.value.detail.lower()

    def test_guest_passes_guest_gate(self):
        """A user satisfying the exact minimum role is allowed."""
        checker = RoleChecker(WorkspaceRole.GUEST)
        user = self._make_user(WorkspaceRole.GUEST)
        result = checker(user)
        assert result is user
