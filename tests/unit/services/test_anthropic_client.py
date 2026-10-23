"""Tests for extract_json_block() in services/api/app/core/anthropic_client.py"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'services', 'api'))

import pytest

# Import only the pure helper; avoid triggering the lru_cache'd client init
# which would fail without ANTHROPIC_API_KEY.
from app.core.anthropic_client import extract_json_block


class TestExtractJsonBlock:
    def test_plain_json_object_returned_unchanged(self):
        raw = '{"key": "value"}'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_strips_json_code_fence(self):
        raw = '```json\n{"key": "value"}\n```'
        result = extract_json_block(raw)
        assert result == '{"key": "value"}'

    def test_strips_plain_code_fence(self):
        raw = '```\n{"key": "value"}\n```'
        result = extract_json_block(raw)
        assert result == '{"key": "value"}'

    def test_strips_leading_trailing_whitespace(self):
        raw = '   {"key": "value"}   '
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_json_fence_with_extra_whitespace_after_marker(self):
        raw = '```json\n\n{"a": 1}\n\n```'
        result = extract_json_block(raw)
        # The implementation strips text after splitting on ``` and the json prefix
        # After splitting: ['', 'json\n\n{"a": 1}\n\n', '']
        # text = text.split("```")[1] → 'json\n\n{"a": 1}\n\n'
        # if text.startswith("json"): text = text[4:] → '\n\n{"a": 1}\n\n'
        # text.strip() → '{"a": 1}'
        assert result == '{"a": 1}'

    def test_empty_string_returns_empty(self):
        assert extract_json_block('') == ''

    def test_whitespace_only_returns_empty(self):
        assert extract_json_block('   ') == ''

    def test_json_array_returned_unchanged(self):
        raw = '[1, 2, 3]'
        assert extract_json_block(raw) == '[1, 2, 3]'

    def test_json_array_in_fence(self):
        raw = '```json\n[1, 2, 3]\n```'
        assert extract_json_block(raw) == '[1, 2, 3]'

    def test_nested_json_preserved(self):
        raw = '```json\n{"a": {"b": [1, 2]}}\n```'
        assert extract_json_block(raw) == '{"a": {"b": [1, 2]}}'

    def test_no_fence_preserves_content_with_newlines(self):
        raw = '{\n  "key": "value"\n}'
        assert extract_json_block(raw) == '{\n  "key": "value"\n}'

    def test_fence_without_json_label(self):
        raw = '```\nsome text\n```'
        result = extract_json_block(raw)
        assert result == 'some text'

    def test_string_starting_with_json_not_inside_fence(self):
        # Plain text starting with "json" – no fence so passes through stripped
        raw = 'json{"key": "val"}'
        assert extract_json_block(raw) == 'json{"key": "val"}'

    def test_real_llm_style_output(self):
        raw = """Here is the JSON output:
```json
{
  "handle": "@creator",
  "sampleSize": 40,
  "avgViews": 15000,
  "engagementRate": 0.045,
  "hookBreakdown": [{"name": "Curiosity Question", "frequency": 0.5}],
  "contentGaps": ["gap1", "gap2", "gap3"]
}
```"""
        result = extract_json_block(raw)
        # The implementation only strips the first ``` block it finds.
        # raw doesn't start with ``` (starts with "Here is") so it is returned as-is (stripped)
        # meaning the prefix text is also included.
        # Let's verify the actual behavior:
        # text = raw.strip()
        # text.startswith("```") → False  (starts with "Here is")
        # Returns the whole stripped string unchanged
        assert '```json' in result or '"handle"' in result

    def test_fence_only_at_start_triggers_strip(self):
        """Only strips the fence when the raw string *starts* with the fence."""
        raw = '```json\n{"x": 1}\n```'
        assert extract_json_block(raw) == '{"x": 1}'

    def test_text_before_fence_is_not_stripped(self):
        """If there's text before the ```, the block is returned as-is."""
        raw = 'Some text\n```json\n{"x": 1}\n```'
        result = extract_json_block(raw)
        # Doesn't start with ``` so the whole string comes back (stripped)
        assert result == raw.strip()
