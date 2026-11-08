"""Tests for extract_json_block() in app.core.anthropic_client."""
import pytest
from app.core.anthropic_client import extract_json_block


class TestExtractJsonBlock:
    # ------------------------------------------------------------------
    # No fence — raw JSON is returned as-is (stripped)
    # ------------------------------------------------------------------

    def test_plain_json_returned_verbatim(self):
        raw = '{"key": "value"}'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_plain_json_stripped_of_whitespace(self):
        raw = '  {"key": "value"}  '
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_plain_array_json(self):
        raw = '[1, 2, 3]'
        assert extract_json_block(raw) == '[1, 2, 3]'

    def test_empty_string(self):
        assert extract_json_block('') == ''

    def test_whitespace_only(self):
        assert extract_json_block('   ') == ''

    # ------------------------------------------------------------------
    # Fenced code blocks
    # ------------------------------------------------------------------

    def test_json_fence_stripped(self):
        raw = '```json\n{"key": "value"}\n```'
        result = extract_json_block(raw)
        assert result == '{"key": "value"}'

    def test_bare_fence_stripped(self):
        raw = '```\n{"key": "value"}\n```'
        result = extract_json_block(raw)
        # After stripping ``` the second segment starts immediately — no 'json' prefix
        assert '{"key": "value"}' in result

    def test_fence_with_array(self):
        raw = '```json\n[{"a": 1}, {"b": 2}]\n```'
        assert extract_json_block(raw) == '[{"a": 1}, {"b": 2}]'

    def test_fence_with_leading_whitespace_inside(self):
        raw = '```json\n  {"spaced": true}\n```'
        result = extract_json_block(raw)
        assert '{"spaced": true}' in result

    def test_fence_with_trailing_whitespace(self):
        raw = '  ```json\n{"k": "v"}\n```  '
        # strip() removes outer whitespace, then fence detected
        result = extract_json_block(raw)
        assert '{"k": "v"}' in result

    # ------------------------------------------------------------------
    # Content integrity
    # ------------------------------------------------------------------

    def test_multiline_json_preserved(self):
        raw = '```json\n{\n  "a": 1,\n  "b": 2\n}\n```'
        result = extract_json_block(raw)
        assert '"a": 1' in result
        assert '"b": 2' in result

    def test_non_json_text_returned_as_is(self):
        raw = 'just some text'
        assert extract_json_block(raw) == 'just some text'

    def test_json_fence_without_closing_fence(self):
        # Only two segments after split on ``` — no trailing fence present
        raw = '```json\n{"key": "value"}'
        result = extract_json_block(raw)
        # Still extracts the content after the fence tag
        assert '{"key": "value"}' in result

    def test_empty_fence(self):
        raw = '```json\n```'
        result = extract_json_block(raw)
        assert result == ''

    # ------------------------------------------------------------------
    # Real-world LLM output shapes
    # ------------------------------------------------------------------

    def test_real_llm_hook_score_output(self):
        raw = (
            '```json\n'
            '{\n'
            '  "original_input": "Hey guys today we explore...",\n'
            '  "optimized_script": "Delete this. Here\'s proof—",\n'
            '  "hook_score": 92.5,\n'
            '  "hook_rationale": "Pattern interrupt in first word",\n'
            '  "target_platform": "tiktok",\n'
            '  "estimated_duration_seconds": 15.0,\n'
            '  "pacing_wpm": 160,\n'
            '  "retention_triggers": ["curiosity gap", "shocking reveal"]\n'
            '}\n'
            '```'
        )
        result = extract_json_block(raw)
        assert '"hook_score": 92.5' in result
        assert '"pacing_wpm": 160' in result
