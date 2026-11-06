"""Tests for AudioMixEngine.build_ducking_command() – pure command-list builder."""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'services', 'api'))
from app.pipeline.audio_mix import AudioMixEngine


class TestAudioMixEngineBuildDuckingCommand:
    def setup_method(self):
        self.engine = AudioMixEngine(ffmpeg_bin='ffmpeg')

    # ── basic structure ──────────────────────────────────────────────────────

    def test_returns_a_list(self):
        cmd = self.engine.build_ducking_command('vo.wav', 'bgm.mp3', 'out.aac')
        assert isinstance(cmd, list)

    def test_starts_with_ffmpeg_bin(self):
        cmd = self.engine.build_ducking_command('vo.wav', 'bgm.mp3', 'out.aac')
        assert cmd[0] == 'ffmpeg'

    def test_has_overwrite_flag(self):
        cmd = self.engine.build_ducking_command('vo.wav', 'bgm.mp3', 'out.aac')
        assert '-y' in cmd

    def test_includes_voiceover_path(self):
        cmd = self.engine.build_ducking_command('/a/vo.wav', '/b/bgm.mp3', '/c/out.aac')
        assert '/a/vo.wav' in cmd

    def test_includes_music_path(self):
        cmd = self.engine.build_ducking_command('/a/vo.wav', '/b/bgm.mp3', '/c/out.aac')
        assert '/b/bgm.mp3' in cmd

    def test_ends_with_output_path(self):
        cmd = self.engine.build_ducking_command('vo.wav', 'bgm.mp3', '/c/out.aac')
        assert cmd[-1] == '/c/out.aac'

    def test_uses_aac_codec(self):
        cmd = self.engine.build_ducking_command('vo.wav', 'bgm.mp3', 'out.aac')
        assert '-c:a' in cmd
        idx = cmd.index('-c:a')
        assert cmd[idx + 1] == 'aac'

    # ── filter content ───────────────────────────────────────────────────────

    def test_filter_complex_contains_volume(self):
        cmd = self.engine.build_ducking_command('vo.wav', 'bgm.mp3', 'out.aac', music_volume=0.3)
        fc = ' '.join(cmd)
        assert 'volume=0.3' in fc

    def test_filter_complex_contains_loudnorm(self):
        cmd = self.engine.build_ducking_command('vo.wav', 'bgm.mp3', 'out.aac', target_i_lufs=-14.0)
        fc = ' '.join(cmd)
        assert 'loudnorm' in fc
        assert 'I=-14.0' in fc

    def test_filter_complex_contains_sidechaincompress(self):
        cmd = self.engine.build_ducking_command('vo.wav', 'bgm.mp3', 'out.aac')
        fc = ' '.join(cmd)
        assert 'sidechaincompress' in fc

    def test_filter_complex_contains_amix(self):
        cmd = self.engine.build_ducking_command('vo.wav', 'bgm.mp3', 'out.aac')
        fc = ' '.join(cmd)
        assert 'amix' in fc

    def test_filter_complex_contains_stream_loop(self):
        cmd = self.engine.build_ducking_command('vo.wav', 'bgm.mp3', 'out.aac')
        assert '-stream_loop' in cmd

    # ── ducking reduction ratio calculation ──────────────────────────────────

    def test_ratio_uses_max_of_2_and_half_ducking_db(self):
        # ducking_reduction_db=14 → ratio = max(2.0, 7.0) = 7.0
        cmd = self.engine.build_ducking_command('vo.wav', 'bgm.mp3', 'out.aac', ducking_reduction_db=14.0)
        fc = ' '.join(cmd)
        assert 'ratio=7.0' in fc

    def test_ratio_floor_at_2_for_low_ducking_db(self):
        # ducking_reduction_db=2 → ratio = max(2.0, 1.0) = 2.0
        cmd = self.engine.build_ducking_command('vo.wav', 'bgm.mp3', 'out.aac', ducking_reduction_db=2.0)
        fc = ' '.join(cmd)
        assert 'ratio=2.0' in fc

    # ── custom ffmpeg bin ────────────────────────────────────────────────────

    def test_custom_ffmpeg_bin(self):
        engine = AudioMixEngine(ffmpeg_bin='/usr/local/bin/ffmpeg')
        cmd = engine.build_ducking_command('vo.wav', 'bgm.mp3', 'out.aac')
        assert cmd[0] == '/usr/local/bin/ffmpeg'

    # ── output format ────────────────────────────────────────────────────────

    def test_output_bitrate_is_192k(self):
        cmd = self.engine.build_ducking_command('vo.wav', 'bgm.mp3', 'out.aac')
        assert '-b:a' in cmd
        idx = cmd.index('-b:a')
        assert cmd[idx + 1] == '192k'

    def test_sample_rate_is_48000(self):
        cmd = self.engine.build_ducking_command('vo.wav', 'bgm.mp3', 'out.aac')
        assert '-ar' in cmd
        idx = cmd.index('-ar')
        assert cmd[idx + 1] == '48000'
