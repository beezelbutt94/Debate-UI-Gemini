"""Tests for services/api/app/middleware/rate_limit._LocalSlidingWindow

Pure in-process window logic — no Redis, no HTTP.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

import time

import pytest

from app.middleware.rate_limit import (
    MAX_REQUESTS_PER_WINDOW,
    WINDOW_SECONDS,
    _FALLBACK_MAX_KEYS,
    _LocalSlidingWindow,
)


class TestLocalSlidingWindow:
    def test_first_hit_returns_zero_preceding(self):
        w = _LocalSlidingWindow()
        assert w.hit("key", time.time()) == 0

    def test_second_hit_returns_one_preceding(self):
        w = _LocalSlidingWindow()
        now = time.time()
        w.hit("key", now)
        assert w.hit("key", now + 0.1) == 1

    def test_window_accumulates_within_period(self):
        w = _LocalSlidingWindow()
        now = time.time()
        for i in range(10):
            w.hit("key", now + i * 0.5)
        assert w.hit("key", now + 5.5) == 10

    def test_old_requests_expire_after_window(self):
        w = _LocalSlidingWindow()
        now = 1_000_000.0  # arbitrary fixed time
        # Add 5 requests inside the window (at now+0..now+4)
        for i in range(5):
            w.hit("key", now + i)
        # Jump far enough that ALL 5 events fall outside the window.
        # cutoff = late - WINDOW_SECONDS; need cutoff > now+4, so late > now+4+WINDOW_SECONDS.
        late = now + WINDOW_SECONDS + 5 + 1  # all 5 events are <= cutoff
        assert w.hit("key", late) == 0

    def test_partial_expiry(self):
        w = _LocalSlidingWindow()
        now = 1_000_000.0
        # 3 old requests
        for i in range(3):
            w.hit("key", now + i)
        # 2 recent requests
        recent_start = now + WINDOW_SECONDS + 1
        for i in range(2):
            w.hit("key", recent_start + i)
        # Next hit should see only the 2 recent ones
        assert w.hit("key", recent_start + 2) == 2

    def test_independent_keys_do_not_interfere(self):
        w = _LocalSlidingWindow()
        now = time.time()
        for _ in range(5):
            w.hit("key-a", now)
        assert w.hit("key-b", now) == 0

    def test_requests_at_window_boundary_expire_correctly(self):
        w = _LocalSlidingWindow()
        base = 1_000_000.0
        # Request at time `base`.
        w.hit("key", base)
        # At exactly base+WINDOW_SECONDS: cutoff = (base+WINDOW_SECONDS) - WINDOW_SECONDS = base.
        # The condition is `<= cutoff`, so the event at `base` IS expired.
        assert w.hit("key", base + WINDOW_SECONDS) == 0
        # One nanosecond before expiry: event is still live
        w2 = _LocalSlidingWindow()
        w2.hit("key", base)
        assert w2.hit("key", base + WINDOW_SECONDS - 0.001) == 1

    def test_evicts_lru_keys_when_over_capacity(self):
        w = _LocalSlidingWindow()
        now = time.time()
        # Fill to capacity
        for i in range(_FALLBACK_MAX_KEYS):
            w.hit(f"key-{i}", now)
        # One more key should evict the LRU
        w.hit("overflow-key", now + 1)
        assert len(w._windows) <= _FALLBACK_MAX_KEYS

    def test_hit_count_never_negative(self):
        w = _LocalSlidingWindow()
        assert w.hit("fresh", time.time()) >= 0

    def test_rate_limit_constants_are_sane(self):
        assert MAX_REQUESTS_PER_WINDOW > 0
        assert WINDOW_SECONDS > 0
        assert _FALLBACK_MAX_KEYS > 0

    def test_15_hits_crosses_threshold(self):
        # Confirm the configured threshold triggers at MAX_REQUESTS_PER_WINDOW
        w = _LocalSlidingWindow()
        now = time.time()
        counts = [w.hit("k", now + i * 0.01) for i in range(MAX_REQUESTS_PER_WINDOW + 1)]
        # The last hit should report MAX_REQUESTS_PER_WINDOW preceding it
        assert counts[-1] == MAX_REQUESTS_PER_WINDOW
