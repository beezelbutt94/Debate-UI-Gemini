"""Tests for AudioMixEngine.build_ducking_command() — pure command-builder."""
import pytest
from app.pipeline.audio_mix import AudioMixEngine


class TestAudioMixEngineInit:
    def test_default_ffmpeg_bin(self):
        engine = AudioMixEngine()
        assert engine.ffmpeg_bin == "ffmpeg"

    def test_custom_ffmpeg_bin(self):
        engine = AudioMixEngine(ffmpeg_bin="/usr/local/bin/ffmpeg")
        assert engine.ffmpeg_bin == "/usr/local/bin/ffmpeg"


class TestBuildDuckingCommand:
    def setup_method(self):
        self.engine = AudioMixEngine()

    def _build(self, **kwargs):
        defaults = dict(
            voiceover_path="/tmp/vo.wav",
            background_music_path="/tmp/bgm.mp3",
            output_audio_path="/tmp/out.aac",
        )
        defaults.update(kwargs)
        return self.engine.build_ducking_command(**defaults)

    def test_returns_list(self):
        cmd = self._build()
        assert isinstance(cmd, list)

    def test_starts_with_ffmpeg(self):
        cmd = self._build()
        assert cmd[0] == "ffmpeg"

    def test_contains_y_flag(self):
        cmd = self._build()
        assert "-y" in cmd

    def test_contains_voiceover_input(self):
        cmd = self._build(voiceover_path="/tmp/my_vo.wav")
        assert "/tmp/my_vo.wav" in cmd

    def test_contains_bgm_input(self):
        cmd = self._build(background_music_path="/tmp/my_bgm.mp3")
        assert "/tmp/my_bgm.mp3" in cmd

    def test_contains_output_path(self):
        cmd = self._build(output_audio_path="/tmp/result.aac")
        assert "/tmp/result.aac" in cmd

    def test_contains_filter_complex_flag(self):
        cmd = self._build()
        assert "-filter_complex" in cmd

    def test_filter_complex_contains_volume(self):
        cmd = self._build(music_volume=0.25)
        fc_idx = cmd.index("-filter_complex")
        fc_value = cmd[fc_idx + 1]
        assert "volume=0.25" in fc_value

    def test_filter_complex_contains_loudnorm_target(self):
        cmd = self._build(target_i_lufs=-14.0)
        fc_idx = cmd.index("-filter_complex")
        fc_value = cmd[fc_idx + 1]
        assert "loudnorm" in fc_value
        assert "I=-14.0" in fc_value

    def test_filter_complex_contains_sidechaincompress(self):
        cmd = self._build()
        fc_idx = cmd.index("-filter_complex")
        fc_value = cmd[fc_idx + 1]
        assert "sidechaincompress" in fc_value

    def test_filter_complex_contains_amix(self):
        cmd = self._build()
        fc_idx = cmd.index("-filter_complex")
        fc_value = cmd[fc_idx + 1]
        assert "amix" in fc_value

    def test_output_codec_is_aac(self):
        cmd = self._build()
        assert "-c:a" in cmd
        ca_idx = cmd.index("-c:a")
        assert cmd[ca_idx + 1] == "aac"

    def test_output_bitrate_is_192k(self):
        cmd = self._build()
        assert "-b:a" in cmd
        ba_idx = cmd.index("-b:a")
        assert cmd[ba_idx + 1] == "192k"

    def test_sample_rate_is_48000(self):
        cmd = self._build()
        assert "-ar" in cmd
        ar_idx = cmd.index("-ar")
        assert cmd[ar_idx + 1] == "48000"

    def test_map_flag_present(self):
        cmd = self._build()
        assert "-map" in cmd

    def test_custom_music_volume_reflected_in_filter(self):
        cmd = self._build(music_volume=0.10)
        fc_idx = cmd.index("-filter_complex")
        fc_value = cmd[fc_idx + 1]
        assert "volume=0.1" in fc_value

    def test_custom_lufs_target(self):
        cmd = self._build(target_i_lufs=-23.0)
        fc_idx = cmd.index("-filter_complex")
        fc_value = cmd[fc_idx + 1]
        assert "I=-23.0" in fc_value

    def test_ratio_is_at_least_2(self):
        # ducking_reduction_db=14 → ratio = max(2, 14/2) = 7
        cmd = self._build(ducking_reduction_db=14.0)
        fc_idx = cmd.index("-filter_complex")
        fc_value = cmd[fc_idx + 1]
        assert "ratio=7.0" in fc_value

    def test_ratio_clamps_to_2_for_small_reduction(self):
        # ducking_reduction_db=2 → 2/2=1, max(2,1)=2
        cmd = self._build(ducking_reduction_db=2.0)
        fc_idx = cmd.index("-filter_complex")
        fc_value = cmd[fc_idx + 1]
        assert "ratio=2.0" in fc_value

    def test_stream_loop_flag_for_bgm(self):
        cmd = self._build()
        assert "-stream_loop" in cmd

    def test_last_element_is_output_path(self):
        cmd = self._build(output_audio_path="/out/final.aac")
        assert cmd[-1] == "/out/final.aac"

    def test_different_paths_produce_different_commands(self):
        cmd1 = self._build(voiceover_path="/a.wav")
        cmd2 = self._build(voiceover_path="/b.wav")
        assert cmd1 != cmd2


class TestBuildDuckingCommandCustomBin:
    def test_custom_ffmpeg_bin_in_command(self):
        engine = AudioMixEngine(ffmpeg_bin="/opt/ffmpeg/bin/ffmpeg")
        cmd = engine.build_ducking_command("/vo.wav", "/bgm.mp3", "/out.aac")
        assert cmd[0] == "/opt/ffmpeg/bin/ffmpeg"
