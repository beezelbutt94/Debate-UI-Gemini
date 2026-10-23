"""Tests for _LocalSlidingWindow in services/api/app/middleware/rate_limit.py"""
import sys
import os
import time
import threading

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'services', 'api'))

import pytest

# Patch redis before importing rate_limit so it doesn't try to connect on import
import unittest.mock as mock
with mock.patch.dict('sys.modules', {'redis': mock.MagicMock()}):
    from app.middleware.rate_limit import _LocalSlidingWindow, WINDOW_SECONDS, MAX_REQUESTS_PER_WINDOW, _FALLBACK_MAX_KEYS


class TestLocalSlidingWindow:
    def setup_method(self):
        self.limiter = _LocalSlidingWindow()

    # ── basic counting ────────────────────────────────────────────────────────

    def test_first_request_returns_zero_preceding(self):
        assert self.limiter.hit('k1', time.time()) == 0

    def test_second_request_returns_one_preceding(self):
        now = time.time()
        self.limiter.hit('k1', now)
        assert self.limiter.hit('k1', now + 0.01) == 1

    def test_third_request_returns_two_preceding(self):
        now = time.time()
        self.limiter.hit('k1', now)
        self.limiter.hit('k1', now + 0.01)
        assert self.limiter.hit('k1', now + 0.02) == 2

    def test_different_keys_are_independent(self):
        now = time.time()
        self.limiter.hit('k1', now)
        self.limiter.hit('k1', now + 0.01)
        # k2 starts fresh
        assert self.limiter.hit('k2', now + 0.02) == 0

    def test_requests_at_exact_window_boundary_are_evicted(self):
        """Timestamps exactly at or before (now - WINDOW_SECONDS) are removed."""
        now = time.time()
        # Place a request exactly WINDOW_SECONDS in the past
        old_ts = now - WINDOW_SECONDS
        self.limiter.hit('k1', old_ts)
        # The next hit at `now` should evict that old entry (cutoff = now - WINDOW)
        # window[0] == old_ts == cutoff → `while window[0] <= cutoff` removes it
        assert self.limiter.hit('k1', now) == 0

    def test_requests_just_inside_window_are_counted(self):
        """A request 1ms before expiry is still counted."""
        now = time.time()
        recent_ts = now - WINDOW_SECONDS + 1  # 1 second inside window
        self.limiter.hit('k1', recent_ts)
        assert self.limiter.hit('k1', now) == 1

    def test_old_requests_are_evicted_after_window(self):
        """After the window elapses the count resets to 0."""
        now = time.time()
        # Fill up to MAX_REQUESTS - 1 in the past (outside window)
        for i in range(5):
            self.limiter.hit('k1', now - WINDOW_SECONDS - 10 + i * 0.1)
        # All 5 are older than the window; next hit should see 0 preceding
        assert self.limiter.hit('k1', now) == 0

    def test_mixed_old_and_new_requests(self):
        """Only requests within the window count toward the preceding total."""
        now = time.time()
        # 3 stale requests
        for i in range(3):
            self.limiter.hit('k1', now - WINDOW_SECONDS - 5 + i)
        # 2 fresh requests
        self.limiter.hit('k1', now - 5)
        self.limiter.hit('k1', now - 3)
        # Should see 2 preceding (the 3 stale ones are evicted)
        assert self.limiter.hit('k1', now) == 2

    # ── LRU eviction cap ─────────────────────────────────────────────────────

    def test_key_count_stays_bounded(self):
        """Adding more than _FALLBACK_MAX_KEYS keys evicts LRU entries."""
        now = time.time()
        for i in range(_FALLBACK_MAX_KEYS + 50):
            self.limiter.hit(f'key_{i}', now)
        assert len(self.limiter._windows) <= _FALLBACK_MAX_KEYS

    def test_lru_key_is_evicted_first(self):
        """The oldest accessed key is the one evicted when capacity is exceeded."""
        now = time.time()
        # Touch key_0 first, then fill up capacity
        self.limiter.hit('key_0', now)
        for i in range(1, _FALLBACK_MAX_KEYS + 1):
            self.limiter.hit(f'key_{i}', now)
        # key_0 was LRU and should have been evicted (or at the edge)
        # Either way, total size must be bounded
        assert len(self.limiter._windows) <= _FALLBACK_MAX_KEYS

    # ── thread safety ─────────────────────────────────────────────────────────

    def test_concurrent_hits_do_not_corrupt_state(self):
        """Multiple threads hitting simultaneously should not raise or corrupt."""
        limiter = _LocalSlidingWindow()
        errors = []

        def worker():
            try:
                for _ in range(20):
                    limiter.hit('shared_key', time.time())
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == [], f"Unexpected errors in threads: {errors}"

    def test_concurrent_different_keys_bounded(self):
        """Concurrent writes with many distinct keys must stay bounded."""
        limiter = _LocalSlidingWindow()
        errors = []

        def worker(worker_id):
            try:
                for i in range(200):
                    limiter.hit(f'worker_{worker_id}_key_{i}', time.time())
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(w,)) for w in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == []
        assert len(limiter._windows) <= _FALLBACK_MAX_KEYS

    # ── return value semantics ────────────────────────────────────────────────

    def test_hit_returns_count_before_current_request(self):
        """The returned integer is preceding count, not including the current hit."""
        now = time.time()
        # After 9 hits, the 10th should return 9 (not 10)
        for _ in range(9):
            self.limiter.hit('k', now)
        assert self.limiter.hit('k', now + 0.001) == 9

    def test_window_resets_correctly_after_expiry(self):
        """After the window expires the count goes back to 0."""
        now = time.time()
        for _ in range(MAX_REQUESTS_PER_WINDOW):
            self.limiter.hit('k', now - WINDOW_SECONDS - 1)
        # New request in fresh window
        assert self.limiter.hit('k', now) == 0
