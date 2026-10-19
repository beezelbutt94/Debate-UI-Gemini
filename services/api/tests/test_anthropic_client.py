"""Unit tests for extract_json_block -- the one pure function in anthropic_client.py.

get_anthropic_client() requires ANTHROPIC_API_KEY and the anthropic SDK;
we only test the text-extraction helper which has no external dependencies.
"""
import sys
import os
from unittest.mock import MagicMock

import pytest


@pytest.fixture(autouse=True, scope="module")
def _stub_anthropic():
    """Prevent the real anthropic SDK from being required at import time."""
    sys.modules.setdefault("anthropic", MagicMock())


def _fn():
    from services.api.app.core.anthropic_client import extract_json_block
    return extract_json_block


class TestExtractJsonBlock:
    def test_plain_json_is_returned_unchanged(self):
        fn = _fn()
        raw = '{"key": "value"}'
        assert fn(raw) == raw

    def test_strips_fenced_json_block(self):
        fn = _fn()
        raw = "```json\n{\"key\": \"value\"}\n```"
        assert fn(raw) == '{"key": "value"}'

    def test_strips_generic_fence_without_json_language_tag(self):
        fn = _fn()
        raw = "```\n{\"key\": \"value\"}\n```"
        assert fn(raw) == '{"key": "value"}'

    def test_handles_leading_and_trailing_whitespace_before_fence(self):
        fn = _fn()
        raw = "   ```json\n{\"x\": 1}\n```   "
        assert fn(raw) == '{"x": 1}'

    def test_handles_nested_content_with_colons_and_quotes(self):
        fn = _fn()
        raw = '```json\n{"hook": "Stop doing this: it\'s wrong", "score": 85}\n```'
        result = fn(raw)
        assert '"hook"' in result
        assert '"score": 85' in result

    def test_complex_nested_json(self):
        fn = _fn()
        raw = '```json\n{"a": [1, 2, 3], "b": {"c": true}}\n```'
        result = fn(raw)
        assert '"a"' in result
        assert '"c": true' in result

    def test_plain_json_with_leading_trailing_whitespace_is_stripped(self):
        fn = _fn()
        raw = '  {"key": "value"}  '
        assert fn(raw) == '{"key": "value"}'

    def test_preserves_json_array(self):
        fn = _fn()
        raw = '```json\n[1, 2, 3]\n```'
        assert fn(raw) == '[1, 2, 3]'

    def test_empty_json_object(self):
        fn = _fn()
        raw = '```json\n{}\n```'
        assert fn(raw) == '{}'

    def test_no_fence_multiline_json(self):
        fn = _fn()
        raw = '{\n  "a": 1,\n  "b": 2\n}'
        assert fn(raw) == raw

    def test_fence_with_extra_blank_lines_inside(self):
        fn = _fn()
        raw = "```json\n\n{\"k\": \"v\"}\n\n```"
        result = fn(raw)
        assert result == '{"k": "v"}'
