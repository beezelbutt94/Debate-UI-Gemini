"""Tests for VideoProcessingPipeline — overlay coordinates, command building,
and quality tier configuration."""
import shutil
import pytest
from unittest.mock import patch, MagicMock

# VideoProcessingPipeline checks shutil.which(ffmpeg_bin) at __init__ time.
# Patch it so tests don't require a real FFmpeg installation.
import shutil as _shutil

_original_which = _shutil.which


def _which_stub(name, *args, **kwargs):
    if 'ffmpeg' in str(name):
        return f'/usr/bin/{name}'
    return _original_which(name, *args, **kwargs)


with patch('shutil.which', side_effect=_which_stub):
    from app.pipeline.video_pipeline import (
        VideoProcessingPipeline,
        QUALITY_TIER_SPECS,
        BrandOverlayOptions,
    )


def make_pipeline():
    with patch('shutil.which', side_effect=_which_stub):
        return VideoProcessingPipeline(ffmpeg_bin='ffmpeg')


class TestOverlayCoordinates:
    def test_top_left(self):
        coords = VideoProcessingPipeline._overlay_coordinates('top_left')
        assert '24' in coords  # padding=24 by default

    def test_top_right(self):
        coords = VideoProcessingPipeline._overlay_coordinates('top_right')
        assert 'main_w' in coords

    def test_bottom_left(self):
        coords = VideoProcessingPipeline._overlay_coordinates('bottom_left')
        assert 'main_h' in coords

    def test_bottom_right(self):
        coords = VideoProcessingPipeline._overlay_coordinates('bottom_right')
        assert 'main_w' in coords
        assert 'main_h' in coords

    def test_center(self):
        coords = VideoProcessingPipeline._overlay_coordinates('center')
        assert '(main_w-overlay_w)/2' in coords

    def test_unknown_position_falls_back_to_bottom_right(self):
        coords = VideoProcessingPipeline._overlay_coordinates('invalid')
        default = VideoProcessingPipeline._overlay_coordinates('bottom_right')
        assert coords == default

    def test_custom_padding(self):
        coords = VideoProcessingPipeline._overlay_coordinates('top_left', padding=10)
        assert '10' in coords
        assert '24' not in coords


class TestQualityTierSpecs:
    def test_all_tiers_present(self):
        for tier in ['draft', 'standard', 'premium']:
            assert tier in QUALITY_TIER_SPECS

    def test_draft_is_lower_res_than_standard(self):
        draft = QUALITY_TIER_SPECS['draft']
        standard = QUALITY_TIER_SPECS['standard']
        assert draft.width < standard.width
        assert draft.height < standard.height

    def test_premium_is_higher_res_than_standard(self):
        standard = QUALITY_TIER_SPECS['standard']
        premium = QUALITY_TIER_SPECS['premium']
        assert premium.width > standard.width

    def test_draft_uses_ultrafast_preset(self):
        assert QUALITY_TIER_SPECS['draft'].preset == 'ultrafast'

    def test_standard_uses_libx264(self):
        assert QUALITY_TIER_SPECS['standard'].vcodec == 'libx264'

    def test_premium_uses_libx265(self):
        assert QUALITY_TIER_SPECS['premium'].vcodec == 'libx265'

    def test_premium_has_highest_audio_bitrate(self):
        assert '320k' in QUALITY_TIER_SPECS['premium'].audio_bitrate

    def test_draft_has_lowest_audio_bitrate(self):
        assert '96k' in QUALITY_TIER_SPECS['draft'].audio_bitrate

    def test_premium_60fps(self):
        assert QUALITY_TIER_SPECS['premium'].fps == 60

    def test_draft_24fps(self):
        assert QUALITY_TIER_SPECS['draft'].fps == 24


class TestBuildCommand:
    def setup_method(self):
        self.pipeline = make_pipeline()

    def test_returns_list(self):
        cmd = self.pipeline.build_command('/in.mp4', '/out.mp4')
        assert isinstance(cmd, list)

    def test_starts_with_ffmpeg(self):
        cmd = self.pipeline.build_command('/in.mp4', '/out.mp4')
        assert cmd[0] == 'ffmpeg'

    def test_includes_y_flag(self):
        cmd = self.pipeline.build_command('/in.mp4', '/out.mp4')
        assert '-y' in cmd

    def test_includes_input(self):
        cmd = self.pipeline.build_command('/my/input.mp4', '/out.mp4')
        assert '/my/input.mp4' in cmd

    def test_includes_output(self):
        cmd = self.pipeline.build_command('/in.mp4', '/my/output.mp4')
        assert '/my/output.mp4' in cmd

    def test_includes_filter_complex(self):
        cmd = self.pipeline.build_command('/in.mp4', '/out.mp4')
        assert '-filter_complex' in cmd

    def test_standard_tier_uses_crf_23(self):
        cmd = self.pipeline.build_command('/in.mp4', '/out.mp4', tier='standard')
        assert '23' in cmd

    def test_draft_tier_uses_crf_28(self):
        cmd = self.pipeline.build_command('/in.mp4', '/out.mp4', tier='draft')
        assert '28' in cmd

    def test_unknown_tier_falls_back_to_standard(self):
        cmd_unknown = self.pipeline.build_command('/in.mp4', '/out.mp4', tier='fake_tier')
        cmd_standard = self.pipeline.build_command('/in.mp4', '/out.mp4', tier='standard')
        # The video codec and preset should be the same
        assert 'libx264' in cmd_unknown

    def test_no_logo_no_extra_input(self):
        cmd = self.pipeline.build_command('/in.mp4', '/out.mp4', brand=None)
        assert cmd.count('-i') == 1  # only the input video

    def test_logo_present_adds_input(self):
        brand = BrandOverlayOptions(logo_path='/logo.png', position='top_right')
        with patch('os.path.exists', return_value=True):
            cmd = self.pipeline.build_command('/in.mp4', '/out.mp4', brand=brand)
        assert '/logo.png' in cmd

    def test_logo_absent_no_extra_input(self):
        brand = BrandOverlayOptions(logo_path='/nonexistent.png')
        with patch('os.path.exists', return_value=False):
            cmd = self.pipeline.build_command('/in.mp4', '/out.mp4', brand=brand)
        assert '/nonexistent.png' not in cmd

    def test_includes_movflags_faststart(self):
        cmd = self.pipeline.build_command('/in.mp4', '/out.mp4')
        assert '+faststart' in cmd

    def test_scale_filter_uses_tier_resolution(self):
        cmd = self.pipeline.build_command('/in.mp4', '/out.mp4', tier='standard')
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'scale=1920:1080' in fc

    def test_premium_scale_filter(self):
        cmd = self.pipeline.build_command('/in.mp4', '/out.mp4', tier='premium')
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'scale=2560:1440' in fc

    def test_includes_yuv420p_format(self):
        cmd = self.pipeline.build_command('/in.mp4', '/out.mp4')
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'yuv420p' in fc


class TestBrandOverlayOptions:
    def test_default_position_bottom_right(self):
        opts = BrandOverlayOptions()
        assert opts.position == 'bottom_right'

    def test_size_ratio_range_valid(self):
        BrandOverlayOptions(size_ratio=0.05)
        BrandOverlayOptions(size_ratio=0.30)

    def test_size_ratio_below_min_rejected(self):
        with pytest.raises(Exception):
            BrandOverlayOptions(size_ratio=0.04)

    def test_size_ratio_above_max_rejected(self):
        with pytest.raises(Exception):
            BrandOverlayOptions(size_ratio=0.31)

    def test_opacity_range_valid(self):
        BrandOverlayOptions(opacity=0.0)
        BrandOverlayOptions(opacity=1.0)
