"""Tests for _LocalSlidingWindow in app.middleware.rate_limit.

We import the class directly; the module-level redis_client is created at
import time (redis.from_url) but any Redis calls only happen inside
SlidingWindowRateLimiterMiddleware.dispatch, which we don't call here.
We exercise _LocalSlidingWindow.hit() in isolation.
"""
import time
import threading
import pytest

# redis module may not be installed in test environment; guard import
try:
    from app.middleware.rate_limit import (
        _LocalSlidingWindow,
        WINDOW_SECONDS,
        MAX_REQUESTS_PER_WINDOW,
        _FALLBACK_MAX_KEYS,
    )
    REDIS_AVAILABLE = True
except Exception:
    REDIS_AVAILABLE = False

pytestmark = pytest.mark.skipif(
    not REDIS_AVAILABLE,
    reason="redis package not installed or rate_limit module failed to import"
)


class TestLocalSlidingWindow:
    def setup_method(self):
        self.lw = _LocalSlidingWindow()

    # ── basic counting ───────────────────────────────────────────────────────

    def test_first_hit_returns_zero_preceding(self):
        assert self.lw.hit("key", time.time()) == 0

    def test_second_hit_returns_one_preceding(self):
        now = time.time()
        self.lw.hit("key", now)
        assert self.lw.hit("key", now + 0.001) == 1

    def test_counts_accumulate_within_window(self):
        base = time.time()
        for i in range(10):
            preceding = self.lw.hit("key", base + i * 0.1)
            assert preceding == i

    def test_independent_keys_do_not_interfere(self):
        now = time.time()
        self.lw.hit("key_a", now)
        self.lw.hit("key_a", now + 0.001)
        # key_b is fresh
        assert self.lw.hit("key_b", now + 0.002) == 0

    # ── window expiry ─────────────────────────────────────────────────────────

    def test_old_requests_expire_after_window(self):
        old = 1.0  # a timestamp far in the past
        self.lw.hit("key", old)
        self.lw.hit("key", old + 1)
        # now = old + WINDOW_SECONDS + 1 → both old entries should expire
        now = old + WINDOW_SECONDS + 1
        assert self.lw.hit("key", now) == 0

    def test_requests_at_window_boundary_expire(self):
        # cutoff = now - WINDOW_SECONDS; entries <= cutoff are removed.
        base = 1000.0
        self.lw.hit("k", base)  # exactly at boundary = should be evicted
        now = base + WINDOW_SECONDS
        # At now, cutoff = now - WINDOW_SECONDS = base.
        # while window[0] <= cutoff: pop → base <= base → popped.
        result = self.lw.hit("k", now)
        assert result == 0

    def test_request_just_inside_window_is_counted(self):
        base = 1000.0
        self.lw.hit("k", base + 0.001)  # just after window start
        now = base + WINDOW_SECONDS
        # cutoff = now - WINDOW_SECONDS = base; base + 0.001 > base → NOT evicted
        result = self.lw.hit("k", now)
        assert result == 1

    def test_sliding_window_only_counts_recent_hits(self):
        base = 1000.0
        # 5 old hits outside window
        for i in range(5):
            self.lw.hit("k", base + i)
        # 3 recent hits inside window
        recent_base = base + WINDOW_SECONDS + 10
        for i in range(3):
            self.lw.hit("k", recent_base + i * 0.1)
        # 4th recent hit — should see 3 preceding (the 5 old ones expired)
        assert self.lw.hit("k", recent_base + 1.0) == 3

    # ── rate-limit enforcement simulation ────────────────────────────────────

    def test_detects_when_limit_would_be_hit(self):
        now = time.time()
        for i in range(MAX_REQUESTS_PER_WINDOW):
            self.lw.hit("throttled", now + i * 0.001)
        # The next hit returns preceding == MAX_REQUESTS_PER_WINDOW (limit reached)
        result = self.lw.hit("throttled", now + 1.0)
        assert result >= MAX_REQUESTS_PER_WINDOW

    # ── LRU eviction ─────────────────────────────────────────────────────────

    def test_evicts_lru_keys_when_cap_exceeded(self):
        now = time.time()
        # Fill to the cap
        for i in range(_FALLBACK_MAX_KEYS):
            self.lw.hit(f"key_{i}", now)
        assert len(self.lw._windows) == _FALLBACK_MAX_KEYS
        # One more key should evict the oldest
        self.lw.hit("newest_key", now + 0.001)
        assert len(self.lw._windows) == _FALLBACK_MAX_KEYS
        assert "newest_key" in self.lw._windows

    # ── thread safety ─────────────────────────────────────────────────────────

    def test_concurrent_hits_do_not_corrupt_state(self):
        results = []
        errors = []

        def hit_many(key, count, offset):
            try:
                base = time.time()
                for i in range(count):
                    results.append(self.lw.hit(key, base + offset + i * 0.001))
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=hit_many, args=(f"k{t}", 50, t * 100)) for t in range(4)]
        for th in threads:
            th.start()
        for th in threads:
            th.join()

        assert not errors, f"Thread errors: {errors}"
        # Each thread uses a unique key, so counts should be in [0, 49]
        assert all(0 <= r <= 49 for r in results)

    # ── return type ───────────────────────────────────────────────────────────

    def test_hit_returns_int(self):
        result = self.lw.hit("key", time.time())
        assert isinstance(result, int)
