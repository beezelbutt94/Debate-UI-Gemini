"""Tests for extract_json_block() in app.core.anthropic_client."""
import sys
import os

# Add the services/api directory so the import resolves without installing the package.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

import pytest
from app.core.anthropic_client import extract_json_block


class TestExtractJsonBlock:
    # ------------------------------------------------------------------
    # Fence-wrapped inputs
    # ------------------------------------------------------------------

    def test_strips_json_fence_with_language_tag(self):
        raw = '```json\n{"key": "value"}\n```'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_strips_plain_code_fence(self):
        """A ``` fence without 'json' should still be stripped."""
        raw = '```\n{"a": 1}\n```'
        assert extract_json_block(raw) == '{"a": 1}'

    def test_handles_json_fence_with_leading_whitespace(self):
        raw = '  ```json\n{"x": true}\n```'
        # strip() is called first, so leading spaces are removed before the fence check
        assert extract_json_block(raw) == '{"x": true}'

    def test_handles_empty_json_object_in_fence(self):
        raw = '```json\n{}\n```'
        assert extract_json_block(raw) == '{}'

    def test_handles_array_json_in_fence(self):
        raw = '```json\n[1, 2, 3]\n```'
        assert extract_json_block(raw) == '[1, 2, 3]'

    def test_multiline_json_in_fence(self):
        raw = '```json\n{\n  "name": "test",\n  "value": 42\n}\n```'
        result = extract_json_block(raw)
        assert '"name": "test"' in result
        assert '"value": 42' in result

    # ------------------------------------------------------------------
    # Plain (no fence) inputs
    # ------------------------------------------------------------------

    def test_plain_json_object_passthrough(self):
        raw = '{"key": "value"}'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_plain_json_array_passthrough(self):
        raw = '[{"a": 1}, {"b": 2}]'
        assert extract_json_block(raw) == '[{"a": 1}, {"b": 2}]'

    def test_plain_string_passthrough(self):
        raw = 'just some text without fences'
        assert extract_json_block(raw) == 'just some text without fences'

    def test_strips_leading_and_trailing_whitespace_for_plain(self):
        raw = '  {"padded": true}  '
        assert extract_json_block(raw) == '{"padded": true}'

    def test_empty_string_returns_empty(self):
        assert extract_json_block('') == ''

    def test_whitespace_only_returns_empty(self):
        assert extract_json_block('   \n\t  ') == ''

    # ------------------------------------------------------------------
    # Edge cases
    # ------------------------------------------------------------------

    def test_fence_without_closing_backticks(self):
        """If there's no closing ```, split('```') still works — returns the content after first fence."""
        raw = '```json\n{"incomplete": true}'
        result = extract_json_block(raw)
        # After splitting by ``` we get ['', 'json\n{"incomplete": true}']
        # text = parts[1] = 'json\n{"incomplete": true}', then strip 'json' prefix
        assert '{"incomplete": true}' in result

    def test_deeply_nested_json_in_fence(self):
        raw = '```json\n{"a": {"b": {"c": [1, 2, 3]}}}\n```'
        result = extract_json_block(raw)
        assert result == '{"a": {"b": {"c": [1, 2, 3]}}}'

    def test_json_with_unicode(self):
        raw = '```json\n{"emoji": "🚀", "name": "Héllo"}\n```'
        result = extract_json_block(raw)
        assert '"emoji": "🚀"' in result

    def test_json_with_newlines_inside_values(self):
        raw = '```json\n{"script": "line1\\nline2"}\n```'
        result = extract_json_block(raw)
        assert '"script": "line1\\nline2"' in result

    def test_result_is_parseable_json_after_fence_strip(self):
        import json
        raw = '```json\n{"hook_score": 85.5, "platform": "tiktok"}\n```'
        result = extract_json_block(raw)
        parsed = json.loads(result)
        assert parsed['hook_score'] == 85.5
        assert parsed['platform'] == 'tiktok'

    def test_plain_json_result_parseable(self):
        import json
        raw = '{"sampleSize": 30, "avgViews": 50000}'
        result = extract_json_block(raw)
        parsed = json.loads(result)
        assert parsed['sampleSize'] == 30

    def test_fence_with_extra_spaces_after_backticks(self):
        """Fence line with trailing spaces is still detected because strip() is applied."""
        raw = '```json  \n{"key": 1}\n```'
        # strip() is applied at the top level but the first line check is startswith('```')
        # In the actual implementation, text = raw.strip() → starts with ``` so it splits.
        result = extract_json_block(raw)
        assert '{"key": 1}' in result
