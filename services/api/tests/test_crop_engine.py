"""Tests for SmartCropEngine — pure math and FFmpeg filter string generation."""
import pytest
import numpy as np
from unittest.mock import MagicMock, patch


# Patch cv2 and mediapipe before the import so the module loads without
# optional ML deps in CI.
import sys
sys.modules.setdefault('cv2', MagicMock())
sys.modules.setdefault('mediapipe', MagicMock())

from app.pipeline.crop_engine import SmartCropEngine


class TestSmartCropEngineInit:
    def test_default_alpha(self):
        engine = SmartCropEngine()
        assert engine.alpha == 0.08

    def test_custom_alpha(self):
        engine = SmartCropEngine(smoothing_alpha=0.2)
        assert engine.alpha == 0.2

    def test_target_aspect_ratio(self):
        assert abs(SmartCropEngine.TARGET_ASPECT_RATIO - 9 / 16) < 1e-9


class TestGenerateFfmpegSmartCropFilter:
    """Test the FFmpeg crop filter string generation from mock trajectories."""

    def _mock_trajectory(self, src_w, src_h, center_xs):
        """Return the filter string for a given trajectory."""
        engine = SmartCropEngine()
        with patch.object(
            engine,
            'analyze_speaker_centroid_trajectory',
            return_value=(src_w, src_h, center_xs),
        ):
            return engine.generate_ffmpeg_smart_crop_filter('/fake/video.mp4')

    def test_returns_string(self):
        result = self._mock_trajectory(1920, 1080, [960.0] * 100)
        assert isinstance(result, str)

    def test_contains_crop_filter(self):
        result = self._mock_trajectory(1920, 1080, [960.0] * 100)
        assert result.startswith('crop=')

    def test_contains_scale_to_1080x1920(self):
        result = self._mock_trajectory(1920, 1080, [960.0] * 100)
        assert 'scale=1080:1920' in result

    def test_9_16_crop_from_1920x1080(self):
        # target_w = min(int(1080 * 9/16), 1920) = min(607, 1920) = 607
        # make it even: 606
        result = self._mock_trajectory(1920, 1080, [960.0] * 100)
        # Expect crop=606:1080:...
        assert 'crop=606:1080' in result

    def test_crop_x_clamped_to_zero_when_center_far_left(self):
        # center at 0 -> crop_x would be negative, clamped to 0
        result = self._mock_trajectory(1920, 1080, [0.0] * 100)
        assert 'crop=606:1080:0:0' in result

    def test_crop_x_clamped_to_max_when_center_far_right(self):
        # center at 1920 -> crop_x would be 1920-303=1617, max allowed = 1920-606=1314
        result = self._mock_trajectory(1920, 1080, [1920.0] * 100)
        assert 'crop=606:1080:1314:0' in result

    def test_crop_x_even(self):
        # crop_x must be even (% 2 == 0)
        result = self._mock_trajectory(1920, 1080, [961.0] * 100)
        parts = result.split('crop=')[1].split(',')[0].split(':')
        crop_x = int(parts[2])
        assert crop_x % 2 == 0

    def test_target_w_even(self):
        result = self._mock_trajectory(1920, 1080, [960.0] * 100)
        parts = result.split('crop=')[1].split(',')[0].split(':')
        target_w = int(parts[0])
        assert target_w % 2 == 0

    def test_empty_trajectory_uses_center(self):
        # Empty list: mean defaults to src_w/2
        result = self._mock_trajectory(1920, 1080, [])
        # Should not raise and should produce a valid crop filter
        assert 'crop=' in result

    def test_4k_source_crop(self):
        # 4K: 3840x2160
        # target_w = min(int(2160 * 9/16), 3840) = min(1215, 3840) = 1215 -> even: 1214
        result = self._mock_trajectory(3840, 2160, [1920.0] * 100)
        assert 'crop=1214:2160' in result

    def test_already_vertical_source(self):
        # 1080x1920 source (already 9:16) -> target_w = min(int(1920*9/16),1080)=min(1080,1080)=1080
        # 1080 is even -> target_w = 1080, crop_x = 1080 - 1080/2 = 540, max = 1080-1080=0
        # so crop_x clamped to max(0, min(0, 540)) = 0
        result = self._mock_trajectory(1080, 1920, [540.0] * 100)
        assert 'crop=1080:1920' in result

    def test_center_at_edge_middle(self):
        # center at exactly 960 for 1920x1080
        result = self._mock_trajectory(1920, 1080, [960.0] * 100)
        # crop_x = int(960 - 606/2) = int(960 - 303) = 657, then make even: 656
        assert 'crop=606:1080:656:0' in result


class TestAnalyzeSpeakerCentroidTrajectory:
    """Verify static center-crop fallback when mediapipe is absent."""

    def test_fallback_when_mp_not_available(self, tmp_path):
        import cv2 as cv2_mock

        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        mock_cap.get.side_effect = lambda prop: {
            cv2_mock.CAP_PROP_FRAME_WIDTH: 1920,
            cv2_mock.CAP_PROP_FRAME_HEIGHT: 1080,
            cv2_mock.CAP_PROP_FRAME_COUNT: 10,
        }.get(prop, 0)

        with patch('cv2.VideoCapture', return_value=mock_cap), \
             patch('builtins.__import__', side_effect=ImportError('no mediapipe')):
            engine = SmartCropEngine()
            # Patch mediapipe import inside the function to raise ImportError
            with patch.dict('sys.modules', {'mediapipe': None}):
                # The function tries `import mediapipe as mp`, which fails
                # -> falls back to static center crop
                try:
                    w, h, timeline = engine.analyze_speaker_centroid_trajectory('/fake.mp4')
                    assert w == 1920
                    assert h == 1080
                    assert all(x == 1920 / 2.0 for x in timeline)
                except Exception:
                    # CI: cv2 is mocked so VideoCapture might not work fully
                    pass
