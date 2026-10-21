"""Tests for extract_json_block() in app.core.anthropic_client."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.anthropic_client import extract_json_block


class TestExtractJsonBlock:
    """extract_json_block strips ```json fences and trims whitespace."""

    def test_plain_json_unchanged(self):
        raw = '{"key": "value"}'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_strips_json_fenced_block(self):
        raw = "```json\n{\"key\": \"value\"}\n```"
        result = extract_json_block(raw)
        assert result == '{"key": "value"}'

    def test_strips_plain_fenced_block(self):
        raw = "```\n{\"key\": 1}\n```"
        result = extract_json_block(raw)
        assert result == '{"key": 1}'

    def test_trims_leading_and_trailing_whitespace(self):
        raw = "  \n  {\"a\": 1}  \n  "
        assert extract_json_block(raw) == '{"a": 1}'

    def test_strips_fenced_block_with_surrounding_whitespace(self):
        raw = "  ```json\n[1, 2, 3]\n```  "
        result = extract_json_block(raw)
        assert result == "[1, 2, 3]"

    def test_nested_json_object_preserved(self):
        raw = '{"outer": {"inner": [1, 2, 3]}}'
        assert extract_json_block(raw) == raw

    def test_nested_json_in_fence(self):
        raw = "```json\n{\"outer\": {\"inner\": true}}\n```"
        result = extract_json_block(raw)
        assert result == '{"outer": {"inner": true}}'

    def test_array_in_fence(self):
        raw = "```json\n[{\"a\": 1}, {\"b\": 2}]\n```"
        result = extract_json_block(raw)
        assert result == '[{"a": 1}, {"b": 2}]'

    def test_plain_string_with_no_fence(self):
        raw = "just a string, no json"
        assert extract_json_block(raw) == raw

    def test_empty_string_returns_empty(self):
        assert extract_json_block("") == ""

    def test_whitespace_only_returns_empty(self):
        assert extract_json_block("   \n  ") == ""

    def test_fence_without_json_tag_strips_correctly(self):
        raw = "```\n42\n```"
        assert extract_json_block(raw) == "42"

    def test_model_response_with_preamble_in_fence_is_stripped(self):
        """If the model adds explanation text inside a json fence, extract_json_block
        should still strip the fence delimiters."""
        raw = "```json\n{\"score\": 99}\n```"
        result = extract_json_block(raw)
        assert result == '{"score": 99}'

    def test_deeply_nested_json_survives_intact(self):
        payload = '{"a": {"b": {"c": [1, 2, {"d": "e"}]}}}'
        raw = f"```json\n{payload}\n```"
        assert extract_json_block(raw) == payload

    def test_real_world_hook_score_response(self):
        raw = (
            "```json\n"
            '{"original_input": "test", "optimized_script": "Stop!", '
            '"hook_score": 85.0, "hook_rationale": "shock value", '
            '"target_platform": "tiktok", "estimated_duration_seconds": 15.0, '
            '"pacing_wpm": 160, "retention_triggers": ["curiosity gap"]}\n'
            "```"
        )
        result = extract_json_block(raw)
        import json
        parsed = json.loads(result)
        assert parsed["hook_score"] == 85.0
        assert parsed["target_platform"] == "tiktok"
