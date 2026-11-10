"""Tests for ExtractedClipCandidate model and extract_lossless_subclip error handling."""
import pytest
from unittest.mock import patch, MagicMock


class TestExtractedClipCandidate:
    def _make(self, **overrides):
        from app.pipeline.repurpose import ExtractedClipCandidate
        base = dict(
            clip_id="clip_1",
            start_second=10.5,
            end_second=35.0,
            duration=24.5,
            hook_text="You won't believe this stat",
            virality_rationale="Strong curiosity gap in the first 3 words",
            confidence_score=0.85,
        )
        base.update(overrides)
        return ExtractedClipCandidate(**base)

    def test_valid_candidate_instantiates(self):
        c = self._make()
        assert c.clip_id == "clip_1"

    def test_confidence_score_zero_valid(self):
        c = self._make(confidence_score=0.0)
        assert c.confidence_score == 0.0

    def test_confidence_score_one_valid(self):
        c = self._make(confidence_score=1.0)
        assert c.confidence_score == 1.0

    def test_confidence_score_below_zero_raises(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self._make(confidence_score=-0.01)

    def test_confidence_score_above_one_raises(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self._make(confidence_score=1.01)

    def test_start_second_can_be_zero(self):
        c = self._make(start_second=0.0)
        assert c.start_second == 0.0

    def test_all_fields_stored(self):
        c = self._make()
        assert c.start_second == 10.5
        assert c.end_second == 35.0
        assert c.duration == 24.5
        assert c.hook_text == "You won't believe this stat"
        assert c.virality_rationale == "Strong curiosity gap in the first 3 words"


class TestExtractLosslessSubclip:
    def setup_method(self):
        from app.pipeline.repurpose import LongFormRepurposingEngine
        # Patch WhisperModel to avoid importing faster-whisper
        with patch('app.pipeline.repurpose.LongFormRepurposingEngine.__init__', return_value=None):
            self.engine = LongFormRepurposingEngine.__new__(LongFormRepurposingEngine)

    def test_returns_output_path_on_success(self):
        mock_result = MagicMock()
        mock_result.returncode = 0
        with patch('subprocess.run', return_value=mock_result):
            result = self.engine.extract_lossless_subclip(
                "input.mp4", 10.0, 25.0, "output.mp4"
            )
        assert result == "output.mp4"

    def test_raises_runtime_error_on_ffmpeg_failure(self):
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = "Error: file not found"
        with patch('subprocess.run', return_value=mock_result):
            with pytest.raises(RuntimeError, match="Subclip extraction failed"):
                self.engine.extract_lossless_subclip(
                    "missing.mp4", 0.0, 10.0, "out.mp4"
                )

    def test_error_message_includes_stderr(self):
        mock_result = MagicMock()
        mock_result.returncode = 2
        mock_result.stderr = "No such file or directory"
        with patch('subprocess.run', return_value=mock_result):
            with pytest.raises(RuntimeError) as exc:
                self.engine.extract_lossless_subclip("bad.mp4", 0.0, 5.0, "out.mp4")
        assert "No such file or directory" in str(exc.value)

    def test_ffmpeg_command_uses_libx264(self):
        mock_result = MagicMock()
        mock_result.returncode = 0
        called_with = {}
        def capture_run(cmd, **kwargs):
            called_with['cmd'] = cmd
            return mock_result
        with patch('subprocess.run', side_effect=capture_run):
            self.engine.extract_lossless_subclip("in.mp4", 5.0, 20.0, "out.mp4")
        assert 'libx264' in called_with['cmd']

    def test_ffmpeg_command_includes_start_and_duration(self):
        mock_result = MagicMock()
        mock_result.returncode = 0
        captured = {}
        def capture(cmd, **kwargs):
            captured['cmd'] = cmd
            return mock_result
        with patch('subprocess.run', side_effect=capture):
            self.engine.extract_lossless_subclip("in.mp4", 7.5, 15.0, "out.mp4")
        cmd_str = ' '.join(str(c) for c in captured['cmd'])
        assert '7.5' in cmd_str
        assert '15.0' in cmd_str
