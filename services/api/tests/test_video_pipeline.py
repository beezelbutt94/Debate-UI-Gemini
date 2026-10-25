"""Unit tests for VideoProcessingPipeline.build_command() and helpers.

No FFmpeg binary or video files are required: the tests only inspect the
command list that build_command() returns, not its execution.
"""
import os
import sys
from unittest.mock import patch

import pytest

# Patch shutil.which before the module is imported so VideoProcessingPipeline
# can be instantiated without a real ffmpeg binary.
with patch("shutil.which", return_value="/usr/bin/ffmpeg"):
    from app.pipeline.video_pipeline import (
        BrandOverlayOptions,
        QUALITY_TIER_SPECS,
        VideoProcessingPipeline,
    )


@pytest.fixture()
def pipeline():
    with patch("shutil.which", return_value="/usr/bin/ffmpeg"):
        return VideoProcessingPipeline(ffmpeg_bin="ffmpeg")


# ---------------------------------------------------------------------------
# _overlay_coordinates
# ---------------------------------------------------------------------------

class TestOverlayCoordinates:
    def test_top_left(self, pipeline):
        coords = pipeline._overlay_coordinates("top_left")
        assert coords == "24:24"

    def test_top_right(self, pipeline):
        coords = pipeline._overlay_coordinates("top_right")
        assert "main_w" in coords and "24" in coords

    def test_bottom_left(self, pipeline):
        coords = pipeline._overlay_coordinates("bottom_left")
        assert "main_h" in coords and "24" in coords

    def test_bottom_right(self, pipeline):
        coords = pipeline._overlay_coordinates("bottom_right")
        assert "main_w" in coords and "main_h" in coords

    def test_center(self, pipeline):
        coords = pipeline._overlay_coordinates("center")
        assert "main_w-overlay_w" in coords and "main_h-overlay_h" in coords

    def test_unknown_position_falls_back_to_bottom_right(self, pipeline):
        coords = pipeline._overlay_coordinates("unknown-spot")
        expected = pipeline._overlay_coordinates("bottom_right")
        assert coords == expected

    def test_custom_padding(self, pipeline):
        coords = pipeline._overlay_coordinates("top_left", padding=10)
        assert coords == "10:10"

    def test_all_known_positions_return_string(self, pipeline):
        for pos in ["top_left", "top_right", "bottom_left", "bottom_right", "center"]:
            result = pipeline._overlay_coordinates(pos)
            assert isinstance(result, str) and len(result) > 0


# ---------------------------------------------------------------------------
# QUALITY_TIER_SPECS
# ---------------------------------------------------------------------------

class TestQualityTierSpecs:
    def test_draft_exists(self):
        assert "draft" in QUALITY_TIER_SPECS

    def test_standard_exists(self):
        assert "standard" in QUALITY_TIER_SPECS

    def test_premium_exists(self):
        assert "premium" in QUALITY_TIER_SPECS

    def test_draft_is_lower_resolution_than_standard(self):
        assert QUALITY_TIER_SPECS["draft"].width < QUALITY_TIER_SPECS["standard"].width

    def test_standard_is_lower_resolution_than_premium(self):
        assert QUALITY_TIER_SPECS["standard"].width < QUALITY_TIER_SPECS["premium"].width

    def test_premium_uses_h265(self):
        assert QUALITY_TIER_SPECS["premium"].vcodec == "libx265"

    def test_draft_uses_h264(self):
        assert QUALITY_TIER_SPECS["draft"].vcodec == "libx264"

    def test_all_specs_have_positive_crf(self):
        for tier, spec in QUALITY_TIER_SPECS.items():
            assert spec.crf > 0, f"{tier} crf should be positive"

    def test_premium_has_higher_fps_than_draft(self):
        assert QUALITY_TIER_SPECS["premium"].fps > QUALITY_TIER_SPECS["draft"].fps


# ---------------------------------------------------------------------------
# build_command – basic structure
# ---------------------------------------------------------------------------

class TestBuildCommandBasic:
    def test_starts_with_ffmpeg(self, pipeline):
        cmd = pipeline.build_command("input.mp4", "output.mp4")
        assert cmd[0] == "ffmpeg"

    def test_includes_overwrite_flag(self, pipeline):
        cmd = pipeline.build_command("input.mp4", "output.mp4")
        assert "-y" in cmd

    def test_includes_input_file(self, pipeline):
        cmd = pipeline.build_command("input.mp4", "output.mp4")
        assert "input.mp4" in cmd

    def test_includes_output_file(self, pipeline):
        cmd = pipeline.build_command("input.mp4", "output.mp4")
        assert "output.mp4" in cmd

    def test_includes_filter_complex(self, pipeline):
        cmd = pipeline.build_command("input.mp4", "output.mp4")
        assert "-filter_complex" in cmd

    def test_includes_video_codec(self, pipeline):
        cmd = pipeline.build_command("input.mp4", "output.mp4")
        assert "-c:v" in cmd

    def test_includes_audio_codec_aac(self, pipeline):
        cmd = pipeline.build_command("input.mp4", "output.mp4")
        assert "aac" in cmd

    def test_includes_faststart_flag(self, pipeline):
        cmd = pipeline.build_command("input.mp4", "output.mp4")
        assert "+faststart" in cmd

    def test_returns_list_of_strings(self, pipeline):
        cmd = pipeline.build_command("input.mp4", "output.mp4")
        assert isinstance(cmd, list)
        assert all(isinstance(part, str) for part in cmd)


# ---------------------------------------------------------------------------
# build_command – quality tier selection
# ---------------------------------------------------------------------------

class TestBuildCommandQualityTier:
    def test_draft_tier_uses_ultrafast_preset(self, pipeline):
        cmd = pipeline.build_command("i.mp4", "o.mp4", tier="draft")
        assert "ultrafast" in cmd

    def test_standard_tier_uses_fast_preset(self, pipeline):
        cmd = pipeline.build_command("i.mp4", "o.mp4", tier="standard")
        assert "fast" in cmd

    def test_premium_tier_uses_medium_preset(self, pipeline):
        cmd = pipeline.build_command("i.mp4", "o.mp4", tier="premium")
        assert "medium" in cmd

    def test_unknown_tier_falls_back_to_standard(self, pipeline):
        cmd_standard = pipeline.build_command("i.mp4", "o.mp4", tier="standard")
        cmd_unknown = pipeline.build_command("i.mp4", "o.mp4", tier="nonexistent")
        # Both should use the same preset
        std_idx = cmd_standard.index("-preset")
        unk_idx = cmd_unknown.index("-preset")
        assert cmd_standard[std_idx + 1] == cmd_unknown[unk_idx + 1]

    def test_tier_matching_is_case_insensitive(self, pipeline):
        cmd_lower = pipeline.build_command("i.mp4", "o.mp4", tier="premium")
        cmd_upper = pipeline.build_command("i.mp4", "o.mp4", tier="PREMIUM")
        # Preset should be the same
        def get_preset(cmd):
            idx = cmd.index("-preset")
            return cmd[idx + 1]
        assert get_preset(cmd_lower) == get_preset(cmd_upper)

    def test_draft_crf_higher_than_premium(self, pipeline):
        cmd_draft = pipeline.build_command("i.mp4", "o.mp4", tier="draft")
        cmd_premium = pipeline.build_command("i.mp4", "o.mp4", tier="premium")
        def get_crf(cmd):
            idx = cmd.index("-crf")
            return int(cmd[idx + 1])
        assert get_crf(cmd_draft) > get_crf(cmd_premium)


# ---------------------------------------------------------------------------
# build_command – brand overlay
# ---------------------------------------------------------------------------

class TestBuildCommandBrand:
    def test_no_brand_does_not_add_extra_inputs(self, pipeline):
        cmd_plain = pipeline.build_command("i.mp4", "o.mp4")
        # Only one -i (the input video)
        assert cmd_plain.count("-i") == 1

    def test_logo_path_adds_second_input(self, pipeline):
        brand = BrandOverlayOptions(logo_path="/fake/logo.png")
        with patch("os.path.exists", return_value=True):
            cmd = pipeline.build_command("i.mp4", "o.mp4", brand=brand)
        assert cmd.count("-i") == 2
        assert "/fake/logo.png" in cmd

    def test_logo_path_not_exists_skips_overlay(self, pipeline):
        brand = BrandOverlayOptions(logo_path="/nonexistent/logo.png")
        with patch("os.path.exists", return_value=False):
            cmd = pipeline.build_command("i.mp4", "o.mp4", brand=brand)
        assert cmd.count("-i") == 1

    def test_intro_path_adds_input(self, pipeline):
        brand = BrandOverlayOptions(intro_path="/fake/intro.mp4")
        with patch("os.path.exists", return_value=True):
            cmd = pipeline.build_command("i.mp4", "o.mp4", brand=brand)
        assert "/fake/intro.mp4" in cmd

    def test_outro_path_adds_input(self, pipeline):
        brand = BrandOverlayOptions(outro_path="/fake/outro.mp4")
        with patch("os.path.exists", return_value=True):
            cmd = pipeline.build_command("i.mp4", "o.mp4", brand=brand)
        assert "/fake/outro.mp4" in cmd

    def test_intro_and_outro_together_triggers_concat(self, pipeline):
        brand = BrandOverlayOptions(
            intro_path="/fake/intro.mp4",
            outro_path="/fake/outro.mp4",
        )
        with patch("os.path.exists", return_value=True):
            cmd = pipeline.build_command("i.mp4", "o.mp4", brand=brand)
        filter_idx = cmd.index("-filter_complex")
        filters = cmd[filter_idx + 1]
        assert "concat" in filters

    def test_no_brand_does_not_use_concat(self, pipeline):
        cmd = pipeline.build_command("i.mp4", "o.mp4")
        filter_idx = cmd.index("-filter_complex")
        filters = cmd[filter_idx + 1]
        assert "concat" not in filters


# ---------------------------------------------------------------------------
# BrandOverlayOptions validation
# ---------------------------------------------------------------------------

class TestBrandOverlayOptions:
    def test_default_position_is_bottom_right(self):
        b = BrandOverlayOptions()
        assert b.position == "bottom_right"

    def test_size_ratio_must_be_at_least_0_05(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            BrandOverlayOptions(size_ratio=0.01)

    def test_size_ratio_must_be_at_most_0_30(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            BrandOverlayOptions(size_ratio=0.99)

    def test_opacity_must_be_at_least_0(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            BrandOverlayOptions(opacity=-0.1)

    def test_opacity_must_be_at_most_1(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            BrandOverlayOptions(opacity=1.5)

    def test_valid_boundary_values(self):
        b = BrandOverlayOptions(size_ratio=0.05, opacity=0.0)
        assert b.size_ratio == 0.05
        assert b.opacity == 0.0
