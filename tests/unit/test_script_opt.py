"""Tests for ScriptOptimizationReport Pydantic model validation."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

import pytest


class TestScriptOptimizationReport:
    @pytest.fixture(autouse=True)
    def setup(self):
        from app.pipeline.script_opt import ScriptOptimizationReport
        self.Model = ScriptOptimizationReport

    def _valid(self, **overrides):
        defaults = dict(
            original_input='Raw idea here',
            optimized_script='This will SHOCK you',
            hook_score=85.0,
            hook_rationale='Strong curiosity gap',
            target_platform='tiktok',
            estimated_duration_seconds=15.0,
            pacing_wpm=160,
            retention_triggers=['pattern interrupt', 'cliffhanger'],
        )
        defaults.update(overrides)
        return self.Model(**defaults)

    def test_valid_model_constructs(self):
        m = self._valid()
        assert m.hook_score == 85.0

    def test_hook_score_zero_is_valid(self):
        m = self._valid(hook_score=0.0)
        assert m.hook_score == 0.0

    def test_hook_score_hundred_is_valid(self):
        m = self._valid(hook_score=100.0)
        assert m.hook_score == 100.0

    def test_hook_score_below_zero_raises(self):
        with pytest.raises(Exception):
            self._valid(hook_score=-1.0)

    def test_hook_score_above_hundred_raises(self):
        with pytest.raises(Exception):
            self._valid(hook_score=101.0)

    def test_retention_triggers_list_stored(self):
        m = self._valid(retention_triggers=['a', 'b', 'c'])
        assert m.retention_triggers == ['a', 'b', 'c']

    def test_empty_retention_triggers_accepted(self):
        m = self._valid(retention_triggers=[])
        assert m.retention_triggers == []

    def test_platform_stored_verbatim(self):
        for plat in ('tiktok', 'instagram_reels', 'youtube_shorts'):
            m = self._valid(target_platform=plat)
            assert m.target_platform == plat

    def test_pacing_wpm_integer(self):
        m = self._valid(pacing_wpm=180)
        assert m.pacing_wpm == 180
