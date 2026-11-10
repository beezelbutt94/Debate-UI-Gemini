"""Tests for extract_json_block() in services/api/app/core/anthropic_client.py"""
import sys
import os
import types

# Stub anthropic BEFORE adding the services path so the module-level
# `from anthropic import AsyncAnthropic` doesn't fail.
_anthropic_stub = types.ModuleType('anthropic')
_anthropic_stub.AsyncAnthropic = type('AsyncAnthropic', (), {})  # type: ignore[attr-defined]
sys.modules.setdefault('anthropic', _anthropic_stub)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'services', 'api'))

from app.core.anthropic_client import extract_json_block  # noqa: E402


class TestExtractJsonBlock:
    # ── Fenced inputs ───────────────────────────────────────────────────────

    def test_strips_json_fence_with_json_tag(self):
        raw = "```json\n{\"key\": \"value\"}\n```"
        result = extract_json_block(raw)
        assert result == '{"key": "value"}'

    def test_strips_generic_code_fence(self):
        raw = "```\n{\"key\": \"value\"}\n```"
        result = extract_json_block(raw)
        # split('```')[1] = '\n{"key": "value"}\n'; strip() = '{"key": "value"}'
        assert result == '{"key": "value"}'

    def test_handles_fence_with_leading_whitespace(self):
        raw = "   ```json\n{}\n```   "
        # outer strip turns it into ```json\n{}\n``` before the fence check
        result = extract_json_block(raw)
        assert result == "{}"

    # ── Plain inputs (no fence) ─────────────────────────────────────────────

    def test_passthrough_plain_json_object(self):
        raw = '{"a": 1, "b": "two"}'
        assert extract_json_block(raw) == '{"a": 1, "b": "two"}'

    def test_passthrough_plain_json_array(self):
        raw = '[1, 2, 3]'
        assert extract_json_block(raw) == '[1, 2, 3]'

    def test_strips_surrounding_whitespace_from_plain_input(self):
        raw = '   {"stripped": true}   '
        assert extract_json_block(raw) == '{"stripped": true}'

    def test_passthrough_empty_string(self):
        assert extract_json_block('') == ''

    def test_passthrough_whitespace_only_string(self):
        assert extract_json_block('   ') == ''

    # ── Nested fences / edge cases ──────────────────────────────────────────

    def test_fence_with_array_content(self):
        raw = "```json\n[{\"id\":1},{\"id\":2}]\n```"
        result = extract_json_block(raw)
        assert result == '[{"id":1},{"id":2}]'

    def test_plain_string_starting_with_non_brace(self):
        raw = "some plain text"
        assert extract_json_block(raw) == "some plain text"

    def test_multiline_plain_json(self):
        raw = '{\n  "a": 1,\n  "b": 2\n}'
        assert extract_json_block(raw) == '{\n  "a": 1,\n  "b": 2\n}'

    def test_fence_preserves_internal_newlines(self):
        raw = "```json\n{\n  \"key\": \"value\"\n}\n```"
        result = extract_json_block(raw)
        assert '"key": "value"' in result

    def test_fence_no_json_tag(self):
        raw = "```\n42\n```"
        # split('```') = ['', '\n42\n', ''] → [1] = '\n42\n' → strip = '42'
        assert extract_json_block(raw) == '42'

    def test_model_response_typical(self):
        """Realistic model output with json fence and trailing whitespace."""
        raw = "```json\n{\"clips\": [{\"id\": 1}]}\n```\n"
        result = extract_json_block(raw)
        assert result == '{"clips": [{"id": 1}]}'
