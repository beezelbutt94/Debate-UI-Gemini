"""Tests for SmartCropEngine — mocking cv2/mediapipe to avoid heavy deps."""
import sys
import types
import pytest
from unittest.mock import MagicMock, patch


def _install_cv2_stub():
    """Install a minimal cv2 stub so the module-level import succeeds."""
    if "cv2" not in sys.modules:
        cv2 = types.ModuleType("cv2")
        cv2.CAP_PROP_FRAME_WIDTH = 3
        cv2.CAP_PROP_FRAME_HEIGHT = 4
        cv2.CAP_PROP_FRAME_COUNT = 7
        cv2.COLOR_BGR2RGB = 4
        cv2.VideoCapture = MagicMock()
        cv2.cvtColor = MagicMock()
        sys.modules["cv2"] = cv2


_install_cv2_stub()
# crop_engine does `import numpy as np` at module level, numpy is installed.
from app.pipeline.crop_engine import SmartCropEngine


def _make_cap(width: int, height: int, frames: int = 10):
    """Return a cv2.VideoCapture mock for a video of the given dimensions."""
    cap = MagicMock()
    cap.isOpened.return_value = True
    prop_map = {3: float(width), 4: float(height), 7: float(frames)}
    cap.get.side_effect = lambda prop: prop_map[prop]
    cap.read.return_value = (False, None)
    return cap


class TestSmartCropEngineInit:
    def test_default_alpha(self):
        assert SmartCropEngine().alpha == 0.08

    def test_custom_alpha(self):
        assert SmartCropEngine(smoothing_alpha=0.5).alpha == 0.5

    def test_target_aspect_ratio(self):
        assert SmartCropEngine.TARGET_ASPECT_RATIO == pytest.approx(9 / 16)


class TestGenerateFfmpegSmartCropFilter:
    """
    Tests generate_ffmpeg_smart_crop_filter().

    We force mediapipe to be absent (None in sys.modules → ImportError) so
    analyze_speaker_centroid_trajectory takes the static center-crop fallback
    path, which is deterministic and requires only cv2.
    """

    def _run(self, width: int, height: int, frames: int = 10):
        """Run generate_ffmpeg_smart_crop_filter with mocked cv2 and no mediapipe."""
        engine = SmartCropEngine()
        cap = _make_cap(width, height, frames)
        cv2_stub = sys.modules["cv2"]
        cv2_stub.VideoCapture = MagicMock(return_value=cap)
        # Patch mediapipe to None → import inside function raises ImportError
        with patch.dict(sys.modules, {"mediapipe": None}):
            return engine.generate_ffmpeg_smart_crop_filter("dummy.mp4")

    def test_returns_string(self):
        result = self._run(1920, 1080)
        assert isinstance(result, str)

    def test_output_ends_with_scale_1080x1920(self):
        result = self._run(1920, 1080)
        assert result.endswith("scale=1080:1920")

    def test_filter_starts_with_crop(self):
        result = self._run(1920, 1080)
        assert result.startswith("crop=")

    def test_target_width_is_even(self):
        result = self._run(1920, 1080)
        crop_part = result.split(",")[0]
        target_w = int(crop_part[len("crop="):].split(":")[0])
        assert target_w % 2 == 0

    def test_crop_x_is_even(self):
        result = self._run(1920, 1080)
        crop_part = result.split(",")[0]
        crop_x = int(crop_part[len("crop="):].split(":")[2])
        assert crop_x % 2 == 0

    def test_crop_x_within_bounds(self):
        width, height = 1920, 1080
        result = self._run(width, height)
        crop_part = result.split(",")[0]
        params = crop_part[len("crop="):].split(":")
        crop_w, crop_x = int(params[0]), int(params[2])
        assert crop_x >= 0
        assert crop_x + crop_w <= width

    def test_portrait_video_stays_within_bounds(self):
        width, height = 1080, 1920
        result = self._run(width, height)
        crop_part = result.split(",")[0]
        params = crop_part[len("crop="):].split(":")
        crop_w, crop_x = int(params[0]), int(params[2])
        assert crop_x >= 0
        assert crop_x + crop_w <= width

    def test_square_video(self):
        result = self._run(1080, 1080)
        assert result.startswith("crop=")
        assert result.endswith("scale=1080:1920")

    def test_raises_on_unreadable_video(self):
        engine = SmartCropEngine()
        bad_cap = MagicMock()
        bad_cap.isOpened.return_value = False
        cv2_stub = sys.modules["cv2"]
        cv2_stub.VideoCapture = MagicMock(return_value=bad_cap)
        with patch.dict(sys.modules, {"mediapipe": None}):
            with pytest.raises(ValueError, match="Unable to read input video"):
                engine.generate_ffmpeg_smart_crop_filter("missing.mp4")

    def test_narrow_video_crop_w_not_wider_than_source(self):
        """For 640×480, target_w = min(int(480 * 9/16), 640) = min(270, 640) = 270."""
        result = self._run(640, 480)
        crop_part = result.split(",")[0]
        crop_w = int(crop_part[len("crop="):].split(":")[0])
        assert crop_w <= 640

    def test_filter_has_four_crop_params(self):
        """crop=W:H:X:0 — four colon-separated values."""
        result = self._run(1920, 1080)
        crop_part = result.split(",")[0]
        params = crop_part[len("crop="):].split(":")
        assert len(params) == 4

    def test_crop_y_offset_is_zero(self):
        result = self._run(1920, 1080)
        crop_part = result.split(",")[0]
        params = crop_part[len("crop="):].split(":")
        assert params[3] == "0"
