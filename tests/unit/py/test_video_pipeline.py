"""Tests for services/api/app/pipeline/video_pipeline.py

Covers VideoProcessingPipeline.build_command() and its helpers without
invoking FFmpeg (shutil.which is mocked so __init__ succeeds).
"""
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, "services/api")


def _make_pipeline(bin_name: str = "ffmpeg"):
    """Create a VideoProcessingPipeline with a mocked FFmpeg binary check."""
    with patch("shutil.which", return_value="/usr/bin/ffmpeg"):
        from app.pipeline.video_pipeline import VideoProcessingPipeline
        return VideoProcessingPipeline(ffmpeg_bin=bin_name)


class TestOverlayCoordinates:
    def setup_method(self):
        with patch("shutil.which", return_value="/usr/bin/ffmpeg"):
            from app.pipeline.video_pipeline import VideoProcessingPipeline
            self.VPP = VideoProcessingPipeline

    def test_top_left(self):
        result = self.VPP._overlay_coordinates("top_left")
        assert result == "24:24"

    def test_top_right(self):
        result = self.VPP._overlay_coordinates("top_right")
        assert "main_w-overlay_w" in result
        assert result.endswith(":24")

    def test_bottom_left(self):
        result = self.VPP._overlay_coordinates("bottom_left")
        assert result.startswith("24:")
        assert "main_h-overlay_h" in result

    def test_bottom_right_default(self):
        result = self.VPP._overlay_coordinates("bottom_right")
        assert "main_w-overlay_w" in result
        assert "main_h-overlay_h" in result

    def test_center(self):
        result = self.VPP._overlay_coordinates("center")
        assert "main_w-overlay_w" in result
        assert "main_h-overlay_h" in result

    def test_unknown_position_falls_back_to_bottom_right(self):
        result = self.VPP._overlay_coordinates("diagonal")
        bottom_right = self.VPP._overlay_coordinates("bottom_right")
        assert result == bottom_right

    def test_custom_padding(self):
        result = self.VPP._overlay_coordinates("top_left", padding=10)
        assert result == "10:10"

    def test_zero_padding(self):
        result = self.VPP._overlay_coordinates("top_left", padding=0)
        assert result == "0:0"


class TestBuildCommand:
    def setup_method(self):
        self.pipeline = _make_pipeline()

    def test_returns_list(self):
        cmd = self.pipeline.build_command("in.mp4", "out.mp4")
        assert isinstance(cmd, list)

    def test_starts_with_ffmpeg_bin(self):
        cmd = self.pipeline.build_command("in.mp4", "out.mp4")
        assert cmd[0] == "ffmpeg"

    def test_overwrite_flag_present(self):
        cmd = self.pipeline.build_command("in.mp4", "out.mp4")
        assert "-y" in cmd

    def test_input_file_in_command(self):
        cmd = self.pipeline.build_command("in.mp4", "out.mp4")
        assert "in.mp4" in cmd

    def test_output_file_in_command(self):
        cmd = self.pipeline.build_command("in.mp4", "out.mp4")
        assert "out.mp4" in cmd

    def test_default_tier_standard(self):
        cmd = self.pipeline.build_command("in.mp4", "out.mp4", tier="standard")
        cmd_str = " ".join(cmd)
        assert "libx264" in cmd_str

    def test_draft_tier_ultrafast_preset(self):
        cmd = self.pipeline.build_command("in.mp4", "out.mp4", tier="draft")
        assert "ultrafast" in cmd

    def test_premium_tier_libx265(self):
        cmd = self.pipeline.build_command("in.mp4", "out.mp4", tier="premium")
        assert "libx265" in cmd

    def test_unknown_tier_falls_back_to_standard(self):
        cmd_unknown = self.pipeline.build_command("in.mp4", "out.mp4", tier="extreme")
        cmd_standard = self.pipeline.build_command("in.mp4", "out.mp4", tier="standard")
        # Both should produce the same codec choice
        assert "libx264" in " ".join(cmd_unknown)
        assert "libx264" in " ".join(cmd_standard)

    def test_case_insensitive_tier(self):
        cmd = self.pipeline.build_command("in.mp4", "out.mp4", tier="DRAFT")
        assert "ultrafast" in cmd

    def test_no_brand_no_extra_inputs(self):
        cmd = self.pipeline.build_command("in.mp4", "out.mp4")
        # Without brand, only one -i input
        assert cmd.count("-i") == 1

    def test_brand_logo_not_existing_skipped(self):
        from app.pipeline.video_pipeline import BrandOverlayOptions
        brand = BrandOverlayOptions(logo_path="/nonexistent/logo.png")
        cmd = self.pipeline.build_command("in.mp4", "out.mp4", brand=brand)
        # Logo path doesn't exist → not added as input
        assert "/nonexistent/logo.png" not in cmd

    def test_brand_logo_existing_added(self, tmp_path):
        from app.pipeline.video_pipeline import BrandOverlayOptions
        logo = tmp_path / "logo.png"
        logo.write_bytes(b"\x00")
        brand = BrandOverlayOptions(logo_path=str(logo))
        cmd = self.pipeline.build_command("in.mp4", "out.mp4", brand=brand)
        assert str(logo) in cmd
        assert cmd.count("-i") == 2

    def test_brand_intro_existing_added(self, tmp_path):
        from app.pipeline.video_pipeline import BrandOverlayOptions
        intro = tmp_path / "intro.mp4"
        intro.write_bytes(b"\x00")
        brand = BrandOverlayOptions(intro_path=str(intro))
        cmd = self.pipeline.build_command("in.mp4", "out.mp4", brand=brand)
        assert str(intro) in cmd

    def test_brand_outro_existing_added(self, tmp_path):
        from app.pipeline.video_pipeline import BrandOverlayOptions
        outro = tmp_path / "outro.mp4"
        outro.write_bytes(b"\x00")
        brand = BrandOverlayOptions(outro_path=str(outro))
        cmd = self.pipeline.build_command("in.mp4", "out.mp4", brand=brand)
        assert str(outro) in cmd

    def test_faststart_movflag_present(self):
        cmd = self.pipeline.build_command("in.mp4", "out.mp4")
        assert "+faststart" in cmd

    def test_filter_complex_present(self):
        cmd = self.pipeline.build_command("in.mp4", "out.mp4")
        assert "-filter_complex" in cmd

    def test_audio_codec_aac(self):
        cmd = self.pipeline.build_command("in.mp4", "out.mp4")
        assert "aac" in cmd

    def test_crf_present(self):
        cmd = self.pipeline.build_command("in.mp4", "out.mp4", tier="standard")
        assert "-crf" in cmd
        crf_idx = cmd.index("-crf")
        assert cmd[crf_idx + 1] == "23"

    def test_all_three_brand_elements(self, tmp_path):
        from app.pipeline.video_pipeline import BrandOverlayOptions
        logo = tmp_path / "logo.png"
        intro = tmp_path / "intro.mp4"
        outro = tmp_path / "outro.mp4"
        for f in (logo, intro, outro):
            f.write_bytes(b"\x00")
        brand = BrandOverlayOptions(
            logo_path=str(logo),
            intro_path=str(intro),
            outro_path=str(outro),
        )
        cmd = self.pipeline.build_command("in.mp4", "out.mp4", brand=brand)
        # 1 main + logo + intro + outro = 4 inputs
        assert cmd.count("-i") == 4


class TestInit:
    def test_raises_when_ffmpeg_missing(self):
        with patch("shutil.which", return_value=None):
            from app.pipeline.video_pipeline import VideoProcessingPipeline
            with pytest.raises(EnvironmentError, match="FFmpeg binary not found"):
                VideoProcessingPipeline()

    def test_succeeds_when_ffmpeg_found(self):
        pipeline = _make_pipeline()
        assert pipeline.ffmpeg_bin == "ffmpeg"

    def test_custom_ffmpeg_path(self):
        pipeline = _make_pipeline(bin_name="/opt/ffmpeg/bin/ffmpeg")
        assert pipeline.ffmpeg_bin == "/opt/ffmpeg/bin/ffmpeg"


class TestQualityTierSpecs:
    def test_all_three_tiers_defined(self):
        from app.pipeline.video_pipeline import QUALITY_TIER_SPECS
        for tier in ("draft", "standard", "premium"):
            assert tier in QUALITY_TIER_SPECS

    def test_draft_resolution_720p(self):
        from app.pipeline.video_pipeline import QUALITY_TIER_SPECS
        spec = QUALITY_TIER_SPECS["draft"]
        assert spec.width == 1280
        assert spec.height == 720

    def test_standard_resolution_1080p(self):
        from app.pipeline.video_pipeline import QUALITY_TIER_SPECS
        spec = QUALITY_TIER_SPECS["standard"]
        assert spec.width == 1920
        assert spec.height == 1080

    def test_premium_resolution_1440p(self):
        from app.pipeline.video_pipeline import QUALITY_TIER_SPECS
        spec = QUALITY_TIER_SPECS["premium"]
        assert spec.width == 2560
        assert spec.height == 1440

    def test_premium_fps_60(self):
        from app.pipeline.video_pipeline import QUALITY_TIER_SPECS
        assert QUALITY_TIER_SPECS["premium"].fps == 60

    def test_draft_fps_24(self):
        from app.pipeline.video_pipeline import QUALITY_TIER_SPECS
        assert QUALITY_TIER_SPECS["draft"].fps == 24
