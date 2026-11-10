"""Tests for SmartCropEngine pure-logic (no cv2/mediapipe/ffmpeg required).

We mock analyze_speaker_centroid_trajectory so the crop math is exercised
without any external binary or ML dependency.
"""
import pytest
from unittest.mock import patch

from app.pipeline.crop_engine import SmartCropEngine


RATIO = 9 / 16  # TARGET_ASPECT_RATIO


def _mock_traj(src_w, src_h, centers):
    """Return a mock for analyze_speaker_centroid_trajectory."""
    return (src_w, src_h, centers)


class TestGenerateFfmpegSmartCropFilter:
    def _crop(self, src_w, src_h, centers):
        engine = SmartCropEngine()
        with patch.object(engine, 'analyze_speaker_centroid_trajectory', return_value=(src_w, src_h, centers)):
            return engine.generate_ffmpeg_smart_crop_filter('fake_path.mp4')

    def test_output_ends_with_scale_1080_1920(self):
        result = self._crop(1920, 1080, [960.0])
        assert result.endswith(',scale=1080:1920')

    def test_output_starts_with_crop(self):
        result = self._crop(1920, 1080, [960.0])
        assert result.startswith('crop=')

    def test_target_width_is_even(self):
        result = self._crop(1920, 1080, [960.0])
        target_w = int(result.split('crop=')[1].split(':')[0])
        assert target_w % 2 == 0

    def test_crop_x_is_even(self):
        result = self._crop(1920, 1080, [960.0])
        parts = result.split('crop=')[1].split(',')[0].split(':')
        crop_x = int(parts[2])
        assert crop_x % 2 == 0

    def test_1920x1080_centered_subject(self):
        # src_h=1080, target_w = min(int(1080*9/16), 1920) = min(607, 1920)=607 → 606 (even)
        result = self._crop(1920, 1080, [960.0])
        parts = result.split('crop=')[1].split(',')[0].split(':')
        target_w, target_h, crop_x, crop_y = int(parts[0]), int(parts[1]), int(parts[2]), int(parts[3])
        assert target_w == 606
        assert target_h == 1080
        # crop_x = int(960 - 303) = 657, make even → 656
        assert crop_x == 656
        assert crop_y == 0

    def test_subject_at_left_edge_clamps_crop_x_to_zero(self):
        result = self._crop(1920, 1080, [0.0])
        parts = result.split('crop=')[1].split(',')[0].split(':')
        crop_x = int(parts[2])
        assert crop_x == 0

    def test_subject_at_right_edge_clamps_crop_x_to_max(self):
        result = self._crop(1920, 1080, [1920.0])
        parts = result.split('crop=')[1].split(',')[0].split(':')
        target_w = int(parts[0])
        crop_x = int(parts[2])
        # crop_x must not exceed src_w - target_w
        assert crop_x <= 1920 - target_w

    def test_empty_centers_uses_midpoint(self):
        # No trajectory data → falls back to src_w/2.0
        result = self._crop(1920, 1080, [])
        parts = result.split('crop=')[1].split(',')[0].split(':')
        crop_x = int(parts[2])
        # With center at 960, expected crop_x is 656 (same as centered)
        assert crop_x == 656

    def test_9x16_source_already_vertical(self):
        # 1080x1920 source → target_w = min(int(1920*9/16),1080) = min(1080,1080) = 1080 (even)
        result = self._crop(1080, 1920, [540.0])
        parts = result.split('crop=')[1].split(',')[0].split(':')
        target_w, target_h = int(parts[0]), int(parts[1])
        crop_x = int(parts[2])
        assert target_w == 1080
        assert target_h == 1920
        assert crop_x == 0

    def test_small_landscape_640x360(self):
        # target_w = min(int(360*9/16), 640) = min(202, 640) = 202 (even)
        result = self._crop(640, 360, [320.0])
        parts = result.split('crop=')[1].split(',')[0].split(':')
        target_w = int(parts[0])
        assert target_w == 202
        assert target_w % 2 == 0

    def test_average_of_multiple_centers(self):
        # 3 center values: 100, 300, 500 → mean = 300
        result = self._crop(1920, 1080, [100.0, 300.0, 500.0])
        # target_w=606, mean=300
        # crop_x = int(300 - 303) = int(-3) = -3 → clamp to 0
        parts = result.split('crop=')[1].split(',')[0].split(':')
        crop_x = int(parts[2])
        assert crop_x == 0

    def test_format_is_parseable(self):
        result = self._crop(1920, 1080, [960.0])
        # crop=W:H:X:Y,scale=1080:1920
        assert ',' in result
        crop_part, scale_part = result.split(',')
        assert scale_part == 'scale=1080:1920'
        dimensions = crop_part.replace('crop=', '').split(':')
        assert len(dimensions) == 4
        for d in dimensions:
            assert d.isdigit()

    def test_smoothing_alpha_has_no_effect_on_pure_math(self):
        # alpha only matters during frame analysis, not during the filter generation
        engine_a = SmartCropEngine(smoothing_alpha=0.0)
        engine_b = SmartCropEngine(smoothing_alpha=1.0)
        centers = [800.0, 900.0, 1000.0]
        with patch.object(engine_a, 'analyze_speaker_centroid_trajectory', return_value=(1920, 1080, centers)):
            result_a = engine_a.generate_ffmpeg_smart_crop_filter('x')
        with patch.object(engine_b, 'analyze_speaker_centroid_trajectory', return_value=(1920, 1080, centers)):
            result_b = engine_b.generate_ffmpeg_smart_crop_filter('x')
        assert result_a == result_b


class TestSmartCropEngineDefaults:
    def test_default_alpha(self):
        engine = SmartCropEngine()
        assert engine.alpha == 0.08

    def test_custom_alpha_stored(self):
        engine = SmartCropEngine(smoothing_alpha=0.2)
        assert engine.alpha == 0.2

    def test_target_aspect_ratio(self):
        import math
        assert math.isclose(SmartCropEngine.TARGET_ASPECT_RATIO, 9 / 16, rel_tol=1e-9)
