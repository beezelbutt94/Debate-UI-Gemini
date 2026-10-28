"""Tests for extract_json_block in services/api/app/core/anthropic_client.py."""
import sys
import os

# Allow importing from the services/api directory without installing the package.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'services', 'api'))

# Stub out the 'anthropic' import so we can test without the SDK installed.
import types
anthropic_stub = types.ModuleType('anthropic')
class _AsyncAnthropic:
    def __init__(self, **kw):
        pass
anthropic_stub.AsyncAnthropic = _AsyncAnthropic
sys.modules.setdefault('anthropic', anthropic_stub)

from app.core.anthropic_client import extract_json_block  # noqa: E402


class TestExtractJsonBlock:
    # ── Plain JSON (no fence) ──────────────────────────────────────────────
    def test_plain_json_array(self):
        raw = '[{"a": 1}]'
        assert extract_json_block(raw) == '[{"a": 1}]'

    def test_plain_json_object(self):
        raw = '{"key": "value"}'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_plain_json_with_leading_trailing_whitespace(self):
        raw = '  {"key": "value"}  '
        assert extract_json_block(raw) == '{"key": "value"}'

    # ── Fenced with ```json ────────────────────────────────────────────────
    def test_fenced_with_json_label(self):
        raw = '```json\n[{"a": 1}]\n```'
        assert extract_json_block(raw) == '[{"a": 1}]'

    def test_fenced_json_with_extra_whitespace(self):
        raw = '```json\n  {"x": 2}  \n```'
        assert extract_json_block(raw) == '{"x": 2}'

    def test_fenced_json_multiline_object(self):
        raw = '```json\n{\n  "foo": "bar",\n  "baz": 42\n}\n```'
        result = extract_json_block(raw)
        assert '"foo"' in result
        assert '"baz"' in result

    # ── Fenced with plain ``` (no language label) ─────────────────────────
    def test_fenced_without_language_label(self):
        raw = '```\n[1, 2, 3]\n```'
        result = extract_json_block(raw)
        assert '[1, 2, 3]' in result

    # ── Real output patterns ───────────────────────────────────────────────
    def test_model_preamble_before_fence_is_ignored_after_split(self):
        # The function splits on ``` and takes index [1], so only the fence
        # content matters — preamble before the first ``` is discarded.
        raw = 'Here is the JSON:\n```json\n{"clips": []}\n```'
        result = extract_json_block(raw)
        assert '{"clips": []}' in result

    def test_empty_json_object_in_fence(self):
        raw = '```json\n{}\n```'
        assert extract_json_block(raw) == '{}'

    def test_empty_json_array_in_fence(self):
        raw = '```json\n[]\n```'
        assert extract_json_block(raw) == '[]'

    def test_returns_string(self):
        assert isinstance(extract_json_block('{}'), str)

    def test_empty_string_returns_empty(self):
        assert extract_json_block('') == ''

    def test_whitespace_only_returns_empty(self):
        assert extract_json_block('   ') == ''

    def test_nested_json_in_fence(self):
        raw = '```json\n{"outer": {"inner": [1, 2, 3]}}\n```'
        result = extract_json_block(raw)
        assert '"inner"' in result
        assert '[1, 2, 3]' in result

    def test_no_double_strip_of_plain_json(self):
        # Plain JSON must not have its content mangled
        raw = '{"score": 95, "verdict": "strong"}'
        result = extract_json_block(raw)
        assert result == '{"score": 95, "verdict": "strong"}'
