"""Tests for app.pipeline.repurpose – LongFormRepurposingEngine.extract_lossless_subclip.

extract_lossless_subclip is synchronous and calls subprocess.run to invoke
FFmpeg. We mock subprocess.run so no real FFmpeg binary is required.
"""
import os
import subprocess
import sys
from unittest.mock import MagicMock, patch

import pytest

_API_ROOT = os.path.join(os.path.dirname(__file__), "..")
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

# faster_whisper is an ML dependency; mock it so the import succeeds.
_mock_fw = MagicMock()
with patch.dict("sys.modules", {"faster_whisper": _mock_fw}):
    from app.pipeline.repurpose import LongFormRepurposingEngine


def _make_engine() -> LongFormRepurposingEngine:
    """Create a LongFormRepurposingEngine with a mocked transcriber."""
    mock_transcriber = MagicMock()
    engine = object.__new__(LongFormRepurposingEngine)
    engine.transcriber = mock_transcriber
    return engine


class TestExtractLosslessSubclip:
    def setup_method(self):
        self.engine = _make_engine()

    def _make_completed_process(self, returncode: int, stderr: str = "") -> subprocess.CompletedProcess:
        proc = MagicMock(spec=subprocess.CompletedProcess)
        proc.returncode = returncode
        proc.stderr = stderr
        return proc

    # --- Success path ---

    def test_returns_output_path_on_success(self):
        mock_proc = self._make_completed_process(0)
        with patch("subprocess.run", return_value=mock_proc):
            result = self.engine.extract_lossless_subclip(
                "/input/video.mp4", 10.0, 30.0, "/output/clip.mp4"
            )
        assert result == "/output/clip.mp4"

    def test_subprocess_called_with_ffmpeg(self):
        mock_proc = self._make_completed_process(0)
        captured = {}

        def fake_run(cmd, **kwargs):
            captured["cmd"] = cmd
            return mock_proc

        with patch("subprocess.run", side_effect=fake_run):
            self.engine.extract_lossless_subclip(
                "source.mp4", 5.0, 20.0, "out.mp4"
            )

        assert captured["cmd"][0] == "ffmpeg"

    def test_subprocess_receives_start_second(self):
        mock_proc = self._make_completed_process(0)
        captured = {}

        def fake_run(cmd, **kwargs):
            captured["cmd"] = cmd
            return mock_proc

        with patch("subprocess.run", side_effect=fake_run):
            self.engine.extract_lossless_subclip(
                "source.mp4", 42.5, 10.0, "out.mp4"
            )

        cmd_str = " ".join(str(x) for x in captured["cmd"])
        assert "42.5" in cmd_str

    def test_subprocess_receives_duration(self):
        mock_proc = self._make_completed_process(0)
        captured = {}

        def fake_run(cmd, **kwargs):
            captured["cmd"] = cmd
            return mock_proc

        with patch("subprocess.run", side_effect=fake_run):
            self.engine.extract_lossless_subclip(
                "source.mp4", 0.0, 55.5, "out.mp4"
            )

        cmd_str = " ".join(str(x) for x in captured["cmd"])
        assert "55.5" in cmd_str

    def test_subprocess_receives_source_video(self):
        mock_proc = self._make_completed_process(0)
        captured = {}

        def fake_run(cmd, **kwargs):
            captured["cmd"] = cmd
            return mock_proc

        with patch("subprocess.run", side_effect=fake_run):
            self.engine.extract_lossless_subclip(
                "/unique/source_video.mp4", 0.0, 10.0, "out.mp4"
            )

        assert "/unique/source_video.mp4" in captured["cmd"]

    def test_subprocess_receives_output_path(self):
        mock_proc = self._make_completed_process(0)
        captured = {}

        def fake_run(cmd, **kwargs):
            captured["cmd"] = cmd
            return mock_proc

        with patch("subprocess.run", side_effect=fake_run):
            self.engine.extract_lossless_subclip(
                "source.mp4", 0.0, 10.0, "/unique/output_clip.mp4"
            )

        assert "/unique/output_clip.mp4" in captured["cmd"]

    # --- Failure path ---

    def test_raises_runtime_error_on_nonzero_returncode(self):
        mock_proc = self._make_completed_process(1, stderr="FFmpeg failed: no codec")
        with patch("subprocess.run", return_value=mock_proc):
            with pytest.raises(RuntimeError, match="Subclip extraction failed"):
                self.engine.extract_lossless_subclip(
                    "source.mp4", 0.0, 10.0, "out.mp4"
                )

    def test_error_message_includes_stderr(self):
        stderr_msg = "error: codec not found for output format"
        mock_proc = self._make_completed_process(2, stderr=stderr_msg)
        with patch("subprocess.run", return_value=mock_proc):
            with pytest.raises(RuntimeError) as exc_info:
                self.engine.extract_lossless_subclip(
                    "source.mp4", 0.0, 10.0, "out.mp4"
                )
        assert stderr_msg in str(exc_info.value)

    def test_returncode_minus_1_raises(self):
        mock_proc = self._make_completed_process(-1, stderr="signal killed")
        with patch("subprocess.run", return_value=mock_proc):
            with pytest.raises(RuntimeError):
                self.engine.extract_lossless_subclip(
                    "source.mp4", 0.0, 5.0, "out.mp4"
                )

    # --- Codec flags ---

    def test_libx264_codec_in_command(self):
        mock_proc = self._make_completed_process(0)
        captured = {}

        def fake_run(cmd, **kwargs):
            captured["cmd"] = cmd
            return mock_proc

        with patch("subprocess.run", side_effect=fake_run):
            self.engine.extract_lossless_subclip(
                "source.mp4", 0.0, 10.0, "out.mp4"
            )

        assert "libx264" in captured["cmd"]

    def test_aac_audio_codec_in_command(self):
        mock_proc = self._make_completed_process(0)
        captured = {}

        def fake_run(cmd, **kwargs):
            captured["cmd"] = cmd
            return mock_proc

        with patch("subprocess.run", side_effect=fake_run):
            self.engine.extract_lossless_subclip(
                "source.mp4", 0.0, 10.0, "out.mp4"
            )

        assert "aac" in captured["cmd"]

    # --- Edge cases ---

    def test_start_at_zero(self):
        mock_proc = self._make_completed_process(0)
        with patch("subprocess.run", return_value=mock_proc):
            result = self.engine.extract_lossless_subclip(
                "source.mp4", 0.0, 10.0, "out.mp4"
            )
        assert result == "out.mp4"

    def test_very_short_clip(self):
        mock_proc = self._make_completed_process(0)
        with patch("subprocess.run", return_value=mock_proc):
            result = self.engine.extract_lossless_subclip(
                "source.mp4", 0.0, 0.1, "tiny.mp4"
            )
        assert result == "tiny.mp4"
