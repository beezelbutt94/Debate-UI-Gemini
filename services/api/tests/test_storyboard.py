"""Tests for StoryboardScene Pydantic model constraints."""
import pytest


class TestStoryboardScene:
    def _make_scene(self, **overrides):
        from app.pipeline.storyboard import StoryboardScene
        base = dict(
            scene_num=1,
            duration_seconds=3.0,
            voiceover="Stop scrolling.",
            visual_direction="Close-up of face reacting with shock",
            camera_motion="zoom_in",
            text_overlay=None,
            vibe="energetic",
        )
        base.update(overrides)
        return StoryboardScene(**base)

    def test_valid_scene_instantiates(self):
        s = self._make_scene()
        assert s.scene_num == 1

    def test_duration_above_half_second_is_valid(self):
        s = self._make_scene(duration_seconds=0.6)
        assert s.duration_seconds == 0.6

    def test_duration_exactly_half_second_raises(self):
        """Field constraint is > 0.5, so 0.5 is not allowed."""
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self._make_scene(duration_seconds=0.5)

    def test_duration_below_half_second_raises(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self._make_scene(duration_seconds=0.1)

    def test_duration_exactly_10s_is_valid(self):
        s = self._make_scene(duration_seconds=10.0)
        assert s.duration_seconds == 10.0

    def test_duration_above_10s_raises(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self._make_scene(duration_seconds=10.1)

    def test_text_overlay_can_be_none(self):
        s = self._make_scene(text_overlay=None)
        assert s.text_overlay is None

    def test_text_overlay_can_be_string(self):
        s = self._make_scene(text_overlay="Caption here")
        assert s.text_overlay == "Caption here"

    def test_camera_motion_accepts_zoom_in(self):
        s = self._make_scene(camera_motion="zoom_in")
        assert s.camera_motion == "zoom_in"

    def test_camera_motion_accepts_zoom_out(self):
        s = self._make_scene(camera_motion="zoom_out")
        assert s.camera_motion == "zoom_out"

    def test_camera_motion_accepts_pan_left(self):
        s = self._make_scene(camera_motion="pan_left")
        assert s.camera_motion == "pan_left"

    def test_camera_motion_accepts_pan_right(self):
        s = self._make_scene(camera_motion="pan_right")
        assert s.camera_motion == "pan_right"

    def test_camera_motion_accepts_static(self):
        s = self._make_scene(camera_motion="static")
        assert s.camera_motion == "static"

    def test_duration_typical_range(self):
        for d in [2.0, 2.5, 3.0, 3.5, 4.0]:
            s = self._make_scene(duration_seconds=d)
            assert s.duration_seconds == d
