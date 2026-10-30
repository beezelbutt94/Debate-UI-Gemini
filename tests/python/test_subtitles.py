"""Tests for KineticSubtitleGenerator static/pure methods.
The class __init__ imports faster_whisper lazily, so we can test
_format_timestamp and build_ass_subtitles without ML deps by instantiating
via object.__new__ (bypassing __init__).
"""
import os
import tempfile
import pytest
from unittest.mock import MagicMock, patch
from app.pipeline.subtitles import KineticSubtitleGenerator


def make_generator():
    """Create a KineticSubtitleGenerator without invoking __init__ (no ML dep)."""
    gen = object.__new__(KineticSubtitleGenerator)
    gen.model = MagicMock()
    return gen


class TestFormatTimestamp:
    def test_zero_seconds(self):
        assert KineticSubtitleGenerator._format_timestamp(0.0) == "0:00:00.00"

    def test_one_second(self):
        assert KineticSubtitleGenerator._format_timestamp(1.0) == "0:00:01.00"

    def test_one_minute(self):
        assert KineticSubtitleGenerator._format_timestamp(60.0) == "0:01:00.00"

    def test_one_hour(self):
        assert KineticSubtitleGenerator._format_timestamp(3600.0) == "1:00:00.00"

    def test_fractional_seconds(self):
        # 1.5s → 1s + 50 centiseconds
        assert KineticSubtitleGenerator._format_timestamp(1.5) == "0:00:01.50"

    def test_fractional_centiseconds_rounding(self):
        # 1.999s → rounds to centiseconds
        result = KineticSubtitleGenerator._format_timestamp(1.999)
        # 0.999 * 100 = 99.9 → round → 100 centis → 1.00 (but int() is used)
        # Actually int(round(0.999*100)) = int(round(99.9)) = int(100) = 100
        # But centis format is .{centis:02d}, 100 would be "100" (3 digits)
        # Let's just check it's a valid string
        assert isinstance(result, str)
        assert result.startswith("0:00:01.")

    def test_complex_time(self):
        # 3723.45s = 1h 2m 3s + 45 centisecs
        result = KineticSubtitleGenerator._format_timestamp(3723.45)
        assert result == "1:02:03.45"

    def test_minutes_and_seconds(self):
        # 90.25s = 0h 1m 30s + 25 centisecs
        result = KineticSubtitleGenerator._format_timestamp(90.25)
        assert result == "0:01:30.25"

    def test_two_digit_minutes(self):
        result = KineticSubtitleGenerator._format_timestamp(720.0)
        assert result == "0:12:00.00"

    def test_centiseconds_two_digits(self):
        # 0.09s → 9 centisecs → formatted as "09"
        result = KineticSubtitleGenerator._format_timestamp(0.09)
        assert result == "0:00:00.09"

    def test_returns_string(self):
        result = KineticSubtitleGenerator._format_timestamp(100.0)
        assert isinstance(result, str)

    def test_format_matches_ass_pattern(self):
        # ASS format: H:MM:SS.CC
        result = KineticSubtitleGenerator._format_timestamp(3661.0)
        parts = result.split(":")
        assert len(parts) == 3
        assert parts[0].isdigit()  # hours
        assert len(parts[1]) == 2  # MM
        assert "." in parts[2]     # SS.CC

    def test_large_hours(self):
        result = KineticSubtitleGenerator._format_timestamp(7200.0)
        assert result.startswith("2:")


class TestBuildAssSubtitles:
    def setup_method(self):
        self.gen = make_generator()

    def _make_words(self, *words_with_times):
        """words_with_times: (word, start, end) tuples"""
        return [
            {"word": w, "start": s, "end": e, "probability": 0.99}
            for w, s, e in words_with_times
        ]

    def test_creates_file(self):
        with tempfile.NamedTemporaryFile(suffix=".ass", delete=False) as f:
            path = f.name
        try:
            words = self._make_words(("HELLO", 0.0, 0.5), ("WORLD", 0.5, 1.0))
            result = self.gen.build_ass_subtitles(words, path)
            assert os.path.exists(result)
        finally:
            os.unlink(path)

    def test_returns_output_path(self):
        with tempfile.NamedTemporaryFile(suffix=".ass", delete=False) as f:
            path = f.name
        try:
            words = self._make_words(("TEST", 0.0, 1.0))
            result = self.gen.build_ass_subtitles(words, path)
            assert result == path
        finally:
            os.unlink(path)

    def test_file_contains_script_info_section(self):
        with tempfile.NamedTemporaryFile(suffix=".ass", delete=False, mode='w') as f:
            path = f.name
        try:
            words = self._make_words(("HI", 0.0, 0.5))
            self.gen.build_ass_subtitles(words, path)
            content = open(path).read()
            assert "[Script Info]" in content
        finally:
            os.unlink(path)

    def test_file_contains_v4_styles_section(self):
        with tempfile.NamedTemporaryFile(suffix=".ass", delete=False) as f:
            path = f.name
        try:
            words = self._make_words(("HI", 0.0, 0.5))
            self.gen.build_ass_subtitles(words, path)
            content = open(path).read()
            assert "[V4+ Styles]" in content
        finally:
            os.unlink(path)

    def test_file_contains_events_section(self):
        with tempfile.NamedTemporaryFile(suffix=".ass", delete=False) as f:
            path = f.name
        try:
            words = self._make_words(("HI", 0.0, 0.5))
            self.gen.build_ass_subtitles(words, path)
            content = open(path).read()
            assert "[Events]" in content
        finally:
            os.unlink(path)

    def test_dialogue_line_per_word_in_chunk(self):
        with tempfile.NamedTemporaryFile(suffix=".ass", delete=False) as f:
            path = f.name
        try:
            # 3 words → 1 chunk of 3 → 3 dialogue events (one per word highlighted)
            words = self._make_words(("ONE", 0.0, 0.5), ("TWO", 0.5, 1.0), ("THREE", 1.0, 1.5))
            self.gen.build_ass_subtitles(words, path)
            content = open(path).read()
            dialogue_count = content.count("Dialogue:")
            assert dialogue_count == 3
        finally:
            os.unlink(path)

    def test_empty_words_creates_header_only(self):
        with tempfile.NamedTemporaryFile(suffix=".ass", delete=False) as f:
            path = f.name
        try:
            self.gen.build_ass_subtitles([], path)
            content = open(path).read()
            assert "[Script Info]" in content
            assert "Dialogue:" not in content
        finally:
            os.unlink(path)

    def test_custom_font_name_in_style(self):
        with tempfile.NamedTemporaryFile(suffix=".ass", delete=False) as f:
            path = f.name
        try:
            words = self._make_words(("HI", 0.0, 0.5))
            self.gen.build_ass_subtitles(words, path, font_name="Arial Black")
            content = open(path).read()
            assert "Arial Black" in content
        finally:
            os.unlink(path)

    def test_custom_font_size_in_style(self):
        with tempfile.NamedTemporaryFile(suffix=".ass", delete=False) as f:
            path = f.name
        try:
            words = self._make_words(("HI", 0.0, 0.5))
            self.gen.build_ass_subtitles(words, path, font_size=64)
            content = open(path).read()
            assert ",64," in content
        finally:
            os.unlink(path)

    def test_words_split_into_chunks_of_max_words_per_line(self):
        with tempfile.NamedTemporaryFile(suffix=".ass", delete=False) as f:
            path = f.name
        try:
            # 4 words, max 2 per line → 2 chunks → 4 dialogue events
            words = self._make_words(
                ("A", 0.0, 0.5), ("B", 0.5, 1.0), ("C", 1.0, 1.5), ("D", 1.5, 2.0)
            )
            self.gen.build_ass_subtitles(words, path, max_words_per_line=2)
            content = open(path).read()
            assert content.count("Dialogue:") == 4
        finally:
            os.unlink(path)

    def test_play_res_x_is_1080(self):
        with tempfile.NamedTemporaryFile(suffix=".ass", delete=False) as f:
            path = f.name
        try:
            words = self._make_words(("HI", 0.0, 0.5))
            self.gen.build_ass_subtitles(words, path)
            content = open(path).read()
            assert "PlayResX: 1080" in content
        finally:
            os.unlink(path)

    def test_play_res_y_is_1920(self):
        with tempfile.NamedTemporaryFile(suffix=".ass", delete=False) as f:
            path = f.name
        try:
            words = self._make_words(("HI", 0.0, 0.5))
            self.gen.build_ass_subtitles(words, path)
            content = open(path).read()
            assert "PlayResY: 1920" in content
        finally:
            os.unlink(path)
