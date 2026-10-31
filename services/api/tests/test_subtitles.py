"""Tests for app.pipeline.subtitles – KineticSubtitleGenerator._format_timestamp.

_format_timestamp is a pure static method that converts a float number of
seconds into the ASS subtitle timestamp format: H:MM:SS.CC. No external
dependencies or I/O are needed.
"""
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

_API_ROOT = os.path.join(os.path.dirname(__file__), "..")
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

# faster_whisper is an ML dependency not installed in CI. Mock it so the
# module import succeeds without needing the actual package.
_mock_faster_whisper = MagicMock()
with patch.dict("sys.modules", {"faster_whisper": _mock_faster_whisper}):
    from app.pipeline.subtitles import KineticSubtitleGenerator

_fmt = KineticSubtitleGenerator._format_timestamp


class TestFormatTimestamp:
    # --- Zero ---

    def test_zero_seconds(self):
        assert _fmt(0.0) == "0:00:00.00"

    # --- Sub-minute values ---

    def test_30_seconds(self):
        assert _fmt(30.0) == "0:00:30.00"

    def test_59_point_99_seconds(self):
        result = _fmt(59.99)
        assert result.startswith("0:00:59.")

    # --- Exactly 1 minute ---

    def test_60_seconds_is_1_minute(self):
        assert _fmt(60.0) == "0:01:00.00"

    # --- Multi-minute values ---

    def test_90_seconds(self):
        assert _fmt(90.0) == "0:01:30.00"

    def test_119_seconds(self):
        assert _fmt(119.0) == "0:01:59.00"

    def test_120_seconds(self):
        assert _fmt(120.0) == "0:02:00.00"

    # --- Exactly 1 hour ---

    def test_one_hour(self):
        assert _fmt(3600.0) == "1:00:00.00"

    def test_one_hour_30_minutes(self):
        assert _fmt(5400.0) == "1:30:00.00"

    def test_two_hours(self):
        assert _fmt(7200.0) == "2:00:00.00"

    # --- Centiseconds (fractional part) ---

    def test_centiseconds_half_second(self):
        result = _fmt(0.5)
        assert result == "0:00:00.50"

    def test_centiseconds_25(self):
        result = _fmt(0.25)
        assert result == "0:00:00.25"

    def test_centiseconds_99(self):
        result = _fmt(0.99)
        assert result == "0:00:00.99"

    def test_centiseconds_at_whole_second_boundary(self):
        result = _fmt(5.0)
        assert result == "0:00:05.00"

    # --- Combined values ---

    def test_complex_timestamp(self):
        # 1h 2m 3s 0.45s
        result = _fmt(3600 + 120 + 3 + 0.45)
        assert result == "1:02:03.45"

    def test_video_segment_timestamp(self):
        # 2 minutes 15 seconds 500ms
        result = _fmt(135.5)
        assert result == "0:02:15.50"

    # --- Return type ---

    def test_returns_string(self):
        assert isinstance(_fmt(10.0), str)

    # --- Format structure ---

    def test_format_has_colon_separated_sections(self):
        result = _fmt(90.5)
        parts = result.split(":")
        assert len(parts) == 3

    def test_minutes_always_two_digits(self):
        # 5 minutes → "05"
        result = _fmt(300.0)
        _, minutes_part, _ = result.split(":")
        assert len(minutes_part) == 2

    def test_seconds_always_two_digits(self):
        result = _fmt(5.0)
        _, _, secs_part = result.split(":")
        assert secs_part.split(".")[0] == "05"

    def test_centiseconds_always_two_digits_single_digit(self):
        # 0.05 → centiseconds = 5 → should be "05"
        result = _fmt(0.05)
        centis = result.split(".")[1]
        assert len(centis) == 2
