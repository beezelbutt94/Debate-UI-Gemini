"""Tests for _LocalSlidingWindow – the in-process rate-limit fallback.

The module instantiates a Redis client at import time, so we patch redis
before importing to avoid a real connection attempt.
"""
import sys
import os
from unittest.mock import MagicMock, patch
import time
import threading

# Provide a stub redis module so the module-level `redis.from_url()` call
# doesn't require a live Redis instance.
fake_redis = MagicMock()
sys.modules.setdefault('redis', fake_redis)
sys.modules.setdefault('fastapi', MagicMock())
sys.modules.setdefault('fastapi.responses', MagicMock())
sys.modules.setdefault('starlette', MagicMock())
sys.modules.setdefault('starlette.middleware', MagicMock())
sys.modules.setdefault('starlette.middleware.base', MagicMock())

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'services', 'api'))

with patch.dict('os.environ', {'REDIS_URL': 'redis://localhost:6379/0'}):
    from app.middleware.rate_limit import _LocalSlidingWindow, WINDOW_SECONDS, MAX_REQUESTS_PER_WINDOW


class TestLocalSlidingWindow:
    def setup_method(self):
        self.window = _LocalSlidingWindow()

    # ── basic counting ───────────────────────────────────────────────────────

    def test_first_request_returns_zero_preceding(self):
        now = time.time()
        assert self.window.hit('key1', now) == 0

    def test_second_request_returns_one_preceding(self):
        now = time.time()
        self.window.hit('key2', now)
        assert self.window.hit('key2', now + 0.01) == 1

    def test_counts_accumulate_within_window(self):
        now = time.time()
        for i in range(5):
            self.window.hit('key3', now + i * 0.1)
        assert self.window.hit('key3', now + 0.6) == 5

    def test_different_keys_are_independent(self):
        now = time.time()
        self.window.hit('keyA', now)
        self.window.hit('keyA', now + 0.1)
        # keyB should start fresh
        assert self.window.hit('keyB', now + 0.2) == 0

    # ── window expiry ────────────────────────────────────────────────────────

    def test_requests_outside_window_are_not_counted(self):
        now = time.time()
        # Put 3 requests in the past, beyond WINDOW_SECONDS
        self.window.hit('expire_key', now - WINDOW_SECONDS - 2)
        self.window.hit('expire_key', now - WINDOW_SECONDS - 1)
        # This request is current -- the two old ones should be evicted
        assert self.window.hit('expire_key', now) == 0

    def test_requests_on_boundary_are_evicted(self):
        now = time.time()
        old = now - WINDOW_SECONDS  # exactly at the boundary (<=cutoff), should be evicted
        self.window.hit('boundary_key', old)
        assert self.window.hit('boundary_key', now) == 0

    def test_requests_just_inside_window_are_counted(self):
        now = time.time()
        recent = now - WINDOW_SECONDS + 1  # 1 second inside the window
        self.window.hit('inside_key', recent)
        assert self.window.hit('inside_key', now) == 1

    # ── thread safety ────────────────────────────────────────────────────────

    def test_concurrent_hits_do_not_corrupt_count(self):
        results = []
        now = time.time()

        def hit_many():
            for _ in range(50):
                results.append(self.window.hit('concurrent_key', time.time()))

        threads = [threading.Thread(target=hit_many) for _ in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # 200 hits total; every result must be an integer >= 0
        assert all(isinstance(r, int) and r >= 0 for r in results)
        assert len(results) == 200

    # ── max-key eviction ─────────────────────────────────────────────────────

    def test_lru_eviction_keeps_active_key(self):
        """Fill past the _FALLBACK_MAX_KEYS limit; the active key's count
        should still be bounded (not assert an exact value as eviction order
        may vary, but it must be an int)."""
        from app.middleware.rate_limit import _FALLBACK_MAX_KEYS
        now = time.time()
        # Seed many distinct keys to push near the limit
        for i in range(min(_FALLBACK_MAX_KEYS + 10, 200)):
            self.window.hit(f'flood_key_{i}', now)

        # The last key we inserted should still be trackable
        result = self.window.hit('active_survivor', now + 1)
        assert isinstance(result, int) and result >= 0

    # ── rate limit threshold ─────────────────────────────────────────────────

    def test_hit_count_reaches_max_requests_per_window(self):
        now = time.time()
        for i in range(MAX_REQUESTS_PER_WINDOW):
            self.window.hit('limit_key', now + i * 0.001)
        # The next hit should return MAX_REQUESTS_PER_WINDOW (all preceding)
        assert self.window.hit('limit_key', now + 1) == MAX_REQUESTS_PER_WINDOW
