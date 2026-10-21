"""Tests for auth helpers: _ROLE_RANK, RoleChecker, get_current_user."""
import sys
import os
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.models import WorkspaceRole
from app.core.auth import _ROLE_RANK, RoleChecker, get_current_user


class TestRoleRank:
    """_ROLE_RANK defines a strict linear ordering of workspace roles."""

    def test_owner_has_highest_rank(self):
        assert _ROLE_RANK[WorkspaceRole.OWNER] == max(_ROLE_RANK.values())

    def test_guest_has_lowest_rank(self):
        assert _ROLE_RANK[WorkspaceRole.GUEST] == min(_ROLE_RANK.values())

    def test_owner_outranks_admin(self):
        assert _ROLE_RANK[WorkspaceRole.OWNER] > _ROLE_RANK[WorkspaceRole.ADMIN]

    def test_admin_outranks_editor(self):
        assert _ROLE_RANK[WorkspaceRole.ADMIN] > _ROLE_RANK[WorkspaceRole.EDITOR]

    def test_editor_outranks_viewer(self):
        assert _ROLE_RANK[WorkspaceRole.EDITOR] > _ROLE_RANK[WorkspaceRole.VIEWER]

    def test_viewer_outranks_guest(self):
        assert _ROLE_RANK[WorkspaceRole.VIEWER] > _ROLE_RANK[WorkspaceRole.GUEST]

    def test_all_five_roles_are_ranked(self):
        assert set(_ROLE_RANK.keys()) == {
            WorkspaceRole.OWNER,
            WorkspaceRole.ADMIN,
            WorkspaceRole.EDITOR,
            WorkspaceRole.VIEWER,
            WorkspaceRole.GUEST,
        }

    def test_ranks_are_unique(self):
        values = list(_ROLE_RANK.values())
        assert len(values) == len(set(values))

    def test_all_ranks_are_non_negative(self):
        for rank in _ROLE_RANK.values():
            assert rank >= 0


class TestRoleChecker:
    """RoleChecker gates access to a minimum workspace role."""

    def _user_with_role(self, role: WorkspaceRole):
        user = MagicMock()
        user.role = role
        return user

    def test_user_with_exact_minimum_role_is_allowed(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = self._user_with_role(WorkspaceRole.EDITOR)
        result = checker(user)
        assert result is user

    def test_user_with_higher_role_is_allowed(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = self._user_with_role(WorkspaceRole.ADMIN)
        result = checker(user)
        assert result is user

    def test_owner_passes_any_role_check(self):
        for role in WorkspaceRole:
            checker = RoleChecker(role)
            user = self._user_with_role(WorkspaceRole.OWNER)
            assert checker(user) is user

    def test_guest_fails_viewer_check(self):
        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = self._user_with_role(WorkspaceRole.GUEST)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_guest_fails_editor_check(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = self._user_with_role(WorkspaceRole.GUEST)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_viewer_fails_editor_check(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = self._user_with_role(WorkspaceRole.VIEWER)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_editor_fails_admin_check(self):
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = self._user_with_role(WorkspaceRole.EDITOR)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_admin_fails_owner_check(self):
        checker = RoleChecker(WorkspaceRole.OWNER)
        user = self._user_with_role(WorkspaceRole.ADMIN)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_forbidden_detail_mentions_required_role(self):
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = self._user_with_role(WorkspaceRole.GUEST)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert "admin" in exc_info.value.detail.lower()

    def test_viewer_passes_guest_check(self):
        checker = RoleChecker(WorkspaceRole.GUEST)
        user = self._user_with_role(WorkspaceRole.VIEWER)
        assert checker(user) is user

    def test_editor_passes_viewer_check(self):
        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = self._user_with_role(WorkspaceRole.EDITOR)
        assert checker(user) is user


class TestGetCurrentUser:
    """get_current_user raises 401 when API key is missing or invalid."""

    def test_raises_401_when_no_api_key(self):
        db = MagicMock()
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(api_key=None, db=db)  # type: ignore[arg-type]
        assert exc_info.value.status_code == 401
        assert "Missing" in exc_info.value.detail

    def test_raises_401_when_api_key_not_found_in_db(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(api_key="bad_key", db=db)
        assert exc_info.value.status_code == 401
        assert "Invalid" in exc_info.value.detail

    def test_returns_user_when_api_key_is_valid(self):
        db = MagicMock()
        mock_user = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = mock_user
        result = get_current_user(api_key="valid_key", db=db)
        assert result is mock_user

    def test_raises_401_for_empty_string_key(self):
        db = MagicMock()
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(api_key="", db=db)
        assert exc_info.value.status_code == 401
