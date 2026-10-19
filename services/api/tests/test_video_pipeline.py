"""Tests for app.pipeline.video_pipeline – pure logic, no FFmpeg or filesystem."""
import os
import shutil
import pytest
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Import the module under test
# ---------------------------------------------------------------------------
from app.pipeline.video_pipeline import (
    QUALITY_TIER_SPECS,
    BrandOverlayOptions,
    QualityTierConfig,
    VideoProcessingPipeline,
)


# ---------------------------------------------------------------------------
# QUALITY_TIER_SPECS data-integrity checks
# ---------------------------------------------------------------------------
class TestQualityTierSpecs:
    def test_all_three_tiers_present(self):
        assert set(QUALITY_TIER_SPECS.keys()) == {"draft", "standard", "premium"}

    def test_draft_resolution(self):
        assert QUALITY_TIER_SPECS["draft"].width == 1280
        assert QUALITY_TIER_SPECS["draft"].height == 720

    def test_standard_resolution(self):
        assert QUALITY_TIER_SPECS["standard"].width == 1920
        assert QUALITY_TIER_SPECS["standard"].height == 1080

    def test_premium_resolution(self):
        assert QUALITY_TIER_SPECS["premium"].width == 2560
        assert QUALITY_TIER_SPECS["premium"].height == 1440

    def test_premium_uses_h265(self):
        assert QUALITY_TIER_SPECS["premium"].vcodec == "libx265"

    def test_draft_and_standard_use_h264(self):
        assert QUALITY_TIER_SPECS["draft"].vcodec == "libx264"
        assert QUALITY_TIER_SPECS["standard"].vcodec == "libx264"

    def test_fps_values(self):
        assert QUALITY_TIER_SPECS["draft"].fps == 24
        assert QUALITY_TIER_SPECS["standard"].fps == 30
        assert QUALITY_TIER_SPECS["premium"].fps == 60

    def test_crf_ordering(self):
        # Higher quality means lower CRF
        assert QUALITY_TIER_SPECS["premium"].crf < QUALITY_TIER_SPECS["standard"].crf
        assert QUALITY_TIER_SPECS["standard"].crf < QUALITY_TIER_SPECS["draft"].crf


# ---------------------------------------------------------------------------
# _overlay_coordinates
# ---------------------------------------------------------------------------
class TestOverlayCoordinates:
    """Tests for the static helper that maps position name -> FFmpeg coords."""

    def _coords(self, position: str, padding: int = 24) -> str:
        return VideoProcessingPipeline._overlay_coordinates(position, padding)

    def test_top_left(self):
        assert self._coords("top_left") == "24:24"

    def test_top_right(self):
        assert self._coords("top_right") == "main_w-overlay_w-24:24"

    def test_bottom_left(self):
        assert self._coords("bottom_left") == "24:main_h-overlay_h-24"

    def test_bottom_right(self):
        assert self._coords("bottom_right") == "main_w-overlay_w-24:main_h-overlay_h-24"

    def test_center(self):
        assert self._coords("center") == "(main_w-overlay_w)/2:(main_h-overlay_h)/2"

    def test_unknown_position_falls_back_to_bottom_right(self):
        assert self._coords("middle") == self._coords("bottom_right")

    def test_custom_padding_top_left(self):
        assert self._coords("top_left", padding=10) == "10:10"

    def test_custom_padding_bottom_right(self):
        assert self._coords("bottom_right", padding=0) == "main_w-overlay_w-0:main_h-overlay_h-0"


# ---------------------------------------------------------------------------
# VideoProcessingPipeline.__init__
# ---------------------------------------------------------------------------
class TestPipelineInit:
    def test_raises_when_ffmpeg_not_found(self):
        with patch("shutil.which", return_value=None):
            with pytest.raises(EnvironmentError, match="FFmpeg binary not found"):
                VideoProcessingPipeline(ffmpeg_bin="nonexistent_ffmpeg")

    def test_succeeds_when_ffmpeg_found(self):
        with patch("shutil.which", return_value="/usr/bin/ffmpeg"):
            pipeline = VideoProcessingPipeline(ffmpeg_bin="ffmpeg")
            assert pipeline.ffmpeg_bin == "ffmpeg"


# ---------------------------------------------------------------------------
# build_command – no brand overlay
# ---------------------------------------------------------------------------
class TestBuildCommandNoBrand:
    @pytest.fixture(autouse=True)
    def pipeline(self):
        with patch("shutil.which", return_value="/usr/bin/ffmpeg"):
            self.p = VideoProcessingPipeline()

    def test_command_starts_with_ffmpeg_and_y(self):
        cmd = self.p.build_command("in.mp4", "out.mp4", tier="standard")
        assert cmd[:3] == ["ffmpeg", "-y", "-i"]

    def test_input_video_in_command(self):
        cmd = self.p.build_command("in.mp4", "out.mp4", tier="standard")
        assert "in.mp4" in cmd

    def test_output_video_at_end(self):
        cmd = self.p.build_command("in.mp4", "out.mp4", tier="standard")
        assert cmd[-1] == "out.mp4"

    def test_standard_codec(self):
        cmd = self.p.build_command("in.mp4", "out.mp4", tier="standard")
        idx = cmd.index("-c:v")
        assert cmd[idx + 1] == "libx264"

    def test_premium_codec(self):
        cmd = self.p.build_command("in.mp4", "out.mp4", tier="premium")
        idx = cmd.index("-c:v")
        assert cmd[idx + 1] == "libx265"

    def test_draft_tier_uses_ultrafast_preset(self):
        cmd = self.p.build_command("in.mp4", "out.mp4", tier="draft")
        idx = cmd.index("-preset")
        assert cmd[idx + 1] == "ultrafast"

    def test_unknown_tier_falls_back_to_standard(self):
        cmd_unknown = self.p.build_command("in.mp4", "out.mp4", tier="nonexistent")
        cmd_standard = self.p.build_command("in.mp4", "out.mp4", tier="standard")
        # The codec and preset should match standard
        def get_val(cmd, flag):
            return cmd[cmd.index(flag) + 1]
        assert get_val(cmd_unknown, "-c:v") == get_val(cmd_standard, "-c:v")
        assert get_val(cmd_unknown, "-preset") == get_val(cmd_standard, "-preset")

    def test_faststart_movflag(self):
        cmd = self.p.build_command("in.mp4", "out.mp4")
        assert "+faststart" in cmd

    def test_filter_complex_present(self):
        cmd = self.p.build_command("in.mp4", "out.mp4")
        assert "-filter_complex" in cmd

    def test_audio_codec_is_aac(self):
        cmd = self.p.build_command("in.mp4", "out.mp4")
        idx = cmd.index("-c:a")
        assert cmd[idx + 1] == "aac"


# ---------------------------------------------------------------------------
# build_command – with logo that does NOT exist on disk (should be skipped)
# ---------------------------------------------------------------------------
class TestBuildCommandLogoNotExists:
    @pytest.fixture(autouse=True)
    def pipeline(self):
        with patch("shutil.which", return_value="/usr/bin/ffmpeg"):
            self.p = VideoProcessingPipeline()

    def test_missing_logo_not_added_as_input(self):
        brand = BrandOverlayOptions(logo_path="/nonexistent/logo.png")
        cmd = self.p.build_command("in.mp4", "out.mp4", brand=brand)
        assert "/nonexistent/logo.png" not in cmd

    def test_command_still_valid_without_logo(self):
        brand = BrandOverlayOptions(logo_path=None)
        cmd = self.p.build_command("in.mp4", "out.mp4", brand=brand)
        assert cmd[-1] == "out.mp4"


# ---------------------------------------------------------------------------
# build_command – with logo that DOES exist on disk
# ---------------------------------------------------------------------------
class TestBuildCommandLogoExists:
    @pytest.fixture(autouse=True)
    def pipeline(self):
        with patch("shutil.which", return_value="/usr/bin/ffmpeg"):
            self.p = VideoProcessingPipeline()

    def test_logo_added_as_input(self, tmp_path):
        logo = tmp_path / "logo.png"
        logo.write_bytes(b"fake-png")
        brand = BrandOverlayOptions(logo_path=str(logo))
        cmd = self.p.build_command("in.mp4", "out.mp4", brand=brand)
        assert str(logo) in cmd

    def test_overlay_filter_present_when_logo_exists(self, tmp_path):
        logo = tmp_path / "logo.png"
        logo.write_bytes(b"fake-png")
        brand = BrandOverlayOptions(logo_path=str(logo), position="top_right")
        cmd = self.p.build_command("in.mp4", "out.mp4", brand=brand)
        filter_str = cmd[cmd.index("-filter_complex") + 1]
        assert "overlay=" in filter_str

    def test_opacity_in_filter(self, tmp_path):
        logo = tmp_path / "logo.png"
        logo.write_bytes(b"fake-png")
        brand = BrandOverlayOptions(logo_path=str(logo), opacity=0.5)
        cmd = self.p.build_command("in.mp4", "out.mp4", brand=brand)
        filter_str = cmd[cmd.index("-filter_complex") + 1]
        assert "aa=0.5" in filter_str


# ---------------------------------------------------------------------------
# build_command – with intro and outro that exist on disk
# ---------------------------------------------------------------------------
class TestBuildCommandConcatSegments:
    @pytest.fixture(autouse=True)
    def pipeline(self):
        with patch("shutil.which", return_value="/usr/bin/ffmpeg"):
            self.p = VideoProcessingPipeline()

    def test_intro_added_as_input(self, tmp_path):
        intro = tmp_path / "intro.mp4"
        intro.write_bytes(b"fake")
        brand = BrandOverlayOptions(intro_path=str(intro))
        cmd = self.p.build_command("in.mp4", "out.mp4", brand=brand)
        assert str(intro) in cmd

    def test_outro_added_as_input(self, tmp_path):
        outro = tmp_path / "outro.mp4"
        outro.write_bytes(b"fake")
        brand = BrandOverlayOptions(outro_path=str(outro))
        cmd = self.p.build_command("in.mp4", "out.mp4", brand=brand)
        assert str(outro) in cmd

    def test_concat_filter_present_with_intro(self, tmp_path):
        intro = tmp_path / "intro.mp4"
        intro.write_bytes(b"fake")
        brand = BrandOverlayOptions(intro_path=str(intro))
        cmd = self.p.build_command("in.mp4", "out.mp4", brand=brand)
        filter_str = cmd[cmd.index("-filter_complex") + 1]
        assert "concat=" in filter_str

    def test_concat_filter_present_with_intro_and_outro(self, tmp_path):
        intro = tmp_path / "intro.mp4"
        outro = tmp_path / "outro.mp4"
        intro.write_bytes(b"fake")
        outro.write_bytes(b"fake")
        brand = BrandOverlayOptions(intro_path=str(intro), outro_path=str(outro))
        cmd = self.p.build_command("in.mp4", "out.mp4", brand=brand)
        filter_str = cmd[cmd.index("-filter_complex") + 1]
        # Three segments: intro + main + outro => n=3
        assert "concat=n=3" in filter_str


# ---------------------------------------------------------------------------
# BrandOverlayOptions validation
# ---------------------------------------------------------------------------
class TestBrandOverlayOptions:
    def test_size_ratio_min_bound(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            BrandOverlayOptions(size_ratio=0.01)  # below 0.05

    def test_size_ratio_max_bound(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            BrandOverlayOptions(size_ratio=0.99)  # above 0.30

    def test_valid_size_ratio(self):
        b = BrandOverlayOptions(size_ratio=0.15)
        assert b.size_ratio == 0.15

    def test_opacity_min_bound(self):
        b = BrandOverlayOptions(opacity=0.0)
        assert b.opacity == 0.0

    def test_opacity_max_bound(self):
        b = BrandOverlayOptions(opacity=1.0)
        assert b.opacity == 1.0

    def test_default_position_is_bottom_right(self):
        b = BrandOverlayOptions()
        assert b.position == "bottom_right"
