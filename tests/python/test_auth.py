"""Tests for auth helpers: role ranking and RoleChecker logic."""
import pytest
from app.core.auth import _ROLE_RANK
from app.core.models import WorkspaceRole


class TestRoleRank:
    """_ROLE_RANK must be a strict monotone total order on the five roles."""

    def test_all_roles_have_a_rank(self):
        for role in WorkspaceRole:
            assert role in _ROLE_RANK, f"{role} missing from _ROLE_RANK"

    def test_ranks_are_non_negative_integers(self):
        for role, rank in _ROLE_RANK.items():
            assert isinstance(rank, int), f"rank for {role} is not int"
            assert rank >= 0

    def test_guest_has_lowest_rank(self):
        guest_rank = _ROLE_RANK[WorkspaceRole.GUEST]
        for role, rank in _ROLE_RANK.items():
            if role is not WorkspaceRole.GUEST:
                assert guest_rank < rank, f"GUEST should be below {role}"

    def test_owner_has_highest_rank(self):
        owner_rank = _ROLE_RANK[WorkspaceRole.OWNER]
        for role, rank in _ROLE_RANK.items():
            if role is not WorkspaceRole.OWNER:
                assert owner_rank > rank, f"OWNER should be above {role}"

    def test_strict_ordering(self):
        """
        GUEST < VIEWER < EDITOR < ADMIN < OWNER
        """
        order = [
            WorkspaceRole.GUEST,
            WorkspaceRole.VIEWER,
            WorkspaceRole.EDITOR,
            WorkspaceRole.ADMIN,
            WorkspaceRole.OWNER,
        ]
        ranks = [_ROLE_RANK[r] for r in order]
        assert ranks == sorted(ranks), "Roles are not in strictly ascending order"
        # Also verify each step is strictly less (no ties)
        for i in range(len(ranks) - 1):
            assert ranks[i] < ranks[i + 1]

    def test_total_distinct_ranks(self):
        """All five roles must have distinct rank values."""
        rank_values = list(_ROLE_RANK.values())
        assert len(set(rank_values)) == len(rank_values) == 5

    # ------------------------------------------------------------------
    # RoleChecker gate logic (pure rank comparison, no DB/FastAPI needed)
    # ------------------------------------------------------------------

    def test_editor_passes_editor_gate(self):
        """An editor meets the editor minimum."""
        assert _ROLE_RANK[WorkspaceRole.EDITOR] >= _ROLE_RANK[WorkspaceRole.EDITOR]

    def test_guest_fails_editor_gate(self):
        """A guest does not meet the editor minimum."""
        assert _ROLE_RANK[WorkspaceRole.GUEST] < _ROLE_RANK[WorkspaceRole.EDITOR]

    def test_owner_passes_all_gates(self):
        for minimum in WorkspaceRole:
            assert _ROLE_RANK[WorkspaceRole.OWNER] >= _ROLE_RANK[minimum]

    def test_guest_fails_all_gates_except_guest(self):
        for minimum in WorkspaceRole:
            if minimum is WorkspaceRole.GUEST:
                assert _ROLE_RANK[WorkspaceRole.GUEST] >= _ROLE_RANK[minimum]
            else:
                assert _ROLE_RANK[WorkspaceRole.GUEST] < _ROLE_RANK[minimum]

    def test_admin_passes_editor_gate(self):
        assert _ROLE_RANK[WorkspaceRole.ADMIN] >= _ROLE_RANK[WorkspaceRole.EDITOR]

    def test_viewer_fails_editor_gate(self):
        assert _ROLE_RANK[WorkspaceRole.VIEWER] < _ROLE_RANK[WorkspaceRole.EDITOR]

    def test_editor_fails_admin_gate(self):
        assert _ROLE_RANK[WorkspaceRole.EDITOR] < _ROLE_RANK[WorkspaceRole.ADMIN]
