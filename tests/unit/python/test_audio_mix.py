"""Tests for AudioMixEngine — pure computation only (no FFmpeg execution)."""
import pytest
from app.pipeline.audio_mix import AudioMixEngine


class TestAudioMixEngineBuildDuckingCommand:
    def setup_method(self):
        self.engine = AudioMixEngine(ffmpeg_bin="ffmpeg")

    def _build(self, **kwargs):
        return self.engine.build_ducking_command(
            voiceover_path=kwargs.get("vo", "vo.wav"),
            background_music_path=kwargs.get("bgm", "bgm.mp3"),
            output_audio_path=kwargs.get("out", "out.aac"),
            music_volume=kwargs.get("music_volume", 0.25),
            ducking_reduction_db=kwargs.get("ducking_reduction_db", 14.0),
            target_i_lufs=kwargs.get("target_i_lufs", -14.0),
        )

    # ── command structure ────────────────────────────────────────────────────

    def test_first_element_is_ffmpeg_bin(self):
        cmd = self._build()
        assert cmd[0] == "ffmpeg"

    def test_contains_y_flag(self):
        cmd = self._build()
        assert "-y" in cmd

    def test_input_files_present(self):
        cmd = self._build(vo="myvox.wav", bgm="music.mp3")
        assert "myvox.wav" in cmd
        assert "music.mp3" in cmd

    def test_output_file_present(self):
        cmd = self._build(out="result.aac")
        assert "result.aac" in cmd

    def test_stream_loop_flag_present_for_bgm(self):
        cmd = self._build()
        assert "-stream_loop" in cmd
        idx = cmd.index("-stream_loop")
        assert cmd[idx + 1] == "-1"

    def test_codec_aac(self):
        cmd = self._build()
        assert "-c:a" in cmd
        idx = cmd.index("-c:a")
        assert cmd[idx + 1] == "aac"

    def test_bitrate_192k(self):
        cmd = self._build()
        assert "192k" in cmd

    def test_sample_rate_48000(self):
        cmd = self._build()
        assert "48000" in cmd

    # ── filter_complex correctness ───────────────────────────────────────────

    def _get_filter(self, **kwargs):
        cmd = self._build(**kwargs)
        idx = cmd.index("-filter_complex")
        return cmd[idx + 1]

    def test_filter_complex_present(self):
        cmd = self._build()
        assert "-filter_complex" in cmd

    def test_filter_contains_loudnorm_target(self):
        fc = self._get_filter(target_i_lufs=-14.0)
        assert "loudnorm=I=-14.0" in fc

    def test_filter_loudnorm_custom_target(self):
        fc = self._get_filter(target_i_lufs=-16.0)
        assert "loudnorm=I=-16.0" in fc

    def test_filter_contains_music_volume(self):
        fc = self._get_filter(music_volume=0.25)
        assert "volume=0.25" in fc

    def test_filter_contains_custom_music_volume(self):
        fc = self._get_filter(music_volume=0.10)
        assert "volume=0.1" in fc

    def test_filter_contains_sidechaincompress(self):
        fc = self._get_filter()
        assert "sidechaincompress" in fc

    def test_filter_contains_amix(self):
        fc = self._get_filter()
        assert "amix" in fc

    def test_filter_outputs_mastered_audio_label(self):
        fc = self._get_filter()
        assert "[mastered_audio]" in fc

    # ── ratio calculation: ratio = max(2.0, ducking_reduction_db / 2) ────────

    def test_ratio_with_default_14db(self):
        # max(2.0, 14.0/2) = max(2.0, 7.0) = 7.0
        fc = self._get_filter(ducking_reduction_db=14.0)
        assert "ratio=7.0" in fc

    def test_ratio_with_low_db_clamps_to_2(self):
        # max(2.0, 2.0/2) = max(2.0, 1.0) = 2.0
        fc = self._get_filter(ducking_reduction_db=2.0)
        assert "ratio=2.0" in fc

    def test_ratio_with_very_high_db(self):
        # max(2.0, 40.0/2) = max(2.0, 20.0) = 20.0
        fc = self._get_filter(ducking_reduction_db=40.0)
        assert "ratio=20.0" in fc

    def test_ratio_zero_db_clamps_to_2(self):
        # max(2.0, 0/2) = max(2.0, 0) = 2.0
        fc = self._get_filter(ducking_reduction_db=0.0)
        assert "ratio=2.0" in fc

    # ── custom ffmpeg_bin ────────────────────────────────────────────────────

    def test_custom_ffmpeg_bin(self):
        engine = AudioMixEngine(ffmpeg_bin="/usr/local/bin/ffmpeg")
        cmd = engine.build_ducking_command("vo.wav", "bgm.mp3", "out.aac")
        assert cmd[0] == "/usr/local/bin/ffmpeg"

    # ── return type ──────────────────────────────────────────────────────────

    def test_returns_list_of_strings(self):
        cmd = self._build()
        assert isinstance(cmd, list)
        assert all(isinstance(x, str) for x in cmd)
