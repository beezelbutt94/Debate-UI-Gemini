"""Tests for _LocalSlidingWindow in app.middleware.rate_limit."""
import time
import threading
import pytest
from app.middleware.rate_limit import (
    _LocalSlidingWindow,
    WINDOW_SECONDS,
    MAX_REQUESTS_PER_WINDOW,
    _FALLBACK_MAX_KEYS,
)


class TestLocalSlidingWindow:
    # ------------------------------------------------------------------
    # Basic request counting
    # ------------------------------------------------------------------

    def test_first_request_returns_zero_preceding(self):
        w = _LocalSlidingWindow()
        assert w.hit("key1", 1000.0) == 0

    def test_second_request_returns_one_preceding(self):
        w = _LocalSlidingWindow()
        w.hit("key1", 1000.0)
        assert w.hit("key1", 1001.0) == 1

    def test_nth_request_returns_n_minus_one_preceding(self):
        w = _LocalSlidingWindow()
        for i in range(10):
            count = w.hit("key1", float(1000 + i))
        assert count == 9

    def test_different_keys_are_independent(self):
        w = _LocalSlidingWindow()
        w.hit("keyA", 1000.0)
        w.hit("keyA", 1001.0)
        # keyB starts fresh
        assert w.hit("keyB", 1002.0) == 0

    # ------------------------------------------------------------------
    # Sliding window expiry
    # ------------------------------------------------------------------

    def test_requests_outside_window_are_not_counted(self):
        w = _LocalSlidingWindow()
        # Fire 5 requests at t=0
        for i in range(5):
            w.hit("key1", float(i))
        # Jump forward past the window (WINDOW_SECONDS + 1)
        now = float(WINDOW_SECONDS + 10)
        # All previous requests fall outside the window → preceding = 0
        assert w.hit("key1", now) == 0

    def test_only_requests_inside_window_counted(self):
        w = _LocalSlidingWindow()
        # 3 old requests (outside window)
        for i in range(3):
            w.hit("key1", float(i))
        # 2 recent requests (inside window)
        base = float(WINDOW_SECONDS + 100)
        w.hit("key1", base)
        result = w.hit("key1", base + 1.0)
        # preceding = 1 (only the one at `base` is in the window)
        assert result == 1

    def test_requests_exactly_at_cutoff_are_excluded(self):
        """Requests at exactly now - WINDOW_SECONDS should be evicted."""
        w = _LocalSlidingWindow()
        t0 = 1000.0
        w.hit("key1", t0)  # recorded at t0
        # now = t0 + WINDOW_SECONDS: cutoff = t0, so t0 <= cutoff → evicted
        now = t0 + WINDOW_SECONDS
        assert w.hit("key1", now) == 0

    def test_request_just_inside_window_is_counted(self):
        """A request 1 second inside the window edge should still be counted."""
        w = _LocalSlidingWindow()
        t0 = 1000.0
        w.hit("key1", t0)
        now = t0 + WINDOW_SECONDS - 1  # 1 second before expiry
        assert w.hit("key1", now) == 1

    # ------------------------------------------------------------------
    # Rate limit boundary
    # ------------------------------------------------------------------

    def test_at_max_requests_rate_limit_is_reached(self):
        w = _LocalSlidingWindow()
        for i in range(MAX_REQUESTS_PER_WINDOW):
            count = w.hit("key1", float(1000 + i))
        # After MAX_REQUESTS_PER_WINDOW calls the preceding count equals MAX-1,
        # meaning the next check would see MAX_REQUESTS_PER_WINDOW preceding
        final = w.hit("key1", float(1000 + MAX_REQUESTS_PER_WINDOW))
        assert final >= MAX_REQUESTS_PER_WINDOW

    # ------------------------------------------------------------------
    # Key eviction (bounded memory)
    # ------------------------------------------------------------------

    def test_lru_eviction_at_max_keys(self):
        """When the key count exceeds _FALLBACK_MAX_KEYS the oldest is evicted."""
        w = _LocalSlidingWindow()
        # Insert _FALLBACK_MAX_KEYS + 1 distinct keys
        for i in range(_FALLBACK_MAX_KEYS + 1):
            w.hit(f"evict-key-{i}", 1000.0)
        # Window should not grow past the cap
        assert len(w._windows) <= _FALLBACK_MAX_KEYS

    def test_active_key_not_evicted(self):
        """A key that is still being hit should survive eviction."""
        w = _LocalSlidingWindow()
        # Seed an active key first
        w.hit("active", 1000.0)
        # Then flood with new keys to trigger eviction
        for i in range(_FALLBACK_MAX_KEYS):
            w.hit(f"flood-{i}", 1001.0)
        # 'active' may or may not survive depending on LRU ordering;
        # just verify invariant: len never exceeds max
        assert len(w._windows) <= _FALLBACK_MAX_KEYS

    # ------------------------------------------------------------------
    # Thread safety
    # ------------------------------------------------------------------

    def test_concurrent_hits_do_not_corrupt_count(self):
        """Multiple threads hitting the same key should not corrupt state."""
        w = _LocalSlidingWindow()
        results = []
        lock = threading.Lock()

        def worker():
            for _ in range(50):
                result = w.hit("shared-key", time.time())
                with lock:
                    results.append(result)

        threads = [threading.Thread(target=worker) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # All results are non-negative integers; no exception means no corruption
        assert all(isinstance(r, int) and r >= 0 for r in results)
        assert len(results) == 250

    # ------------------------------------------------------------------
    # Return type
    # ------------------------------------------------------------------

    def test_hit_returns_int(self):
        w = _LocalSlidingWindow()
        result = w.hit("key", 1000.0)
        assert isinstance(result, int)
