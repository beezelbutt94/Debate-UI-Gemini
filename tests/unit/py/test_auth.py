"""Tests for services/api/app/core/auth.py

Covers RoleChecker role-rank logic without a real database: we mock
get_current_user and pass User objects directly.
"""
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, "services/api")

# Mock SQLAlchemy / database so the import chain doesn't need Postgres
_db_mock = MagicMock()
_db_mock.Base = MagicMock()
sys.modules.setdefault("app.core.database", _db_mock)


class TestRoleRank:
    def test_role_rank_values(self):
        from app.core.auth import _ROLE_RANK
        from app.core.models import WorkspaceRole

        assert _ROLE_RANK[WorkspaceRole.GUEST] == 0
        assert _ROLE_RANK[WorkspaceRole.VIEWER] == 1
        assert _ROLE_RANK[WorkspaceRole.EDITOR] == 2
        assert _ROLE_RANK[WorkspaceRole.ADMIN] == 3
        assert _ROLE_RANK[WorkspaceRole.OWNER] == 4

    def test_all_five_roles_in_rank_map(self):
        from app.core.auth import _ROLE_RANK
        from app.core.models import WorkspaceRole

        for role in WorkspaceRole:
            assert role in _ROLE_RANK


class TestRoleChecker:
    def _make_user(self, role):
        from app.core.models import WorkspaceRole
        user = MagicMock()
        user.role = role
        return user

    def test_owner_passes_all_gates(self):
        from app.core.auth import RoleChecker
        from app.core.models import WorkspaceRole
        from fastapi import HTTPException

        for min_role in WorkspaceRole:
            checker = RoleChecker(min_role)
            user = self._make_user(WorkspaceRole.OWNER)
            with patch("app.core.auth.get_current_user", return_value=user):
                result = checker(user=user)
            assert result is user

    def test_guest_fails_viewer_gate(self):
        from app.core.auth import RoleChecker
        from app.core.models import WorkspaceRole
        from fastapi import HTTPException

        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = self._make_user(WorkspaceRole.GUEST)
        with pytest.raises(HTTPException) as exc_info:
            checker(user=user)
        assert exc_info.value.status_code == 403

    def test_editor_fails_admin_gate(self):
        from app.core.auth import RoleChecker
        from app.core.models import WorkspaceRole
        from fastapi import HTTPException

        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = self._make_user(WorkspaceRole.EDITOR)
        with pytest.raises(HTTPException) as exc_info:
            checker(user=user)
        assert exc_info.value.status_code == 403

    def test_admin_passes_editor_gate(self):
        from app.core.auth import RoleChecker
        from app.core.models import WorkspaceRole

        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = self._make_user(WorkspaceRole.ADMIN)
        result = checker(user=user)
        assert result is user

    def test_viewer_passes_viewer_gate(self):
        from app.core.auth import RoleChecker
        from app.core.models import WorkspaceRole

        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = self._make_user(WorkspaceRole.VIEWER)
        result = checker(user=user)
        assert result is user

    def test_editor_fails_owner_gate(self):
        from app.core.auth import RoleChecker
        from app.core.models import WorkspaceRole
        from fastapi import HTTPException

        checker = RoleChecker(WorkspaceRole.OWNER)
        user = self._make_user(WorkspaceRole.EDITOR)
        with pytest.raises(HTTPException) as exc_info:
            checker(user=user)
        assert exc_info.value.status_code == 403

    def test_403_detail_mentions_required_role(self):
        from app.core.auth import RoleChecker
        from app.core.models import WorkspaceRole
        from fastapi import HTTPException

        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = self._make_user(WorkspaceRole.GUEST)
        with pytest.raises(HTTPException) as exc_info:
            checker(user=user)
        assert "admin" in exc_info.value.detail.lower()

    def test_unknown_role_denied(self):
        """A user whose role is not in _ROLE_RANK gets -1, denied everywhere."""
        from app.core.auth import RoleChecker
        from app.core.models import WorkspaceRole
        from fastapi import HTTPException

        checker = RoleChecker(WorkspaceRole.GUEST)
        user = MagicMock()
        user.role = "super_unknown_role_xyz"
        with pytest.raises(HTTPException) as exc_info:
            checker(user=user)
        assert exc_info.value.status_code == 403


class TestWorkspaceRoleEnum:
    def test_enum_string_values(self):
        from app.core.models import WorkspaceRole
        assert WorkspaceRole.OWNER.value == "owner"
        assert WorkspaceRole.ADMIN.value == "admin"
        assert WorkspaceRole.EDITOR.value == "editor"
        assert WorkspaceRole.VIEWER.value == "viewer"
        assert WorkspaceRole.GUEST.value == "guest"

    def test_is_str_subclass(self):
        from app.core.models import WorkspaceRole
        assert isinstance(WorkspaceRole.OWNER, str)
