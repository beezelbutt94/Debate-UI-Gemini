"""Tests for KineticSubtitleGenerator._format_timestamp (pure static method)."""
import pytest
from app.pipeline.subtitles import KineticSubtitleGenerator

fmt = KineticSubtitleGenerator._format_timestamp


class TestFormatTimestamp:
    def test_zero(self):
        assert fmt(0.0) == '0:00:00.00'

    def test_one_second(self):
        assert fmt(1.0) == '0:00:01.00'

    def test_one_minute(self):
        assert fmt(60.0) == '0:01:00.00'

    def test_one_hour(self):
        assert fmt(3600.0) == '1:00:00.00'

    def test_one_hour_one_minute_one_second(self):
        assert fmt(3661.0) == '1:01:01.00'

    def test_fractional_centiseconds_half_second(self):
        assert fmt(0.5) == '0:00:00.50'

    def test_fractional_centiseconds_123ms(self):
        # 0.123s → centis = round(0.123 * 100) = 12
        assert fmt(0.123) == '0:00:00.12'

    def test_fractional_centiseconds_round_up(self):
        # 0.995 * 100 rounds to 100 centiseconds, which normalises to
        # 1 second + 0 centiseconds (not 0s + malformed "100" centis).
        assert fmt(0.995) == '0:00:01.00'

    def test_centiseconds_overflow_mid_minute(self):
        # 1.995 s → round(199.5) = 200 centis = 2 s exactly
        assert fmt(1.995) == '0:00:02.00'

    def test_centiseconds_overflow_at_minute_boundary(self):
        # 59.995 s → round(5999.5) = 6000 centis = 60 s = 1 min
        assert fmt(59.995) == '0:01:00.00'

    def test_fractional_centiseconds_99_centis(self):
        assert fmt(0.99) == '0:00:00.99'

    def test_mixed_hours_minutes_seconds_centiseconds(self):
        # 1h 2m 3.45s = 3600 + 120 + 3.45 = 3723.45
        assert fmt(3723.45) == '1:02:03.45'

    def test_59_minutes_59_seconds(self):
        assert fmt(3599.0) == '0:59:59.00'

    def test_format_has_leading_zero_minutes(self):
        assert fmt(60.0).startswith('0:01:')

    def test_format_has_leading_zero_seconds(self):
        result = fmt(1.0)
        # seconds field is zero-padded to 2 digits
        assert result == '0:00:01.00'

    def test_large_hours(self):
        # 10 hours
        result = fmt(36000.0)
        assert result == '10:00:00.00'

    def test_seconds_field_zero_padded(self):
        result = fmt(65.0)  # 1m 5s
        assert result == '0:01:05.00'

    def test_centis_field_zero_padded(self):
        result = fmt(0.01)
        assert result == '0:00:00.01'

    def test_returns_string_type(self):
        assert isinstance(fmt(42.5), str)

    def test_negative_zero(self):
        result = fmt(-0.0)
        assert result == '0:00:00.00'


class TestBuildAssSubtitles:
    """Tests for the subtitle chunking and ASS format generation.

    KineticSubtitleGenerator.__init__ imports faster_whisper lazily, so we
    bypass it via object.__new__ to get an instance without loading ML libs.
    """

    def _gen(self):
        """Return an instance with __init__ bypassed."""
        return object.__new__(KineticSubtitleGenerator)

    def _make_words(self, texts, base_start=0.0, duration=0.5):
        words = []
        for i, text in enumerate(texts):
            start = base_start + i * duration
            words.append({'word': text.upper(), 'start': start, 'end': start + duration, 'probability': 0.99})
        return words

    def test_empty_words_produces_valid_header(self, tmp_path):
        out = str(tmp_path / 'sub.ass')
        result = self._gen().build_ass_subtitles([], out)
        assert result == out
        content = open(out).read()
        assert '[Script Info]' in content
        assert '[Events]' in content

    def test_single_word_creates_one_dialogue_line(self, tmp_path):
        out = str(tmp_path / 'sub.ass')
        words = self._make_words(['HELLO'])
        self._gen().build_ass_subtitles(words, out)
        content = open(out).read()
        assert 'Dialogue:' in content
        assert 'HELLO' in content

    def test_max_words_per_line_chunking(self, tmp_path):
        out = str(tmp_path / 'sub.ass')
        # 6 words, default max_words_per_line=3 → 2 chunks of 3
        words = self._make_words(['A', 'B', 'C', 'D', 'E', 'F'])
        self._gen().build_ass_subtitles(words, out)
        content = open(out).read()
        dialogues = [l for l in content.splitlines() if l.startswith('Dialogue:')]
        # 2 chunks × 3 words each = 6 dialogue events
        assert len(dialogues) == 6

    def test_output_file_is_created(self, tmp_path):
        import os
        out = str(tmp_path / 'output.ass')
        words = self._make_words(['TEST'])
        self._gen().build_ass_subtitles(words, out)
        assert os.path.exists(out)

    def test_custom_max_words_per_line(self, tmp_path):
        out = str(tmp_path / 'sub.ass')
        words = self._make_words(['A', 'B', 'C', 'D'])
        self._gen().build_ass_subtitles(words, out, max_words_per_line=2)
        content = open(out).read()
        # 2 chunks × 2 words = 4 dialogue events
        dialogues = [l for l in content.splitlines() if l.startswith('Dialogue:')]
        assert len(dialogues) == 4

    def test_highlight_color_applied_to_active_word(self, tmp_path):
        out = str(tmp_path / 'sub.ass')
        words = self._make_words(['FOCUS'])
        self._gen().build_ass_subtitles(words, out)
        content = open(out).read()
        # Default highlight color
        assert '&H0000FFFF' in content

    def test_script_info_resolution(self, tmp_path):
        out = str(tmp_path / 'sub.ass')
        self._gen().build_ass_subtitles([], out)
        content = open(out).read()
        assert 'PlayResX: 1080' in content
        assert 'PlayResY: 1920' in content
