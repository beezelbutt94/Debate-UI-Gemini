"""Tests for pure helper functions in app.core.anthropic_client."""
import pytest
import sys
import os

# Allow import without installing the package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.core.anthropic_client import extract_json_block


class TestExtractJsonBlock:
    """extract_json_block strips ```json fences and returns the raw JSON string."""

    # -----------------------------------------------------------------
    # Unfenced inputs — returned as-is (stripped)
    # -----------------------------------------------------------------
    def test_plain_json_object(self):
        raw = '{"key": "value"}'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_plain_json_array(self):
        raw = '[1, 2, 3]'
        assert extract_json_block(raw) == '[1, 2, 3]'

    def test_strips_leading_and_trailing_whitespace(self):
        raw = '   {"a": 1}   '
        assert extract_json_block(raw) == '{"a": 1}'

    def test_empty_string(self):
        assert extract_json_block('') == ''

    def test_whitespace_only_string(self):
        assert extract_json_block('   ') == ''

    # -----------------------------------------------------------------
    # Fenced inputs — ```json ... ``` removed
    # -----------------------------------------------------------------
    def test_json_fenced_block(self):
        raw = '```json\n{"key": "value"}\n```'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_generic_fenced_block_no_language_tag(self):
        raw = '```\n{"key": "value"}\n```'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_fenced_array(self):
        raw = '```json\n[1, 2, 3]\n```'
        assert extract_json_block(raw) == '[1, 2, 3]'

    def test_fenced_with_leading_whitespace_before_fence(self):
        raw = '  ```json\n{"x": 1}\n```'
        # strip() removes leading spaces, so the fence is first
        assert extract_json_block(raw) == '{"x": 1}'

    def test_multi_key_fenced_json(self):
        raw = '```json\n{"hook_score": 85, "target_platform": "tiktok"}\n```'
        result = extract_json_block(raw)
        assert '"hook_score": 85' in result
        assert '"target_platform": "tiktok"' in result

    def test_fenced_json_result_is_valid_json(self):
        import json
        raw = '```json\n{"name": "test", "value": 42}\n```'
        result = extract_json_block(raw)
        parsed = json.loads(result)
        assert parsed['name'] == 'test'
        assert parsed['value'] == 42

    def test_nested_object_fenced(self):
        import json
        payload = '{"outer": {"inner": [1, 2, 3]}}'
        raw = f'```json\n{payload}\n```'
        result = extract_json_block(raw)
        parsed = json.loads(result)
        assert parsed['outer']['inner'] == [1, 2, 3]

    def test_fenced_with_trailing_newline_inside(self):
        raw = '```json\n{"a": 1}\n\n```'
        result = extract_json_block(raw)
        # Content between fences should be present
        assert '{"a": 1}' in result

    def test_real_llm_style_response(self):
        """Mirrors what Claude actually returns for a competitor analysis."""
        raw = (
            '```json\n'
            '{\n'
            '  "handle": "@testcreator",\n'
            '  "platform": "tiktok",\n'
            '  "sampleSize": 35,\n'
            '  "avgViews": 120000,\n'
            '  "engagementRate": 0.062,\n'
            '  "hookBreakdown": [],\n'
            '  "contentGaps": ["gap1", "gap2", "gap3"]\n'
            '}\n'
            '```'
        )
        import json
        result = extract_json_block(raw)
        parsed = json.loads(result)
        assert parsed['handle'] == '@testcreator'
        assert parsed['sampleSize'] == 35

    def test_does_not_alter_non_fenced_valid_json_array(self):
        raw = '[{"clip_id": "c1", "start_second": 0.0}]'
        assert extract_json_block(raw) == raw

    # -----------------------------------------------------------------
    # Edge cases
    # -----------------------------------------------------------------
    def test_json_tag_without_closing_fence(self):
        """If the model forgets the closing ```, the content between is still extracted."""
        raw = '```json\n{"key": "value"}'
        result = extract_json_block(raw)
        # split('```')[1] → 'json\n{"key": "value"}'; lstrip 'json' → '\n{"key": "value"}'
        # strip() → '{"key": "value"}'
        assert '{"key": "value"}' in result

    def test_plain_text_not_starting_with_fence(self):
        raw = 'Here is the JSON: {"a": 1}'
        # Does not start with ``` so returned as-is after strip
        assert extract_json_block(raw) == 'Here is the JSON: {"a": 1}'
