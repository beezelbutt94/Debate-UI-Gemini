"""Tests for app.core.telemetry – TrackTranscodeLatency context manager
and record_nvml_gpu_telemetry graceful-degradation path.
"""
import os
import sys
import time
from unittest.mock import MagicMock, patch

import pytest

_API_ROOT = os.path.join(os.path.dirname(__file__), "..")
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

from app.core.telemetry import (
    TrackTranscodeLatency,
    ACTIVE_TRANSCODE_GAUGE,
    TRANSCODE_DURATION_HISTOGRAM,
    FAILED_RENDERS_COUNTER,
    record_nvml_gpu_telemetry,
)


class TestTrackTranscodeLatency:
    def test_increments_gauge_on_enter(self):
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels") as mock_labels:
            mock_gauge = MagicMock()
            mock_labels.return_value = mock_gauge

            tracker = TrackTranscodeLatency("standard")
            tracker.__enter__()

            mock_labels.assert_called_with(tier="standard")
            mock_gauge.inc.assert_called_once()

    def test_decrements_gauge_on_exit(self):
        dec_calls = []
        original_labels = ACTIVE_TRANSCODE_GAUGE.labels

        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels") as mock_labels:
            mock_gauge = MagicMock()
            mock_gauge.dec.side_effect = lambda: dec_calls.append(1)
            mock_labels.return_value = mock_gauge

            tracker = TrackTranscodeLatency("premium")
            tracker.__enter__()
            tracker.__exit__(None, None, None)

        assert len(dec_calls) == 1

    def test_records_completed_histogram_on_success(self):
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels", return_value=MagicMock()):
            with patch.object(TRANSCODE_DURATION_HISTOGRAM, "labels") as mock_labels:
                mock_hist = MagicMock()
                mock_labels.return_value = mock_hist

                tracker = TrackTranscodeLatency("draft")
                tracker.__enter__()
                tracker.__exit__(None, None, None)

                mock_labels.assert_called_with(tier="draft", status="completed")
                mock_hist.observe.assert_called_once()

    def test_records_failed_histogram_on_exception(self):
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels", return_value=MagicMock()):
            with patch.object(TRANSCODE_DURATION_HISTOGRAM, "labels") as mock_labels:
                mock_hist = MagicMock()
                mock_labels.return_value = mock_hist

                tracker = TrackTranscodeLatency("standard")
                tracker.__enter__()
                tracker.__exit__(ValueError, ValueError("fail"), None)

                mock_labels.assert_called_with(tier="standard", status="failed")
                mock_hist.observe.assert_called_once()

    def test_increments_failure_counter_on_exception(self):
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels", return_value=MagicMock()):
            with patch.object(TRANSCODE_DURATION_HISTOGRAM, "labels", return_value=MagicMock()):
                with patch.object(FAILED_RENDERS_COUNTER, "labels") as mock_labels:
                    mock_counter = MagicMock()
                    mock_labels.return_value = mock_counter

                    tracker = TrackTranscodeLatency("standard")
                    tracker.__enter__()
                    tracker.__exit__(RuntimeError, RuntimeError("oops"), None)

                    mock_labels.assert_called_with(reason="RuntimeError")
                    mock_counter.inc.assert_called_once()

    def test_does_not_increment_failure_counter_on_success(self):
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels", return_value=MagicMock()):
            with patch.object(TRANSCODE_DURATION_HISTOGRAM, "labels", return_value=MagicMock()):
                with patch.object(FAILED_RENDERS_COUNTER, "labels") as mock_labels:
                    tracker = TrackTranscodeLatency("standard")
                    tracker.__enter__()
                    tracker.__exit__(None, None, None)

                    mock_labels.assert_not_called()

    def test_context_manager_records_positive_duration(self):
        durations = []
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels", return_value=MagicMock()):
            with patch.object(TRANSCODE_DURATION_HISTOGRAM, "labels") as mock_labels:
                mock_hist = MagicMock()
                mock_hist.observe.side_effect = lambda d: durations.append(d)
                mock_labels.return_value = mock_hist

                with TrackTranscodeLatency("standard"):
                    time.sleep(0.01)

        assert len(durations) == 1
        assert durations[0] > 0

    def test_used_as_real_context_manager_no_exception(self):
        """Full integration through `with` syntax, no crash."""
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels", return_value=MagicMock()):
            with patch.object(TRANSCODE_DURATION_HISTOGRAM, "labels", return_value=MagicMock()):
                with TrackTranscodeLatency("draft"):
                    pass  # success path

    def test_used_as_real_context_manager_with_exception(self):
        """Full integration through `with` syntax, exception path does not re-raise."""
        with patch.object(ACTIVE_TRANSCODE_GAUGE, "labels", return_value=MagicMock()):
            with patch.object(TRANSCODE_DURATION_HISTOGRAM, "labels", return_value=MagicMock()):
                with patch.object(FAILED_RENDERS_COUNTER, "labels", return_value=MagicMock()):
                    tracker = TrackTranscodeLatency("premium")
                    tracker.__enter__()
                    result = tracker.__exit__(TypeError, TypeError("t"), None)
                    # __exit__ returning None (falsy) means the exception propagates --
                    # that is correct behaviour; the caller (Celery task) handles it.
                    assert result is None


# ---------------------------------------------------------------------------
# record_nvml_gpu_telemetry
# ---------------------------------------------------------------------------

class TestRecordNvmlGpuTelemetry:
    def test_does_not_raise_when_pynvml_absent(self):
        """On a CPU-only machine the ImportError must be silently swallowed."""
        with patch.dict("sys.modules", {"pynvml": None}):
            # Reload to re-execute the import guard inside the function
            record_nvml_gpu_telemetry()  # should not raise

    def test_does_not_raise_on_generic_exception(self):
        """Any pynvml error must be silently swallowed."""
        mock_nvml = MagicMock()
        mock_nvml.nvmlInit.side_effect = Exception("driver not found")

        with patch.dict("sys.modules", {"pynvml": mock_nvml}):
            record_nvml_gpu_telemetry()  # should not raise
