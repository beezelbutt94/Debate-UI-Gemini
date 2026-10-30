"""Tests for FoleyMixEngine.build_sfx_filtergraph() — pure command-builder."""
import pytest
from unittest.mock import patch
from app.pipeline.foley import FoleyMixEngine, SFXEvent


class TestSFXEvent:
    def test_default_volume(self):
        e = SFXEvent(sfx_type="whoosh", timestamp=1.0)
        assert e.volume == 0.4

    def test_custom_volume(self):
        e = SFXEvent(sfx_type="pop", timestamp=2.5, volume=0.8)
        assert e.volume == 0.8

    def test_volume_upper_bound_accepted(self):
        e = SFXEvent(sfx_type="impact", timestamp=0.0, volume=1.5)
        assert e.volume == 1.5

    def test_volume_lower_bound_accepted(self):
        e = SFXEvent(sfx_type="riser", timestamp=0.0, volume=0.0)
        assert e.volume == 0.0

    def test_volume_too_high_raises(self):
        with pytest.raises(Exception):
            SFXEvent(sfx_type="click", timestamp=0.0, volume=2.0)

    def test_volume_negative_raises(self):
        with pytest.raises(Exception):
            SFXEvent(sfx_type="click", timestamp=0.0, volume=-0.1)

    def test_timestamp_negative_raises(self):
        with pytest.raises(Exception):
            SFXEvent(sfx_type="whoosh", timestamp=-1.0)

    def test_zero_timestamp_accepted(self):
        e = SFXEvent(sfx_type="whoosh", timestamp=0.0)
        assert e.timestamp == 0.0


class TestBuildSfxFiltergraph:
    def setup_method(self):
        self.engine = FoleyMixEngine(ffmpeg_bin="ffmpeg")

    def _make_events(self, *specs):
        return [SFXEvent(sfx_type=s, timestamp=t) for s, t in specs]

    @patch("os.path.exists", return_value=False)
    def test_returns_list(self, _):
        events = self._make_events(("whoosh", 1.0))
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/out.aac")
        assert isinstance(cmd, list)

    @patch("os.path.exists", return_value=False)
    def test_starts_with_ffmpeg(self, _):
        events = self._make_events(("pop", 0.5))
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/out.aac")
        assert cmd[0] == "ffmpeg"

    @patch("os.path.exists", return_value=False)
    def test_contains_y_flag(self, _):
        events = self._make_events(("whoosh", 1.0))
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/out.aac")
        assert "-y" in cmd

    @patch("os.path.exists", return_value=False)
    def test_base_audio_is_first_input(self, _):
        events = self._make_events(("whoosh", 1.0))
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/out.aac")
        i_idx = cmd.index("-i")
        assert cmd[i_idx + 1] == "/base.aac"

    @patch("os.path.exists", return_value=False)
    def test_output_path_is_last(self, _):
        events = self._make_events(("pop", 2.0))
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/my_output.aac")
        assert cmd[-1] == "/my_output.aac"

    @patch("os.path.exists", return_value=False)
    def test_filter_complex_present(self, _):
        events = self._make_events(("whoosh", 1.0))
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/out.aac")
        assert "-filter_complex" in cmd

    @patch("os.path.exists", return_value=False)
    def test_filter_complex_contains_amix(self, _):
        events = self._make_events(("whoosh", 1.0))
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/out.aac")
        fc_idx = cmd.index("-filter_complex")
        assert "amix" in cmd[fc_idx + 1]

    @patch("os.path.exists", return_value=False)
    def test_filter_complex_contains_adelay_for_timestamp(self, _):
        events = [SFXEvent(sfx_type="whoosh", timestamp=1.5)]
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/out.aac")
        fc_idx = cmd.index("-filter_complex")
        # 1.5s → 1500ms
        assert "adelay=1500|1500" in cmd[fc_idx + 1]

    @patch("os.path.exists", return_value=False)
    def test_multiple_events_all_in_filter(self, _):
        events = self._make_events(("whoosh", 1.0), ("pop", 2.0), ("impact", 3.5))
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/out.aac")
        fc_idx = cmd.index("-filter_complex")
        fc = cmd[fc_idx + 1]
        assert "sfx_1" in fc
        assert "sfx_2" in fc
        assert "sfx_3" in fc

    @patch("os.path.exists", return_value=False)
    def test_amix_inputs_count_equals_events_plus_one(self, _):
        events = self._make_events(("whoosh", 1.0), ("pop", 2.0))
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/out.aac")
        fc_idx = cmd.index("-filter_complex")
        fc = cmd[fc_idx + 1]
        # 2 events + 1 base = 3
        assert "amix=inputs=3" in fc

    @patch("os.path.exists", return_value=False)
    def test_output_codec_aac(self, _):
        events = self._make_events(("pop", 0.5))
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/out.aac")
        assert "-c:a" in cmd
        assert cmd[cmd.index("-c:a") + 1] == "aac"

    @patch("os.path.exists", return_value=False)
    def test_sample_rate_48000(self, _):
        events = self._make_events(("pop", 0.5))
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/out.aac")
        assert "-ar" in cmd
        assert cmd[cmd.index("-ar") + 1] == "48000"

    @patch("os.path.exists", return_value=False)
    def test_map_flag_points_to_final_foley_out(self, _):
        events = self._make_events(("riser", 1.0))
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/out.aac")
        assert "-map" in cmd
        map_idx = cmd.index("-map")
        assert "[final_foley_out]" in cmd[map_idx + 1]

    @patch("os.path.exists", return_value=False)
    def test_known_sfx_type_uses_correct_filename(self, _):
        events = [SFXEvent(sfx_type="impact", timestamp=0.5)]
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/out.aac")
        # When os.path.exists returns False, falls back to /tmp/<filename>
        assert any("cinematic_sub_drop.wav" in c for c in cmd)

    @patch("os.path.exists", return_value=False)
    def test_unknown_sfx_type_falls_back_to_whoosh(self, _):
        events = [SFXEvent(sfx_type="unknown_sfx", timestamp=0.0)]
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/out.aac")
        assert any("whoosh_high_velocity.wav" in c for c in cmd)

    @patch("os.path.exists", return_value=False)
    def test_volume_reflected_in_filter_complex(self, _):
        events = [SFXEvent(sfx_type="click", timestamp=1.0, volume=0.9)]
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/out.aac")
        fc_idx = cmd.index("-filter_complex")
        assert "volume=0.9" in cmd[fc_idx + 1]

    @patch("os.path.exists", return_value=True)
    def test_uses_actual_asset_path_when_exists(self, _):
        import os
        events = [SFXEvent(sfx_type="pop", timestamp=0.5)]
        cmd = self.engine.build_sfx_filtergraph("/base.aac", events, "/out.aac")
        expected_path = os.path.join(
            FoleyMixEngine.__module__,  # unused — we just check /tmp isn't used
        )
        # When file exists, /tmp/ should NOT be in the path for this input
        input_paths = [cmd[i + 1] for i, c in enumerate(cmd) if c == "-i"]
        assert not any(p.startswith("/tmp/") and "bubble_pop" in p for p in input_paths)
