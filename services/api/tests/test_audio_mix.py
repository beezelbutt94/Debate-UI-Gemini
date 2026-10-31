"""Tests for app.pipeline.audio_mix – AudioMixEngine.build_ducking_command.

build_ducking_command is a pure function that constructs an FFmpeg argument
list from its inputs; no external processes are spawned in these tests.
"""
import os
import sys

import pytest

_API_ROOT = os.path.join(os.path.dirname(__file__), "..")
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

from app.pipeline.audio_mix import AudioMixEngine


class TestAudioMixEngineBuildDuckingCommand:
    def setup_method(self):
        self.engine = AudioMixEngine()

    # --- Output is a list of strings ---

    def test_returns_list(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert isinstance(cmd, list)

    def test_all_elements_are_strings(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert all(isinstance(el, str) for el in cmd)

    # --- Paths are included ---

    def test_voiceover_path_in_command(self):
        cmd = self.engine.build_ducking_command("/audio/vo.wav", "bgm.mp3", "out.aac")
        assert "/audio/vo.wav" in cmd

    def test_bgm_path_in_command(self):
        cmd = self.engine.build_ducking_command("vo.wav", "/music/bgm.mp3", "out.aac")
        assert "/music/bgm.mp3" in cmd

    def test_output_path_in_command(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "/output/final.aac")
        assert "/output/final.aac" in cmd

    # --- FFmpeg binary ---

    def test_first_element_is_ffmpeg(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert cmd[0] == "ffmpeg"

    def test_custom_ffmpeg_bin(self):
        engine = AudioMixEngine(ffmpeg_bin="/usr/local/bin/ffmpeg")
        cmd = engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert cmd[0] == "/usr/local/bin/ffmpeg"

    def test_overwrite_flag_present(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert "-y" in cmd

    # --- Filter complex contains key audio parameters ---

    def _get_filter_complex(self, **kwargs) -> str:
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac", **kwargs)
        idx = cmd.index("-filter_complex")
        return cmd[idx + 1]

    def test_filter_complex_present(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert "-filter_complex" in cmd

    def test_filter_complex_includes_loudnorm(self):
        fc = self._get_filter_complex()
        assert "loudnorm" in fc

    def test_filter_complex_includes_sidechaincompress(self):
        fc = self._get_filter_complex()
        assert "sidechaincompress" in fc

    def test_default_target_lufs_in_filter(self):
        fc = self._get_filter_complex()
        assert "I=-14.0" in fc or "I=-14" in fc

    def test_custom_target_lufs(self):
        fc = self._get_filter_complex(target_i_lufs=-23.0)
        assert "I=-23.0" in fc or "I=-23" in fc

    def test_default_music_volume_in_filter(self):
        fc = self._get_filter_complex()
        assert "volume=0.25" in fc

    def test_custom_music_volume(self):
        fc = self._get_filter_complex(music_volume=0.10)
        assert "volume=0.1" in fc

    # --- Output codec ---

    def test_output_codec_aac(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert "-c:a" in cmd
        codec_idx = cmd.index("-c:a")
        assert cmd[codec_idx + 1] == "aac"

    def test_output_bitrate_192k(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert "192k" in cmd

    def test_sample_rate_48000(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert "48000" in cmd

    # --- Ducking ratio derived from ducking_reduction_db ---

    def test_ratio_is_at_least_2_for_small_reduction(self):
        fc = self._get_filter_complex(ducking_reduction_db=1.0)
        # ratio = max(2.0, 1.0/2.0) = 2.0
        assert "ratio=2.0" in fc

    def test_ratio_scales_with_larger_reduction(self):
        # ducking_reduction_db=20.0 → ratio = max(2.0, 10.0) = 10.0
        fc = self._get_filter_complex(ducking_reduction_db=20.0)
        assert "ratio=10.0" in fc

    # --- Stream loop for background music ---

    def test_stream_loop_flag_present(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert "-stream_loop" in cmd

    def test_stream_loop_value_is_minus_one(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        idx = cmd.index("-stream_loop")
        assert cmd[idx + 1] == "-1"
