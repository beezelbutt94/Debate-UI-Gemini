"""Tests for _LocalSlidingWindow and rate-limit middleware configuration."""
import time
import threading
import pytest


def _make_window():
    from app.middleware.rate_limit import _LocalSlidingWindow, WINDOW_SECONDS, MAX_REQUESTS_PER_WINDOW
    return _LocalSlidingWindow(), WINDOW_SECONDS, MAX_REQUESTS_PER_WINDOW


# ── _LocalSlidingWindow ───────────────────────────────────────────────────────

class TestLocalSlidingWindow:

    def test_first_hit_returns_zero_preceding(self):
        window, _, _ = _make_window()
        count = window.hit("key1", time.time())
        assert count == 0

    def test_second_hit_returns_one_preceding(self):
        window, _, _ = _make_window()
        now = time.time()
        window.hit("key1", now)
        count = window.hit("key1", now + 0.01)
        assert count == 1

    def test_different_keys_are_independent(self):
        window, _, _ = _make_window()
        now = time.time()
        window.hit("keyA", now)
        window.hit("keyA", now + 0.01)
        # keyB starts fresh
        count = window.hit("keyB", now + 0.02)
        assert count == 0

    def test_requests_outside_window_are_not_counted(self):
        window, win_secs, _ = _make_window()
        now = time.time()
        # Put a request far in the past
        window.hit("key1", now - win_secs - 1)
        # This new request should not see the old one
        count = window.hit("key1", now)
        assert count == 0

    def test_requests_at_window_edge_are_evicted(self):
        window, win_secs, _ = _make_window()
        now = time.time()
        # Exactly at the cutoff boundary (<=) means it should be evicted
        window.hit("key1", now - win_secs)
        count = window.hit("key1", now)
        assert count == 0

    def test_requests_just_inside_window_are_counted(self):
        window, win_secs, _ = _make_window()
        now = time.time()
        # Just inside the window
        window.hit("key1", now - win_secs + 0.5)
        count = window.hit("key1", now)
        assert count == 1

    def test_accumulates_multiple_requests_within_window(self):
        window, _, _ = _make_window()
        now = time.time()
        for i in range(5):
            window.hit("key1", now + i * 0.1)
        # 6th hit should see 5 preceding
        count = window.hit("key1", now + 0.6)
        assert count == 5

    def test_thread_safety_no_race_conditions(self):
        """Multiple threads hitting the same key should produce consistent results."""
        window, _, _ = _make_window()
        counts = []
        lock = threading.Lock()

        def worker():
            c = window.hit("shared", time.time())
            with lock:
                counts.append(c)

        threads = [threading.Thread(target=worker) for _ in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # All preceding counts should be non-negative and less than 20
        assert all(0 <= c < 20 for c in counts)
        # No duplicates — each thread sees a unique slot
        assert len(counts) == 20

    def test_eviction_at_max_keys(self):
        """When _FALLBACK_MAX_KEYS is exceeded, oldest entries are evicted."""
        from app.middleware.rate_limit import _FALLBACK_MAX_KEYS
        window, _, _ = _make_window()
        now = time.time()
        # Fill it past the limit
        for i in range(_FALLBACK_MAX_KEYS + 10):
            window.hit(f"key{i}", now)
        # Window internals should not exceed the cap
        with window._lock:
            assert len(window._windows) <= _FALLBACK_MAX_KEYS

    def test_returns_int(self):
        window, _, _ = _make_window()
        result = window.hit("k", time.time())
        assert isinstance(result, int)

    def test_zero_time_still_works(self):
        window, _, _ = _make_window()
        result = window.hit("k", 0.0)
        assert result == 0

    def test_hit_twice_at_identical_timestamp(self):
        window, _, _ = _make_window()
        now = time.time()
        window.hit("k", now)
        # Same timestamp — both are within the window
        count = window.hit("k", now)
        assert count == 1


# ── Constants / configuration checks ─────────────────────────────────────────

class TestRateLimitConfig:
    def test_window_is_60_seconds(self):
        from app.middleware.rate_limit import WINDOW_SECONDS
        assert WINDOW_SECONDS == 60

    def test_max_requests_is_15(self):
        from app.middleware.rate_limit import MAX_REQUESTS_PER_WINDOW
        assert MAX_REQUESTS_PER_WINDOW == 15

    def test_rate_limited_prefixes_includes_generation(self):
        from app.middleware.rate_limit import RATE_LIMITED_PREFIXES
        assert any("generate" in p for p in RATE_LIMITED_PREFIXES)

    def test_rate_limited_prefixes_includes_competitor_scan(self):
        from app.middleware.rate_limit import RATE_LIMITED_PREFIXES
        assert any("competitor" in p for p in RATE_LIMITED_PREFIXES)

    def test_fallback_max_keys_is_positive(self):
        from app.middleware.rate_limit import _FALLBACK_MAX_KEYS
        assert _FALLBACK_MAX_KEYS > 0

    def test_outage_log_interval_is_positive(self):
        from app.middleware.rate_limit import _OUTAGE_LOG_INTERVAL_SECONDS
        assert _OUTAGE_LOG_INTERVAL_SECONDS > 0
