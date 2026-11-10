"""Tests for extract_json_block() and get_anthropic_client() error handling."""
import os
import pytest


def _import():
    from app.core.anthropic_client import extract_json_block, get_anthropic_client
    return extract_json_block, get_anthropic_client


# ── extract_json_block() ───────────────────────────────────────────────────────

class TestExtractJsonBlock:
    def setup_method(self):
        self.fn, _ = _import()

    def test_passthrough_plain_json(self):
        raw = '{"key": "value"}'
        assert self.fn(raw) == '{"key": "value"}'

    def test_strips_backtick_json_fence(self):
        raw = "```json\n{\"key\": \"value\"}\n```"
        result = self.fn(raw)
        assert result == '{"key": "value"}'

    def test_strips_backtick_fence_without_json_label(self):
        raw = "```\n{\"key\": \"value\"}\n```"
        result = self.fn(raw)
        assert result == '{"key": "value"}'

    def test_passthrough_array_json(self):
        raw = '[{"a": 1}, {"b": 2}]'
        assert self.fn(raw) == '[{"a": 1}, {"b": 2}]'

    def test_strips_fence_around_array(self):
        raw = "```json\n[1, 2, 3]\n```"
        result = self.fn(raw)
        assert result == '[1, 2, 3]'

    def test_strips_leading_and_trailing_whitespace(self):
        raw = '  {"k": 1}  '
        assert self.fn(raw) == '{"k": 1}'

    def test_strips_fence_with_leading_whitespace(self):
        raw = '  ```json\n{"k": 1}\n```  '
        result = self.fn(raw)
        assert result == '{"k": 1}'

    def test_empty_string_passthrough(self):
        assert self.fn('') == ''

    def test_nested_json_preserved(self):
        raw = '```json\n{"outer": {"inner": [1, 2]}}\n```'
        result = self.fn(raw)
        assert result == '{"outer": {"inner": [1, 2]}}'

    def test_does_not_strip_mid_text_backticks(self):
        raw = 'Some text `code` more text'
        result = self.fn(raw)
        assert result == 'Some text `code` more text'

    def test_fence_without_closing_ticks_still_strips_opening(self):
        raw = "```json\n{\"key\": \"val\"}"
        result = self.fn(raw)
        # split on ``` gives ['', 'json\n{"key": "val"}'], no closing ``` needed
        assert '{"key": "val"}' in result

    def test_number_passthrough(self):
        assert self.fn('42') == '42'

    def test_null_string_passthrough(self):
        assert self.fn('null') == 'null'


# ── get_anthropic_client() ────────────────────────────────────────────────────

class TestGetAnthropicClient:
    def setup_method(self):
        """Clear lru_cache between tests so env changes take effect."""
        _, get_client = _import()
        get_client.cache_clear()

    def teardown_method(self):
        """Restore ANTHROPIC_API_KEY and clear cache."""
        from app.core.anthropic_client import get_anthropic_client
        get_anthropic_client.cache_clear()
        os.environ.pop("ANTHROPIC_API_KEY", None)

    def test_raises_when_api_key_missing(self):
        os.environ.pop("ANTHROPIC_API_KEY", None)
        _, get_client = _import()
        get_client.cache_clear()
        with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
            get_client()

    def test_returns_client_when_api_key_set(self):
        os.environ["ANTHROPIC_API_KEY"] = "test-key"
        _, get_client = _import()
        get_client.cache_clear()
        client = get_client()
        assert client is not None

    def test_returns_same_instance_on_repeated_calls(self):
        os.environ["ANTHROPIC_API_KEY"] = "test-key"
        _, get_client = _import()
        get_client.cache_clear()
        a = get_client()
        b = get_client()
        assert a is b
