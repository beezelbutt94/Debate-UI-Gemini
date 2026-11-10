"""Tests for AudioMixEngine — exercises build_ducking_command() without
running FFmpeg. The command list is deterministic and fully testable.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

import pytest


class TestAudioMixEngine:
    @pytest.fixture(autouse=True)
    def setup(self):
        from app.pipeline.audio_mix import AudioMixEngine
        self.engine = AudioMixEngine()

    def _cmd(self, **kwargs):
        defaults = dict(
            voiceover_path='/tmp/vo.wav',
            background_music_path='/tmp/bgm.mp3',
            output_audio_path='/tmp/out.aac',
        )
        defaults.update(kwargs)
        return self.engine.build_ducking_command(**defaults)

    def test_returns_a_list(self):
        assert isinstance(self._cmd(), list)

    def test_starts_with_ffmpeg(self):
        assert self._cmd()[0] == 'ffmpeg'

    def test_contains_voiceover_path(self):
        cmd = self._cmd(voiceover_path='/a/b/vo.wav')
        assert '/a/b/vo.wav' in cmd

    def test_contains_bgm_path(self):
        cmd = self._cmd(background_music_path='/a/b/bgm.mp3')
        assert '/a/b/bgm.mp3' in cmd

    def test_contains_output_path(self):
        cmd = self._cmd(output_audio_path='/out/final.aac')
        assert '/out/final.aac' in cmd

    def test_filter_complex_present(self):
        cmd = self._cmd()
        assert '-filter_complex' in cmd

    def test_target_lufs_embedded_in_filter(self):
        cmd = self._cmd(target_i_lufs=-16.0)
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'I=-16.0' in fc

    def test_music_volume_embedded_in_filter(self):
        cmd = self._cmd(music_volume=0.5)
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'volume=0.5' in fc

    def test_ducking_ratio_minimum_clamp(self):
        """ratio = max(2.0, ducking_reduction_db / 2.0); anything <=4 dB → 2.0"""
        cmd = self._cmd(ducking_reduction_db=2.0)
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'ratio=2.0' in fc

    def test_ducking_ratio_above_clamp(self):
        """20 dB → ratio = 10.0"""
        cmd = self._cmd(ducking_reduction_db=20.0)
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'ratio=10.0' in fc

    def test_contains_aac_codec(self):
        cmd = self._cmd()
        assert 'aac' in cmd

    def test_contains_48k_sample_rate(self):
        cmd = self._cmd()
        assert '48000' in cmd

    def test_contains_overwrite_flag(self):
        assert '-y' in self._cmd()

    def test_custom_ffmpeg_bin(self):
        from app.pipeline.audio_mix import AudioMixEngine
        engine = AudioMixEngine(ffmpeg_bin='/usr/local/bin/ffmpeg')
        cmd = engine.build_ducking_command('/vo', '/bgm', '/out')
        assert cmd[0] == '/usr/local/bin/ffmpeg'

    def test_loudnorm_target_in_filter_complex(self):
        cmd = self._cmd(target_i_lufs=-14.0)
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'loudnorm' in fc
        assert 'I=-14.0' in fc

    def test_sidechaincompress_in_filter_complex(self):
        fc_idx = self._cmd().index('-filter_complex') + 1
        fc = self._cmd()[fc_idx]
        assert 'sidechaincompress' in fc
