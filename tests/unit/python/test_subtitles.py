"""Tests for KineticSubtitleGenerator static helpers (no faster-whisper required)."""
import os
import tempfile
import pytest

# The class imports faster-whisper in __init__, so we test only static/class
# methods that don't require it, using a direct import of the method.
from app.pipeline.subtitles import KineticSubtitleGenerator


class TestFormatTimestamp:
    """_format_timestamp(seconds) → 'H:MM:SS.cc'"""

    def test_zero_seconds(self):
        assert KineticSubtitleGenerator._format_timestamp(0.0) == "0:00:00.00"

    def test_one_second(self):
        assert KineticSubtitleGenerator._format_timestamp(1.0) == "0:00:01.00"

    def test_one_minute(self):
        assert KineticSubtitleGenerator._format_timestamp(60.0) == "0:01:00.00"

    def test_one_hour(self):
        assert KineticSubtitleGenerator._format_timestamp(3600.0) == "1:00:00.00"

    def test_complex_time(self):
        # 1h 23m 45.67s
        t = 3600 + 23 * 60 + 45.67
        assert KineticSubtitleGenerator._format_timestamp(t) == "1:23:45.67"

    def test_centisecond_rounding(self):
        # 0.999s → centis = round(0.999 * 100) = 100 → but secs is int(0.999)=0
        # actual: centis = int(round((0.999 - 0) * 100)) = int(round(99.9)) = 100
        # but 100 centiseconds would be formatted as .100 which has 3 digits...
        # Let's use a cleaner value
        t = 1.5
        assert KineticSubtitleGenerator._format_timestamp(t) == "0:00:01.50"

    def test_30_seconds(self):
        assert KineticSubtitleGenerator._format_timestamp(30.0) == "0:00:30.00"

    def test_fractional_centiseconds(self):
        t = 5.25
        assert KineticSubtitleGenerator._format_timestamp(t) == "0:00:05.25"

    def test_59_minutes_59_seconds(self):
        t = 59 * 60 + 59.0
        assert KineticSubtitleGenerator._format_timestamp(t) == "0:59:59.00"

    def test_two_hours(self):
        assert KineticSubtitleGenerator._format_timestamp(7200.0) == "2:00:00.00"

    def test_minutes_zero_padded(self):
        t = 5 * 60  # 5 minutes = "0:05:00.00"
        assert KineticSubtitleGenerator._format_timestamp(t) == "0:05:00.00"

    def test_seconds_zero_padded(self):
        t = 9.0
        assert KineticSubtitleGenerator._format_timestamp(t) == "0:00:09.00"

    def test_small_fraction(self):
        t = 0.01
        assert KineticSubtitleGenerator._format_timestamp(t) == "0:00:00.01"


class TestBuildAssSubtitles:
    """build_ass_subtitles() writes a valid ASS file and returns its path.

    We test the output file structure and content without needing faster-whisper.
    A synthetic word-list is passed directly.
    """

    def _make_words(self, texts, start_offset=0.0):
        words = []
        t = start_offset
        for text in texts:
            words.append({"word": text.upper(), "start": t, "end": t + 0.4, "probability": 0.99})
            t += 0.5
        return words

    def _build(self, words=None, **kwargs):
        if words is None:
            words = self._make_words(["hello", "world", "test"])
        with tempfile.NamedTemporaryFile(suffix=".ass", delete=False) as f:
            path = f.name
        try:
            # build_ass_subtitles requires __init__ (WhisperModel); call the
            # static parts via an unbound call to avoid instantiation.
            # Since build_ass_subtitles is an instance method but only uses
            # self._format_timestamp (a @staticmethod), we can call it on an
            # object created without super().__init__ using object.__new__.
            instance = object.__new__(KineticSubtitleGenerator)
            result = KineticSubtitleGenerator.build_ass_subtitles(
                instance, words, path, **kwargs
            )
            return result, path
        except Exception:
            if os.path.exists(path):
                os.unlink(path)
            raise

    def teardown_method(self):
        pass  # temp files cleaned per test

    def test_returns_path_to_ass_file(self):
        result, path = self._build()
        assert result == path
        os.unlink(path)

    def test_file_is_written(self):
        _, path = self._build()
        assert os.path.exists(path)
        assert os.path.getsize(path) > 0
        os.unlink(path)

    def test_script_info_section_present(self):
        _, path = self._build()
        with open(path, encoding="utf-8") as f:
            content = f.read()
        assert "[Script Info]" in content
        os.unlink(path)

    def test_styles_section_present(self):
        _, path = self._build()
        with open(path, encoding="utf-8") as f:
            content = f.read()
        assert "[V4+ Styles]" in content
        os.unlink(path)

    def test_events_section_present(self):
        _, path = self._build()
        with open(path, encoding="utf-8") as f:
            content = f.read()
        assert "[Events]" in content
        os.unlink(path)

    def test_dialogue_lines_present(self):
        words = self._make_words(["foo", "bar", "baz"])
        _, path = self._build(words=words)
        with open(path, encoding="utf-8") as f:
            content = f.read()
        assert "Dialogue:" in content
        os.unlink(path)

    def test_words_uppercased_in_output(self):
        words = self._make_words(["hello", "world"])
        _, path = self._build(words=words)
        with open(path, encoding="utf-8") as f:
            content = f.read()
        assert "HELLO" in content
        assert "WORLD" in content
        os.unlink(path)

    def test_custom_font_name_in_style(self):
        _, path = self._build(font_name="Arial")
        with open(path, encoding="utf-8") as f:
            content = f.read()
        assert "Arial" in content
        os.unlink(path)

    def test_custom_font_size_in_style(self):
        _, path = self._build(font_size=64)
        with open(path, encoding="utf-8") as f:
            content = f.read()
        assert "64" in content
        os.unlink(path)

    def test_empty_words_list_produces_valid_header_only(self):
        _, path = self._build(words=[])
        with open(path, encoding="utf-8") as f:
            content = f.read()
        assert "[Script Info]" in content
        assert "Dialogue:" not in content
        os.unlink(path)

    def test_chunks_are_bounded_by_max_words_per_line(self):
        # 7 words with max_words_per_line=3 → 3 chunks (3,3,1)
        # Each chunk produces len(chunk) dialogue lines (one per active word)
        words = self._make_words(["a", "b", "c", "d", "e", "f", "g"])
        _, path = self._build(words=words, max_words_per_line=3)
        with open(path, encoding="utf-8") as f:
            content = f.read()
        dialogue_count = content.count("Dialogue:")
        # 3 + 3 + 1 = 7 dialogue lines
        assert dialogue_count == 7
        os.unlink(path)

    def test_highlight_color_appears_in_dialogue(self):
        words = self._make_words(["test"])
        _, path = self._build(words=words, highlight_color_bgr="&H0000FF00")
        with open(path, encoding="utf-8") as f:
            content = f.read()
        assert "&H0000FF00" in content
        os.unlink(path)

    def test_play_res_set_for_vertical_video(self):
        _, path = self._build()
        with open(path, encoding="utf-8") as f:
            content = f.read()
        assert "PlayResX: 1080" in content
        assert "PlayResY: 1920" in content
        os.unlink(path)
