"""Tests for app.core.anthropic_client.extract_json_block() and related helpers."""
import os
import importlib
import pytest


def _reload_client_module():
    """Force a fresh import so lru_cache doesn't carry state between tests."""
    import app.core.anthropic_client as m
    importlib.reload(m)
    return m


class TestExtractJsonBlock:
    """extract_json_block strips ```json fences if present."""

    def _run(self, raw: str) -> str:
        from app.core.anthropic_client import extract_json_block
        return extract_json_block(raw)

    def test_plain_json_unchanged(self):
        raw = '{"key": "value"}'
        assert self._run(raw) == raw

    def test_strips_json_code_fence(self):
        raw = '```json\n{"key": "value"}\n```'
        result = self._run(raw)
        assert result == '{"key": "value"}'

    def test_strips_plain_code_fence(self):
        raw = '```\n{"key": "value"}\n```'
        result = self._run(raw)
        assert result == '{"key": "value"}'

    def test_strips_leading_whitespace(self):
        raw = '   {"key": "value"}   '
        result = self._run(raw)
        assert result == '{"key": "value"}'

    def test_json_fence_with_surrounding_text(self):
        # Only the first ``` split is used -- text before the fence is dropped
        raw = 'Here is your JSON:\n```json\n[1, 2, 3]\n```'
        result = self._run(raw)
        assert result.strip() == '[1, 2, 3]'

    def test_nested_braces_preserved(self):
        raw = '```json\n{"a": {"b": 1}}\n```'
        result = self._run(raw)
        assert '"b": 1' in result

    def test_json_array(self):
        raw = '```json\n[{"id": 1}, {"id": 2}]\n```'
        result = self._run(raw)
        assert result.startswith('[')

    def test_whitespace_only_fence_content(self):
        raw = '```\n   \n```'
        result = self._run(raw)
        assert result.strip() == ''

    def test_no_trailing_backticks_required(self):
        # Some models omit the closing fence; strip only processes the opener
        raw = '```json\n{"key": "val"}'
        result = self._run(raw)
        # After split on ```, second element is 'json\n{"key": "val"}'
        # after lstrip 'json' -> '{"key": "val"}'
        assert '{"key": "val"}' in result

    def test_returns_string(self):
        assert isinstance(self._run('{"x": 1}'), str)


class TestANTHROPIC_MODEL_env:
    def test_default_model_set(self, monkeypatch):
        monkeypatch.delenv('ANTHROPIC_MODEL', raising=False)
        m = _reload_client_module()
        assert m.ANTHROPIC_MODEL == 'claude-opus-5'

    def test_env_override(self, monkeypatch):
        monkeypatch.setenv('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001')
        m = _reload_client_module()
        assert m.ANTHROPIC_MODEL == 'claude-haiku-4-5-20251001'


class TestGetAnthropicClient:
    def test_raises_without_api_key(self, monkeypatch):
        monkeypatch.delenv('ANTHROPIC_API_KEY', raising=False)
        m = _reload_client_module()
        with pytest.raises(RuntimeError, match='ANTHROPIC_API_KEY'):
            m.get_anthropic_client()

    def test_returns_client_with_key(self, monkeypatch):
        monkeypatch.setenv('ANTHROPIC_API_KEY', 'sk-test-key-does-not-matter')
        m = _reload_client_module()
        from anthropic import AsyncAnthropic
        client = m.get_anthropic_client()
        assert isinstance(client, AsyncAnthropic)
