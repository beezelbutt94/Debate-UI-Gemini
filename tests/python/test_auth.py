"""Tests for auth.py role-rank ordering and RoleChecker logic."""
import sys
import os
import types

# Stub heavy imports that auth.py pulls in transitively
for _mod in ('fastapi', 'fastapi.security', 'fastapi.security.api_key', 'sqlalchemy',
             'sqlalchemy.orm', 'starlette', 'starlette.middleware', 'starlette.middleware.base'):
    if _mod not in sys.modules:
        sys.modules[_mod] = types.ModuleType(_mod)

# Minimal stubs so the import resolves without installing the full stack
_fastapi = sys.modules['fastapi']
_fastapi.Depends = lambda f: f  # type: ignore[attr-defined]
_fastapi.HTTPException = type('HTTPException', (Exception,), {'__init__': lambda s, **kw: None})  # type: ignore[attr-defined]

class _Security:
    def __call__(self, *a, **kw): return None

_fastapi.Security = _Security()  # type: ignore[attr-defined]
_fastapi.status = types.SimpleNamespace(HTTP_401_UNAUTHORIZED=401, HTTP_403_FORBIDDEN=403)  # type: ignore[attr-defined]

_fastapi_security = sys.modules['fastapi.security']
_fastapi_security_api_key = sys.modules['fastapi.security.api_key']

class _APIKeyHeader:
    def __init__(self, **kw): pass

_fastapi_security_api_key.APIKeyHeader = _APIKeyHeader  # type: ignore[attr-defined]

# Stub sqlalchemy.orm.Session
_sqlalchemy_orm = sys.modules['sqlalchemy.orm']
_sqlalchemy_orm.Session = object  # type: ignore[attr-defined]

# Stub app.core.database and app.core.models before importing auth
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'services', 'api'))

_database_stub = types.ModuleType('app.core.database')
_database_stub.get_db = lambda: None  # type: ignore[attr-defined]
sys.modules['app.core.database'] = _database_stub

# We need the real WorkspaceRole from models, but models imports sqlalchemy which
# we're stubbing. Define WorkspaceRole directly here matching the real definition.
from enum import Enum as _Enum

class WorkspaceRole(str, _Enum):
    OWNER = 'owner'
    ADMIN = 'admin'
    EDITOR = 'editor'
    VIEWER = 'viewer'
    GUEST = 'guest'

class _FakeUser:
    def __init__(self, role: WorkspaceRole, is_active: bool = True):
        self.role = role
        self.api_key = 'test-key'
        self.is_active = is_active

_models_stub = types.ModuleType('app.core.models')
_models_stub.User = _FakeUser  # type: ignore[attr-defined]
_models_stub.WorkspaceRole = WorkspaceRole  # type: ignore[attr-defined]
sys.modules['app.core.models'] = _models_stub
sys.modules['app'] = types.ModuleType('app')
sys.modules['app.core'] = types.ModuleType('app.core')

from app.core.auth import _ROLE_RANK, RoleChecker  # noqa: E402


class TestRoleRank:
    def test_guest_has_lowest_rank(self):
        assert _ROLE_RANK[WorkspaceRole.GUEST] == 0

    def test_viewer_outranks_guest(self):
        assert _ROLE_RANK[WorkspaceRole.VIEWER] > _ROLE_RANK[WorkspaceRole.GUEST]

    def test_editor_outranks_viewer(self):
        assert _ROLE_RANK[WorkspaceRole.EDITOR] > _ROLE_RANK[WorkspaceRole.VIEWER]

    def test_admin_outranks_editor(self):
        assert _ROLE_RANK[WorkspaceRole.ADMIN] > _ROLE_RANK[WorkspaceRole.EDITOR]

    def test_owner_outranks_admin(self):
        assert _ROLE_RANK[WorkspaceRole.OWNER] > _ROLE_RANK[WorkspaceRole.ADMIN]

    def test_owner_has_highest_rank(self):
        all_ranks = list(_ROLE_RANK.values())
        assert _ROLE_RANK[WorkspaceRole.OWNER] == max(all_ranks)

    def test_total_ordering_is_strict(self):
        ordered = [WorkspaceRole.GUEST, WorkspaceRole.VIEWER, WorkspaceRole.EDITOR,
                   WorkspaceRole.ADMIN, WorkspaceRole.OWNER]
        ranks = [_ROLE_RANK[r] for r in ordered]
        assert ranks == sorted(ranks)
        assert len(set(ranks)) == len(ranks), "All ranks must be distinct"

    def test_all_five_roles_present(self):
        assert set(_ROLE_RANK.keys()) == set(WorkspaceRole)


class TestRoleChecker:
    """Unit tests for RoleChecker.__call__ without the FastAPI dependency stack."""

    def _make_checker(self, minimum: WorkspaceRole) -> RoleChecker:
        return RoleChecker(minimum_role=minimum)

    def _invoke(self, checker: RoleChecker, user: _FakeUser) -> _FakeUser | None:
        """Call checker with a mock user, bypassing get_current_user."""
        # RoleChecker.__call__ accepts a user kwarg via Depends — call it directly.
        try:
            return checker(user=user)
        except Exception:
            return None

    def test_owner_passes_owner_gate(self):
        checker = self._make_checker(WorkspaceRole.OWNER)
        user = _FakeUser(WorkspaceRole.OWNER)
        assert self._invoke(checker, user) is user

    def test_owner_passes_editor_gate(self):
        checker = self._make_checker(WorkspaceRole.EDITOR)
        user = _FakeUser(WorkspaceRole.OWNER)
        assert self._invoke(checker, user) is user

    def test_admin_passes_editor_gate(self):
        checker = self._make_checker(WorkspaceRole.EDITOR)
        user = _FakeUser(WorkspaceRole.ADMIN)
        assert self._invoke(checker, user) is user

    def test_editor_passes_viewer_gate(self):
        checker = self._make_checker(WorkspaceRole.VIEWER)
        user = _FakeUser(WorkspaceRole.EDITOR)
        assert self._invoke(checker, user) is user

    def test_guest_fails_viewer_gate(self):
        checker = self._make_checker(WorkspaceRole.VIEWER)
        user = _FakeUser(WorkspaceRole.GUEST)
        # Should raise HTTPException (403)
        result = self._invoke(checker, user)
        assert result is None

    def test_viewer_fails_editor_gate(self):
        checker = self._make_checker(WorkspaceRole.EDITOR)
        user = _FakeUser(WorkspaceRole.VIEWER)
        result = self._invoke(checker, user)
        assert result is None

    def test_editor_fails_admin_gate(self):
        checker = self._make_checker(WorkspaceRole.ADMIN)
        user = _FakeUser(WorkspaceRole.EDITOR)
        result = self._invoke(checker, user)
        assert result is None

    def test_guest_passes_guest_gate(self):
        checker = self._make_checker(WorkspaceRole.GUEST)
        user = _FakeUser(WorkspaceRole.GUEST)
        assert self._invoke(checker, user) is user
