"""Tests for VideoProcessingPipeline static methods and QUALITY_TIER_SPECS."""
import pytest
from unittest.mock import patch
from app.pipeline.video_pipeline import (
    QUALITY_TIER_SPECS,
    QualityTierConfig,
    BrandOverlayOptions,
    VideoProcessingPipeline,
)


class TestQualityTierSpecs:
    def test_has_draft_tier(self):
        assert "draft" in QUALITY_TIER_SPECS

    def test_has_standard_tier(self):
        assert "standard" in QUALITY_TIER_SPECS

    def test_has_premium_tier(self):
        assert "premium" in QUALITY_TIER_SPECS

    def test_exactly_three_tiers(self):
        assert len(QUALITY_TIER_SPECS) == 3

    def test_draft_uses_libx264(self):
        assert QUALITY_TIER_SPECS["draft"].vcodec == "libx264"

    def test_standard_uses_libx264(self):
        assert QUALITY_TIER_SPECS["standard"].vcodec == "libx264"

    def test_premium_uses_libx265(self):
        assert QUALITY_TIER_SPECS["premium"].vcodec == "libx265"

    def test_draft_is_lowest_quality(self):
        # higher CRF = lower quality
        assert QUALITY_TIER_SPECS["draft"].crf > QUALITY_TIER_SPECS["standard"].crf
        assert QUALITY_TIER_SPECS["standard"].crf > QUALITY_TIER_SPECS["premium"].crf

    def test_premium_has_highest_fps(self):
        assert QUALITY_TIER_SPECS["premium"].fps >= QUALITY_TIER_SPECS["standard"].fps
        assert QUALITY_TIER_SPECS["standard"].fps >= QUALITY_TIER_SPECS["draft"].fps

    def test_all_configs_are_quality_tier_config(self):
        for tier, config in QUALITY_TIER_SPECS.items():
            assert isinstance(config, QualityTierConfig), f"{tier} is not QualityTierConfig"

    def test_draft_resolution(self):
        assert QUALITY_TIER_SPECS["draft"].resolution == "1280x720"

    def test_standard_resolution(self):
        assert QUALITY_TIER_SPECS["standard"].resolution == "1920x1080"

    def test_premium_resolution(self):
        assert QUALITY_TIER_SPECS["premium"].resolution == "2560x1440"

    def test_draft_preset_is_ultrafast(self):
        assert QUALITY_TIER_SPECS["draft"].preset == "ultrafast"

    def test_premium_preset_is_medium(self):
        assert QUALITY_TIER_SPECS["premium"].preset == "medium"

    def test_audio_bitrate_increases_with_quality(self):
        def parse_kbps(s):
            return int(s.replace("k", ""))
        draft_kbps = parse_kbps(QUALITY_TIER_SPECS["draft"].audio_bitrate)
        standard_kbps = parse_kbps(QUALITY_TIER_SPECS["standard"].audio_bitrate)
        premium_kbps = parse_kbps(QUALITY_TIER_SPECS["premium"].audio_bitrate)
        assert draft_kbps < standard_kbps < premium_kbps


class TestBrandOverlayOptions:
    def test_default_position(self):
        opts = BrandOverlayOptions()
        assert opts.position == "bottom_right"

    def test_default_size_ratio(self):
        opts = BrandOverlayOptions()
        assert opts.size_ratio == 0.15

    def test_default_opacity(self):
        opts = BrandOverlayOptions()
        assert opts.opacity == 0.8

    def test_default_logo_path_is_none(self):
        opts = BrandOverlayOptions()
        assert opts.logo_path is None

    def test_custom_position(self):
        opts = BrandOverlayOptions(position="top_left")
        assert opts.position == "top_left"

    def test_custom_size_ratio(self):
        opts = BrandOverlayOptions(size_ratio=0.20)
        assert opts.size_ratio == 0.20

    def test_size_ratio_min_bound(self):
        opts = BrandOverlayOptions(size_ratio=0.05)
        assert opts.size_ratio == 0.05

    def test_size_ratio_max_bound(self):
        opts = BrandOverlayOptions(size_ratio=0.30)
        assert opts.size_ratio == 0.30

    def test_size_ratio_below_min_raises(self):
        with pytest.raises(Exception):
            BrandOverlayOptions(size_ratio=0.04)

    def test_size_ratio_above_max_raises(self):
        with pytest.raises(Exception):
            BrandOverlayOptions(size_ratio=0.31)

    def test_opacity_min_bound(self):
        opts = BrandOverlayOptions(opacity=0.0)
        assert opts.opacity == 0.0

    def test_opacity_max_bound(self):
        opts = BrandOverlayOptions(opacity=1.0)
        assert opts.opacity == 1.0

    def test_opacity_above_max_raises(self):
        with pytest.raises(Exception):
            BrandOverlayOptions(opacity=1.1)

    def test_opacity_below_min_raises(self):
        with pytest.raises(Exception):
            BrandOverlayOptions(opacity=-0.1)

    def test_logo_path_accepted(self):
        opts = BrandOverlayOptions(logo_path="/logos/brand.png")
        assert opts.logo_path == "/logos/brand.png"

    def test_intro_path_default_is_none(self):
        opts = BrandOverlayOptions()
        assert opts.intro_path is None

    def test_outro_path_default_is_none(self):
        opts = BrandOverlayOptions()
        assert opts.outro_path is None


class TestOverlayCoordinates:
    """Test VideoProcessingPipeline._overlay_coordinates() static helper."""

    @patch("shutil.which", return_value="/usr/bin/ffmpeg")
    def setup_method(self, _, mock_which=None):
        with patch("shutil.which", return_value="/usr/bin/ffmpeg"):
            self.pipeline = VideoProcessingPipeline(ffmpeg_bin="/usr/bin/ffmpeg")

    @patch("shutil.which", return_value="/usr/bin/ffmpeg")
    def test_top_left_uses_padding_coords(self, _):
        coords = VideoProcessingPipeline._overlay_coordinates("top_left", padding=24)
        assert coords == "24:24"

    @patch("shutil.which", return_value="/usr/bin/ffmpeg")
    def test_top_right_contains_main_w(self, _):
        coords = VideoProcessingPipeline._overlay_coordinates("top_right", padding=24)
        assert "main_w" in coords
        assert "24" in coords

    @patch("shutil.which", return_value="/usr/bin/ffmpeg")
    def test_bottom_left_contains_main_h(self, _):
        coords = VideoProcessingPipeline._overlay_coordinates("bottom_left", padding=24)
        assert "main_h" in coords
        assert "24" in coords

    @patch("shutil.which", return_value="/usr/bin/ffmpeg")
    def test_bottom_right_contains_both_dimensions(self, _):
        coords = VideoProcessingPipeline._overlay_coordinates("bottom_right", padding=24)
        assert "main_w" in coords
        assert "main_h" in coords

    @patch("shutil.which", return_value="/usr/bin/ffmpeg")
    def test_center_defaults_to_centered_formula(self, _):
        coords = VideoProcessingPipeline._overlay_coordinates("center", padding=24)
        # center position uses (main_w-overlay_w)/2
        assert "2" in coords

    @patch("shutil.which", return_value="/usr/bin/ffmpeg")
    def test_custom_padding_reflected_in_coords(self, _):
        coords = VideoProcessingPipeline._overlay_coordinates("top_left", padding=10)
        assert coords == "10:10"

    @patch("shutil.which", return_value="/usr/bin/ffmpeg")
    def test_zero_padding(self, _):
        coords = VideoProcessingPipeline._overlay_coordinates("top_left", padding=0)
        assert coords == "0:0"

    @patch("shutil.which", return_value="/usr/bin/ffmpeg")
    def test_unknown_position_falls_back(self, _):
        coords = VideoProcessingPipeline._overlay_coordinates("somewhere", padding=24)
        assert isinstance(coords, str)
        assert len(coords) > 0
