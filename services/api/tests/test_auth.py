"""Tests for auth.py: RoleChecker role-rank ordering and get_current_user logic."""
import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException


def _import():
    from app.core.auth import RoleChecker, _ROLE_RANK, get_current_user
    from app.core.models import WorkspaceRole
    return RoleChecker, _ROLE_RANK, get_current_user, WorkspaceRole


# ── _ROLE_RANK ordering ───────────────────────────────────────────────────────

class TestRoleRank:
    def setup_method(self):
        _, self.ranks, _, self.WR = _import()

    def test_owner_has_highest_rank(self):
        max_rank = max(self.ranks.values())
        assert self.ranks[self.WR.OWNER] == max_rank

    def test_guest_has_lowest_rank(self):
        min_rank = min(self.ranks.values())
        assert self.ranks[self.WR.GUEST] == min_rank

    def test_admin_outranks_editor(self):
        assert self.ranks[self.WR.ADMIN] > self.ranks[self.WR.EDITOR]

    def test_editor_outranks_viewer(self):
        assert self.ranks[self.WR.EDITOR] > self.ranks[self.WR.VIEWER]

    def test_viewer_outranks_guest(self):
        assert self.ranks[self.WR.VIEWER] > self.ranks[self.WR.GUEST]

    def test_owner_outranks_admin(self):
        assert self.ranks[self.WR.OWNER] > self.ranks[self.WR.ADMIN]

    def test_all_five_roles_present(self):
        assert len(self.ranks) == 5

    def test_all_ranks_are_unique(self):
        rank_values = list(self.ranks.values())
        assert len(rank_values) == len(set(rank_values))

    def test_all_ranks_are_non_negative_integers(self):
        for v in self.ranks.values():
            assert isinstance(v, int)
            assert v >= 0

    def test_strict_ordering_guest_viewer_editor_admin_owner(self):
        WR = self.WR
        r = self.ranks
        assert r[WR.GUEST] < r[WR.VIEWER] < r[WR.EDITOR] < r[WR.ADMIN] < r[WR.OWNER]


# ── RoleChecker.__call__ ──────────────────────────────────────────────────────

class TestRoleChecker:
    def setup_method(self):
        self.RC, self.ranks, _, self.WR = _import()

    def _make_user(self, role):
        u = MagicMock()
        u.role = role
        return u

    def test_allows_exact_matching_role(self):
        checker = self.RC(minimum_role=self.WR.EDITOR)
        user = self._make_user(self.WR.EDITOR)
        with patch('app.core.auth.get_current_user', return_value=user):
            result = checker(user=user)
        assert result is user

    def test_allows_higher_role(self):
        checker = self.RC(minimum_role=self.WR.EDITOR)
        user = self._make_user(self.WR.ADMIN)
        with patch('app.core.auth.get_current_user', return_value=user):
            result = checker(user=user)
        assert result is user

    def test_allows_owner_for_any_minimum(self):
        for minimum in [self.WR.GUEST, self.WR.VIEWER, self.WR.EDITOR, self.WR.ADMIN]:
            checker = self.RC(minimum_role=minimum)
            user = self._make_user(self.WR.OWNER)
            with patch('app.core.auth.get_current_user', return_value=user):
                result = checker(user=user)
            assert result is user

    def test_rejects_lower_role(self):
        checker = self.RC(minimum_role=self.WR.EDITOR)
        user = self._make_user(self.WR.VIEWER)
        with pytest.raises(HTTPException) as exc:
            checker(user=user)
        assert exc.value.status_code == 403

    def test_rejects_guest_when_minimum_is_viewer(self):
        checker = self.RC(minimum_role=self.WR.VIEWER)
        user = self._make_user(self.WR.GUEST)
        with pytest.raises(HTTPException) as exc:
            checker(user=user)
        assert exc.value.status_code == 403

    def test_403_detail_mentions_required_role(self):
        checker = self.RC(minimum_role=self.WR.ADMIN)
        user = self._make_user(self.WR.EDITOR)
        with pytest.raises(HTTPException) as exc:
            checker(user=user)
        assert 'admin' in exc.value.detail.lower()

    def test_missing_role_treated_as_rank_minus_one(self):
        """A user with an unknown role should be rejected for any minimum."""
        checker = self.RC(minimum_role=self.WR.GUEST)
        user = self._make_user('nonexistent_role')
        with pytest.raises(HTTPException) as exc:
            checker(user=user)
        assert exc.value.status_code == 403


# ── get_current_user() ────────────────────────────────────────────────────────

class TestGetCurrentUser:
    def setup_method(self):
        _, _, self.gcu, self.WR = _import()

    def test_raises_401_when_no_api_key(self):
        db = MagicMock()
        with pytest.raises(HTTPException) as exc:
            self.gcu(api_key=None, db=db)
        assert exc.value.status_code == 401
        assert 'Missing' in exc.value.detail

    def test_raises_401_for_empty_api_key(self):
        db = MagicMock()
        with pytest.raises(HTTPException) as exc:
            self.gcu(api_key='', db=db)
        assert exc.value.status_code == 401

    def test_raises_401_when_key_not_found_in_db(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc:
            self.gcu(api_key='bad-key', db=db)
        assert exc.value.status_code == 401
        assert 'Invalid' in exc.value.detail

    def test_returns_user_when_key_valid(self):
        fake_user = MagicMock()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = fake_user
        result = self.gcu(api_key='good-key', db=db)
        assert result is fake_user
