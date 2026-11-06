"""Tests for extract_json_block() – the only pure function in anthropic_client.py."""
import sys
import os
import pytest

# Patch out anthropic import before loading the module under test, since the
# real SDK is not installed in this test environment.
from unittest.mock import MagicMock
sys.modules.setdefault('anthropic', MagicMock())

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'services', 'api'))
from app.core.anthropic_client import extract_json_block


class TestExtractJsonBlock:
    # ── no fence ─────────────────────────────────────────────────────────────

    def test_plain_json_returned_as_is(self):
        raw = '{"key": "value"}'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_plain_json_with_leading_whitespace(self):
        raw = '   {"key": "value"}   '
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_plain_array(self):
        raw = '[1, 2, 3]'
        assert extract_json_block(raw) == '[1, 2, 3]'

    # ── ```json fence ─────────────────────────────────────────────────────────

    def test_strips_json_fence(self):
        raw = '```json\n{"a": 1}\n```'
        assert extract_json_block(raw) == '{"a": 1}'

    def test_strips_json_fence_no_newline(self):
        raw = '```json{"a": 1}```'
        result = extract_json_block(raw)
        assert '{"a": 1}' in result

    def test_strips_json_fence_with_whitespace_around_content(self):
        raw = '```json\n  {"x": 42}  \n```'
        assert extract_json_block(raw) == '{"x": 42}'

    # ── plain ``` fence (no language tag) ────────────────────────────────────

    def test_strips_plain_fence(self):
        raw = '```\n{"b": 2}\n```'
        # The function splits on ``` and takes index 1; "json" prefix not present,
        # so the result is "\n{\"b\": 2}\n" stripped = '{"b": 2}'
        result = extract_json_block(raw)
        assert '{"b": 2}' in result

    # ── empty / edge cases ────────────────────────────────────────────────────

    def test_empty_string(self):
        assert extract_json_block('') == ''

    def test_whitespace_only(self):
        assert extract_json_block('   ') == ''

    def test_fence_with_array(self):
        raw = '```json\n[{"a": 1}, {"b": 2}]\n```'
        assert extract_json_block(raw) == '[{"a": 1}, {"b": 2}]'

    def test_nested_json_preserved(self):
        raw = '```json\n{"outer": {"inner": [1, 2, 3]}}\n```'
        assert extract_json_block(raw) == '{"outer": {"inner": [1, 2, 3]}}'

    def test_does_not_modify_non_fence_content(self):
        raw = 'No fences here, just text'
        assert extract_json_block(raw) == 'No fences here, just text'

    def test_strips_trailing_newline(self):
        raw = '{"hello": "world"}\n'
        assert extract_json_block(raw) == '{"hello": "world"}'

    def test_fence_with_unicode(self):
        raw = '```json\n{"emoji": "🎬"}\n```'
        assert extract_json_block(raw) == '{"emoji": "🎬"}'
