"""Tests for the pure extract_json_block helper in app/core/anthropic_client.py."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'services', 'api'))

from app.core.anthropic_client import extract_json_block


class TestExtractJsonBlock:
    def test_plain_json_returned_as_is(self):
        raw = '{"key": "value"}'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_plain_json_array_returned_as_is(self):
        raw = '[1, 2, 3]'
        assert extract_json_block(raw) == '[1, 2, 3]'

    def test_strips_json_fenced_block(self):
        raw = '```json\n{"key": "value"}\n```'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_strips_bare_fenced_block(self):
        raw = '```\n{"key": "value"}\n```'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_strips_leading_and_trailing_whitespace(self):
        raw = '   {"a": 1}   '
        assert extract_json_block(raw) == '{"a": 1}'

    def test_strips_whitespace_around_fenced_block(self):
        raw = '  ```json\n[1,2,3]\n```  '
        assert extract_json_block(raw) == '[1,2,3]'

    def test_handles_multiline_json_in_fence(self):
        raw = '```json\n{\n  "foo": "bar",\n  "baz": 42\n}\n```'
        result = extract_json_block(raw)
        assert '"foo"' in result
        assert '"bar"' in result
        assert '42' in result

    def test_handles_array_in_json_fence(self):
        raw = '```json\n[{"a": 1}, {"b": 2}]\n```'
        result = extract_json_block(raw)
        assert result == '[{"a": 1}, {"b": 2}]'

    def test_no_fence_with_whitespace_lines(self):
        raw = '\n\n{"x": true}\n\n'
        assert extract_json_block(raw) == '{"x": true}'

    def test_empty_json_object(self):
        raw = '{}'
        assert extract_json_block(raw) == '{}'

    def test_fence_without_json_tag(self):
        # bare ``` fence (no "json" after the backticks)
        raw = '```\n{"only": "data"}\n```'
        assert extract_json_block(raw) == '{"only": "data"}'

    def test_nested_json_preserved(self):
        raw = '```json\n{"outer": {"inner": [1, 2, 3]}}\n```'
        result = extract_json_block(raw)
        assert '"outer"' in result
        assert '"inner"' in result

    def test_json_with_unicode(self):
        raw = '{"emoji": "🎬", "text": "café"}'
        assert extract_json_block(raw) == '{"emoji": "🎬", "text": "café"}'
