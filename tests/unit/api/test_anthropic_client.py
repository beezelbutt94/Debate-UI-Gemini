"""Tests for extract_json_block in services/api/app/core/anthropic_client.py.

The module imports `anthropic` at the top level. We mock it so we can load
the module without the SDK being installed.
"""
import sys
import types
from unittest.mock import MagicMock

import pytest

# ── mock `anthropic` before loading the module ──────────────────────────────

sys.modules.setdefault("anthropic", MagicMock())

import importlib.util
import os

_AC_PATH = os.path.join(
    os.path.dirname(__file__),
    "../../../services/api/app/core/anthropic_client.py",
)

_spec = importlib.util.spec_from_file_location("anthropic_client", os.path.abspath(_AC_PATH))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

extract_json_block = _mod.extract_json_block
ANTHROPIC_MODEL = _mod.ANTHROPIC_MODEL


# ── extract_json_block ───────────────────────────────────────────────────────

class TestExtractJsonBlock:
    def test_plain_json_passes_through_unchanged(self):
        raw = '{"key": "value"}'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_strips_json_fenced_code_block(self):
        raw = "```json\n{\"key\": \"value\"}\n```"
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_strips_generic_fenced_code_block(self):
        raw = "```\n{\"key\": \"value\"}\n```"
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_strips_leading_trailing_whitespace(self):
        raw = "   {\"key\": \"value\"}   "
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_strips_whitespace_inside_fenced_block(self):
        raw = "```json\n  [1, 2, 3]  \n```"
        assert extract_json_block(raw) == "[1, 2, 3]"

    def test_returns_empty_array_unchanged(self):
        assert extract_json_block("[]") == "[]"

    def test_returns_empty_object_unchanged(self):
        assert extract_json_block("{}") == "{}"

    def test_handles_multiline_json_inside_fence(self):
        raw = '```json\n[\n  {"a": 1},\n  {"b": 2}\n]\n```'
        result = extract_json_block(raw)
        assert result.strip().startswith("[")
        assert '"a"' in result
        assert '"b"' in result

    def test_handles_fenced_block_with_no_language_tag(self):
        raw = "```\n[1, 2, 3]\n```"
        result = extract_json_block(raw)
        assert "[1, 2, 3]" in result

    def test_returns_string(self):
        assert isinstance(extract_json_block('{"x": 1}'), str)

    def test_does_not_strip_non_fence_backticks(self):
        # If the raw string does not start with ```, it passes through.
        raw = 'no fences here: `inline code`'
        result = extract_json_block(raw)
        assert "no fences here" in result


# ── ANTHROPIC_MODEL ──────────────────────────────────────────────────────────

class TestAnthropicModel:
    def test_model_is_set(self):
        assert ANTHROPIC_MODEL is not None

    def test_model_is_a_string(self):
        assert isinstance(ANTHROPIC_MODEL, str)

    def test_model_is_non_empty(self):
        assert len(ANTHROPIC_MODEL) > 0

    def test_model_name_looks_like_claude(self):
        # All Claude models contain 'claude' in lowercase.
        assert "claude" in ANTHROPIC_MODEL.lower()
