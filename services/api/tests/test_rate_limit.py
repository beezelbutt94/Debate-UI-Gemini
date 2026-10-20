"""Tests for the in-process sliding window fallback rate limiter."""
import time
import threading
import pytest

from app.middleware.rate_limit import (
    _LocalSlidingWindow,
    WINDOW_SECONDS,
    MAX_REQUESTS_PER_WINDOW,
    _FALLBACK_MAX_KEYS,
    RATE_LIMITED_PREFIXES,
)


class TestLocalSlidingWindow:
    def setup_method(self):
        self.window = _LocalSlidingWindow()

    def _now(self):
        return time.time()

    def test_first_hit_returns_zero_preceding(self):
        assert self.window.hit('key1', self._now()) == 0

    def test_second_hit_returns_one_preceding(self):
        now = self._now()
        self.window.hit('key1', now)
        assert self.window.hit('key1', now + 0.1) == 1

    def test_preceding_count_increments_within_window(self):
        now = self._now()
        for i in range(5):
            self.window.hit('key1', now + i * 0.1)
        # 6th hit should see 5 preceding
        assert self.window.hit('key1', now + 5 * 0.1) == 5

    def test_requests_outside_window_are_expired(self):
        now = self._now()
        # Place 10 hits far in the past (beyond the window)
        for i in range(10):
            self.window.hit('key1', now - WINDOW_SECONDS - 10 + i * 0.1)
        # A fresh hit at `now` should see 0 preceding (all expired)
        assert self.window.hit('key1', now) == 0

    def test_requests_exactly_at_cutoff_are_expired(self):
        now = self._now()
        # Hit at exactly (now - WINDOW_SECONDS) -- should be expired
        self.window.hit('key1', now - WINDOW_SECONDS)
        assert self.window.hit('key1', now) == 0

    def test_independent_keys_do_not_interfere(self):
        now = self._now()
        self.window.hit('key_a', now)
        self.window.hit('key_a', now + 0.1)
        # key_b starts fresh
        assert self.window.hit('key_b', now + 0.2) == 0

    def test_sliding_not_fixed_window(self):
        now = self._now()
        # 3 hits just inside the window
        self.window.hit('key1', now - WINDOW_SECONDS + 5)
        self.window.hit('key1', now - WINDOW_SECONDS + 10)
        self.window.hit('key1', now - WINDOW_SECONDS + 15)
        # 1 fresh hit should see those 3 as preceding
        assert self.window.hit('key1', now) == 3

    def test_lru_eviction_caps_total_keys(self):
        now = self._now()
        for i in range(_FALLBACK_MAX_KEYS + 50):
            self.window.hit(f'key_{i}', now)
        assert len(self.window._windows) <= _FALLBACK_MAX_KEYS

    def test_thread_safety_no_exception(self):
        errors = []
        now = self._now()

        def worker(key_suffix: int):
            try:
                for _ in range(50):
                    self.window.hit(f'key_{key_suffix}', time.time())
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == [], f'Thread-safety errors: {errors}'

    def test_hit_at_boundary_exactly_max_minus_one(self):
        now = self._now()
        for i in range(MAX_REQUESTS_PER_WINDOW - 1):
            self.window.hit('key1', now + i * 0.01)
        preceding = self.window.hit('key1', now + MAX_REQUESTS_PER_WINDOW * 0.01)
        assert preceding == MAX_REQUESTS_PER_WINDOW - 1

    def test_hit_exceeds_max(self):
        now = self._now()
        for i in range(MAX_REQUESTS_PER_WINDOW):
            self.window.hit('key1', now + i * 0.01)
        preceding = self.window.hit('key1', now + MAX_REQUESTS_PER_WINDOW * 0.01)
        assert preceding >= MAX_REQUESTS_PER_WINDOW


class TestRateLimitConstants:
    def test_window_is_60_seconds(self):
        assert WINDOW_SECONDS == 60

    def test_max_requests_is_15(self):
        assert MAX_REQUESTS_PER_WINDOW == 15

    def test_rate_limited_prefixes_include_generate(self):
        assert any('generate' in p for p in RATE_LIMITED_PREFIXES)

    def test_rate_limited_prefixes_include_competitor_scan(self):
        assert any('competitor' in p for p in RATE_LIMITED_PREFIXES)
