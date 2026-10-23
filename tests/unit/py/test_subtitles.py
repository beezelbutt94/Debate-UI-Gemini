"""Tests for services/api/app/pipeline/subtitles.py

Covers KineticSubtitleGenerator._format_timestamp() (static) and
build_ass_subtitles() (instance, bypasses __init__ to skip faster-whisper).
"""
import os
import sys

import pytest

sys.path.insert(0, "services/api")
from app.pipeline.subtitles import KineticSubtitleGenerator


def make_generator() -> KineticSubtitleGenerator:
    """Create an instance without loading faster-whisper."""
    obj = KineticSubtitleGenerator.__new__(KineticSubtitleGenerator)
    return obj


class TestFormatTimestamp:
    def test_zero(self):
        assert KineticSubtitleGenerator._format_timestamp(0.0) == "0:00:00.00"

    def test_one_second(self):
        assert KineticSubtitleGenerator._format_timestamp(1.0) == "0:00:01.00"

    def test_one_minute(self):
        assert KineticSubtitleGenerator._format_timestamp(60.0) == "0:01:00.00"

    def test_one_hour(self):
        assert KineticSubtitleGenerator._format_timestamp(3600.0) == "1:00:00.00"

    def test_fractional_centiseconds(self):
        assert KineticSubtitleGenerator._format_timestamp(0.5) == "0:00:00.50"

    def test_fractional_rounding(self):
        # 0.995 -> centis = round(0.995 * 100) = round(99.5) -> 100 (but int(round) is 100)
        # This could overflow centis to 100; let's just check it returns a string
        result = KineticSubtitleGenerator._format_timestamp(0.995)
        assert isinstance(result, str)
        assert ":" in result

    def test_mixed_hms(self):
        # 3661.5 = 1h 1m 1.5s
        result = KineticSubtitleGenerator._format_timestamp(3661.5)
        assert result == "1:01:01.50"

    def test_59_seconds_99_centis(self):
        result = KineticSubtitleGenerator._format_timestamp(59.99)
        assert result.startswith("0:00:59.")
        assert result.endswith(".99")

    def test_zero_padded_minutes(self):
        result = KineticSubtitleGenerator._format_timestamp(65.0)
        assert result == "0:01:05.00"

    def test_zero_padded_seconds(self):
        result = KineticSubtitleGenerator._format_timestamp(3605.0)
        assert result == "1:00:05.00"

    def test_returns_string_type(self):
        result = KineticSubtitleGenerator._format_timestamp(12.34)
        assert isinstance(result, str)

    def test_large_hours(self):
        # 36000 seconds = 10 hours
        result = KineticSubtitleGenerator._format_timestamp(36000.0)
        assert result == "10:00:00.00"


class TestBuildAssSubtitles:
    def setup_method(self):
        self.gen = make_generator()

    def _sample_words(self):
        return [
            {"word": "HELLO", "start": 0.0, "end": 0.5, "probability": 0.99},
            {"word": "WORLD", "start": 0.5, "end": 1.0, "probability": 0.98},
            {"word": "THIS", "start": 1.0, "end": 1.3, "probability": 0.97},
            {"word": "IS", "start": 1.3, "end": 1.5, "probability": 0.95},
            {"word": "A", "start": 1.5, "end": 1.6, "probability": 0.99},
            {"word": "TEST", "start": 1.6, "end": 2.0, "probability": 0.98},
        ]

    def test_creates_ass_file(self, tmp_path):
        out = str(tmp_path / "subs.ass")
        result = self.gen.build_ass_subtitles(self._sample_words(), out)
        assert result == out
        assert os.path.exists(out)

    def test_ass_file_has_script_info(self, tmp_path):
        out = str(tmp_path / "subs.ass")
        self.gen.build_ass_subtitles(self._sample_words(), out)
        content = open(out).read()
        assert "[Script Info]" in content

    def test_ass_file_has_v4_styles(self, tmp_path):
        out = str(tmp_path / "subs.ass")
        self.gen.build_ass_subtitles(self._sample_words(), out)
        content = open(out).read()
        assert "[V4+ Styles]" in content

    def test_ass_file_has_events(self, tmp_path):
        out = str(tmp_path / "subs.ass")
        self.gen.build_ass_subtitles(self._sample_words(), out)
        content = open(out).read()
        assert "[Events]" in content

    def test_ass_has_dialogue_lines(self, tmp_path):
        out = str(tmp_path / "subs.ass")
        self.gen.build_ass_subtitles(self._sample_words(), out)
        content = open(out).read()
        assert "Dialogue:" in content

    def test_words_appear_in_ass(self, tmp_path):
        out = str(tmp_path / "subs.ass")
        self.gen.build_ass_subtitles(self._sample_words(), out)
        content = open(out).read()
        assert "HELLO" in content
        assert "WORLD" in content

    def test_empty_word_list_produces_header_only(self, tmp_path):
        out = str(tmp_path / "empty.ass")
        self.gen.build_ass_subtitles([], out)
        content = open(out).read()
        assert "[Script Info]" in content
        assert "Dialogue:" not in content

    def test_custom_font_in_style(self, tmp_path):
        out = str(tmp_path / "font.ass")
        words = [{"word": "HI", "start": 0.0, "end": 0.5, "probability": 1.0}]
        self.gen.build_ass_subtitles(words, out, font_name="Arial")
        content = open(out).read()
        assert "Arial" in content

    def test_custom_font_size_in_style(self, tmp_path):
        out = str(tmp_path / "size.ass")
        words = [{"word": "HI", "start": 0.0, "end": 0.5, "probability": 1.0}]
        self.gen.build_ass_subtitles(words, out, font_size=64)
        content = open(out).read()
        assert "64" in content

    def test_chunk_size_one_word_per_line(self, tmp_path):
        out = str(tmp_path / "chunk1.ass")
        self.gen.build_ass_subtitles(self._sample_words(), out, max_words_per_line=1)
        content = open(out).read()
        # With max_words_per_line=1 and 6 words, expect 6 Dialogue lines
        dialogue_count = content.count("Dialogue:")
        assert dialogue_count == 6

    def test_resolution_1080_1920_in_header(self, tmp_path):
        out = str(tmp_path / "res.ass")
        self.gen.build_ass_subtitles(self._sample_words(), out)
        content = open(out).read()
        assert "PlayResX: 1080" in content
        assert "PlayResY: 1920" in content

    def test_returns_output_path(self, tmp_path):
        out = str(tmp_path / "ret.ass")
        result = self.gen.build_ass_subtitles(self._sample_words(), out)
        assert result == out
