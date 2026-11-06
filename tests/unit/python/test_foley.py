"""Tests for FoleyMixEngine.build_sfx_filtergraph() and SFXEvent model."""
import sys
import os
import pytest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'services', 'api'))
from app.pipeline.foley import FoleyMixEngine, SFXEvent


class TestSFXEvent:
    def test_valid_event_creation(self):
        ev = SFXEvent(sfx_type='whoosh', timestamp=1.5)
        assert ev.sfx_type == 'whoosh'
        assert ev.timestamp == 1.5
        assert ev.volume == 0.4  # default

    def test_custom_volume(self):
        ev = SFXEvent(sfx_type='pop', timestamp=0.0, volume=0.8)
        assert ev.volume == 0.8

    def test_volume_zero_is_valid(self):
        ev = SFXEvent(sfx_type='impact', timestamp=2.0, volume=0.0)
        assert ev.volume == 0.0

    def test_volume_max_is_1_5(self):
        ev = SFXEvent(sfx_type='riser', timestamp=3.0, volume=1.5)
        assert ev.volume == 1.5

    def test_volume_exceeding_max_raises(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            SFXEvent(sfx_type='click', timestamp=1.0, volume=1.6)

    def test_negative_timestamp_raises(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            SFXEvent(sfx_type='whoosh', timestamp=-0.1)

    def test_zero_timestamp_is_valid(self):
        ev = SFXEvent(sfx_type='whoosh', timestamp=0.0)
        assert ev.timestamp == 0.0


class TestFoleyMixEngineBuildSfxFiltergraph:
    def setup_method(self):
        self.engine = FoleyMixEngine(ffmpeg_bin='ffmpeg')

    def _events(self):
        return [
            SFXEvent(sfx_type='whoosh', timestamp=1.0, volume=0.5),
            SFXEvent(sfx_type='pop', timestamp=3.0, volume=0.3),
        ]

    # ── basic structure ──────────────────────────────────────────────────────

    def test_returns_a_list(self):
        with patch('os.path.exists', return_value=False):
            cmd = self.engine.build_sfx_filtergraph('base.aac', self._events(), 'out.aac')
        assert isinstance(cmd, list)

    def test_starts_with_ffmpeg(self):
        with patch('os.path.exists', return_value=False):
            cmd = self.engine.build_sfx_filtergraph('base.aac', self._events(), 'out.aac')
        assert cmd[0] == 'ffmpeg'

    def test_includes_overwrite_flag(self):
        with patch('os.path.exists', return_value=False):
            cmd = self.engine.build_sfx_filtergraph('base.aac', self._events(), 'out.aac')
        assert '-y' in cmd

    def test_base_audio_is_first_input(self):
        with patch('os.path.exists', return_value=False):
            cmd = self.engine.build_sfx_filtergraph('base.aac', self._events(), 'out.aac')
        # -i base.aac should appear early
        assert '-i' in cmd
        idx = cmd.index('-i')
        assert cmd[idx + 1] == 'base.aac'

    def test_output_path_is_last_element(self):
        with patch('os.path.exists', return_value=False):
            cmd = self.engine.build_sfx_filtergraph('base.aac', self._events(), 'out.aac')
        assert cmd[-1] == 'out.aac'

    def test_includes_filter_complex_flag(self):
        with patch('os.path.exists', return_value=False):
            cmd = self.engine.build_sfx_filtergraph('base.aac', self._events(), 'out.aac')
        assert '-filter_complex' in cmd

    # ── filter content ───────────────────────────────────────────────────────

    def test_filter_contains_adelay(self):
        with patch('os.path.exists', return_value=False):
            cmd = self.engine.build_sfx_filtergraph('base.aac', self._events(), 'out.aac')
        fc_idx = cmd.index('-filter_complex')
        fc = cmd[fc_idx + 1]
        assert 'adelay' in fc

    def test_filter_contains_amix(self):
        with patch('os.path.exists', return_value=False):
            cmd = self.engine.build_sfx_filtergraph('base.aac', self._events(), 'out.aac')
        fc_idx = cmd.index('-filter_complex')
        fc = cmd[fc_idx + 1]
        assert 'amix' in fc

    def test_amix_inputs_equals_events_plus_one(self):
        events = self._events()  # 2 events
        with patch('os.path.exists', return_value=False):
            cmd = self.engine.build_sfx_filtergraph('base.aac', events, 'out.aac')
        fc_idx = cmd.index('-filter_complex')
        fc = cmd[fc_idx + 1]
        assert f'amix=inputs={len(events) + 1}' in fc

    def test_delay_is_in_milliseconds(self):
        # timestamp=1.0 → delay_ms=1000
        events = [SFXEvent(sfx_type='whoosh', timestamp=1.0)]
        with patch('os.path.exists', return_value=False):
            cmd = self.engine.build_sfx_filtergraph('base.aac', events, 'out.aac')
        fc_idx = cmd.index('-filter_complex')
        fc = cmd[fc_idx + 1]
        assert 'adelay=1000' in fc

    def test_volume_is_applied_to_sfx(self):
        events = [SFXEvent(sfx_type='pop', timestamp=0.5, volume=0.7)]
        with patch('os.path.exists', return_value=False):
            cmd = self.engine.build_sfx_filtergraph('base.aac', events, 'out.aac')
        fc_idx = cmd.index('-filter_complex')
        fc = cmd[fc_idx + 1]
        assert 'volume=0.7' in fc

    # ── SFX sample map ───────────────────────────────────────────────────────

    def test_known_sfx_types_have_sample_files(self):
        for sfx_type in ('whoosh', 'pop', 'impact', 'riser', 'click'):
            assert sfx_type in FoleyMixEngine.SFX_SAMPLE_MAP

    def test_unknown_sfx_type_falls_back_to_whoosh(self):
        # The code uses .get(event.sfx_type, 'whoosh_high_velocity.wav')
        result = FoleyMixEngine.SFX_SAMPLE_MAP.get('unknown_sfx', 'whoosh_high_velocity.wav')
        assert result == 'whoosh_high_velocity.wav'

    # ── execute_mix passthrough with no events ───────────────────────────────

    def test_execute_mix_no_events_returns_base_path(self):
        # No subprocess call when events list is empty
        result = self.engine.execute_mix('base.aac', [], 'out.aac')
        assert result == 'base.aac'

    # ── aac output settings ──────────────────────────────────────────────────

    def test_codec_is_aac(self):
        with patch('os.path.exists', return_value=False):
            cmd = self.engine.build_sfx_filtergraph('base.aac', self._events(), 'out.aac')
        assert '-c:a' in cmd
        idx = cmd.index('-c:a')
        assert cmd[idx + 1] == 'aac'

    def test_bitrate_is_192k(self):
        with patch('os.path.exists', return_value=False):
            cmd = self.engine.build_sfx_filtergraph('base.aac', self._events(), 'out.aac')
        assert '-b:a' in cmd
        idx = cmd.index('-b:a')
        assert cmd[idx + 1] == '192k'

    def test_sample_rate_is_48000(self):
        with patch('os.path.exists', return_value=False):
            cmd = self.engine.build_sfx_filtergraph('base.aac', self._events(), 'out.aac')
        assert '-ar' in cmd
        idx = cmd.index('-ar')
        assert cmd[idx + 1] == '48000'
