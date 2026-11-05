"""Tests for app.core.anthropic_client utilities (pure, no network calls)."""
import sys
import os

# Allow importing from services/api without the package being installed
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

import pytest


# ─── extract_json_block ────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def import_module():
    global extract_json_block
    from app.core.anthropic_client import extract_json_block as _fn
    extract_json_block = _fn


class TestExtractJsonBlock:
    def test_passthrough_plain_json(self):
        raw = '{"key": "value"}'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_strips_backtick_fence_no_lang(self):
        raw = '```\n{"a":1}\n```'
        result = extract_json_block(raw)
        assert result == '{"a":1}'

    def test_strips_backtick_json_fence(self):
        raw = '```json\n{"a":1}\n```'
        result = extract_json_block(raw)
        assert result == '{"a":1}'

    def test_strips_leading_whitespace(self):
        raw = '   {"k": "v"}'
        assert extract_json_block(raw) == '{"k": "v"}'

    def test_strips_trailing_whitespace(self):
        raw = '{"k": "v"}   '
        assert extract_json_block(raw) == '{"k": "v"}'

    def test_handles_array_payload(self):
        raw = '```json\n[1,2,3]\n```'
        assert extract_json_block(raw) == '[1,2,3]'

    def test_fence_without_json_tag(self):
        raw = '```\n[{"x":1}]\n```'
        result = extract_json_block(raw)
        assert result == '[{"x":1}]'

    def test_nested_backtick_content_untouched(self):
        raw = '{"code": "``` x ```"}'
        assert extract_json_block(raw) == '{"code": "``` x ```"}'

    def test_empty_string_returns_empty(self):
        assert extract_json_block('') == ''

    def test_multiline_json_preserved(self):
        raw = '{\n  "a": 1,\n  "b": 2\n}'
        assert extract_json_block(raw) == '{\n  "a": 1,\n  "b": 2\n}'

    def test_fence_with_extra_whitespace_inside(self):
        raw = '```json\n\n  {"spaced": true}\n\n```'
        result = extract_json_block(raw)
        assert '{"spaced": true}' in result

    def test_does_not_alter_valid_non_fenced_nested_braces(self):
        raw = '{"outer": {"inner": 42}}'
        assert extract_json_block(raw) == '{"outer": {"inner": 42}}'
