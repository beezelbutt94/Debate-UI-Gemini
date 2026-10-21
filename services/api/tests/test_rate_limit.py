"""Tests for _LocalSlidingWindow in app.middleware.rate_limit."""
import sys
import os
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Import the private class directly for unit testing
from app.middleware.rate_limit import (
    _LocalSlidingWindow,
    WINDOW_SECONDS,
    MAX_REQUESTS_PER_WINDOW,
    _FALLBACK_MAX_KEYS,
)


class TestLocalSlidingWindow:
    """_LocalSlidingWindow tracks per-key request counts within a sliding window."""

    def _window(self):
        return _LocalSlidingWindow()

    def test_first_hit_returns_zero_preceding(self):
        w = self._window()
        count = w.hit("key1", time.time())
        assert count == 0

    def test_second_hit_returns_one_preceding(self):
        w = self._window()
        now = time.time()
        w.hit("key1", now)
        count = w.hit("key1", now + 0.1)
        assert count == 1

    def test_third_hit_returns_two_preceding(self):
        w = self._window()
        now = time.time()
        for i in range(2):
            w.hit("key1", now + i * 0.1)
        count = w.hit("key1", now + 0.5)
        assert count == 2

    def test_old_requests_outside_window_are_not_counted(self):
        w = self._window()
        old_time = time.time() - WINDOW_SECONDS - 1  # definitely outside window
        w.hit("key1", old_time)
        # This hit is inside the window
        count = w.hit("key1", time.time())
        assert count == 0

    def test_requests_at_window_boundary_are_excluded(self):
        w = self._window()
        now = time.time()
        # Request exactly at the boundary should be excluded (cutoff = now - WINDOW_SECONDS)
        w.hit("key1", now - WINDOW_SECONDS)
        count = w.hit("key1", now)
        assert count == 0

    def test_requests_just_inside_window_are_counted(self):
        w = self._window()
        now = time.time()
        w.hit("key1", now - WINDOW_SECONDS + 1)  # 1 second inside window
        count = w.hit("key1", now)
        assert count == 1

    def test_different_keys_are_tracked_independently(self):
        w = self._window()
        now = time.time()
        w.hit("key1", now)
        w.hit("key1", now + 0.1)
        # key2 gets its own fresh window
        count_key2 = w.hit("key2", now + 0.2)
        assert count_key2 == 0

    def test_max_requests_per_window_limit(self):
        w = self._window()
        now = time.time()
        for i in range(MAX_REQUESTS_PER_WINDOW):
            w.hit("key1", now + i * 0.001)
        # The next hit should report MAX_REQUESTS_PER_WINDOW preceding
        count = w.hit("key1", now + 1)
        assert count == MAX_REQUESTS_PER_WINDOW

    def test_evicts_lru_keys_when_at_max_capacity(self):
        w = self._window()
        now = time.time()
        # Fill up to max keys
        for i in range(_FALLBACK_MAX_KEYS):
            w.hit(f"key_{i}", now)
        # Adding a new key should evict the oldest, not crash
        count = w.hit("new_key", now + 1)
        assert count == 0
        # Internal dict should not exceed max
        assert len(w._windows) <= _FALLBACK_MAX_KEYS

    def test_thread_safety_no_exception_under_concurrent_access(self):
        """Concurrent hits on the same window must not raise."""
        import threading
        w = self._window()
        errors = []

        def hit_many():
            try:
                for _ in range(100):
                    w.hit("shared_key", time.time())
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=hit_many) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert errors == []

    def test_window_resets_after_full_window_elapses(self):
        """After WINDOW_SECONDS have elapsed, old counts drop out."""
        w = self._window()
        old = time.time() - WINDOW_SECONDS - 5
        # Simulate 10 old requests
        for i in range(10):
            w.hit("key1", old + i * 0.1)
        # Fresh request: no old hits should remain
        count = w.hit("key1", time.time())
        assert count == 0

    def test_hit_returns_int(self):
        w = self._window()
        result = w.hit("key1", time.time())
        assert isinstance(result, int)

    def test_multiple_keys_accumulate_independently(self):
        w = self._window()
        now = time.time()
        for i in range(5):
            w.hit("a", now + i * 0.01)
        for i in range(3):
            w.hit("b", now + i * 0.01)
        assert w.hit("a", now + 1) == 5
        assert w.hit("b", now + 1) == 3
