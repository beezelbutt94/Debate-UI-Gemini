"""Tests for KineticSubtitleGenerator — exercises the pure timestamp
formatting and ASS-file building without requiring faster-whisper.
"""
import sys
import os
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

import pytest


@pytest.fixture
def generator():
    # Patch faster_whisper away so the class can be imported in a no-GPU env.
    import unittest.mock as mock
    with mock.patch.dict('sys.modules', {'faster_whisper': mock.MagicMock()}):
        from app.pipeline.subtitles import KineticSubtitleGenerator
        g = KineticSubtitleGenerator.__new__(KineticSubtitleGenerator)
        return g


class TestFormatTimestamp:
    @pytest.fixture(autouse=True)
    def setup(self):
        import unittest.mock as mock
        with mock.patch.dict('sys.modules', {'faster_whisper': mock.MagicMock()}):
            from app.pipeline.subtitles import KineticSubtitleGenerator
            self.fmt = KineticSubtitleGenerator._format_timestamp

    def test_zero_seconds(self):
        assert self.fmt(0.0) == '0:00:00.00'

    def test_one_minute(self):
        assert self.fmt(60.0) == '0:01:00.00'

    def test_one_hour(self):
        assert self.fmt(3600.0) == '1:00:00.00'

    def test_one_hour_one_minute_one_second(self):
        assert self.fmt(3661.0) == '1:01:01.00'

    def test_half_second_centiseconds(self):
        assert self.fmt(0.5) == '0:00:00.50'

    def test_fractional_centiseconds_round(self):
        result = self.fmt(1.255)
        # 0.255 * 100 = 25.5 → rounds to 26
        assert result == '0:00:01.26'

    def test_90_seconds(self):
        assert self.fmt(90.0) == '0:01:30.00'

    def test_minutes_zero_padded(self):
        # 9 minutes → "0:09:00.00"
        assert self.fmt(540.0) == '0:09:00.00'

    def test_seconds_zero_padded(self):
        # 5 seconds → "0:00:05.00"
        assert self.fmt(5.0) == '0:00:05.00'

    def test_large_time_above_one_hour(self):
        result = self.fmt(7265.0)   # 2h 1m 5s
        assert result == '2:01:05.00'


class TestBuildAssSubtitles:
    @pytest.fixture(autouse=True)
    def setup(self):
        import unittest.mock as mock
        with mock.patch.dict('sys.modules', {'faster_whisper': mock.MagicMock()}):
            from app.pipeline.subtitles import KineticSubtitleGenerator
            self.gen = KineticSubtitleGenerator.__new__(KineticSubtitleGenerator)

    def _words(self, texts, start=0.0, duration=0.5):
        return [
            {'word': t.upper(), 'start': start + i * duration, 'end': start + (i + 1) * duration, 'probability': 0.99}
            for i, t in enumerate(texts)
        ]

    def test_returns_output_path(self, tmp_path):
        words = self._words(['hello', 'world'])
        out = str(tmp_path / 'sub.ass')
        result = self.gen.build_ass_subtitles(words, out)
        assert result == out

    def test_output_file_exists(self, tmp_path):
        words = self._words(['hello'])
        out = str(tmp_path / 'sub.ass')
        self.gen.build_ass_subtitles(words, out)
        assert os.path.exists(out)

    def test_output_contains_script_info_header(self, tmp_path):
        words = self._words(['hi'])
        out = str(tmp_path / 'sub.ass')
        self.gen.build_ass_subtitles(words, out)
        content = open(out).read()
        assert '[Script Info]' in content

    def test_output_contains_events_section(self, tmp_path):
        words = self._words(['hi'])
        out = str(tmp_path / 'sub.ass')
        self.gen.build_ass_subtitles(words, out)
        content = open(out).read()
        assert '[Events]' in content

    def test_output_contains_dialogue_lines(self, tmp_path):
        words = self._words(['hello', 'world'])
        out = str(tmp_path / 'sub.ass')
        self.gen.build_ass_subtitles(words, out)
        content = open(out).read()
        assert 'Dialogue:' in content

    def test_max_words_per_line_chunking(self, tmp_path):
        words = self._words(['a', 'b', 'c', 'd'])
        out = str(tmp_path / 'sub.ass')
        self.gen.build_ass_subtitles(words, out, max_words_per_line=2)
        content = open(out).read()
        dialogue_count = content.count('Dialogue:')
        # 4 words, 2 per chunk → 2 chunks, each active-highlights all words in chunk
        # chunk [a,b]: 2 dialogue lines; chunk [c,d]: 2 dialogue lines → 4 total
        assert dialogue_count == 4

    def test_custom_font_name_in_style(self, tmp_path):
        words = self._words(['hi'])
        out = str(tmp_path / 'sub.ass')
        self.gen.build_ass_subtitles(words, out, font_name='Arial Black')
        content = open(out).read()
        assert 'Arial Black' in content

    def test_custom_font_size_in_style(self, tmp_path):
        words = self._words(['hi'])
        out = str(tmp_path / 'sub.ass')
        self.gen.build_ass_subtitles(words, out, font_size=64)
        content = open(out).read()
        assert '64' in content

    def test_highlight_color_in_dialogue(self, tmp_path):
        words = self._words(['hi'])
        out = str(tmp_path / 'sub.ass')
        self.gen.build_ass_subtitles(words, out, highlight_color_bgr='&H0000FF00')
        content = open(out).read()
        assert '&H0000FF00' in content

    def test_empty_words_produces_valid_file(self, tmp_path):
        out = str(tmp_path / 'empty.ass')
        result = self.gen.build_ass_subtitles([], out)
        assert os.path.exists(result)

    def test_resolution_1080x1920_in_header(self, tmp_path):
        words = self._words(['hi'])
        out = str(tmp_path / 'sub.ass')
        self.gen.build_ass_subtitles(words, out)
        content = open(out).read()
        assert 'PlayResX: 1080' in content
        assert 'PlayResY: 1920' in content
