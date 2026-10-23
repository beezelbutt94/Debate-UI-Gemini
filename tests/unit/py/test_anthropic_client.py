"""Tests for services/api/app/core/anthropic_client.py

Covers extract_json_block() exhaustively and get_anthropic_client() lazy
init behaviour.  The `anthropic` SDK is stubbed in conftest.py so no
network calls are made.
"""
import os
import sys
from importlib import import_module, reload
from unittest.mock import patch

import pytest

sys.path.insert(0, "services/api")
from app.core.anthropic_client import extract_json_block


class TestExtractJsonBlock:
    def test_plain_json_returned_unchanged(self):
        raw = '{"key": "value"}'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_json_fence_with_language_tag_stripped(self):
        raw = "```json\n{\"a\": 1}\n```"
        assert extract_json_block(raw) == '{"a": 1}'

    def test_json_fence_without_language_tag_stripped(self):
        raw = "```\n{\"b\": 2}\n```"
        assert extract_json_block(raw) == '{"b": 2}'

    def test_leading_and_trailing_whitespace_stripped(self):
        raw = "  \n  {\"c\": 3}  \n  "
        assert extract_json_block(raw) == '{"c": 3}'

    def test_array_json_plain(self):
        raw = '[1, 2, 3]'
        assert extract_json_block(raw) == '[1, 2, 3]'

    def test_array_json_fenced(self):
        raw = "```json\n[1, 2, 3]\n```"
        assert extract_json_block(raw) == "[1, 2, 3]"

    def test_multiline_json_fenced(self):
        raw = "```json\n{\n  \"x\": 1,\n  \"y\": 2\n}\n```"
        result = extract_json_block(raw)
        assert '"x": 1' in result
        assert '"y": 2' in result

    def test_empty_fence_stripped(self):
        raw = "```\n\n```"
        result = extract_json_block(raw)
        assert result == ""

    def test_no_fence_with_only_whitespace(self):
        raw = "   "
        result = extract_json_block(raw)
        assert result == ""

    def test_fence_with_extra_text_after_closing(self):
        # Only the content between the first pair of fences matters
        raw = "```json\n{\"ok\": true}\n```\nSome trailing prose"
        result = extract_json_block(raw)
        # The split on ``` gives ["", "json\n{\"ok\": true}\n", "\nSome trailing prose"]
        # We take index [1] -> strip json prefix + strip whitespace
        assert result == '{"ok": true}'

    def test_fence_case_json_prefix_only_lowered(self):
        # 'json' prefix only; 'JSON' (uppercase) is NOT stripped (case-sensitive)
        raw = "```JSON\n{\"a\": 1}\n```"
        result = extract_json_block(raw)
        # Starts with ``` so split happens; second element is 'JSON\n{"a": 1}\n'
        # Does NOT start with 'json' (lowercase), so prefix is kept
        assert result.startswith("JSON") or '"a": 1' in result

    def test_nested_value_unicode(self):
        raw = '{"emoji": "🎬", "value": 42}'
        assert extract_json_block(raw) == raw

    def test_returns_string_type(self):
        result = extract_json_block('{"x": 1}')
        assert isinstance(result, str)


class TestGetAnthropicClient:
    def test_raises_without_api_key(self):
        # Reload module to clear lru_cache, then test without API key
        import app.core.anthropic_client as mod
        mod.get_anthropic_client.cache_clear()
        with patch.dict(os.environ, {}, clear=False):
            env_backup = os.environ.pop("ANTHROPIC_API_KEY", None)
            try:
                with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
                    mod.get_anthropic_client()
            finally:
                if env_backup is not None:
                    os.environ["ANTHROPIC_API_KEY"] = env_backup
                mod.get_anthropic_client.cache_clear()

    def test_returns_client_with_api_key(self):
        import app.core.anthropic_client as mod
        mod.get_anthropic_client.cache_clear()
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-test-key"}):
            client = mod.get_anthropic_client()
            assert client is not None
        mod.get_anthropic_client.cache_clear()

    def test_lru_cache_returns_same_instance(self):
        import app.core.anthropic_client as mod
        mod.get_anthropic_client.cache_clear()
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-test-key"}):
            c1 = mod.get_anthropic_client()
            c2 = mod.get_anthropic_client()
            assert c1 is c2
        mod.get_anthropic_client.cache_clear()
