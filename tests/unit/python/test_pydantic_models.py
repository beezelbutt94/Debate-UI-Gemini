"""Tests for Pydantic model validation on ScriptOptimizationReport,
StoryboardScene, and ExtractedClipCandidate."""
import sys
import os
import pytest
from unittest.mock import MagicMock

# Stub heavy optional imports before the modules are loaded
sys.modules.setdefault('anthropic', MagicMock())
for mod in ('faster_whisper', 'torch', 'open_clip', 'cv2', 'mediapipe', 'numpy'):
    sys.modules.setdefault(mod, MagicMock())

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'services', 'api'))

from pydantic import ValidationError
from app.pipeline.script_opt import ScriptOptimizationReport
from app.pipeline.storyboard import StoryboardScene
from app.pipeline.repurpose import ExtractedClipCandidate


# ─── ScriptOptimizationReport ─────────────────────────────────────────────────

class TestScriptOptimizationReport:
    def _valid(self, **overrides):
        defaults = dict(
            original_input='Raw script text',
            optimized_script='Stop scrolling — this changed my life.',
            hook_score=82.5,
            hook_rationale='Strong curiosity gap',
            target_platform='tiktok',
            estimated_duration_seconds=15.0,
            pacing_wpm=160,
            retention_triggers=['pattern interrupt', 'cliffhanger'],
        )
        defaults.update(overrides)
        return ScriptOptimizationReport(**defaults)

    def test_valid_model_instantiates(self):
        m = self._valid()
        assert m.hook_score == 82.5

    def test_hook_score_zero_is_valid(self):
        m = self._valid(hook_score=0.0)
        assert m.hook_score == 0.0

    def test_hook_score_100_is_valid(self):
        m = self._valid(hook_score=100.0)
        assert m.hook_score == 100.0

    def test_hook_score_below_zero_raises(self):
        with pytest.raises(ValidationError):
            self._valid(hook_score=-0.1)

    def test_hook_score_above_100_raises(self):
        with pytest.raises(ValidationError):
            self._valid(hook_score=100.1)

    def test_retention_triggers_can_be_empty(self):
        m = self._valid(retention_triggers=[])
        assert m.retention_triggers == []

    def test_original_input_is_stored(self):
        m = self._valid(original_input='my raw text')
        assert m.original_input == 'my raw text'

    def test_pacing_wpm_is_integer(self):
        m = self._valid(pacing_wpm=140)
        assert isinstance(m.pacing_wpm, int)
        assert m.pacing_wpm == 140


# ─── StoryboardScene ──────────────────────────────────────────────────────────

class TestStoryboardScene:
    def _valid(self, **overrides):
        defaults = dict(
            scene_num=1,
            duration_seconds=3.0,
            voiceover='Here is what 90% of people get wrong.',
            visual_direction='Wide shot of a modern kitchen at dawn',
            camera_motion='zoom_in',
            vibe='energetic',
        )
        defaults.update(overrides)
        return StoryboardScene(**defaults)

    def test_valid_scene(self):
        s = self._valid()
        assert s.scene_num == 1

    def test_duration_above_max_raises(self):
        with pytest.raises(ValidationError):
            self._valid(duration_seconds=10.1)

    def test_duration_at_max_is_valid(self):
        s = self._valid(duration_seconds=10.0)
        assert s.duration_seconds == 10.0

    def test_duration_below_min_raises(self):
        with pytest.raises(ValidationError):
            self._valid(duration_seconds=0.5)

    def test_duration_just_above_min_is_valid(self):
        s = self._valid(duration_seconds=0.51)
        assert s.duration_seconds == 0.51

    def test_text_overlay_defaults_to_none(self):
        s = self._valid()
        assert s.text_overlay is None

    def test_text_overlay_can_be_set(self):
        s = self._valid(text_overlay='Follow for more')
        assert s.text_overlay == 'Follow for more'

    def test_camera_motion_field_stored(self):
        for motion in ('zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'static'):
            s = self._valid(camera_motion=motion)
            assert s.camera_motion == motion

    def test_vibe_field_stored(self):
        s = self._valid(vibe='calm')
        assert s.vibe == 'calm'


# ─── ExtractedClipCandidate ───────────────────────────────────────────────────

class TestExtractedClipCandidate:
    def _valid(self, **overrides):
        defaults = dict(
            clip_id='clip-001',
            start_second=10.5,
            end_second=42.0,
            duration=31.5,
            hook_text='Stop scrolling — this will surprise you.',
            virality_rationale='High curiosity gap, contrarian thesis',
            confidence_score=0.87,
        )
        defaults.update(overrides)
        return ExtractedClipCandidate(**defaults)

    def test_valid_candidate_instantiates(self):
        c = self._valid()
        assert c.clip_id == 'clip-001'

    def test_confidence_score_zero_is_valid(self):
        c = self._valid(confidence_score=0.0)
        assert c.confidence_score == 0.0

    def test_confidence_score_one_is_valid(self):
        c = self._valid(confidence_score=1.0)
        assert c.confidence_score == 1.0

    def test_confidence_score_above_one_raises(self):
        with pytest.raises(ValidationError):
            self._valid(confidence_score=1.001)

    def test_confidence_score_below_zero_raises(self):
        with pytest.raises(ValidationError):
            self._valid(confidence_score=-0.001)

    def test_start_and_end_stored(self):
        c = self._valid(start_second=5.0, end_second=35.0)
        assert c.start_second == 5.0
        assert c.end_second == 35.0

    def test_hook_text_stored(self):
        c = self._valid(hook_text='Shocking truth revealed.')
        assert c.hook_text == 'Shocking truth revealed.'

    def test_virality_rationale_stored(self):
        c = self._valid(virality_rationale='Emotion spike at second 3')
        assert c.virality_rationale == 'Emotion spike at second 3'

    def test_duration_field_stored(self):
        c = self._valid(duration=25.5)
        assert c.duration == 25.5
