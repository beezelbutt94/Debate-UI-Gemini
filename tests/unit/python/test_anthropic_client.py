"""Tests for services/api/app/core/anthropic_client.extract_json_block()"""
import sys
import os

# Make the services/api tree importable without installing as a package.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'services', 'api'))

import pytest
from app.core.anthropic_client import extract_json_block


class TestExtractJsonBlock:
    # ---- no fence (plain JSON) -----------------------------------------------
    def test_plain_json_unchanged(self):
        raw = '{"key": "value"}'
        assert extract_json_block(raw) == raw

    def test_plain_json_array(self):
        raw = '[1, 2, 3]'
        assert extract_json_block(raw) == raw

    def test_plain_whitespace_stripped(self):
        raw = '  {"key": 1}  '
        assert extract_json_block(raw) == '{"key": 1}'

    # ---- ```json fenced block --------------------------------------------------
    def test_json_fenced_block(self):
        raw = '```json\n{"key": "value"}\n```'
        assert extract_json_block(raw) == '{"key": "value"}'

    def test_json_fenced_block_with_leading_trailing_whitespace(self):
        raw = '```json\n  {"a": 1}  \n```'
        assert extract_json_block(raw) == '{"a": 1}'

    def test_json_fenced_block_array(self):
        raw = '```json\n[{"id": 1}, {"id": 2}]\n```'
        assert extract_json_block(raw) == '[{"id": 1}, {"id": 2}]'

    # ---- ``` fenced block without "json" label ---------------------------------
    def test_plain_fenced_block(self):
        raw = '```\n{"plain": true}\n```'
        assert extract_json_block(raw) == '{"plain": true}'

    def test_plain_fenced_no_newline(self):
        raw = '```{"key": "val"}```'
        assert extract_json_block(raw) == '{"key": "val"}'

    # ---- multiline JSON --------------------------------------------------------
    def test_multiline_json_fenced(self):
        raw = '```json\n{\n  "a": 1,\n  "b": 2\n}\n```'
        result = extract_json_block(raw)
        assert '"a": 1' in result
        assert '"b": 2' in result

    # ---- no-op for already-clean outputs --------------------------------------
    def test_empty_string(self):
        assert extract_json_block('') == ''

    def test_whitespace_only(self):
        assert extract_json_block('   ') == ''

    def test_single_brace(self):
        assert extract_json_block('{') == '{'

    # ---- model wraps with commentary before the fence -------------------------
    def test_json_block_with_preamble_not_handled(self):
        # extract_json_block only checks if the text *starts* with ``` --
        # preambles are left to the caller to strip; validate that contract.
        raw = 'Here is the JSON:\n```json\n{"x": 1}\n```'
        # The function will NOT strip the fence here -- verify it doesn't crash
        result = extract_json_block(raw)
        assert isinstance(result, str)

    # ---- large realistic payload -----------------------------------------------
    def test_realistic_competitor_json(self):
        payload = (
            '{"handle": "@creator", "platform": "tiktok", '
            '"sampleSize": 40, "avgViews": 85000, "engagementRate": 0.034, '
            '"hookBreakdown": [{"name": "Contrarian Thesis", "frequency": 0.45}], '
            '"contentGaps": ["gap1", "gap2", "gap3"]}'
        )
        raw = f'```json\n{payload}\n```'
        assert extract_json_block(raw) == payload

    # ---- determinism -----------------------------------------------------------
    def test_deterministic(self):
        raw = '```json\n{"stable": true}\n```'
        assert extract_json_block(raw) == extract_json_block(raw)
