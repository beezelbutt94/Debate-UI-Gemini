"""Tests for services/api/app/core/auth.py

Tests the _ROLE_RANK ordering and RoleChecker.__init__ without
touching the database or FastAPI.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

import pytest
from unittest.mock import MagicMock, patch

from app.core.models import WorkspaceRole
from app.core.auth import RoleChecker, _ROLE_RANK


class TestRoleRank:
    def test_all_roles_have_a_rank(self):
        for role in WorkspaceRole:
            assert role in _ROLE_RANK, f"{role} missing from _ROLE_RANK"

    def test_owner_has_highest_rank(self):
        max_rank = max(_ROLE_RANK.values())
        assert _ROLE_RANK[WorkspaceRole.OWNER] == max_rank

    def test_guest_has_lowest_rank(self):
        min_rank = min(_ROLE_RANK.values())
        assert _ROLE_RANK[WorkspaceRole.GUEST] == min_rank

    def test_owner_outranks_admin(self):
        assert _ROLE_RANK[WorkspaceRole.OWNER] > _ROLE_RANK[WorkspaceRole.ADMIN]

    def test_admin_outranks_editor(self):
        assert _ROLE_RANK[WorkspaceRole.ADMIN] > _ROLE_RANK[WorkspaceRole.EDITOR]

    def test_editor_outranks_viewer(self):
        assert _ROLE_RANK[WorkspaceRole.EDITOR] > _ROLE_RANK[WorkspaceRole.VIEWER]

    def test_viewer_outranks_guest(self):
        assert _ROLE_RANK[WorkspaceRole.VIEWER] > _ROLE_RANK[WorkspaceRole.GUEST]

    def test_all_ranks_are_unique(self):
        ranks = list(_ROLE_RANK.values())
        assert len(ranks) == len(set(ranks))

    def test_full_ordering(self):
        ordered = [
            WorkspaceRole.GUEST,
            WorkspaceRole.VIEWER,
            WorkspaceRole.EDITOR,
            WorkspaceRole.ADMIN,
            WorkspaceRole.OWNER,
        ]
        for i in range(len(ordered) - 1):
            assert _ROLE_RANK[ordered[i]] < _ROLE_RANK[ordered[i + 1]]


class TestRoleChecker:
    def test_stores_minimum_role(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        assert checker.minimum_role is WorkspaceRole.EDITOR

    def test_allows_exact_role(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = MagicMock()
        user.role = WorkspaceRole.EDITOR
        with patch("app.core.auth.get_current_user", return_value=user):
            result = checker(user)
        assert result is user

    def test_allows_higher_role(self):
        checker = RoleChecker(WorkspaceRole.EDITOR)
        user = MagicMock()
        user.role = WorkspaceRole.OWNER
        with patch("app.core.auth.get_current_user", return_value=user):
            result = checker(user)
        assert result is user

    def test_rejects_lower_role(self):
        from fastapi import HTTPException
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = MagicMock()
        user.role = WorkspaceRole.VIEWER
        with patch("app.core.auth.get_current_user", return_value=user):
            with pytest.raises(HTTPException) as exc_info:
                checker(user)
        assert exc_info.value.status_code == 403

    def test_403_detail_mentions_required_role(self):
        from fastapi import HTTPException
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = MagicMock()
        user.role = WorkspaceRole.GUEST
        with patch("app.core.auth.get_current_user", return_value=user):
            with pytest.raises(HTTPException) as exc_info:
                checker(user)
        assert "admin" in exc_info.value.detail.lower()

    def test_owner_can_access_owner_only_endpoint(self):
        checker = RoleChecker(WorkspaceRole.OWNER)
        user = MagicMock()
        user.role = WorkspaceRole.OWNER
        with patch("app.core.auth.get_current_user", return_value=user):
            result = checker(user)
        assert result is user

    def test_admin_cannot_access_owner_only_endpoint(self):
        from fastapi import HTTPException
        checker = RoleChecker(WorkspaceRole.OWNER)
        user = MagicMock()
        user.role = WorkspaceRole.ADMIN
        with patch("app.core.auth.get_current_user", return_value=user):
            with pytest.raises(HTTPException) as exc_info:
                checker(user)
        assert exc_info.value.status_code == 403

    def test_guest_cannot_access_viewer_endpoint(self):
        from fastapi import HTTPException
        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = MagicMock()
        user.role = WorkspaceRole.GUEST
        with patch("app.core.auth.get_current_user", return_value=user):
            with pytest.raises(HTTPException):
                checker(user)

    def test_unknown_role_is_rejected_with_403(self):
        # _ROLE_RANK.get(unknown, -1) is always < any valid rank, so access is denied.
        from fastapi import HTTPException
        checker = RoleChecker(WorkspaceRole.GUEST)  # lowest valid minimum
        user = MagicMock()
        user.role = "not_a_real_role"
        with patch("app.core.auth.get_current_user", return_value=user):
            with pytest.raises(HTTPException) as exc_info:
                checker(user)
        assert exc_info.value.status_code == 403
