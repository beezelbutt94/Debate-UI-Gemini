"""Tests for KineticSubtitleGenerator._format_timestamp and build_ass_subtitles.

These tests target the pure-logic parts of the subtitle generator that do
NOT require the optional `faster-whisper` ML dependency.
"""
import os
import sys
import tempfile

import pytest

# Make the services/api root importable without installing the package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'services', 'api'))

from app.pipeline.subtitles import KineticSubtitleGenerator


# ── _format_timestamp ─────────────────────────────────────────────────────────

class TestFormatTimestamp:
    def test_zero(self):
        assert KineticSubtitleGenerator._format_timestamp(0.0) == "0:00:00.00"

    def test_one_second(self):
        assert KineticSubtitleGenerator._format_timestamp(1.0) == "0:00:01.00"

    def test_one_minute(self):
        assert KineticSubtitleGenerator._format_timestamp(60.0) == "0:01:00.00"

    def test_one_hour(self):
        assert KineticSubtitleGenerator._format_timestamp(3600.0) == "1:00:00.00"

    def test_mixed_hms(self):
        # 1h 23m 45s = 5025s
        assert KineticSubtitleGenerator._format_timestamp(5025.0) == "1:23:45.00"

    def test_centiseconds_rounding(self):
        # 0.5s → 50 centiseconds
        assert KineticSubtitleGenerator._format_timestamp(0.5) == "0:00:00.50"

    def test_centiseconds_25(self):
        # 1.25s
        assert KineticSubtitleGenerator._format_timestamp(1.25) == "0:00:01.25"

    def test_centiseconds_99(self):
        # 0.99s
        assert KineticSubtitleGenerator._format_timestamp(0.99) == "0:00:00.99"

    def test_two_digits_minutes(self):
        assert KineticSubtitleGenerator._format_timestamp(754.0) == "0:12:34.00"

    def test_fractional_centis(self):
        # 2.333...s → centis = round(0.333 * 100) = 33
        result = KineticSubtitleGenerator._format_timestamp(2.333)
        assert result == "0:00:02.33"

    def test_sub_second(self):
        assert KineticSubtitleGenerator._format_timestamp(0.01) == "0:00:00.01"

    def test_large_value(self):
        # 7384s = 2h 3m 4s
        result = KineticSubtitleGenerator._format_timestamp(7384.0)
        assert result == "2:03:04.00"


# ── build_ass_subtitles ────────────────────────────────────────────────────────

def make_words(*texts, start_offset=0.0, word_duration=0.5):
    """Helper: create a minimal word list for testing."""
    words = []
    t = start_offset
    for text in texts:
        words.append({
            "word": text.upper(),
            "start": t,
            "end": t + word_duration,
            "probability": 0.99,
        })
        t += word_duration
    return words


def make_generator():
    """Return a KineticSubtitleGenerator instance without running __init__.

    __init__ lazily imports faster-whisper (an ML dependency not installed in
    CI). Bypassing it lets us test the pure-logic methods without that dep.
    """
    return object.__new__(KineticSubtitleGenerator)


class TestBuildAssSubtitles:
    def setup_method(self):
        self.gen = make_generator()

    def test_creates_file(self, tmp_path):
        words = make_words("HELLO", "WORLD")
        out = str(tmp_path / "out.ass")
        result = self.gen.build_ass_subtitles(words, out)
        assert result == out
        assert os.path.exists(out)

    def test_file_contains_script_info_header(self, tmp_path):
        words = make_words("A", "B", "C")
        out = str(tmp_path / "out.ass")
        self.gen.build_ass_subtitles(words, out)
        content = open(out).read()
        assert "[Script Info]" in content

    def test_file_contains_styles_section(self, tmp_path):
        words = make_words("X")
        out = str(tmp_path / "out.ass")
        self.gen.build_ass_subtitles(words, out)
        content = open(out).read()
        assert "[V4+ Styles]" in content

    def test_file_contains_events_section(self, tmp_path):
        words = make_words("X", "Y")
        out = str(tmp_path / "out.ass")
        self.gen.build_ass_subtitles(words, out)
        content = open(out).read()
        assert "[Events]" in content

    def test_empty_word_list_creates_valid_file(self, tmp_path):
        out = str(tmp_path / "empty.ass")
        result = self.gen.build_ass_subtitles([], out)
        assert result == out
        content = open(out).read()
        assert "[Script Info]" in content

    def test_dialogue_lines_generated(self, tmp_path):
        words = make_words("STOP", "SCROLLING", "NOW")
        out = str(tmp_path / "out.ass")
        self.gen.build_ass_subtitles(words, out)
        content = open(out).read()
        # Default max_words_per_line=3, so 1 chunk of 3 words × 3 events
        dialogue_count = content.count("Dialogue:")
        assert dialogue_count == 3

    def test_word_count_exceeding_chunk_size(self, tmp_path):
        # 7 words, chunk size 3 → ceil(7/3)=3 chunks, events = 3+3+1 = 7
        words = make_words("A", "B", "C", "D", "E", "F", "G")
        out = str(tmp_path / "out.ass")
        self.gen.build_ass_subtitles(words, out)
        content = open(out).read()
        assert content.count("Dialogue:") == 7

    def test_custom_font_name_in_style(self, tmp_path):
        words = make_words("HI")
        out = str(tmp_path / "out.ass")
        self.gen.build_ass_subtitles(words, out, font_name="Arial Black")
        content = open(out).read()
        assert "Arial Black" in content

    def test_custom_font_size_in_style(self, tmp_path):
        words = make_words("HI")
        out = str(tmp_path / "out.ass")
        self.gen.build_ass_subtitles(words, out, font_size=60)
        content = open(out).read()
        assert "60" in content

    def test_custom_max_words_per_line(self, tmp_path):
        # 4 words, chunk=2 → 2 chunks, 4 dialogue events
        words = make_words("A", "B", "C", "D")
        out = str(tmp_path / "out.ass")
        self.gen.build_ass_subtitles(words, out, max_words_per_line=2)
        content = open(out).read()
        assert content.count("Dialogue:") == 4

    def test_highlight_color_appears_in_events(self, tmp_path):
        words = make_words("FIRE")
        out = str(tmp_path / "out.ass")
        self.gen.build_ass_subtitles(words, out, highlight_color_bgr="&H0000FF00")
        content = open(out).read()
        assert "&H0000FF00" in content

    def test_play_res_for_vertical_video(self, tmp_path):
        words = make_words("X")
        out = str(tmp_path / "out.ass")
        self.gen.build_ass_subtitles(words, out)
        content = open(out).read()
        assert "PlayResX: 1080" in content
        assert "PlayResY: 1920" in content

    def test_single_word_single_dialogue_line(self, tmp_path):
        words = make_words("BOOM")
        out = str(tmp_path / "out.ass")
        self.gen.build_ass_subtitles(words, out)
        content = open(out).read()
        assert content.count("Dialogue:") == 1

    def test_timestamps_in_dialogue_lines(self, tmp_path):
        words = make_words("GO", start_offset=2.0, word_duration=1.0)
        out = str(tmp_path / "out.ass")
        self.gen.build_ass_subtitles(words, out)
        content = open(out).read()
        # start=2.0 → "0:00:02.00", end=3.0 → "0:00:03.00"
        assert "0:00:02.00" in content
        assert "0:00:03.00" in content
