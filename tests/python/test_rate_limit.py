"""Tests for _LocalSlidingWindow from services/api/app/middleware/rate_limit.py.

We import the class directly rather than spinning up a full ASGI app so the
tests run without Redis or a database.
"""
import sys
import os
import time
import threading

# Allow importing from the services/api package tree
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

# Patch redis before importing the module so redis.from_url doesn't fail
import unittest.mock as mock
import redis
with mock.patch('redis.from_url', return_value=mock.MagicMock()):
    # Patch os.getenv so REDIS_URL doesn't matter
    from app.middleware.rate_limit import (
        _LocalSlidingWindow,
        WINDOW_SECONDS,
        MAX_REQUESTS_PER_WINDOW,
        _FALLBACK_MAX_KEYS,
    )


class TestLocalSlidingWindow:
    def setup_method(self):
        self.window = _LocalSlidingWindow()

    # ── basic counting ────────────────────────────────────────────────────────

    def test_first_request_returns_zero_preceding(self):
        assert self.window.hit('key1', time.time()) == 0

    def test_second_request_returns_one_preceding(self):
        now = time.time()
        self.window.hit('key1', now)
        assert self.window.hit('key1', now + 0.001) == 1

    def test_count_increments_correctly(self):
        now = time.time()
        for i in range(5):
            count = self.window.hit('k', now + i * 0.01)
        # After 5 hits the last call should see 4 preceding
        assert count == 4

    def test_independent_keys_do_not_interfere(self):
        now = time.time()
        self.window.hit('key_a', now)
        self.window.hit('key_a', now + 0.001)
        # key_b is brand-new — should see 0 preceding
        assert self.window.hit('key_b', now + 0.002) == 0

    # ── expiry / sliding window ───────────────────────────────────────────────

    def test_old_requests_are_evicted_outside_window(self):
        old_time = time.time() - WINDOW_SECONDS - 1
        self.window.hit('k', old_time)
        # Hit with a new timestamp: old entry must have been evicted
        assert self.window.hit('k', time.time()) == 0

    def test_requests_exactly_at_window_boundary_are_evicted(self):
        now = time.time()
        boundary = now - WINDOW_SECONDS  # exactly on the cutoff (<=, so evicted)
        self.window.hit('k', boundary)
        assert self.window.hit('k', now) == 0

    def test_requests_just_inside_window_are_kept(self):
        now = time.time()
        just_inside = now - WINDOW_SECONDS + 0.5
        self.window.hit('k', just_inside)
        assert self.window.hit('k', now) == 1

    def test_window_slides_correctly_over_time(self):
        now = time.time()
        # 3 requests at T=0, then query at T=window+1 (all expired)
        for _ in range(3):
            self.window.hit('k', now)
        count = self.window.hit('k', now + WINDOW_SECONDS + 1)
        assert count == 0

    # ── rate limit threshold ──────────────────────────────────────────────────

    def test_exactly_at_limit_is_not_exceeded(self):
        """MAX_REQUESTS_PER_WINDOW hits before the limit triggers means
        the (limit)th call returns limit-1 preceding — still under threshold."""
        now = time.time()
        for _ in range(MAX_REQUESTS_PER_WINDOW - 1):
            self.window.hit('k', now)
        count = self.window.hit('k', now + 0.001)
        assert count == MAX_REQUESTS_PER_WINDOW - 1

    def test_one_over_limit_exceeds_threshold(self):
        now = time.time()
        for _ in range(MAX_REQUESTS_PER_WINDOW):
            self.window.hit('k', now)
        count = self.window.hit('k', now + 0.001)
        assert count >= MAX_REQUESTS_PER_WINDOW

    # ── eviction cap ─────────────────────────────────────────────────────────

    def test_does_not_grow_beyond_max_keys(self):
        now = time.time()
        for i in range(_FALLBACK_MAX_KEYS + 200):
            self.window.hit(f'key_{i}', now)
        assert len(self.window._windows) <= _FALLBACK_MAX_KEYS

    def test_new_active_key_accepted_after_eviction(self):
        """After the cap is hit, new keys must still be tracked (LRU evicts
        idle ones to make room)."""
        now = time.time()
        for i in range(_FALLBACK_MAX_KEYS):
            self.window.hit(f'key_{i}', now)
        # One more key — must not raise
        result = self.window.hit('brand_new_key', now + 1)
        assert result == 0

    # ── thread safety ─────────────────────────────────────────────────────────

    def test_concurrent_hits_do_not_corrupt_count(self):
        results = []
        now = time.time()
        def hit():
            results.append(self.window.hit('shared', now))
        threads = [threading.Thread(target=hit) for _ in range(50)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        # All 50 calls must have recorded; max preceding count must be 49
        assert len(results) == 50
        assert max(results) <= 49

    def test_concurrent_different_keys_do_not_raise(self):
        errors = []
        now = time.time()
        def hit(i):
            try:
                self.window.hit(f'k{i}', now)
            except Exception as e:
                errors.append(e)
        threads = [threading.Thread(target=hit, args=(i,)) for i in range(100)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert errors == []

    # ── edge cases ────────────────────────────────────────────────────────────

    def test_same_timestamp_multiple_hits(self):
        now = time.time()
        self.window.hit('k', now)
        # Exact same timestamp — entry uses append so both stay
        count = self.window.hit('k', now)
        assert count == 1

    def test_returns_int(self):
        assert isinstance(self.window.hit('k', time.time()), int)

    def test_works_with_float_timestamp(self):
        # Should not raise with a float timestamp
        result = self.window.hit('k', 1_700_000_000.123456)
        assert result == 0
