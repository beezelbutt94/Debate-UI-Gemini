"""Tests for services/api/app/middleware/rate_limit.py

Covers _LocalSlidingWindow.hit() -- the in-process fallback used when
Redis is unreachable.  No real Redis connection is required.
"""
import sys
import time
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, "services/api")

# Patch redis.from_url so the module-level client creation doesn't try
# to connect to a Redis server that doesn't exist in CI.
with patch("redis.from_url", return_value=MagicMock()):
    from app.middleware.rate_limit import (
        _LocalSlidingWindow,
        MAX_REQUESTS_PER_WINDOW,
        WINDOW_SECONDS,
        _FALLBACK_MAX_KEYS,
    )


class TestLocalSlidingWindow:
    def setup_method(self):
        self.win = _LocalSlidingWindow()

    def test_first_request_returns_zero(self):
        now = time.time()
        assert self.win.hit("key1", now) == 0

    def test_second_request_within_window_returns_one(self):
        now = time.time()
        self.win.hit("key1", now)
        result = self.win.hit("key1", now + 1)
        assert result == 1

    def test_request_after_window_expires_returns_zero(self):
        now = time.time()
        self.win.hit("key1", now)
        # Simulate request arriving after the window has closed
        future = now + WINDOW_SECONDS + 1
        result = self.win.hit("key1", future)
        assert result == 0

    def test_requests_at_boundary_counted(self):
        now = time.time()
        # Requests exactly at cutoff (<=) are excluded; strictly within window counted
        self.win.hit("key1", now)
        # Request at exactly `now + WINDOW_SECONDS` is inside the window
        result = self.win.hit("key1", now + WINDOW_SECONDS)
        # The first request's timestamp == now; cutoff = (now+WINDOW_SECONDS) - WINDOW_SECONDS = now
        # The condition is `window[0] <= cutoff`, so `now <= now` = True → evicted
        assert result == 0

    def test_independent_keys_isolated(self):
        now = time.time()
        self.win.hit("key-a", now)
        self.win.hit("key-a", now + 1)
        # key-b starts fresh
        result = self.win.hit("key-b", now + 2)
        assert result == 0

    def test_accumulates_up_to_limit(self):
        now = time.time()
        preceding_counts = []
        for i in range(MAX_REQUESTS_PER_WINDOW + 5):
            preceding = self.win.hit("key-x", now + i * 0.1)
            preceding_counts.append(preceding)
        # First call returns 0, each subsequent call increments by 1
        assert preceding_counts[0] == 0
        for i in range(1, MAX_REQUESTS_PER_WINDOW + 5):
            assert preceding_counts[i] == i

    def test_returns_integer(self):
        result = self.win.hit("k", time.time())
        assert isinstance(result, int)

    def test_thread_safety_no_exception(self):
        import threading
        now = time.time()
        errors = []

        def worker(key, offset):
            try:
                for i in range(50):
                    self.win.hit(key, now + offset + i * 0.01)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(f"key{j}", j)) for j in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert not errors

    def test_key_eviction_when_max_exceeded(self):
        now = time.time()
        # Fill up to the max key count
        for i in range(_FALLBACK_MAX_KEYS + 1):
            self.win.hit(f"evict-key-{i}", now)
        # The window should not exceed _FALLBACK_MAX_KEYS entries
        assert len(self.win._windows) <= _FALLBACK_MAX_KEYS

    def test_sliding_window_old_entries_removed(self):
        now = time.time()
        # Add 5 old entries
        for i in range(5):
            self.win.hit("sliding", now + i * 0.1)
        # Jump past the window
        future = now + WINDOW_SECONDS + 10
        result = self.win.hit("sliding", future)
        # All old entries evicted; this is a fresh window
        assert result == 0

    def test_multiple_windows_in_sequence(self):
        now = time.time()
        # First window: 3 requests (at now, now+1, now+2)
        for i in range(3):
            self.win.hit("seq", now + i)
        # Jump far enough that ALL old entries fall outside the new window.
        # cutoff = now2 - WINDOW_SECONDS; to evict `now+2` we need
        # now2 - WINDOW_SECONDS > now+2, i.e. now2 > now + WINDOW_SECONDS + 2.
        now2 = now + WINDOW_SECONDS + 3
        result = self.win.hit("seq", now2)
        assert result == 0  # all old entries evicted

    def test_constants_correct(self):
        assert WINDOW_SECONDS == 60
        assert MAX_REQUESTS_PER_WINDOW == 15


class TestMiddlewareConfig:
    def test_rate_limited_prefixes_import(self):
        with patch("redis.from_url", return_value=MagicMock()):
            from app.middleware.rate_limit import RATE_LIMITED_PREFIXES
        assert "/api/v1/videos/generate" in RATE_LIMITED_PREFIXES
        assert "/api/v1/analytics/competitor-scan" in RATE_LIMITED_PREFIXES
