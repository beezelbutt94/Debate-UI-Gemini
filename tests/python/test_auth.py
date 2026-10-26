"""Tests for core/auth.py role-rank ordering and RoleChecker logic."""
import sys
import enum
import types
import unittest.mock as mock


def _make_pkg(name: str) -> types.ModuleType:
    m = types.ModuleType(name)
    m.__path__ = []        # type: ignore[attr-defined]
    m.__package__ = name
    return m


# ── FastAPI stub ──────────────────────────────────────────────────────────────
class _HTTPException(Exception):
    def __init__(self, status_code: int = 0, detail: str = ''):
        self.status_code = status_code
        self.detail = detail


_fastapi = _make_pkg('fastapi')
_fastapi.HTTPException = _HTTPException              # type: ignore[attr-defined]
_fastapi.Depends = lambda f: f                       # type: ignore[attr-defined]
_fastapi.Security = lambda f, **kw: f               # type: ignore[attr-defined]
_fastapi.status = mock.MagicMock(                    # type: ignore[attr-defined]
    HTTP_401_UNAUTHORIZED=401, HTTP_403_FORBIDDEN=403
)
_fastapi.Request = mock.MagicMock()                  # type: ignore[attr-defined]

_fastapi_responses = _make_pkg('fastapi.responses')
_fastapi_responses.JSONResponse = mock.MagicMock()   # type: ignore[attr-defined]

_starlette = _make_pkg('starlette')
_starlette_middleware = _make_pkg('starlette.middleware')
_starlette_middleware_base = _make_pkg('starlette.middleware.base')
_starlette_middleware_base.BaseHTTPMiddleware = mock.MagicMock()  # type: ignore[attr-defined]

_fastapi_security = _make_pkg('fastapi.security')
_fastapi_security_api_key = _make_pkg('fastapi.security.api_key')
_fastapi_security_api_key.APIKeyHeader = mock.MagicMock()  # type: ignore[attr-defined]

for _n, _m in [
    ('fastapi', _fastapi),
    ('fastapi.responses', _fastapi_responses),
    ('fastapi.security', _fastapi_security),
    ('fastapi.security.api_key', _fastapi_security_api_key),
    ('starlette', _starlette),
    ('starlette.middleware', _starlette_middleware),
    ('starlette.middleware.base', _starlette_middleware_base),
]:
    sys.modules.setdefault(_n, _m)

# ── SQLAlchemy stub (Session must be importable) ──────────────────────────────
_sqlalchemy_orm = _make_pkg('sqlalchemy.orm')
_sqlalchemy_orm.Session = mock.MagicMock()  # type: ignore[attr-defined]
sys.modules.setdefault('sqlalchemy', _make_pkg('sqlalchemy'))
sys.modules.setdefault('sqlalchemy.orm', _sqlalchemy_orm)
sys.modules.setdefault('psycopg2', _make_pkg('psycopg2'))

# ── WorkspaceRole / User stubs ────────────────────────────────────────────────
class WorkspaceRole(str, enum.Enum):
    GUEST = 'guest'
    VIEWER = 'viewer'
    EDITOR = 'editor'
    ADMIN = 'admin'
    OWNER = 'owner'


class User:
    def __init__(self, role: WorkspaceRole):
        self.role = role


# Only stub leaf modules — NOT 'app' or 'app.core' (must stay real packages).
_models_mod = _make_pkg('app.core.models')
_models_mod.User = User                              # type: ignore[attr-defined]
_models_mod.WorkspaceRole = WorkspaceRole            # type: ignore[attr-defined]

_db_mod = _make_pkg('app.core.database')
_db_mod.get_db = mock.MagicMock()                   # type: ignore[attr-defined]

sys.modules.setdefault('app.core.models', _models_mod)
sys.modules.setdefault('app.core.database', _db_mod)

from app.core.auth import _ROLE_RANK, RoleChecker   # noqa: E402


# ── _ROLE_RANK ordering ───────────────────────────────────────────────────────

class TestRoleRankOrdering:
    def test_guest_has_lowest_rank(self):
        assert _ROLE_RANK[WorkspaceRole.GUEST] == 0

    def test_strict_ascending_order(self):
        order = [WorkspaceRole.GUEST, WorkspaceRole.VIEWER, WorkspaceRole.EDITOR,
                 WorkspaceRole.ADMIN, WorkspaceRole.OWNER]
        ranks = [_ROLE_RANK[r] for r in order]
        assert ranks == sorted(ranks)

    def test_all_five_roles_present(self):
        assert len(_ROLE_RANK) == 5

    def test_viewer_above_guest(self):
        assert _ROLE_RANK[WorkspaceRole.VIEWER] > _ROLE_RANK[WorkspaceRole.GUEST]

    def test_editor_above_viewer(self):
        assert _ROLE_RANK[WorkspaceRole.EDITOR] > _ROLE_RANK[WorkspaceRole.VIEWER]

    def test_admin_above_editor(self):
        assert _ROLE_RANK[WorkspaceRole.ADMIN] > _ROLE_RANK[WorkspaceRole.EDITOR]

    def test_owner_above_admin(self):
        assert _ROLE_RANK[WorkspaceRole.OWNER] > _ROLE_RANK[WorkspaceRole.ADMIN]

    def test_owner_has_highest_rank(self):
        assert _ROLE_RANK[WorkspaceRole.OWNER] == max(_ROLE_RANK.values())


# ── RoleChecker.__call__() ────────────────────────────────────────────────────

class TestRoleChecker:
    def _passes(self, user_role: WorkspaceRole, minimum_role: WorkspaceRole) -> bool:
        checker = RoleChecker(minimum_role)
        try:
            checker(user=User(role=user_role))
            return True
        except _HTTPException:
            return False

    # exact-match (pass)
    def test_guest_passes_guest(self):
        assert self._passes(WorkspaceRole.GUEST, WorkspaceRole.GUEST)

    def test_viewer_passes_viewer(self):
        assert self._passes(WorkspaceRole.VIEWER, WorkspaceRole.VIEWER)

    def test_editor_passes_editor(self):
        assert self._passes(WorkspaceRole.EDITOR, WorkspaceRole.EDITOR)

    def test_admin_passes_admin(self):
        assert self._passes(WorkspaceRole.ADMIN, WorkspaceRole.ADMIN)

    def test_owner_passes_owner(self):
        assert self._passes(WorkspaceRole.OWNER, WorkspaceRole.OWNER)

    # higher role passes lower minimum
    def test_owner_passes_guest(self):
        assert self._passes(WorkspaceRole.OWNER, WorkspaceRole.GUEST)

    def test_admin_passes_viewer(self):
        assert self._passes(WorkspaceRole.ADMIN, WorkspaceRole.VIEWER)

    def test_editor_passes_guest(self):
        assert self._passes(WorkspaceRole.EDITOR, WorkspaceRole.GUEST)

    def test_owner_passes_editor(self):
        assert self._passes(WorkspaceRole.OWNER, WorkspaceRole.EDITOR)

    def test_owner_passes_admin(self):
        assert self._passes(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)

    # lower role fails higher minimum
    def test_guest_fails_viewer(self):
        assert not self._passes(WorkspaceRole.GUEST, WorkspaceRole.VIEWER)

    def test_viewer_fails_editor(self):
        assert not self._passes(WorkspaceRole.VIEWER, WorkspaceRole.EDITOR)

    def test_editor_fails_admin(self):
        assert not self._passes(WorkspaceRole.EDITOR, WorkspaceRole.ADMIN)

    def test_admin_fails_owner(self):
        assert not self._passes(WorkspaceRole.ADMIN, WorkspaceRole.OWNER)

    def test_guest_fails_owner(self):
        assert not self._passes(WorkspaceRole.GUEST, WorkspaceRole.OWNER)

    def test_viewer_fails_owner(self):
        assert not self._passes(WorkspaceRole.VIEWER, WorkspaceRole.OWNER)

    def test_guest_fails_editor(self):
        assert not self._passes(WorkspaceRole.GUEST, WorkspaceRole.EDITOR)

    def test_guest_fails_admin(self):
        assert not self._passes(WorkspaceRole.GUEST, WorkspaceRole.ADMIN)

    def test_returns_user_object_on_success(self):
        checker = RoleChecker(WorkspaceRole.VIEWER)
        user = User(role=WorkspaceRole.EDITOR)
        assert checker(user=user) is user

    def test_unknown_role_fails_any_minimum(self):
        # A user whose role is not in _ROLE_RANK gets rank -1, so it fails any minimum.
        class UnknownRole(str, enum.Enum):
            HACKER = 'hacker'

        user = User(role=UnknownRole.HACKER)
        checker = RoleChecker(WorkspaceRole.GUEST)
        try:
            checker(user=user)
            assert False, 'Should have raised HTTPException'
        except _HTTPException as exc:
            assert exc.status_code == 403

    def test_403_detail_mentions_role_name(self):
        checker = RoleChecker(WorkspaceRole.ADMIN)
        user = User(role=WorkspaceRole.GUEST)
        try:
            checker(user=user)
            assert False, 'Should have raised HTTPException'
        except _HTTPException as exc:
            assert 'admin' in exc.detail.lower()

    def test_role_rank_dict_values_are_non_negative(self):
        assert all(v >= 0 for v in _ROLE_RANK.values())

    def test_role_rank_dict_keys_are_workspace_roles(self):
        for key in _ROLE_RANK:
            assert isinstance(key, WorkspaceRole)
