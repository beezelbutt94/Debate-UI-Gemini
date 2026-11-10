"""Tests for model helpers and enum values."""
import uuid
import pytest


class TestUuidHelper:
    def test_returns_string(self):
        from app.core.models import _uuid
        assert isinstance(_uuid(), str)

    def test_produces_valid_uuid4(self):
        from app.core.models import _uuid
        val = _uuid()
        parsed = uuid.UUID(val)
        assert parsed.version == 4

    def test_produces_unique_values(self):
        from app.core.models import _uuid
        seen = {_uuid() for _ in range(200)}
        assert len(seen) == 200

    def test_format_matches_hyphenated_uuid(self):
        from app.core.models import _uuid
        val = _uuid()
        # 8-4-4-4-12 hyphenated format
        parts = val.split('-')
        assert len(parts) == 5
        assert len(parts[0]) == 8
        assert len(parts[1]) == 4
        assert len(parts[2]) == 4
        assert len(parts[3]) == 4
        assert len(parts[4]) == 12


class TestWorkspaceRoleEnum:
    def setup_method(self):
        from app.core.models import WorkspaceRole
        self.WR = WorkspaceRole

    def test_owner_value(self):
        assert self.WR.OWNER.value == 'owner'

    def test_admin_value(self):
        assert self.WR.ADMIN.value == 'admin'

    def test_editor_value(self):
        assert self.WR.EDITOR.value == 'editor'

    def test_viewer_value(self):
        assert self.WR.VIEWER.value == 'viewer'

    def test_guest_value(self):
        assert self.WR.GUEST.value == 'guest'

    def test_all_five_roles_exist(self):
        members = list(self.WR)
        assert len(members) == 5

    def test_is_string_enum(self):
        assert isinstance(self.WR.OWNER.value, str)

    def test_lookup_by_value(self):
        assert self.WR('editor') is self.WR.EDITOR
