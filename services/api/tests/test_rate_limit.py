"""Tests for the _LocalSlidingWindow fallback rate limiter in rate_limit.py."""
import sys
import pytest
from unittest.mock import MagicMock, patch

# Stub redis before importing rate_limit so the module-level redis.from_url
# call doesn't require a real Redis server.
redis_stub = MagicMock()
sys.modules.setdefault('redis', redis_stub)

import app.middleware.rate_limit as _rl
from app.middleware.rate_limit import _LocalSlidingWindow, WINDOW_SECONDS, MAX_REQUESTS_PER_WINDOW, _FALLBACK_MAX_KEYS


class TestLocalSlidingWindow:
    def setup_method(self):
        self.window = _LocalSlidingWindow()

    def test_first_request_returns_zero_preceding(self):
        assert self.window.hit('key1', 1000.0) == 0

    def test_second_request_in_window_returns_one(self):
        self.window.hit('key1', 1000.0)
        assert self.window.hit('key1', 1001.0) == 1

    def test_third_request_in_window_returns_two(self):
        self.window.hit('key1', 1000.0)
        self.window.hit('key1', 1001.0)
        assert self.window.hit('key1', 1002.0) == 2

    def test_requests_after_window_expiry_are_not_counted(self):
        # Hit at t=0 is outside the window at t=WINDOW_SECONDS+1
        self.window.hit('key1', 0.0)
        # At exactly t=WINDOW_SECONDS the first hit is at the cutoff boundary.
        # cutoff = now - WINDOW_SECONDS; condition is window[0] <= cutoff
        # So at now = WINDOW_SECONDS: cutoff = 0, the hit at 0 is <= 0, it's removed.
        result = self.window.hit('key1', float(WINDOW_SECONDS))
        assert result == 0

    def test_requests_just_inside_window_are_counted(self):
        self.window.hit('key1', 0.0)
        # 1 second before the window expires the first hit is still inside.
        result = self.window.hit('key1', float(WINDOW_SECONDS - 1))
        assert result == 1

    def test_multiple_keys_tracked_independently(self):
        self.window.hit('keyA', 1000.0)
        self.window.hit('keyA', 1001.0)
        self.window.hit('keyB', 1000.0)
        assert self.window.hit('keyA', 1002.0) == 2
        assert self.window.hit('keyB', 1001.0) == 1

    def test_window_resets_after_all_entries_expire(self):
        for i in range(5):
            self.window.hit('key1', float(i))
        # Jump forward past the window
        result = self.window.hit('key1', float(WINDOW_SECONDS + 10))
        assert result == 0

    def test_hit_count_accumulates_correctly_at_max_rate(self):
        t = 1000.0
        counts = []
        for i in range(MAX_REQUESTS_PER_WINDOW):
            counts.append(self.window.hit('key1', t + i * 0.1))
        assert counts == list(range(MAX_REQUESTS_PER_WINDOW))

    def test_max_keys_eviction_does_not_raise(self):
        # Fill beyond the cap; eviction should happen silently.
        for i in range(_FALLBACK_MAX_KEYS + 10):
            self.window.hit(f'key_{i}', 1000.0)
        assert len(self.window._windows) <= _FALLBACK_MAX_KEYS

    def test_different_timestamps_same_key_counts_correctly(self):
        # 3 hits; advance time so first two expire but the third is still inside the window
        t0 = 1000.0
        self.window.hit('k', t0)        # will expire
        self.window.hit('k', t0 + 1)   # will expire
        self.window.hit('k', t0 + 2)   # stays in window
        # now = t0+2+WINDOW_SECONDS - 0.5 → cutoff = t0+2 - 0.5 = t0+1.5
        # hits at t0 and t0+1 are <= cutoff, so they expire; hit at t0+2 stays
        result = self.window.hit('k', t0 + 2 + WINDOW_SECONDS - 0.5)
        assert result == 1

    def test_hit_is_threadsafe(self):
        import threading
        results = []

        def worker():
            for _ in range(10):
                results.append(self.window.hit('shared_key', 1000.0))

        threads = [threading.Thread(target=worker) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # 50 total hits; each returns the count of preceding hits → no crashes
        assert len(results) == 50


class TestRateLimitConstants:
    def test_window_seconds_is_60(self):
        assert WINDOW_SECONDS == 60

    def test_max_requests_is_15(self):
        assert MAX_REQUESTS_PER_WINDOW == 15

    def test_fallback_max_keys_is_10000(self):
        assert _FALLBACK_MAX_KEYS == 10_000
