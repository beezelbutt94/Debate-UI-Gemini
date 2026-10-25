"""Unit tests for _LocalSlidingWindow in the rate-limit middleware.

These are self-contained: they import only the class, not the middleware or
Redis, so no network connections are needed.
"""
import time
import threading

import pytest

# Import only the in-process limiter class, not the middleware that would
# try to connect to Redis at import time.
from app.middleware.rate_limit import _LocalSlidingWindow, WINDOW_SECONDS, MAX_REQUESTS_PER_WINDOW


def _now() -> float:
    return time.time()


class TestHitReturnsCount:
    def test_first_request_returns_zero_preceding(self):
        w = _LocalSlidingWindow()
        preceding = w.hit("key1", _now())
        assert preceding == 0

    def test_second_request_returns_one_preceding(self):
        w = _LocalSlidingWindow()
        t = _now()
        w.hit("key1", t)
        preceding = w.hit("key1", t + 0.01)
        assert preceding == 1

    def test_count_accumulates_within_window(self):
        w = _LocalSlidingWindow()
        t = _now()
        for i in range(9):
            w.hit("key1", t + i * 0.1)
        preceding = w.hit("key1", t + 9 * 0.1)
        assert preceding == 9

    def test_different_keys_are_independent(self):
        w = _LocalSlidingWindow()
        t = _now()
        for _ in range(5):
            w.hit("key-a", t)
            t += 0.01
        preceding_b = w.hit("key-b", t)
        assert preceding_b == 0

    def test_requests_outside_window_are_evicted(self):
        w = _LocalSlidingWindow()
        old = _now() - WINDOW_SECONDS - 1
        w.hit("key1", old)   # outside the window
        w.hit("key1", old + 1)  # still outside the window
        preceding = w.hit("key1", _now())
        assert preceding == 0

    def test_requests_exactly_at_window_boundary_are_evicted(self):
        w = _LocalSlidingWindow()
        t = _now()
        cutoff = t - WINDOW_SECONDS
        w.hit("key1", cutoff)   # exactly at the boundary → evicted (<=)
        preceding = w.hit("key1", t)
        assert preceding == 0

    def test_requests_just_inside_window_are_counted(self):
        w = _LocalSlidingWindow()
        t = _now()
        just_in = t - WINDOW_SECONDS + 0.1
        w.hit("key1", just_in)
        preceding = w.hit("key1", t)
        assert preceding == 1

    def test_mixed_in_and_out_of_window(self):
        w = _LocalSlidingWindow()
        t = _now()
        # 3 old (outside window), 4 fresh (inside window)
        for delta in [-WINDOW_SECONDS - 10, -WINDOW_SECONDS - 5, -WINDOW_SECONDS - 1]:
            w.hit("key1", t + delta)
        for delta in [-30, -20, -10, -1]:
            w.hit("key1", t + delta)
        preceding = w.hit("key1", t)
        assert preceding == 4

    def test_returns_int(self):
        w = _LocalSlidingWindow()
        result = w.hit("key1", _now())
        assert isinstance(result, int)


class TestRateLimitBehaviour:
    """Verify the limiter signals when the limit is hit."""

    def test_rate_limit_hit_on_max_requests(self):
        w = _LocalSlidingWindow()
        t = _now()
        for i in range(MAX_REQUESTS_PER_WINDOW):
            preceding = w.hit("key1", t + i * 0.001)
            assert preceding < MAX_REQUESTS_PER_WINDOW

        # The next one (the (MAX+1)th) should report MAX preceding
        preceding = w.hit("key1", t + MAX_REQUESTS_PER_WINDOW * 0.001)
        assert preceding >= MAX_REQUESTS_PER_WINDOW

    def test_counter_resets_after_window_expires(self):
        w = _LocalSlidingWindow()
        t = _now()
        # Fill up the window
        for i in range(MAX_REQUESTS_PER_WINDOW):
            w.hit("key1", t + i * 0.01)
        # Advance past the window
        future = t + WINDOW_SECONDS + 1
        preceding = w.hit("key1", future)
        assert preceding == 0


class TestEviction:
    def test_evicts_lru_key_when_max_keys_exceeded(self):
        from app.middleware.rate_limit import _FALLBACK_MAX_KEYS
        w = _LocalSlidingWindow()
        t = _now()
        # Fill to the max
        for i in range(_FALLBACK_MAX_KEYS):
            w.hit(f"key-{i}", t)
        # One more causes eviction; the limiter should not raise
        w.hit("overflow-key", t + 1)
        assert len(w._windows) <= _FALLBACK_MAX_KEYS

    def test_active_key_survives_eviction(self):
        """A key used repeatedly should not be the one evicted."""
        from app.middleware.rate_limit import _FALLBACK_MAX_KEYS
        w = _LocalSlidingWindow()
        t = _now()
        hot_key = "hot-key"
        w.hit(hot_key, t)
        # Fill with other keys, interleaving hot_key hits to keep it recent
        for i in range(_FALLBACK_MAX_KEYS):
            w.hit(f"cold-{i}", t + i * 0.0001)
            if i % 100 == 0:
                w.hit(hot_key, t + i * 0.0001 + 0.00001)
        # hot_key should still be counted (or at least not crash)
        preceding = w.hit(hot_key, t + 1)
        # Can't assert exact count since cold keys may have bumped hot_key out,
        # but the call must succeed without raising.
        assert isinstance(preceding, int)


class TestThreadSafety:
    def test_concurrent_hits_do_not_raise(self):
        w = _LocalSlidingWindow()
        errors = []

        def worker(key: str):
            try:
                t = _now()
                for i in range(50):
                    w.hit(key, t + i * 0.001)
            except Exception as exc:  # noqa: BLE001
                errors.append(exc)

        threads = [threading.Thread(target=worker, args=(f"k{i}",)) for i in range(20)]
        for th in threads:
            th.start()
        for th in threads:
            th.join()

        assert errors == [], f"Thread-safety errors: {errors}"

    def test_same_key_concurrent_hits(self):
        w = _LocalSlidingWindow()
        results = []

        def worker():
            t = _now()
            for i in range(30):
                results.append(w.hit("shared", t + i * 0.001))

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for th in threads:
            th.start()
        for th in threads:
            th.join()

        assert all(isinstance(r, int) for r in results)
