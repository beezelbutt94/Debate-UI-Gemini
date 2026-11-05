"""Tests for LongFormRepurposingEngine.extract_lossless_subclip().
FFmpeg is mocked out — we validate the command construction only.
"""
import sys
import os
import unittest.mock as mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

import pytest


@pytest.fixture
def engine():
    # Mock faster_whisper so the class can be constructed without a model
    with mock.patch.dict('sys.modules', {
        'faster_whisper': mock.MagicMock(),
    }):
        from app.pipeline.repurpose import LongFormRepurposingEngine
        e = LongFormRepurposingEngine.__new__(LongFormRepurposingEngine)
        # We only test extract_lossless_subclip, which doesn't use self.transcriber
        return e


class TestExtractLosslessSubclip:
    def test_success_returns_output_path(self, engine):
        result = mock.MagicMock(returncode=0)
        with mock.patch('subprocess.run', return_value=result) as _:
            path = engine.extract_lossless_subclip('/src.mp4', 10.0, 30.0, '/out.mp4')
        assert path == '/out.mp4'

    def test_calls_ffmpeg(self, engine):
        result = mock.MagicMock(returncode=0)
        with mock.patch('subprocess.run', return_value=result) as run_mock:
            engine.extract_lossless_subclip('/src.mp4', 0.0, 15.0, '/out.mp4')
        cmd = run_mock.call_args[0][0]
        assert cmd[0] == 'ffmpeg'

    def test_start_second_in_command(self, engine):
        result = mock.MagicMock(returncode=0)
        with mock.patch('subprocess.run', return_value=result) as run_mock:
            engine.extract_lossless_subclip('/src.mp4', 42.5, 10.0, '/out.mp4')
        cmd = run_mock.call_args[0][0]
        assert '42.5' in cmd

    def test_duration_in_command(self, engine):
        result = mock.MagicMock(returncode=0)
        with mock.patch('subprocess.run', return_value=result) as run_mock:
            engine.extract_lossless_subclip('/src.mp4', 0.0, 55.0, '/out.mp4')
        cmd = run_mock.call_args[0][0]
        assert '55.0' in cmd

    def test_input_file_in_command(self, engine):
        result = mock.MagicMock(returncode=0)
        with mock.patch('subprocess.run', return_value=result) as run_mock:
            engine.extract_lossless_subclip('/myvideo.mp4', 0.0, 20.0, '/out.mp4')
        cmd = run_mock.call_args[0][0]
        assert '/myvideo.mp4' in cmd

    def test_output_file_in_command(self, engine):
        result = mock.MagicMock(returncode=0)
        with mock.patch('subprocess.run', return_value=result) as run_mock:
            engine.extract_lossless_subclip('/src.mp4', 0.0, 20.0, '/subclip_01.mp4')
        cmd = run_mock.call_args[0][0]
        assert '/subclip_01.mp4' in cmd

    def test_nonzero_returncode_raises_runtime_error(self, engine):
        fail_result = mock.MagicMock(returncode=1, stderr='some ffmpeg error')
        with mock.patch('subprocess.run', return_value=fail_result):
            with pytest.raises(RuntimeError, match='Subclip extraction failed'):
                engine.extract_lossless_subclip('/src.mp4', 0.0, 10.0, '/out.mp4')

    def test_command_uses_libx264(self, engine):
        result = mock.MagicMock(returncode=0)
        with mock.patch('subprocess.run', return_value=result) as run_mock:
            engine.extract_lossless_subclip('/src.mp4', 0.0, 10.0, '/out.mp4')
        cmd = run_mock.call_args[0][0]
        assert 'libx264' in cmd

    def test_command_uses_aac_audio(self, engine):
        result = mock.MagicMock(returncode=0)
        with mock.patch('subprocess.run', return_value=result) as run_mock:
            engine.extract_lossless_subclip('/src.mp4', 0.0, 10.0, '/out.mp4')
        cmd = run_mock.call_args[0][0]
        assert 'aac' in cmd

    def test_error_message_contains_stderr(self, engine):
        fail_result = mock.MagicMock(returncode=2, stderr='specific_error_text')
        with mock.patch('subprocess.run', return_value=fail_result):
            with pytest.raises(RuntimeError) as exc_info:
                engine.extract_lossless_subclip('/src.mp4', 0.0, 5.0, '/out.mp4')
        assert 'specific_error_text' in str(exc_info.value)


class TestExtractedClipCandidateModel:
    def test_valid_candidate(self):
        from app.pipeline.repurpose import ExtractedClipCandidate
        c = ExtractedClipCandidate(
            clip_id='c1',
            start_second=10.5,
            end_second=40.5,
            duration=30.0,
            hook_text='Amazing hook',
            virality_rationale='High curiosity gap',
            confidence_score=0.95,
        )
        assert c.confidence_score == 0.95

    def test_confidence_score_below_zero_raises(self):
        from app.pipeline.repurpose import ExtractedClipCandidate
        with pytest.raises(Exception):
            ExtractedClipCandidate(
                clip_id='c2', start_second=0.0, end_second=10.0,
                duration=10.0, hook_text='h', virality_rationale='r',
                confidence_score=-0.1,
            )

    def test_confidence_score_above_one_raises(self):
        from app.pipeline.repurpose import ExtractedClipCandidate
        with pytest.raises(Exception):
            ExtractedClipCandidate(
                clip_id='c3', start_second=0.0, end_second=10.0,
                duration=10.0, hook_text='h', virality_rationale='r',
                confidence_score=1.1,
            )

    def test_confidence_score_boundary_zero(self):
        from app.pipeline.repurpose import ExtractedClipCandidate
        c = ExtractedClipCandidate(
            clip_id='c4', start_second=0.0, end_second=5.0,
            duration=5.0, hook_text='h', virality_rationale='r',
            confidence_score=0.0,
        )
        assert c.confidence_score == 0.0

    def test_confidence_score_boundary_one(self):
        from app.pipeline.repurpose import ExtractedClipCandidate
        c = ExtractedClipCandidate(
            clip_id='c5', start_second=0.0, end_second=5.0,
            duration=5.0, hook_text='h', virality_rationale='r',
            confidence_score=1.0,
        )
        assert c.confidence_score == 1.0
