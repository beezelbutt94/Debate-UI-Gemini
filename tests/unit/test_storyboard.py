"""Tests for StoryboardScene Pydantic model validation (pure, no AI calls)."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

import pytest


class TestStoryboardScene:
    @pytest.fixture(autouse=True)
    def setup(self):
        from app.pipeline.storyboard import StoryboardScene
        self.Scene = StoryboardScene

    def _valid(self, **overrides):
        defaults = dict(
            scene_num=1,
            duration_seconds=3.0,
            voiceover='This is wild',
            visual_direction='Close-up of shocked face',
            camera_motion='zoom_in',
            vibe='energetic',
        )
        defaults.update(overrides)
        return self.Scene(**defaults)

    def test_valid_scene_constructs(self):
        s = self._valid()
        assert s.scene_num == 1
        assert s.duration_seconds == 3.0

    def test_text_overlay_is_optional(self):
        s = self._valid(text_overlay=None)
        assert s.text_overlay is None

    def test_text_overlay_accepts_string(self):
        s = self._valid(text_overlay='Caption here')
        assert s.text_overlay == 'Caption here'

    def test_duration_above_max_raises(self):
        with pytest.raises(Exception):
            self._valid(duration_seconds=11.0)

    def test_duration_at_max_is_valid(self):
        s = self._valid(duration_seconds=10.0)
        assert s.duration_seconds == 10.0

    def test_duration_at_min_boundary_is_valid(self):
        # gt=0.5 means strictly greater than 0.5
        s = self._valid(duration_seconds=0.6)
        assert s.duration_seconds == 0.6

    def test_duration_at_or_below_min_raises(self):
        with pytest.raises(Exception):
            self._valid(duration_seconds=0.5)  # not strictly > 0.5

    def test_duration_zero_raises(self):
        with pytest.raises(Exception):
            self._valid(duration_seconds=0.0)

    def test_negative_duration_raises(self):
        with pytest.raises(Exception):
            self._valid(duration_seconds=-1.0)

    def test_camera_motion_field_stored_verbatim(self):
        for motion in ('zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'static'):
            s = self._valid(camera_motion=motion)
            assert s.camera_motion == motion

    def test_scene_num_stored_correctly(self):
        s = self._valid(scene_num=42)
        assert s.scene_num == 42
