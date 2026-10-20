"""Tests for KineticSubtitleGenerator (pure logic, no WhisperModel required)."""
import os
import tempfile
import pytest
from unittest.mock import MagicMock, patch

# Patch `faster_whisper` before importing subtitles so the module loads
# without requiring the optional ML dependency.
import sys
sys.modules.setdefault('faster_whisper', MagicMock())

from app.pipeline.subtitles import KineticSubtitleGenerator


class TestFormatTimestamp:
    """_format_timestamp converts float seconds to ASS H:MM:SS.cc format."""

    def _fmt(self, seconds: float) -> str:
        return KineticSubtitleGenerator._format_timestamp(seconds)

    def test_zero(self):
        assert self._fmt(0.0) == '0:00:00.00'

    def test_one_second(self):
        assert self._fmt(1.0) == '0:00:01.00'

    def test_one_minute(self):
        assert self._fmt(60.0) == '0:01:00.00'

    def test_one_hour(self):
        assert self._fmt(3600.0) == '1:00:00.00'

    def test_mixed_hours_minutes_seconds(self):
        # 1h 2m 3s = 3723 seconds
        assert self._fmt(3723.0) == '1:02:03.00'

    def test_centiseconds(self):
        assert self._fmt(1.5) == '0:00:01.50'

    def test_centiseconds_rounding(self):
        # 0.999 -> 1.00 after round(...*100)
        assert self._fmt(0.999) == '0:00:01.00'

    def test_fractional_centiseconds(self):
        assert self._fmt(1.25) == '0:00:01.25'

    def test_minutes_padding(self):
        assert self._fmt(70.0) == '0:01:10.00'

    def test_seconds_padding(self):
        assert self._fmt(9.0) == '0:00:09.00'

    def test_large_value(self):
        # 2h 30m 15.75s = 9015.75s
        result = self._fmt(9015.75)
        assert result == '2:30:15.75'

    def test_returns_string(self):
        assert isinstance(self._fmt(10.0), str)

    def test_format_contains_colon_separators(self):
        ts = self._fmt(125.5)
        parts = ts.split(':')
        assert len(parts) == 3  # H:MM:SS.cc


class TestBuildAssSubtitles:
    """build_ass_subtitles produces a valid .ass file from a word list."""

    def _make_words(self, texts, base_start=0.0, word_duration=0.5):
        words = []
        for i, text in enumerate(texts):
            start = base_start + i * word_duration
            words.append({
                'word': text.upper(),
                'start': start,
                'end': start + word_duration - 0.05,
                'probability': 0.99,
            })
        return words

    def test_creates_file(self):
        gen = KineticSubtitleGenerator.__new__(KineticSubtitleGenerator)
        words = self._make_words(['HELLO', 'WORLD'])
        with tempfile.NamedTemporaryFile(suffix='.ass', delete=False) as f:
            path = f.name
        try:
            gen.build_ass_subtitles(words, path)
            assert os.path.exists(path)
        finally:
            os.unlink(path)

    def test_file_contains_script_info(self):
        gen = KineticSubtitleGenerator.__new__(KineticSubtitleGenerator)
        words = self._make_words(['TEST'])
        with tempfile.NamedTemporaryFile(suffix='.ass', delete=False) as f:
            path = f.name
        try:
            gen.build_ass_subtitles(words, path)
            content = open(path).read()
            assert '[Script Info]' in content
        finally:
            os.unlink(path)

    def test_file_contains_v4_styles(self):
        gen = KineticSubtitleGenerator.__new__(KineticSubtitleGenerator)
        words = self._make_words(['FOO', 'BAR'])
        with tempfile.NamedTemporaryFile(suffix='.ass', delete=False) as f:
            path = f.name
        try:
            gen.build_ass_subtitles(words, path)
            content = open(path).read()
            assert '[V4+ Styles]' in content
        finally:
            os.unlink(path)

    def test_file_contains_events(self):
        gen = KineticSubtitleGenerator.__new__(KineticSubtitleGenerator)
        words = self._make_words(['ONE', 'TWO', 'THREE'])
        with tempfile.NamedTemporaryFile(suffix='.ass', delete=False) as f:
            path = f.name
        try:
            gen.build_ass_subtitles(words, path)
            content = open(path).read()
            assert '[Events]' in content
        finally:
            os.unlink(path)

    def test_dialogue_lines_count(self):
        gen = KineticSubtitleGenerator.__new__(KineticSubtitleGenerator)
        # max_words_per_line=3, 9 words -> 3 chunks, each with 3 dialogue lines
        words = self._make_words(['W' + str(i) for i in range(9)])
        with tempfile.NamedTemporaryFile(suffix='.ass', delete=False) as f:
            path = f.name
        try:
            gen.build_ass_subtitles(words, path, max_words_per_line=3)
            content = open(path).read()
            dialogue_count = content.count('Dialogue:')
            assert dialogue_count == 9  # 3 chunks × 3 words each
        finally:
            os.unlink(path)

    def test_custom_font_appears_in_style(self):
        gen = KineticSubtitleGenerator.__new__(KineticSubtitleGenerator)
        words = self._make_words(['HELLO'])
        with tempfile.NamedTemporaryFile(suffix='.ass', delete=False) as f:
            path = f.name
        try:
            gen.build_ass_subtitles(words, path, font_name='Arial Black')
            content = open(path).read()
            assert 'Arial Black' in content
        finally:
            os.unlink(path)

    def test_returns_output_path(self):
        gen = KineticSubtitleGenerator.__new__(KineticSubtitleGenerator)
        words = self._make_words(['HELLO'])
        with tempfile.NamedTemporaryFile(suffix='.ass', delete=False) as f:
            path = f.name
        try:
            returned = gen.build_ass_subtitles(words, path)
            assert returned == path
        finally:
            os.unlink(path)

    def test_empty_words_list(self):
        gen = KineticSubtitleGenerator.__new__(KineticSubtitleGenerator)
        with tempfile.NamedTemporaryFile(suffix='.ass', delete=False) as f:
            path = f.name
        try:
            gen.build_ass_subtitles([], path)
            content = open(path).read()
            assert '[Script Info]' in content
            assert content.count('Dialogue:') == 0
        finally:
            os.unlink(path)

    def test_highlight_color_in_output(self):
        gen = KineticSubtitleGenerator.__new__(KineticSubtitleGenerator)
        words = self._make_words(['HELLO', 'WORLD'])
        with tempfile.NamedTemporaryFile(suffix='.ass', delete=False) as f:
            path = f.name
        try:
            gen.build_ass_subtitles(words, path, highlight_color_bgr='&H0000FF00')
            content = open(path).read()
            assert '&H0000FF00' in content
        finally:
            os.unlink(path)

    def test_plays_res_x_and_y_for_vertical(self):
        gen = KineticSubtitleGenerator.__new__(KineticSubtitleGenerator)
        words = self._make_words(['TEST'])
        with tempfile.NamedTemporaryFile(suffix='.ass', delete=False) as f:
            path = f.name
        try:
            gen.build_ass_subtitles(words, path)
            content = open(path).read()
            assert 'PlayResX: 1080' in content
            assert 'PlayResY: 1920' in content
        finally:
            os.unlink(path)
