"""Tests for app.core.telemetry – Prometheus metrics and TrackTranscodeLatency."""
import time
import pytest
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Import the module under test
# ---------------------------------------------------------------------------
from app.core.telemetry import (
    ACTIVE_TRANSCODE_GAUGE,
    FAILED_RENDERS_COUNTER,
    TRANSCODE_DURATION_HISTOGRAM,
    TrackTranscodeLatency,
)


# ---------------------------------------------------------------------------
# TrackTranscodeLatency context manager
# ---------------------------------------------------------------------------
class TestTrackTranscodeLatency:
    def test_increments_active_gauge_on_enter(self):
        gauge_labels = MagicMock()
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels", return_value=gauge_labels):
            ctx = TrackTranscodeLatency(tier="standard")
            ctx.__enter__()
            gauge_labels.inc.assert_called_once()

    def test_decrements_active_gauge_on_exit(self):
        gauge_labels = MagicMock()
        hist_labels = MagicMock()
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels", return_value=gauge_labels):
            with patch.object(TRANSCODE_DURATION_HISTOGRAM, "labels", return_value=hist_labels):
                ctx = TrackTranscodeLatency(tier="draft")
                ctx.__enter__()
                ctx.__exit__(None, None, None)
                gauge_labels.dec.assert_called_once()

    def test_records_completed_status_on_success(self):
        hist_labels = MagicMock()
        gauge_labels = MagicMock()
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels", return_value=gauge_labels):
            with patch.object(TRANSCODE_DURATION_HISTOGRAM, "labels", return_value=hist_labels) as mock_hist:
                with TrackTranscodeLatency(tier="standard"):
                    pass
                mock_hist.assert_called_with(tier="standard", status="completed")

    def test_records_failed_status_on_exception(self):
        hist_labels = MagicMock()
        gauge_labels = MagicMock()
        counter_labels = MagicMock()
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels", return_value=gauge_labels):
            with patch.object(TRANSCODE_DURATION_HISTOGRAM, "labels", return_value=hist_labels) as mock_hist:
                with patch.object(FAILED_RENDERS_COUNTER, "labels", return_value=counter_labels):
                    try:
                        with TrackTranscodeLatency(tier="premium"):
                            raise ValueError("ffmpeg died")
                    except ValueError:
                        pass
                    mock_hist.assert_called_with(tier="premium", status="failed")

    def test_increments_failure_counter_on_exception(self):
        gauge_labels = MagicMock()
        hist_labels = MagicMock()
        counter_labels = MagicMock()
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels", return_value=gauge_labels):
            with patch.object(TRANSCODE_DURATION_HISTOGRAM, "labels", return_value=hist_labels):
                with patch.object(FAILED_RENDERS_COUNTER, "labels", return_value=counter_labels) as mock_ctr:
                    try:
                        with TrackTranscodeLatency(tier="draft"):
                            raise RuntimeError("timeout")
                    except RuntimeError:
                        pass
                    mock_ctr.assert_called_with(reason="RuntimeError")
                    counter_labels.inc.assert_called_once()

    def test_does_not_suppress_exception(self):
        gauge_labels = MagicMock()
        hist_labels = MagicMock()
        counter_labels = MagicMock()
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels", return_value=gauge_labels):
            with patch.object(TRANSCODE_DURATION_HISTOGRAM, "labels", return_value=hist_labels):
                with patch.object(FAILED_RENDERS_COUNTER, "labels", return_value=counter_labels):
                    with pytest.raises(ValueError, match="propagated"):
                        with TrackTranscodeLatency(tier="standard"):
                            raise ValueError("propagated")

    def test_observe_called_with_positive_duration(self):
        hist_labels = MagicMock()
        gauge_labels = MagicMock()
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels", return_value=gauge_labels):
            with patch.object(TRANSCODE_DURATION_HISTOGRAM, "labels", return_value=hist_labels):
                with TrackTranscodeLatency(tier="standard"):
                    pass
                # observe() should have been called with a non-negative float
                observe_args = hist_labels.observe.call_args[0]
                assert observe_args[0] >= 0.0

    def test_label_tier_is_passed_correctly(self):
        gauge_labels = MagicMock()
        hist_labels = MagicMock()
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels", return_value=gauge_labels) as mock_g:
            with patch.object(TRANSCODE_DURATION_HISTOGRAM, "labels", return_value=hist_labels):
                with TrackTranscodeLatency(tier="premium"):
                    pass
                # The gauge labels call should use the correct tier
                mock_g.assert_called_with(tier="premium")

    def test_enter_returns_self(self):
        gauge_labels = MagicMock()
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels", return_value=gauge_labels):
            ctx = TrackTranscodeLatency(tier="draft")
            result = ctx.__enter__()
            assert result is ctx
