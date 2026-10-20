"""Tests for FoleyMixEngine — command builder and SFX mapping logic."""
import os
import pytest
from unittest.mock import patch

from app.pipeline.foley import FoleyMixEngine, SFXEvent


class TestBuildSfxFiltergraph:
    def setup_method(self):
        self.engine = FoleyMixEngine(ffmpeg_bin='ffmpeg')

    def test_returns_list(self):
        events = [SFXEvent(sfx_type='whoosh', timestamp=1.0, volume=0.4)]
        with patch('os.path.exists', return_value=True):
            cmd = self.engine.build_sfx_filtergraph('/base.aac', events, '/out.aac')
        assert isinstance(cmd, list)

    def test_starts_with_ffmpeg(self):
        events = [SFXEvent(sfx_type='pop', timestamp=0.5)]
        with patch('os.path.exists', return_value=True):
            cmd = self.engine.build_sfx_filtergraph('/base.aac', events, '/out.aac')
        assert cmd[0] == 'ffmpeg'

    def test_includes_y_flag(self):
        events = [SFXEvent(sfx_type='impact', timestamp=2.0)]
        with patch('os.path.exists', return_value=True):
            cmd = self.engine.build_sfx_filtergraph('/base.aac', events, '/out.aac')
        assert '-y' in cmd

    def test_includes_base_audio_input(self):
        events = [SFXEvent(sfx_type='click', timestamp=0.0)]
        with patch('os.path.exists', return_value=True):
            cmd = self.engine.build_sfx_filtergraph('/voice/base.aac', events, '/out.aac')
        assert '/voice/base.aac' in cmd

    def test_includes_output_path(self):
        events = [SFXEvent(sfx_type='riser', timestamp=3.0)]
        with patch('os.path.exists', return_value=True):
            cmd = self.engine.build_sfx_filtergraph('/base.aac', events, '/sfx/out.aac')
        assert '/sfx/out.aac' in cmd

    def test_includes_filter_complex_flag(self):
        events = [SFXEvent(sfx_type='whoosh', timestamp=1.0)]
        with patch('os.path.exists', return_value=True):
            cmd = self.engine.build_sfx_filtergraph('/base.aac', events, '/out.aac')
        assert '-filter_complex' in cmd

    def test_filter_includes_adelay_in_ms(self):
        events = [SFXEvent(sfx_type='whoosh', timestamp=2.5)]
        with patch('os.path.exists', return_value=True):
            cmd = self.engine.build_sfx_filtergraph('/base.aac', events, '/out.aac')
        fc = cmd[cmd.index('-filter_complex') + 1]
        # 2.5s = 2500ms
        assert 'adelay=2500|2500' in fc

    def test_filter_includes_volume(self):
        events = [SFXEvent(sfx_type='pop', timestamp=1.0, volume=0.7)]
        with patch('os.path.exists', return_value=True):
            cmd = self.engine.build_sfx_filtergraph('/base.aac', events, '/out.aac')
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'volume=0.7' in fc

    def test_amix_count_matches_events_plus_one(self):
        events = [
            SFXEvent(sfx_type='whoosh', timestamp=0.5),
            SFXEvent(sfx_type='pop', timestamp=1.5),
            SFXEvent(sfx_type='impact', timestamp=2.5),
        ]
        with patch('os.path.exists', return_value=True):
            cmd = self.engine.build_sfx_filtergraph('/base.aac', events, '/out.aac')
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'amix=inputs=4' in fc  # 3 events + 1 base

    def test_sfx_sample_map_all_types(self):
        for sfx_type in ['whoosh', 'pop', 'impact', 'riser', 'click']:
            assert sfx_type in FoleyMixEngine.SFX_SAMPLE_MAP

    def test_sfx_sample_map_returns_wav_files(self):
        for filename in FoleyMixEngine.SFX_SAMPLE_MAP.values():
            assert filename.endswith('.wav')

    def test_unknown_sfx_type_falls_back_to_whoosh(self):
        events = [SFXEvent(sfx_type='unknown_sfx', timestamp=1.0)]
        with patch('os.path.exists', return_value=False):
            cmd = self.engine.build_sfx_filtergraph('/base.aac', events, '/out.aac')
        # Should not raise; should use default asset
        assert isinstance(cmd, list)

    def test_output_codec_aac(self):
        events = [SFXEvent(sfx_type='click', timestamp=0.5)]
        with patch('os.path.exists', return_value=True):
            cmd = self.engine.build_sfx_filtergraph('/base.aac', events, '/out.aac')
        assert 'aac' in cmd

    def test_output_sample_rate_48000(self):
        events = [SFXEvent(sfx_type='whoosh', timestamp=1.0)]
        with patch('os.path.exists', return_value=True):
            cmd = self.engine.build_sfx_filtergraph('/base.aac', events, '/out.aac')
        assert '48000' in cmd

    def test_multiple_events_produce_multiple_sfx_labels(self):
        events = [
            SFXEvent(sfx_type='whoosh', timestamp=0.5),
            SFXEvent(sfx_type='pop', timestamp=2.0),
        ]
        with patch('os.path.exists', return_value=True):
            cmd = self.engine.build_sfx_filtergraph('/base.aac', events, '/out.aac')
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'sfx_1' in fc
        assert 'sfx_2' in fc


class TestSFXEvent:
    def test_valid_event(self):
        e = SFXEvent(sfx_type='whoosh', timestamp=1.5, volume=0.4)
        assert e.sfx_type == 'whoosh'
        assert e.timestamp == 1.5

    def test_negative_timestamp_rejected(self):
        with pytest.raises(Exception):
            SFXEvent(sfx_type='pop', timestamp=-1.0)

    def test_volume_above_1_5_rejected(self):
        with pytest.raises(Exception):
            SFXEvent(sfx_type='pop', timestamp=1.0, volume=2.0)

    def test_volume_below_zero_rejected(self):
        with pytest.raises(Exception):
            SFXEvent(sfx_type='pop', timestamp=1.0, volume=-0.1)

    def test_default_volume_is_0_4(self):
        e = SFXEvent(sfx_type='riser', timestamp=2.0)
        assert e.volume == 0.4


class TestFoleyMixEngineExecuteMix:
    def test_no_events_returns_base_path(self):
        engine = FoleyMixEngine()
        result = engine.execute_mix('/base.aac', [], '/out.aac')
        assert result == '/base.aac'
