"""Tests for auth.py role ranking and RoleChecker logic."""
import sys
import os
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.core.models import WorkspaceRole
from app.core.auth import _ROLE_RANK


class TestRoleRank(unittest.TestCase):
    """Verify that _ROLE_RANK encodes the correct total order."""

    def test_guest_is_lowest(self):
        self.assertLess(_ROLE_RANK[WorkspaceRole.GUEST], _ROLE_RANK[WorkspaceRole.VIEWER])

    def test_viewer_below_editor(self):
        self.assertLess(_ROLE_RANK[WorkspaceRole.VIEWER], _ROLE_RANK[WorkspaceRole.EDITOR])

    def test_editor_below_admin(self):
        self.assertLess(_ROLE_RANK[WorkspaceRole.EDITOR], _ROLE_RANK[WorkspaceRole.ADMIN])

    def test_admin_below_owner(self):
        self.assertLess(_ROLE_RANK[WorkspaceRole.ADMIN], _ROLE_RANK[WorkspaceRole.OWNER])

    def test_owner_is_highest(self):
        ranks = list(_ROLE_RANK.values())
        self.assertEqual(_ROLE_RANK[WorkspaceRole.OWNER], max(ranks))

    def test_guest_is_lowest_rank(self):
        ranks = list(_ROLE_RANK.values())
        self.assertEqual(_ROLE_RANK[WorkspaceRole.GUEST], min(ranks))

    def test_all_five_roles_are_ranked(self):
        self.assertEqual(len(_ROLE_RANK), 5)

    def test_all_ranks_are_unique(self):
        ranks = list(_ROLE_RANK.values())
        self.assertEqual(len(ranks), len(set(ranks)))

    def test_all_ranks_are_non_negative(self):
        for role, rank in _ROLE_RANK.items():
            self.assertGreaterEqual(rank, 0, f"{role} has negative rank")

    def test_full_order_is_correct(self):
        expected_order = [
            WorkspaceRole.GUEST,
            WorkspaceRole.VIEWER,
            WorkspaceRole.EDITOR,
            WorkspaceRole.ADMIN,
            WorkspaceRole.OWNER,
        ]
        for i in range(len(expected_order) - 1):
            lower = expected_order[i]
            higher = expected_order[i + 1]
            self.assertLess(
                _ROLE_RANK[lower], _ROLE_RANK[higher],
                f"{lower} should rank below {higher}"
            )


class TestRoleChecker(unittest.TestCase):
    """RoleChecker dependency factory — isolate from FastAPI and DB."""

    def _make_checker(self, minimum_role: WorkspaceRole):
        from app.core.auth import RoleChecker
        return RoleChecker(minimum_role)

    def _make_user(self, role: WorkspaceRole):
        user = MagicMock()
        user.role = role
        return user

    def test_owner_passes_owner_gate(self):
        checker = self._make_checker(WorkspaceRole.OWNER)
        user = self._make_user(WorkspaceRole.OWNER)
        result = checker(user)
        self.assertEqual(result, user)

    def test_owner_passes_admin_gate(self):
        checker = self._make_checker(WorkspaceRole.ADMIN)
        user = self._make_user(WorkspaceRole.OWNER)
        result = checker(user)
        self.assertEqual(result, user)

    def test_owner_passes_guest_gate(self):
        checker = self._make_checker(WorkspaceRole.GUEST)
        user = self._make_user(WorkspaceRole.OWNER)
        result = checker(user)
        self.assertEqual(result, user)

    def test_editor_passes_editor_gate(self):
        checker = self._make_checker(WorkspaceRole.EDITOR)
        user = self._make_user(WorkspaceRole.EDITOR)
        result = checker(user)
        self.assertEqual(result, user)

    def test_editor_passes_viewer_gate(self):
        checker = self._make_checker(WorkspaceRole.VIEWER)
        user = self._make_user(WorkspaceRole.EDITOR)
        result = checker(user)
        self.assertEqual(result, user)

    def test_guest_fails_viewer_gate(self):
        from fastapi import HTTPException
        checker = self._make_checker(WorkspaceRole.VIEWER)
        user = self._make_user(WorkspaceRole.GUEST)
        with self.assertRaises(HTTPException) as ctx:
            checker(user)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_guest_fails_editor_gate(self):
        from fastapi import HTTPException
        checker = self._make_checker(WorkspaceRole.EDITOR)
        user = self._make_user(WorkspaceRole.GUEST)
        with self.assertRaises(HTTPException):
            checker(user)

    def test_viewer_fails_editor_gate(self):
        from fastapi import HTTPException
        checker = self._make_checker(WorkspaceRole.EDITOR)
        user = self._make_user(WorkspaceRole.VIEWER)
        with self.assertRaises(HTTPException) as ctx:
            checker(user)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_viewer_fails_admin_gate(self):
        from fastapi import HTTPException
        checker = self._make_checker(WorkspaceRole.ADMIN)
        user = self._make_user(WorkspaceRole.VIEWER)
        with self.assertRaises(HTTPException):
            checker(user)

    def test_admin_fails_owner_gate(self):
        from fastapi import HTTPException
        checker = self._make_checker(WorkspaceRole.OWNER)
        user = self._make_user(WorkspaceRole.ADMIN)
        with self.assertRaises(HTTPException) as ctx:
            checker(user)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_error_detail_mentions_required_role(self):
        from fastapi import HTTPException
        checker = self._make_checker(WorkspaceRole.ADMIN)
        user = self._make_user(WorkspaceRole.GUEST)
        with self.assertRaises(HTTPException) as ctx:
            checker(user)
        self.assertIn('admin', ctx.exception.detail.lower())

    def test_guest_passes_guest_gate(self):
        checker = self._make_checker(WorkspaceRole.GUEST)
        user = self._make_user(WorkspaceRole.GUEST)
        result = checker(user)
        self.assertEqual(result, user)


class TestWorkspaceRoleEnum(unittest.TestCase):
    """Sanity checks on the WorkspaceRole enum values."""

    def test_all_roles_are_strings(self):
        for role in WorkspaceRole:
            self.assertIsInstance(role.value, str)

    def test_owner_value(self):
        self.assertEqual(WorkspaceRole.OWNER.value, 'owner')

    def test_admin_value(self):
        self.assertEqual(WorkspaceRole.ADMIN.value, 'admin')

    def test_editor_value(self):
        self.assertEqual(WorkspaceRole.EDITOR.value, 'editor')

    def test_viewer_value(self):
        self.assertEqual(WorkspaceRole.VIEWER.value, 'viewer')

    def test_guest_value(self):
        self.assertEqual(WorkspaceRole.GUEST.value, 'guest')

    def test_five_roles_total(self):
        self.assertEqual(len(list(WorkspaceRole)), 5)


if __name__ == '__main__':
    unittest.main()
