"""Tests for services/api/app/pipeline/audio_mix.py

Covers AudioMixEngine.build_ducking_command() -- a pure command-builder
with no network calls or external binaries needed.
"""
import sys

import pytest

sys.path.insert(0, "services/api")
from app.pipeline.audio_mix import AudioMixEngine


def make_engine(bin_name: str = "ffmpeg") -> AudioMixEngine:
    return AudioMixEngine(ffmpeg_bin=bin_name)


class TestBuildDuckingCommand:
    def setup_method(self):
        self.engine = make_engine()

    def test_returns_list(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert isinstance(cmd, list)

    def test_starts_with_ffmpeg(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert cmd[0] == "ffmpeg"

    def test_overwrite_flag(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert "-y" in cmd

    def test_voiceover_is_first_input(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        i_idx = cmd.index("-i")
        assert cmd[i_idx + 1] == "vo.wav"

    def test_music_is_second_input(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        # Find second -i occurrence
        indices = [i for i, v in enumerate(cmd) if v == "-i"]
        assert len(indices) >= 2
        assert cmd[indices[1] + 1] == "bgm.mp3"

    def test_output_path_last(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert cmd[-1] == "out.aac"

    def test_stream_loop_for_music(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert "-stream_loop" in cmd
        idx = cmd.index("-stream_loop")
        assert cmd[idx + 1] == "-1"

    def test_filter_complex_present(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert "-filter_complex" in cmd

    def test_loudnorm_target_in_filter(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac",
                                                target_i_lufs=-14.0)
        fc_idx = cmd.index("-filter_complex")
        fc_str = cmd[fc_idx + 1]
        assert "I=-14.0" in fc_str

    def test_custom_lufs_target(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac",
                                                target_i_lufs=-23.0)
        fc_idx = cmd.index("-filter_complex")
        fc_str = cmd[fc_idx + 1]
        assert "I=-23.0" in fc_str

    def test_music_volume_in_filter(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac",
                                                music_volume=0.5)
        fc_idx = cmd.index("-filter_complex")
        fc_str = cmd[fc_idx + 1]
        assert "volume=0.5" in fc_str

    def test_ratio_minimum_clamp_at_two(self):
        """With very low ducking_reduction_db (< 4), ratio should be 2.0."""
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac",
                                                ducking_reduction_db=0.0)
        fc_idx = cmd.index("-filter_complex")
        fc_str = cmd[fc_idx + 1]
        assert "ratio=2.0" in fc_str

    def test_ratio_above_minimum(self):
        """With ducking_reduction_db=30, ratio = 15.0."""
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac",
                                                ducking_reduction_db=30.0)
        fc_idx = cmd.index("-filter_complex")
        fc_str = cmd[fc_idx + 1]
        assert "ratio=15.0" in fc_str

    def test_audio_codec_aac(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert "-c:a" in cmd
        idx = cmd.index("-c:a")
        assert cmd[idx + 1] == "aac"

    def test_audio_bitrate_192k(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert "-b:a" in cmd
        idx = cmd.index("-b:a")
        assert cmd[idx + 1] == "192k"

    def test_sample_rate_48000(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert "-ar" in cmd
        idx = cmd.index("-ar")
        assert cmd[idx + 1] == "48000"

    def test_custom_ffmpeg_bin(self):
        eng = AudioMixEngine(ffmpeg_bin="/opt/bin/ffmpeg")
        cmd = eng.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert cmd[0] == "/opt/bin/ffmpeg"

    def test_sidechain_compress_in_filter(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        fc_idx = cmd.index("-filter_complex")
        fc_str = cmd[fc_idx + 1]
        assert "sidechaincompress" in fc_str

    def test_amix_duration_first(self):
        cmd = self.engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        fc_idx = cmd.index("-filter_complex")
        fc_str = cmd[fc_idx + 1]
        assert "amix=inputs=2:duration=first" in fc_str
