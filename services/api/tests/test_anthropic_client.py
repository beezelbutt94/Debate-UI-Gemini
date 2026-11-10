"""Tests for app.core.anthropic_client – pure Python helpers only."""
import os
import pytest
from functools import lru_cache

from app.core.anthropic_client import extract_json_block, get_anthropic_client


class TestExtractJsonBlock:
    def test_plain_json_returned_unchanged(self):
        raw = '{"key": "value"}'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_strips_json_fenced_block(self):
        raw = '```json\n{"key": "value"}\n```'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_strips_generic_code_fence(self):
        raw = '```\n{"key": "value"}\n```'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_trims_surrounding_whitespace(self):
        raw = '   {"key": "value"}   '
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_trims_whitespace_inside_fence(self):
        raw = '```json\n  {"k": 1}  \n```'
        assert extract_json_block(raw) == '{"k": 1}'

    def test_array_json_plain(self):
        raw = '[1, 2, 3]'
        assert extract_json_block(raw) == '[1, 2, 3]'

    def test_array_in_fence(self):
        raw = '```json\n[{"a": 1}, {"b": 2}]\n```'
        assert extract_json_block(raw) == '[{"a": 1}, {"b": 2}]'

    def test_nested_json_preserved(self):
        raw = '```json\n{"outer": {"inner": [1, 2]}}\n```'
        assert extract_json_block(raw) == '{"outer": {"inner": [1, 2]}}'

    def test_empty_string_returned_as_is(self):
        assert extract_json_block('') == ''

    def test_non_json_text_without_fence_returned_as_is(self):
        raw = 'Here is some text without JSON'
        assert extract_json_block(raw) == raw.strip()

    def test_fence_with_newlines_only(self):
        raw = '```json\n\n```'
        result = extract_json_block(raw)
        assert result == ''

    def test_multiline_json_in_fence(self):
        raw = '```json\n{\n  "foo": "bar",\n  "baz": 42\n}\n```'
        result = extract_json_block(raw)
        assert '"foo"' in result
        assert '"baz"' in result


class TestGetAnthropicClient:
    def test_raises_when_api_key_missing(self, monkeypatch):
        monkeypatch.delenv('ANTHROPIC_API_KEY', raising=False)
        # Clear the lru_cache so it re-evaluates the env var
        get_anthropic_client.cache_clear()
        with pytest.raises(RuntimeError, match='ANTHROPIC_API_KEY'):
            get_anthropic_client()

    def test_returns_client_when_key_set(self, monkeypatch):
        monkeypatch.setenv('ANTHROPIC_API_KEY', 'test-key-abc')
        get_anthropic_client.cache_clear()
        # Should not raise; we don't care about the specific type since AsyncAnthropic is mocked
        client = get_anthropic_client()
        assert client is not None
        get_anthropic_client.cache_clear()

    def test_returns_same_instance_on_repeated_calls(self, monkeypatch):
        monkeypatch.setenv('ANTHROPIC_API_KEY', 'test-key-abc')
        get_anthropic_client.cache_clear()
        a = get_anthropic_client()
        b = get_anthropic_client()
        assert a is b
        get_anthropic_client.cache_clear()
