"""Unit tests for SmartCropEngine pure logic (no video files required).

The mediapipe/opencv paths are tested through mocking; only the pure
math (crop coordinates, filter string format) is tested without mocks.
"""
import math
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from app.pipeline.crop_engine import SmartCropEngine


@pytest.fixture()
def engine():
    return SmartCropEngine(smoothing_alpha=0.08)


# ---------------------------------------------------------------------------
# generate_ffmpeg_smart_crop_filter – pure math
# ---------------------------------------------------------------------------

class TestGenerateFilter:
    """Calls generate_ffmpeg_smart_crop_filter by patching the trajectory
    analysis so no video file is needed."""

    def _call_with_trajectory(self, engine, width, height, trajectory):
        with patch.object(
            engine,
            "analyze_speaker_centroid_trajectory",
            return_value=(width, height, trajectory),
        ):
            return engine.generate_ffmpeg_smart_crop_filter("fake.mp4")

    def test_returns_string(self, engine):
        filt = self._call_with_trajectory(engine, 1920, 1080, [960.0] * 30)
        assert isinstance(filt, str)

    def test_filter_ends_with_scale_1080_1920(self, engine):
        filt = self._call_with_trajectory(engine, 1920, 1080, [960.0] * 30)
        assert filt.endswith("scale=1080:1920")

    def test_filter_contains_crop(self, engine):
        filt = self._call_with_trajectory(engine, 1920, 1080, [960.0] * 30)
        assert filt.startswith("crop=")

    def test_target_width_is_even(self, engine):
        filt = self._call_with_trajectory(engine, 1920, 1080, [960.0] * 30)
        # crop=W:H:X:0,scale=...
        parts = filt.split(",")[0]  # "crop=W:H:X:0"
        crop_args = parts[len("crop="):].split(":")
        target_w = int(crop_args[0])
        assert target_w % 2 == 0

    def test_crop_x_is_even(self, engine):
        filt = self._call_with_trajectory(engine, 1920, 1080, [960.0] * 30)
        parts = filt.split(",")[0]
        crop_args = parts[len("crop="):].split(":")
        crop_x = int(crop_args[2])
        assert crop_x % 2 == 0

    def test_crop_x_is_clamped_to_zero_minimum(self, engine):
        # Speaker very far to the left — crop_x should not go below 0
        filt = self._call_with_trajectory(engine, 1920, 1080, [0.0] * 30)
        parts = filt.split(",")[0]
        crop_args = parts[len("crop="):].split(":")
        crop_x = int(crop_args[2])
        assert crop_x >= 0

    def test_crop_x_does_not_exceed_max(self, engine):
        # Speaker very far to the right — crop_x must stay within bounds
        src_w, src_h = 1920, 1080
        target_w = min(int(src_h * SmartCropEngine.TARGET_ASPECT_RATIO), src_w)
        target_w -= target_w % 2
        filt = self._call_with_trajectory(engine, src_w, src_h, [float(src_w)] * 30)
        parts = filt.split(",")[0]
        crop_args = parts[len("crop="):].split(":")
        crop_x = int(crop_args[2])
        assert crop_x <= src_w - target_w

    def test_target_aspect_ratio_close_to_9_16(self, engine):
        src_w, src_h = 1920, 1080
        filt = self._call_with_trajectory(engine, src_w, src_h, [float(src_w) / 2] * 30)
        parts = filt.split(",")[0]
        crop_args = parts[len("crop="):].split(":")
        target_w = int(crop_args[0])
        target_h = int(crop_args[1])
        ratio = target_w / target_h
        expected = 9 / 16
        assert abs(ratio - expected) < 0.05

    def test_empty_trajectory_uses_center(self, engine):
        src_w, src_h = 1920, 1080
        # With empty trajectory, mean defaults to src_w/2
        filt = self._call_with_trajectory(engine, src_w, src_h, [])
        assert "crop=" in filt


# ---------------------------------------------------------------------------
# analyze_speaker_centroid_trajectory – mediapipe-absent path
# ---------------------------------------------------------------------------

class TestTrajectoryWithoutMediapipe:
    def test_returns_center_trajectory_when_mediapipe_missing(self, engine):
        """When mediapipe is absent the trajectory falls back to src_w/2."""
        src_w, src_h, total_frames = 1920, 1080, 5

        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        # cv2 CAP_PROP_FRAME_WIDTH=3, HEIGHT=4, COUNT=7
        mock_cap.get.side_effect = lambda prop: {3: src_w, 4: src_h, 7: total_frames}.get(prop, 0)
        mock_frame = MagicMock()
        mock_cap.read.side_effect = [(True, mock_frame)] * total_frames + [(False, None)]

        mock_cv2 = MagicMock()
        mock_cv2.VideoCapture.return_value = mock_cap
        mock_cv2.CAP_PROP_FRAME_WIDTH = 3
        mock_cv2.CAP_PROP_FRAME_HEIGHT = 4
        mock_cv2.CAP_PROP_FRAME_COUNT = 7

        # Patch both cv2 and mediapipe so analyze_speaker_centroid_trajectory
        # takes the "mediapipe missing" fallback path.
        with patch.dict("sys.modules", {"cv2": mock_cv2, "mediapipe": None}):
            width, height, trajectory = engine.analyze_speaker_centroid_trajectory(
                "fake.mp4", sample_step_frames=1
            )

        assert width == src_w
        assert height == src_h
        assert len(trajectory) == total_frames
        assert all(x == src_w / 2.0 for x in trajectory)


# ---------------------------------------------------------------------------
# SmartCropEngine target aspect ratio constant
# ---------------------------------------------------------------------------

class TestConstants:
    def test_target_aspect_ratio_is_9_over_16(self):
        assert math.isclose(SmartCropEngine.TARGET_ASPECT_RATIO, 9 / 16)

    def test_default_smoothing_alpha(self):
        e = SmartCropEngine()
        assert e.alpha == 0.08

    def test_custom_smoothing_alpha(self):
        e = SmartCropEngine(smoothing_alpha=0.5)
        assert e.alpha == 0.5

    def test_smoothing_alpha_between_0_and_1(self):
        e = SmartCropEngine(smoothing_alpha=0.3)
        assert 0.0 < e.alpha < 1.0
