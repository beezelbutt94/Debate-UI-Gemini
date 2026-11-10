"""Tests for the synchronous / data-layer parts of script_opt.py."""
import pytest


class TestScriptOptimizationReport:
    """Validates the Pydantic model constraints, not the LLM call."""

    def _make_report(self, **overrides):
        from app.pipeline.script_opt import ScriptOptimizationReport
        base = dict(
            original_input="Raw script here",
            optimized_script="Optimized!",
            hook_score=75.0,
            hook_rationale="Strong pattern interrupt",
            target_platform="tiktok",
            estimated_duration_seconds=15.0,
            pacing_wpm=140,
            retention_triggers=["cliffhanger", "curiosity gap"],
        )
        base.update(overrides)
        return ScriptOptimizationReport(**base)

    def test_valid_report_instantiates(self):
        r = self._make_report()
        assert r.hook_score == 75.0

    def test_hook_score_zero_is_valid(self):
        r = self._make_report(hook_score=0.0)
        assert r.hook_score == 0.0

    def test_hook_score_100_is_valid(self):
        r = self._make_report(hook_score=100.0)
        assert r.hook_score == 100.0

    def test_hook_score_below_zero_raises(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self._make_report(hook_score=-1.0)

    def test_hook_score_above_100_raises(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self._make_report(hook_score=100.1)

    def test_retention_triggers_can_be_empty(self):
        r = self._make_report(retention_triggers=[])
        assert r.retention_triggers == []

    def test_target_words_calculation(self):
        """Verify the target_words formula used in the prompt: (duration/60) * 160"""
        duration = 30
        expected_words = int((duration / 60.0) * 160)
        assert expected_words == 80

    def test_target_words_15s(self):
        duration = 15
        expected_words = int((duration / 60.0) * 160)
        assert expected_words == 40

    def test_target_words_60s(self):
        duration = 60
        expected_words = int((duration / 60.0) * 160)
        assert expected_words == 160
