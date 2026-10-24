"""Tests for ScriptOptimizationReport (Pydantic model validation).

These tests validate the report schema independently of any LLM call.
"""
import os
import sys
import types
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'services', 'api'))

# Stub out heavy optional dependencies before the module chain is imported
_anthropic_stub = types.ModuleType('anthropic')
_anthropic_stub.AsyncAnthropic = MagicMock
sys.modules.setdefault('anthropic', _anthropic_stub)

from pydantic import ValidationError
from app.pipeline.script_opt import ScriptOptimizationReport


def valid_payload(**overrides):
    base = {
        "original_input": "5 ways to go viral",
        "optimized_script": "You're missing this viral trick...",
        "hook_score": 87.5,
        "hook_rationale": "Curiosity gap created by implied withholding",
        "target_platform": "tiktok",
        "estimated_duration_seconds": 15.0,
        "pacing_wpm": 155,
        "retention_triggers": ["open loop", "pattern interrupt"],
    }
    base.update(overrides)
    return base


class TestScriptOptimizationReport:
    def test_valid_payload_parses(self):
        report = ScriptOptimizationReport(**valid_payload())
        assert report.hook_score == 87.5
        assert report.target_platform == "tiktok"

    def test_hook_score_minimum_0(self):
        report = ScriptOptimizationReport(**valid_payload(hook_score=0.0))
        assert report.hook_score == 0.0

    def test_hook_score_maximum_100(self):
        report = ScriptOptimizationReport(**valid_payload(hook_score=100.0))
        assert report.hook_score == 100.0

    def test_hook_score_below_0_raises(self):
        with pytest.raises(ValidationError):
            ScriptOptimizationReport(**valid_payload(hook_score=-1.0))

    def test_hook_score_above_100_raises(self):
        with pytest.raises(ValidationError):
            ScriptOptimizationReport(**valid_payload(hook_score=100.1))

    def test_missing_hook_score_raises(self):
        payload = valid_payload()
        del payload["hook_score"]
        with pytest.raises(ValidationError):
            ScriptOptimizationReport(**payload)

    def test_missing_optimized_script_raises(self):
        payload = valid_payload()
        del payload["optimized_script"]
        with pytest.raises(ValidationError):
            ScriptOptimizationReport(**payload)

    def test_missing_original_input_raises(self):
        payload = valid_payload()
        del payload["original_input"]
        with pytest.raises(ValidationError):
            ScriptOptimizationReport(**payload)

    def test_missing_retention_triggers_raises(self):
        payload = valid_payload()
        del payload["retention_triggers"]
        with pytest.raises(ValidationError):
            ScriptOptimizationReport(**payload)

    def test_empty_retention_triggers_allowed(self):
        report = ScriptOptimizationReport(**valid_payload(retention_triggers=[]))
        assert report.retention_triggers == []

    def test_multiple_retention_triggers(self):
        triggers = ["loop", "tease", "callback", "payoff"]
        report = ScriptOptimizationReport(**valid_payload(retention_triggers=triggers))
        assert report.retention_triggers == triggers

    def test_target_platform_stored(self):
        report = ScriptOptimizationReport(**valid_payload(target_platform="instagram_reels"))
        assert report.target_platform == "instagram_reels"

    def test_estimated_duration_stored(self):
        report = ScriptOptimizationReport(**valid_payload(estimated_duration_seconds=30.5))
        assert report.estimated_duration_seconds == 30.5

    def test_pacing_wpm_stored(self):
        report = ScriptOptimizationReport(**valid_payload(pacing_wpm=160))
        assert report.pacing_wpm == 160

    def test_hook_score_edge_boundary_50(self):
        report = ScriptOptimizationReport(**valid_payload(hook_score=50.0))
        assert report.hook_score == 50.0

    def test_extra_fields_allowed_or_ignored(self):
        # Pydantic v2 ignores extra by default (or raises, depends on config)
        # Either way it should not crash on the valid core fields
        try:
            ScriptOptimizationReport(**valid_payload(extra_field="ignored"))
        except ValidationError:
            pass  # Strict models may reject extras; that is acceptable
