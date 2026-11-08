"""Tests for core SQLAlchemy models and enums."""
import pytest
from app.core.models import WorkspaceRole, _uuid


class TestWorkspaceRole:
    def test_all_five_roles_exist(self):
        roles = {r.value for r in WorkspaceRole}
        assert roles == {"owner", "admin", "editor", "viewer", "guest"}

    def test_enum_values_are_lowercase_strings(self):
        for role in WorkspaceRole:
            assert role.value == role.value.lower()

    def test_owner_value(self):
        assert WorkspaceRole.OWNER.value == "owner"

    def test_admin_value(self):
        assert WorkspaceRole.ADMIN.value == "admin"

    def test_editor_value(self):
        assert WorkspaceRole.EDITOR.value == "editor"

    def test_viewer_value(self):
        assert WorkspaceRole.VIEWER.value == "viewer"

    def test_guest_value(self):
        assert WorkspaceRole.GUEST.value == "guest"

    def test_enum_is_str_subclass(self):
        # WorkspaceRole(str, Enum) so each member should compare equal to its value
        assert WorkspaceRole.OWNER == "owner"
        assert WorkspaceRole.GUEST == "guest"

    def test_lookup_by_value(self):
        assert WorkspaceRole("editor") is WorkspaceRole.EDITOR
        assert WorkspaceRole("owner") is WorkspaceRole.OWNER

    def test_invalid_value_raises(self):
        with pytest.raises(ValueError):
            WorkspaceRole("superadmin")

    def test_len(self):
        assert len(WorkspaceRole) == 5


class TestUuidHelper:
    def test_returns_string(self):
        assert isinstance(_uuid(), str)

    def test_returns_valid_uuid_format(self):
        import re
        uuid_pattern = re.compile(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        )
        assert uuid_pattern.match(_uuid())

    def test_generates_unique_values(self):
        ids = {_uuid() for _ in range(100)}
        assert len(ids) == 100

    def test_length(self):
        # UUIDv4 canonical string: 8-4-4-4-12 chars + 4 hyphens = 36
        assert len(_uuid()) == 36
