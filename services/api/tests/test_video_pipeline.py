"""Tests for VideoProcessingPipeline pure logic (no FFmpeg execution)."""
import sys
import os
import shutil
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.pipeline.video_pipeline import (
    VideoProcessingPipeline,
    BrandOverlayOptions,
    QUALITY_TIER_SPECS,
    QualityTierConfig,
)


def make_pipeline():
    """Create a pipeline without checking for ffmpeg binary."""
    with patch('shutil.which', return_value='/usr/bin/ffmpeg'):
        return VideoProcessingPipeline()


class TestOverlayCoordinates(unittest.TestCase):

    def test_top_left(self):
        result = VideoProcessingPipeline._overlay_coordinates('top_left')
        self.assertIn('24', result)
        self.assertEqual(result, '24:24')

    def test_top_right(self):
        result = VideoProcessingPipeline._overlay_coordinates('top_right')
        self.assertIn('main_w', result)
        self.assertIn('overlay_w', result)
        self.assertIn('24', result)

    def test_bottom_left(self):
        result = VideoProcessingPipeline._overlay_coordinates('bottom_left')
        self.assertIn('main_h', result)
        self.assertIn('24', result)

    def test_bottom_right(self):
        result = VideoProcessingPipeline._overlay_coordinates('bottom_right')
        self.assertIn('main_w', result)
        self.assertIn('main_h', result)

    def test_center(self):
        result = VideoProcessingPipeline._overlay_coordinates('center')
        self.assertIn('main_w-overlay_w', result)
        self.assertIn('main_h-overlay_h', result)
        self.assertIn('/2', result)

    def test_unknown_position_defaults_to_bottom_right(self):
        result = VideoProcessingPipeline._overlay_coordinates('invalid_position')
        bottom_right = VideoProcessingPipeline._overlay_coordinates('bottom_right')
        self.assertEqual(result, bottom_right)

    def test_custom_padding(self):
        result = VideoProcessingPipeline._overlay_coordinates('top_left', padding=48)
        self.assertIn('48', result)
        self.assertNotIn('24', result)

    def test_zero_padding(self):
        result = VideoProcessingPipeline._overlay_coordinates('top_left', padding=0)
        self.assertEqual(result, '0:0')

    def test_all_five_positions_return_strings(self):
        positions = ['top_left', 'top_right', 'bottom_left', 'bottom_right', 'center']
        for pos in positions:
            result = VideoProcessingPipeline._overlay_coordinates(pos)
            self.assertIsInstance(result, str)
            self.assertGreater(len(result), 0)


class TestQualityTierSpecs(unittest.TestCase):

    def test_draft_tier_exists(self):
        self.assertIn('draft', QUALITY_TIER_SPECS)

    def test_standard_tier_exists(self):
        self.assertIn('standard', QUALITY_TIER_SPECS)

    def test_premium_tier_exists(self):
        self.assertIn('premium', QUALITY_TIER_SPECS)

    def test_all_tiers_have_required_fields(self):
        for name, spec in QUALITY_TIER_SPECS.items():
            self.assertIsInstance(spec, QualityTierConfig, f"{name} missing QualityTierConfig")
            self.assertGreater(spec.width, 0)
            self.assertGreater(spec.height, 0)
            self.assertGreater(spec.fps, 0)
            self.assertGreater(spec.crf, 0)

    def test_premium_has_higher_resolution_than_standard(self):
        premium = QUALITY_TIER_SPECS['premium']
        standard = QUALITY_TIER_SPECS['standard']
        self.assertGreater(premium.width * premium.height, standard.width * standard.height)

    def test_draft_has_lower_resolution_than_standard(self):
        draft = QUALITY_TIER_SPECS['draft']
        standard = QUALITY_TIER_SPECS['standard']
        self.assertLess(draft.width * draft.height, standard.width * standard.height)

    def test_premium_crf_lower_than_draft(self):
        # Lower CRF = higher quality
        self.assertLess(QUALITY_TIER_SPECS['premium'].crf, QUALITY_TIER_SPECS['draft'].crf)


class TestBuildCommand(unittest.TestCase):

    def test_returns_list(self):
        pipeline = make_pipeline()
        cmd = pipeline.build_command('input.mp4', 'output.mp4')
        self.assertIsInstance(cmd, list)

    def test_starts_with_ffmpeg(self):
        pipeline = make_pipeline()
        cmd = pipeline.build_command('input.mp4', 'output.mp4')
        self.assertEqual(cmd[0], 'ffmpeg')

    def test_includes_y_flag(self):
        pipeline = make_pipeline()
        cmd = pipeline.build_command('input.mp4', 'output.mp4')
        self.assertIn('-y', cmd)

    def test_includes_input_file(self):
        pipeline = make_pipeline()
        cmd = pipeline.build_command('myvideo.mp4', 'output.mp4')
        self.assertIn('myvideo.mp4', cmd)

    def test_includes_output_file(self):
        pipeline = make_pipeline()
        cmd = pipeline.build_command('input.mp4', 'out.mp4')
        self.assertIn('out.mp4', cmd)

    def test_standard_tier_is_default(self):
        pipeline = make_pipeline()
        cmd = pipeline.build_command('input.mp4', 'output.mp4')
        standard = QUALITY_TIER_SPECS['standard']
        self.assertIn(standard.vcodec, cmd)

    def test_draft_tier_uses_ultrafast_preset(self):
        pipeline = make_pipeline()
        cmd = pipeline.build_command('input.mp4', 'output.mp4', tier='draft')
        self.assertIn('ultrafast', cmd)

    def test_premium_tier_uses_libx265(self):
        pipeline = make_pipeline()
        cmd = pipeline.build_command('input.mp4', 'output.mp4', tier='premium')
        self.assertIn('libx265', cmd)

    def test_unknown_tier_falls_back_to_standard(self):
        pipeline = make_pipeline()
        cmd_unknown = pipeline.build_command('input.mp4', 'output.mp4', tier='4k_ultra')
        cmd_standard = pipeline.build_command('input.mp4', 'output.mp4', tier='standard')
        # Both should use the same codec
        self.assertIn(QUALITY_TIER_SPECS['standard'].vcodec, cmd_unknown)

    def test_includes_filter_complex_flag(self):
        pipeline = make_pipeline()
        cmd = pipeline.build_command('input.mp4', 'output.mp4')
        self.assertIn('-filter_complex', cmd)

    def test_includes_movflags_faststart(self):
        pipeline = make_pipeline()
        cmd = pipeline.build_command('input.mp4', 'output.mp4')
        self.assertIn('+faststart', cmd)

    def test_includes_audio_codec_aac(self):
        pipeline = make_pipeline()
        cmd = pipeline.build_command('input.mp4', 'output.mp4')
        self.assertIn('aac', cmd)

    def test_without_brand_no_logo_input(self):
        pipeline = make_pipeline()
        cmd = pipeline.build_command('input.mp4', 'output.mp4', brand=None)
        # Only one -i (the input video)
        i_count = cmd.count('-i')
        self.assertEqual(i_count, 1)

    def test_with_nonexistent_logo_path_no_extra_input(self):
        """If logo_path doesn't exist on disk, it should not be added as an input."""
        pipeline = make_pipeline()
        brand = BrandOverlayOptions(logo_path='/nonexistent/logo.png')
        cmd = pipeline.build_command('input.mp4', 'output.mp4', brand=brand)
        i_count = cmd.count('-i')
        self.assertEqual(i_count, 1)

    def test_with_existing_logo_adds_extra_input(self):
        """If logo_path exists, it should be added as a second -i input."""
        pipeline = make_pipeline()
        brand = BrandOverlayOptions(logo_path='/tmp/logo.png')
        with patch('os.path.exists', return_value=True):
            cmd = pipeline.build_command('input.mp4', 'output.mp4', brand=brand)
        i_count = cmd.count('-i')
        self.assertEqual(i_count, 2)
        self.assertIn('/tmp/logo.png', cmd)

    def test_with_existing_intro_path_adds_extra_input(self):
        pipeline = make_pipeline()
        brand = BrandOverlayOptions(intro_path='/tmp/intro.mp4')
        with patch('os.path.exists', side_effect=lambda p: p == '/tmp/intro.mp4'):
            cmd = pipeline.build_command('input.mp4', 'output.mp4', brand=brand)
        i_count = cmd.count('-i')
        self.assertEqual(i_count, 2)

    def test_with_existing_outro_path_adds_extra_input(self):
        pipeline = make_pipeline()
        brand = BrandOverlayOptions(outro_path='/tmp/outro.mp4')
        with patch('os.path.exists', side_effect=lambda p: p == '/tmp/outro.mp4'):
            cmd = pipeline.build_command('input.mp4', 'output.mp4', brand=brand)
        i_count = cmd.count('-i')
        self.assertEqual(i_count, 2)

    def test_with_intro_and_outro_adds_two_extra_inputs(self):
        pipeline = make_pipeline()
        brand = BrandOverlayOptions(intro_path='/tmp/intro.mp4', outro_path='/tmp/outro.mp4')
        with patch('os.path.exists', return_value=True):
            cmd = pipeline.build_command('input.mp4', 'output.mp4', brand=brand)
        i_count = cmd.count('-i')
        self.assertEqual(i_count, 3)

    def test_filter_complex_contains_scale_filter(self):
        pipeline = make_pipeline()
        cmd = pipeline.build_command('input.mp4', 'output.mp4')
        filter_str = cmd[cmd.index('-filter_complex') + 1]
        self.assertIn('scale', filter_str)

    def test_filter_complex_contains_fps_filter(self):
        pipeline = make_pipeline()
        cmd = pipeline.build_command('input.mp4', 'output.mp4')
        filter_str = cmd[cmd.index('-filter_complex') + 1]
        self.assertIn('fps', filter_str)

    def test_case_insensitive_tier(self):
        """Tier matching is case-insensitive."""
        pipeline = make_pipeline()
        cmd_lower = pipeline.build_command('input.mp4', 'out.mp4', tier='standard')
        cmd_upper = pipeline.build_command('input.mp4', 'out.mp4', tier='STANDARD')
        # Both should produce the same codec choice
        self.assertIn(QUALITY_TIER_SPECS['standard'].vcodec, cmd_upper)


class TestBrandOverlayOptions(unittest.TestCase):

    def test_default_position_is_bottom_right(self):
        opts = BrandOverlayOptions()
        self.assertEqual(opts.position, 'bottom_right')

    def test_default_size_ratio_is_0_15(self):
        opts = BrandOverlayOptions()
        self.assertAlmostEqual(opts.size_ratio, 0.15)

    def test_default_opacity_is_0_8(self):
        opts = BrandOverlayOptions()
        self.assertAlmostEqual(opts.opacity, 0.8)

    def test_size_ratio_min_constraint(self):
        """size_ratio < 0.05 should raise a validation error."""
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            BrandOverlayOptions(size_ratio=0.01)

    def test_size_ratio_max_constraint(self):
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            BrandOverlayOptions(size_ratio=0.50)

    def test_opacity_min_constraint(self):
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            BrandOverlayOptions(opacity=-0.1)

    def test_opacity_max_constraint(self):
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            BrandOverlayOptions(opacity=1.1)

    def test_valid_opacity_boundary_0(self):
        opts = BrandOverlayOptions(opacity=0.0)
        self.assertAlmostEqual(opts.opacity, 0.0)

    def test_valid_opacity_boundary_1(self):
        opts = BrandOverlayOptions(opacity=1.0)
        self.assertAlmostEqual(opts.opacity, 1.0)

    def test_valid_size_ratio_boundary_min(self):
        opts = BrandOverlayOptions(size_ratio=0.05)
        self.assertAlmostEqual(opts.size_ratio, 0.05)

    def test_valid_size_ratio_boundary_max(self):
        opts = BrandOverlayOptions(size_ratio=0.30)
        self.assertAlmostEqual(opts.size_ratio, 0.30)


class TestPipelineInit(unittest.TestCase):

    def test_raises_when_ffmpeg_not_found(self):
        with patch('shutil.which', return_value=None):
            with self.assertRaises(EnvironmentError):
                VideoProcessingPipeline()

    def test_succeeds_when_ffmpeg_found(self):
        with patch('shutil.which', return_value='/usr/bin/ffmpeg'):
            pipeline = VideoProcessingPipeline()
            self.assertEqual(pipeline.ffmpeg_bin, 'ffmpeg')

    def test_custom_ffmpeg_bin(self):
        with patch('shutil.which', return_value='/opt/ffmpeg'):
            pipeline = VideoProcessingPipeline(ffmpeg_bin='/opt/ffmpeg')
            self.assertEqual(pipeline.ffmpeg_bin, '/opt/ffmpeg')


if __name__ == '__main__':
    unittest.main()
