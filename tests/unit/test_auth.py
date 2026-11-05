"""Tests for app.core.auth — role rank ordering and RoleChecker logic.
No database or HTTP is needed: we fake User objects directly.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException


class TestRoleRank:
    """The rank mapping must impose a strict total order."""

    @pytest.fixture(autouse=True)
    def setup(self):
        from app.core.auth import _ROLE_RANK
        from app.core.models import WorkspaceRole
        self.rank = _ROLE_RANK
        self.Role = WorkspaceRole

    def test_guest_is_lowest(self):
        assert self.rank[self.Role.GUEST] == 0

    def test_owner_is_highest(self):
        assert self.rank[self.Role.OWNER] > self.rank[self.Role.ADMIN]

    def test_total_order_ascending(self):
        ordered = [
            self.Role.GUEST,
            self.Role.VIEWER,
            self.Role.EDITOR,
            self.Role.ADMIN,
            self.Role.OWNER,
        ]
        ranks = [self.rank[r] for r in ordered]
        assert ranks == sorted(ranks)

    def test_all_roles_have_rank(self):
        from app.core.models import WorkspaceRole
        for role in WorkspaceRole:
            assert role in self.rank, f"{role} missing from _ROLE_RANK"


class TestRoleChecker:
    """RoleChecker.__call__ gates access by minimum role."""

    @pytest.fixture(autouse=True)
    def setup(self):
        from app.core.auth import RoleChecker
        from app.core.models import WorkspaceRole
        self.RoleChecker = RoleChecker
        self.Role = WorkspaceRole

    def _user(self, role):
        u = MagicMock()
        u.role = role
        return u

    def test_user_with_exact_minimum_role_passes(self):
        checker = self.RoleChecker(self.Role.EDITOR)
        user = self._user(self.Role.EDITOR)
        result = checker(user)
        assert result is user

    def test_user_with_higher_role_passes(self):
        checker = self.RoleChecker(self.Role.EDITOR)
        user = self._user(self.Role.OWNER)
        assert checker(user) is user

    def test_user_below_minimum_raises_403(self):
        checker = self.RoleChecker(self.Role.ADMIN)
        user = self._user(self.Role.VIEWER)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_guest_cannot_access_editor_endpoint(self):
        checker = self.RoleChecker(self.Role.EDITOR)
        user = self._user(self.Role.GUEST)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403

    def test_owner_can_access_every_role_level(self):
        for role in self.Role:
            checker = self.RoleChecker(role)
            user = self._user(self.Role.OWNER)
            assert checker(user) is user

    def test_error_detail_contains_role_name(self):
        checker = self.RoleChecker(self.Role.ADMIN)
        user = self._user(self.Role.GUEST)
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert 'admin' in exc_info.value.detail.lower()

    def test_guest_can_access_guest_endpoint(self):
        checker = self.RoleChecker(self.Role.GUEST)
        user = self._user(self.Role.GUEST)
        assert checker(user) is user


class TestGetCurrentUser:
    """get_current_user raises 401 when key is missing or not found."""

    @pytest.fixture(autouse=True)
    def setup(self):
        from app.core.auth import get_current_user
        self.get_current_user = get_current_user

    def test_missing_api_key_raises_401(self):
        db = MagicMock()
        with pytest.raises(HTTPException) as exc_info:
            self.get_current_user(api_key=None, db=db)
        assert exc_info.value.status_code == 401

    def test_empty_api_key_raises_401(self):
        db = MagicMock()
        with pytest.raises(HTTPException) as exc_info:
            self.get_current_user(api_key='', db=db)
        assert exc_info.value.status_code == 401

    def test_invalid_api_key_raises_401(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc_info:
            self.get_current_user(api_key='bad-key', db=db)
        assert exc_info.value.status_code == 401

    def test_valid_key_returns_user(self):
        from app.core.models import User
        fake_user = MagicMock(spec=User)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = fake_user
        result = self.get_current_user(api_key='valid-key', db=db)
        assert result is fake_user
