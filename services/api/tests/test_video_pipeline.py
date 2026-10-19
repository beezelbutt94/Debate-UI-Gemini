"""Unit tests for the FFmpeg pipeline's pure helper methods.

VideoProcessingPipeline.__init__ checks for the ffmpeg binary, so we patch
shutil.which() to avoid requiring a real ffmpeg installation.  The methods
under test (_overlay_coordinates, build_command) are exercised at the
Python level only -- no subprocess is spawned.
"""
import sys
import os
from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True, scope="module")
def _fake_ffmpeg():
    """Make shutil.which('ffmpeg') return a truthy path for the whole module."""
    with patch("shutil.which", return_value="/usr/bin/ffmpeg"):
        yield


def _make_pipeline():
    # Import inside the fixture scope so the patch is active
    from services.api.app.pipeline.video_pipeline import VideoProcessingPipeline
    return VideoProcessingPipeline()


class TestOverlayCoordinates:
    def test_top_left(self):
        p = _make_pipeline()
        assert p._overlay_coordinates("top_left") == "24:24"

    def test_top_right(self):
        p = _make_pipeline()
        assert p._overlay_coordinates("top_right") == "main_w-overlay_w-24:24"

    def test_bottom_left(self):
        p = _make_pipeline()
        assert p._overlay_coordinates("bottom_left") == "24:main_h-overlay_h-24"

    def test_bottom_right(self):
        p = _make_pipeline()
        assert p._overlay_coordinates("bottom_right") == "main_w-overlay_w-24:main_h-overlay_h-24"

    def test_center(self):
        p = _make_pipeline()
        assert p._overlay_coordinates("center") == "(main_w-overlay_w)/2:(main_h-overlay_h)/2"

    def test_unknown_position_defaults_to_bottom_right(self):
        p = _make_pipeline()
        assert p._overlay_coordinates("invalid_pos") == p._overlay_coordinates("bottom_right")

    def test_custom_padding(self):
        p = _make_pipeline()
        assert p._overlay_coordinates("top_left", padding=10) == "10:10"
        assert p._overlay_coordinates("bottom_right", padding=0) == "main_w-overlay_w-0:main_h-overlay_h-0"


class TestBuildCommand:
    def test_returns_a_list_starting_with_ffmpeg(self):
        p = _make_pipeline()
        cmd = p.build_command("/in.mp4", "/out.mp4")
        assert isinstance(cmd, list)
        assert cmd[0] == "ffmpeg"

    def test_includes_input_and_output_paths(self):
        p = _make_pipeline()
        cmd = p.build_command("/input/video.mp4", "/output/result.mp4")
        assert "/input/video.mp4" in cmd
        assert "/output/result.mp4" in cmd

    def test_default_tier_is_standard(self):
        p = _make_pipeline()
        cmd = p.build_command("/in.mp4", "/out.mp4")
        # standard tier uses libx264
        assert "libx264" in cmd

    def test_draft_tier_uses_ultrafast_preset(self):
        p = _make_pipeline()
        cmd = p.build_command("/in.mp4", "/out.mp4", tier="draft")
        assert "ultrafast" in cmd

    def test_premium_tier_uses_libx265(self):
        p = _make_pipeline()
        cmd = p.build_command("/in.mp4", "/out.mp4", tier="premium")
        assert "libx265" in cmd

    def test_unknown_tier_falls_back_to_standard(self):
        p = _make_pipeline()
        cmd_unknown = p.build_command("/in.mp4", "/out.mp4", tier="nonexistent")
        cmd_std = p.build_command("/in.mp4", "/out.mp4", tier="standard")
        # Both should use libx264 (standard preset)
        assert "libx264" in cmd_unknown
        assert cmd_unknown.count("libx264") == cmd_std.count("libx264")

    def test_overwrite_flag_is_present(self):
        p = _make_pipeline()
        cmd = p.build_command("/in.mp4", "/out.mp4")
        assert "-y" in cmd

    def test_no_brand_no_extra_inputs(self):
        p = _make_pipeline()
        cmd = p.build_command("/in.mp4", "/out.mp4")
        # Only one -i flag (the main input)
        assert cmd.count("-i") == 1

    def test_brand_logo_that_does_not_exist_is_skipped(self, tmp_path):
        from services.api.app.pipeline.video_pipeline import BrandOverlayOptions
        p = _make_pipeline()
        brand = BrandOverlayOptions(logo_path="/nonexistent/logo.png")
        cmd = p.build_command("/in.mp4", "/out.mp4", brand=brand)
        # Logo doesn't exist on disk → not added as extra input
        assert cmd.count("-i") == 1

    def test_brand_logo_that_exists_adds_extra_input(self, tmp_path):
        from services.api.app.pipeline.video_pipeline import BrandOverlayOptions
        logo = tmp_path / "logo.png"
        logo.write_bytes(b"fake")
        p = _make_pipeline()
        brand = BrandOverlayOptions(logo_path=str(logo))
        cmd = p.build_command("/in.mp4", "/out.mp4", brand=brand)
        assert cmd.count("-i") == 2
        assert str(logo) in cmd

    def test_filter_complex_flag_present(self):
        p = _make_pipeline()
        cmd = p.build_command("/in.mp4", "/out.mp4")
        assert "-filter_complex" in cmd

    def test_faststart_movflag_present(self):
        p = _make_pipeline()
        cmd = p.build_command("/in.mp4", "/out.mp4")
        assert "+faststart" in cmd
