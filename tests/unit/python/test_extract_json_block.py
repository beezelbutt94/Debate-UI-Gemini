"""Tests for app.core.anthropic_client.extract_json_block."""
import pytest
from app.core.anthropic_client import extract_json_block


class TestExtractJsonBlock:
    # ── plain JSON (no fence) ────────────────────────────────────────────────

    def test_plain_json_object_passthrough(self):
        raw = '{"key": "value"}'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_plain_json_array_passthrough(self):
        raw = '[1, 2, 3]'
        assert extract_json_block(raw) == '[1, 2, 3]'

    def test_plain_text_with_leading_trailing_whitespace_stripped(self):
        raw = '  {"a": 1}  '
        assert extract_json_block(raw) == '{"a": 1}'

    def test_plain_text_with_newlines_stripped(self):
        raw = '\n{"a": 1}\n'
        assert extract_json_block(raw) == '{"a": 1}'

    # ── fenced JSON block ────────────────────────────────────────────────────

    def test_strips_json_fence(self):
        raw = '```json\n{"key": "value"}\n```'
        result = extract_json_block(raw)
        assert result == '{"key": "value"}'

    def test_strips_fence_without_language_specifier(self):
        raw = '```\n{"key": "value"}\n```'
        result = extract_json_block(raw)
        # The code strips the first ``` block; no 'json' prefix so it strips
        # the empty first token, leaving the content
        assert '{"key": "value"}' in result

    def test_strips_multiline_json_fence(self):
        raw = '```json\n[\n  {"id": 1},\n  {"id": 2}\n]\n```'
        result = extract_json_block(raw)
        assert result.startswith('[')
        assert '"id": 1' in result
        assert '"id": 2' in result

    def test_result_is_valid_parseable_json_after_extraction(self):
        import json
        raw = '```json\n{"clips": [{"start": 0.0, "end": 30.5}]}\n```'
        result = extract_json_block(raw)
        parsed = json.loads(result)
        assert parsed["clips"][0]["end"] == 30.5

    def test_leading_trailing_whitespace_outside_fence(self):
        raw = '  ```json\n{"a": 1}\n```  '
        result = extract_json_block(raw)
        assert '{"a": 1}' in result

    def test_fence_with_extra_whitespace_after_json_tag(self):
        """Model sometimes emits ```json with a trailing space."""
        raw = '```json \n{"x": true}\n```'
        result = extract_json_block(raw)
        # The slice text[4:] will leave a leading space; strip() cleans it
        assert '{"x": true}' in result

    # ── edge cases ───────────────────────────────────────────────────────────

    def test_empty_fence_returns_empty_string(self):
        raw = '```json\n\n```'
        result = extract_json_block(raw)
        assert result == ''

    def test_deeply_nested_json_passthrough(self):
        raw = '{"a": {"b": {"c": [1, 2, 3]}}}'
        assert extract_json_block(raw) == raw

    def test_string_with_only_whitespace(self):
        result = extract_json_block('   ')
        assert result == ''

    def test_fence_wrapping_array_of_candidates(self):
        import json
        clips = [
            {"clip_id": f"c{i}", "start_second": i * 10.0, "end_second": i * 10.0 + 30}
            for i in range(5)
        ]
        raw = f'```json\n{json.dumps(clips)}\n```'
        result = extract_json_block(raw)
        parsed = json.loads(result)
        assert len(parsed) == 5
        assert parsed[2]["clip_id"] == "c2"
