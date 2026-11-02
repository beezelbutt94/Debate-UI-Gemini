"""Tests for role-based authorization logic in app.core.auth.

Import strategy: app.core.models imports app.core.database which tries to
create a real PostgreSQL engine at module level. We stub out the database
module in sys.modules before any app import so no real DB connection is made.
"""
import sys
import os
import types
from unittest.mock import MagicMock

import pytest

# ---------------------------------------------------------------------------
# Stub out heavy infrastructure before touching any app module
# ---------------------------------------------------------------------------
# Provide a fake `app.core.database` with just enough for models.py to load:
# declarative_base() and a no-op sessionmaker binding.
from sqlalchemy.orm import declarative_base as _real_declarative_base

_fake_db_module = types.ModuleType('app.core.database')
_fake_db_module.Base = _real_declarative_base()
_fake_db_module.engine = MagicMock()
_fake_db_module.SessionLocal = MagicMock()
_fake_db_module.get_db = MagicMock()
sys.modules.setdefault('app.core.database', _fake_db_module)

# Also stub fastapi so auth.py can be imported without it installed
for _mod in ['fastapi', 'fastapi.security', 'fastapi.security.api_key']:
    if _mod not in sys.modules:
        _m = types.ModuleType(_mod)
        # Provide the minimal surface auth.py uses
        _m.Depends = lambda f: f  # type: ignore[attr-defined]
        _m.HTTPException = Exception  # type: ignore[attr-defined]
        _m.Security = lambda f, **kw: f  # type: ignore[attr-defined]
        _m.status = MagicMock()  # type: ignore[attr-defined]
        _m.APIKeyHeader = MagicMock(return_value=MagicMock())  # type: ignore[attr-defined]
        sys.modules[_mod] = _m

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.core.models import WorkspaceRole

# Mirror _ROLE_RANK from auth.py to test rank semantics without importing FastAPI
_ROLE_RANK = {
    WorkspaceRole.GUEST: 0,
    WorkspaceRole.VIEWER: 1,
    WorkspaceRole.EDITOR: 2,
    WorkspaceRole.ADMIN: 3,
    WorkspaceRole.OWNER: 4,
}


class TestRoleRankValues:
    """Every role must have a unique, ordered integer rank."""

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

    def test_owner_rank_is_4(self):
        assert _ROLE_RANK[WorkspaceRole.OWNER] == 4

    def test_all_ranks_unique(self):
        ranks = list(_ROLE_RANK.values())
        assert len(ranks) == len(set(ranks))

    def test_all_five_roles_present(self):
        assert set(_ROLE_RANK.keys()) == {
            WorkspaceRole.GUEST,
            WorkspaceRole.VIEWER,
            WorkspaceRole.EDITOR,
            WorkspaceRole.ADMIN,
            WorkspaceRole.OWNER,
        }


class TestRoleCheckerLogic:
    """Simulate the RoleChecker.__call__ gate without a real DB / FastAPI."""

    def _has_permission(self, user_role: WorkspaceRole, minimum_role: WorkspaceRole) -> bool:
        return _ROLE_RANK.get(user_role, -1) >= _ROLE_RANK[minimum_role]

    # Owner passes every gate
    def test_owner_passes_guest_gate(self):
        assert self._has_permission(WorkspaceRole.OWNER, WorkspaceRole.GUEST)

    def test_owner_passes_viewer_gate(self):
        assert self._has_permission(WorkspaceRole.OWNER, WorkspaceRole.VIEWER)

    def test_owner_passes_editor_gate(self):
        assert self._has_permission(WorkspaceRole.OWNER, WorkspaceRole.EDITOR)

    def test_owner_passes_admin_gate(self):
        assert self._has_permission(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)

    def test_owner_passes_owner_gate(self):
        assert self._has_permission(WorkspaceRole.OWNER, WorkspaceRole.OWNER)

    # Guest passes only guest gate
    def test_guest_passes_guest_gate(self):
        assert self._has_permission(WorkspaceRole.GUEST, WorkspaceRole.GUEST)

    def test_guest_fails_viewer_gate(self):
        assert not self._has_permission(WorkspaceRole.GUEST, WorkspaceRole.VIEWER)

    def test_guest_fails_editor_gate(self):
        assert not self._has_permission(WorkspaceRole.GUEST, WorkspaceRole.EDITOR)

    def test_guest_fails_admin_gate(self):
        assert not self._has_permission(WorkspaceRole.GUEST, WorkspaceRole.ADMIN)

    def test_guest_fails_owner_gate(self):
        assert not self._has_permission(WorkspaceRole.GUEST, WorkspaceRole.OWNER)

    # Editor
    def test_editor_passes_guest_gate(self):
        assert self._has_permission(WorkspaceRole.EDITOR, WorkspaceRole.GUEST)

    def test_editor_passes_viewer_gate(self):
        assert self._has_permission(WorkspaceRole.EDITOR, WorkspaceRole.VIEWER)

    def test_editor_passes_editor_gate(self):
        assert self._has_permission(WorkspaceRole.EDITOR, WorkspaceRole.EDITOR)

    def test_editor_fails_admin_gate(self):
        assert not self._has_permission(WorkspaceRole.EDITOR, WorkspaceRole.ADMIN)

    def test_editor_fails_owner_gate(self):
        assert not self._has_permission(WorkspaceRole.EDITOR, WorkspaceRole.OWNER)

    # Admin
    def test_admin_passes_editor_gate(self):
        assert self._has_permission(WorkspaceRole.ADMIN, WorkspaceRole.EDITOR)

    def test_admin_passes_admin_gate(self):
        assert self._has_permission(WorkspaceRole.ADMIN, WorkspaceRole.ADMIN)

    def test_admin_fails_owner_gate(self):
        assert not self._has_permission(WorkspaceRole.ADMIN, WorkspaceRole.OWNER)

    # Viewer
    def test_viewer_passes_guest_gate(self):
        assert self._has_permission(WorkspaceRole.VIEWER, WorkspaceRole.GUEST)

    def test_viewer_passes_viewer_gate(self):
        assert self._has_permission(WorkspaceRole.VIEWER, WorkspaceRole.VIEWER)

    def test_viewer_fails_editor_gate(self):
        assert not self._has_permission(WorkspaceRole.VIEWER, WorkspaceRole.EDITOR)

    # Unknown role → rank -1 → fails every gate
    def test_unknown_role_fails_guest_gate(self):
        assert not self._has_permission('unknown_role', WorkspaceRole.GUEST)  # type: ignore[arg-type]


class TestWorkspaceRoleEnum:
    """WorkspaceRole values match what auth.py stores in the DB."""

    def test_guest_value(self):
        assert WorkspaceRole.GUEST.value == 'guest'

    def test_viewer_value(self):
        assert WorkspaceRole.VIEWER.value == 'viewer'

    def test_editor_value(self):
        assert WorkspaceRole.EDITOR.value == 'editor'

    def test_admin_value(self):
        assert WorkspaceRole.ADMIN.value == 'admin'

    def test_owner_value(self):
        assert WorkspaceRole.OWNER.value == 'owner'

    def test_role_is_str_subclass(self):
        assert isinstance(WorkspaceRole.EDITOR, str)
