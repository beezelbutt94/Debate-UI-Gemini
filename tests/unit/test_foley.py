"""Tests for FoleyMixEngine — exercises build_sfx_filtergraph() without
running FFmpeg or touching the filesystem.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

import pytest


class TestFoleyMixEngine:
    @pytest.fixture(autouse=True)
    def setup(self):
        from app.pipeline.foley import FoleyMixEngine, SFXEvent
        self.Engine = FoleyMixEngine
        self.SFXEvent = SFXEvent
        self.engine = FoleyMixEngine()

    def _event(self, sfx_type='whoosh', timestamp=1.0, volume=0.4):
        return self.SFXEvent(sfx_type=sfx_type, timestamp=timestamp, volume=volume)

    def test_returns_list(self):
        cmd = self.engine.build_sfx_filtergraph('/base.aac', [self._event()], '/out.aac')
        assert isinstance(cmd, list)

    def test_starts_with_ffmpeg(self):
        cmd = self.engine.build_sfx_filtergraph('/base.aac', [self._event()], '/out.aac')
        assert cmd[0] == 'ffmpeg'

    def test_contains_base_audio(self):
        cmd = self.engine.build_sfx_filtergraph('/base.aac', [self._event()], '/out.aac')
        assert '/base.aac' in cmd

    def test_contains_output_path(self):
        cmd = self.engine.build_sfx_filtergraph('/base.aac', [self._event()], '/output.aac')
        assert '/output.aac' in cmd

    def test_one_event_adds_one_sfx_input(self):
        cmd = self.engine.build_sfx_filtergraph('/base.aac', [self._event()], '/out.aac')
        # -i appears for the base + 1 sfx = 2 times minimum
        assert cmd.count('-i') >= 2

    def test_multiple_events_add_multiple_inputs(self):
        events = [self._event('whoosh', 0.5), self._event('pop', 1.5)]
        cmd = self.engine.build_sfx_filtergraph('/base.aac', events, '/out.aac')
        assert cmd.count('-i') >= 3

    def test_filter_complex_present(self):
        cmd = self.engine.build_sfx_filtergraph('/base.aac', [self._event()], '/out.aac')
        assert '-filter_complex' in cmd

    def test_amix_in_filter_complex(self):
        cmd = self.engine.build_sfx_filtergraph('/base.aac', [self._event()], '/out.aac')
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'amix' in fc

    def test_delay_embedded_correctly(self):
        event = self._event(sfx_type='whoosh', timestamp=2.5)
        cmd = self.engine.build_sfx_filtergraph('/base.aac', [event], '/out.aac')
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'adelay=2500|2500' in fc

    def test_volume_embedded_correctly(self):
        event = self._event(sfx_type='pop', timestamp=0.0, volume=0.8)
        cmd = self.engine.build_sfx_filtergraph('/base.aac', [event], '/out.aac')
        fc = cmd[cmd.index('-filter_complex') + 1]
        assert 'volume=0.8' in fc

    def test_map_flag_present(self):
        cmd = self.engine.build_sfx_filtergraph('/base.aac', [self._event()], '/out.aac')
        assert '-map' in cmd

    def test_aac_codec(self):
        cmd = self.engine.build_sfx_filtergraph('/base.aac', [self._event()], '/out.aac')
        assert 'aac' in cmd

    def test_48k_sample_rate(self):
        cmd = self.engine.build_sfx_filtergraph('/base.aac', [self._event()], '/out.aac')
        assert '48000' in cmd

    def test_execute_mix_returns_base_path_when_no_events(self):
        import unittest.mock as mock
        result = self.engine.execute_mix('/base.aac', [], '/out.aac')
        assert result == '/base.aac'

    def test_sfx_sample_map_covers_all_documented_types(self):
        for sfx_type in ('whoosh', 'pop', 'impact', 'riser', 'click'):
            assert sfx_type in self.Engine.SFX_SAMPLE_MAP

    def test_unknown_sfx_type_falls_back_to_whoosh_file(self):
        event = self._event(sfx_type='unknown_sfx_type_xyz', timestamp=0.0)
        cmd = self.engine.build_sfx_filtergraph('/base.aac', [event], '/out.aac')
        # Command should include the whoosh fallback filename somewhere
        assert any('whoosh_high_velocity.wav' in part for part in cmd)


class TestSFXEventValidation:
    @pytest.fixture(autouse=True)
    def setup(self):
        from app.pipeline.foley import SFXEvent
        self.SFXEvent = SFXEvent

    def test_negative_timestamp_raises(self):
        with pytest.raises(Exception):
            self.SFXEvent(sfx_type='whoosh', timestamp=-1.0)

    def test_zero_timestamp_is_valid(self):
        e = self.SFXEvent(sfx_type='whoosh', timestamp=0.0)
        assert e.timestamp == 0.0

    def test_volume_above_1_5_raises(self):
        with pytest.raises(Exception):
            self.SFXEvent(sfx_type='whoosh', timestamp=1.0, volume=2.0)

    def test_volume_zero_is_valid(self):
        e = self.SFXEvent(sfx_type='whoosh', timestamp=1.0, volume=0.0)
        assert e.volume == 0.0
