"""Tests for AudioMixEngine — pure command-builder logic, no FFmpeg execution."""
import pytest
from app.pipeline.audio_mix import AudioMixEngine


class TestBuildDuckingCommand:
    def setup_method(self):
        self.engine = AudioMixEngine(ffmpeg_bin='ffmpeg')

    def _build(self, **kwargs):
        defaults = dict(
            voiceover_path='/tmp/vo.wav',
            background_music_path='/tmp/bgm.mp3',
            output_audio_path='/tmp/out.aac',
        )
        defaults.update(kwargs)
        return self.engine.build_ducking_command(**defaults)

    def test_returns_list(self):
        assert isinstance(self._build(), list)

    def test_starts_with_ffmpeg(self):
        cmd = self._build()
        assert cmd[0] == 'ffmpeg'

    def test_includes_y_flag(self):
        cmd = self._build()
        assert '-y' in cmd

    def test_includes_voiceover_input(self):
        cmd = self._build(voiceover_path='/vo/audio.wav')
        assert '/vo/audio.wav' in cmd

    def test_includes_bgm_input(self):
        cmd = self._build(background_music_path='/bgm/music.mp3')
        assert '/bgm/music.mp3' in cmd

    def test_includes_output_path(self):
        cmd = self._build(output_audio_path='/out/mixed.aac')
        assert '/out/mixed.aac' in cmd

    def test_includes_filter_complex(self):
        cmd = self._build()
        assert '-filter_complex' in cmd

    def test_filter_includes_volume_music(self):
        cmd = self._build(music_volume=0.25)
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'volume=0.25' in fc

    def test_filter_includes_sidechaincompress(self):
        cmd = self._build()
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'sidechaincompress' in fc

    def test_filter_includes_loudnorm(self):
        cmd = self._build()
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'loudnorm' in fc

    def test_loudnorm_target_lufs(self):
        cmd = self._build(target_i_lufs=-14.0)
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'I=-14.0' in fc

    def test_loudnorm_custom_target(self):
        cmd = self._build(target_i_lufs=-16.0)
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'I=-16.0' in fc

    def test_stream_loop_for_bgm(self):
        cmd = self._build()
        assert '-stream_loop' in cmd
        idx = cmd.index('-stream_loop')
        assert cmd[idx + 1] == '-1'

    def test_output_codec_aac(self):
        cmd = self._build()
        assert '-c:a' in cmd
        idx = cmd.index('-c:a')
        assert cmd[idx + 1] == 'aac'

    def test_output_bitrate_192k(self):
        cmd = self._build()
        assert '192k' in cmd

    def test_output_sample_rate_48000(self):
        cmd = self._build()
        assert '48000' in cmd

    def test_ratio_minimum_2(self):
        # ducking_reduction_db=3 -> ratio = max(2, 3/2) = max(2, 1.5) = 2.0
        cmd = self._build(ducking_reduction_db=3.0)
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'ratio=2.0' in fc

    def test_ratio_from_ducking_db(self):
        # ducking_reduction_db=20 -> ratio = max(2, 20/2) = 10.0
        cmd = self._build(ducking_reduction_db=20.0)
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'ratio=10.0' in fc

    def test_custom_ffmpeg_bin(self):
        engine = AudioMixEngine(ffmpeg_bin='/usr/local/bin/ffmpeg')
        cmd = engine.build_ducking_command('/vo.wav', '/bgm.mp3', '/out.aac')
        assert cmd[0] == '/usr/local/bin/ffmpeg'

    def test_music_volume_zero(self):
        cmd = self._build(music_volume=0.0)
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'volume=0.0' in fc

    def test_amix_inputs_2(self):
        cmd = self._build()
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'amix=inputs=2' in fc

    def test_amix_duration_first(self):
        cmd = self._build()
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'duration=first' in fc


class TestAudioMixEngineProcess:
    def test_process_raises_on_nonzero_returncode(self, monkeypatch):
        import subprocess

        def fake_run(cmd, capture_output, text):
            result = subprocess.CompletedProcess(cmd, returncode=1)
            result.stderr = 'FFmpeg error'
            result.stdout = ''
            return result

        monkeypatch.setattr(subprocess, 'run', fake_run)
        engine = AudioMixEngine()
        with pytest.raises(RuntimeError, match='FFmpeg audio master failed'):
            engine.process('/vo.wav', '/bgm.mp3', '/out.aac')
