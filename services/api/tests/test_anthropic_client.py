"""Tests for app.core.anthropic_client – extract_json_block and
get_anthropic_client (the one function that does not need a live Anthropic key).
"""
import os
import importlib
import sys

import pytest


# ---------------------------------------------------------------------------
# extract_json_block
# ---------------------------------------------------------------------------

def _import_extract():
    """Import extract_json_block without triggering an Anthropic API call."""
    # Ensure the services/api directory is on the path
    api_root = os.path.join(os.path.dirname(__file__), "..")
    if api_root not in sys.path:
        sys.path.insert(0, api_root)
    from app.core.anthropic_client import extract_json_block
    return extract_json_block


class TestExtractJsonBlock:
    def setup_method(self):
        self.fn = _import_extract()

    def test_plain_json_unchanged(self):
        raw = '{"key": "value"}'
        assert self.fn(raw) == '{"key": "value"}'

    def test_strips_backtick_json_fence(self):
        raw = "```json\n{\"a\": 1}\n```"
        result = self.fn(raw)
        assert result == '{"a": 1}'

    def test_strips_generic_backtick_fence(self):
        raw = "```\n{\"b\": 2}\n```"
        result = self.fn(raw)
        assert result == '{"b": 2}'

    def test_strips_leading_trailing_whitespace(self):
        raw = "  \n  {\"c\": 3}  \n  "
        result = self.fn(raw)
        assert result == '{"c": 3}'

    def test_json_array_unchanged(self):
        raw = '[1, 2, 3]'
        assert self.fn(raw) == '[1, 2, 3]'

    def test_json_array_in_fence(self):
        raw = "```json\n[{\"x\": 1}]\n```"
        result = self.fn(raw)
        assert result == '[{"x": 1}]'

    def test_empty_fence_body(self):
        raw = "```json\n\n```"
        result = self.fn(raw)
        assert result == ""

    def test_nested_json_in_fence(self):
        raw = '```json\n{"nested": {"a": [1,2,3]}}\n```'
        result = self.fn(raw)
        assert result == '{"nested": {"a": [1,2,3]}}'

    def test_no_fence_multiline(self):
        raw = '{\n  "key": "value"\n}'
        result = self.fn(raw)
        assert result == '{\n  "key": "value"\n}'

    def test_non_json_content_passthrough(self):
        raw = "just some text"
        assert self.fn(raw) == "just some text"


# ---------------------------------------------------------------------------
# get_anthropic_client – error path (no ANTHROPIC_API_KEY)
# ---------------------------------------------------------------------------

class TestGetAnthropicClient:
    def test_raises_runtime_error_when_key_missing(self, monkeypatch):
        # Ensure ANTHROPIC_API_KEY is absent
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

        api_root = os.path.join(os.path.dirname(__file__), "..")
        if api_root not in sys.path:
            sys.path.insert(0, api_root)

        # Must re-import (lru_cache may have a cached result from a prior key)
        import importlib
        import app.core.anthropic_client as mod
        importlib.reload(mod)

        with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
            mod.get_anthropic_client()

    def test_returns_async_anthropic_when_key_present(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-key-0000000000000000000000000")

        import importlib
        import app.core.anthropic_client as mod
        importlib.reload(mod)

        from anthropic import AsyncAnthropic
        client = mod.get_anthropic_client()
        assert isinstance(client, AsyncAnthropic)
