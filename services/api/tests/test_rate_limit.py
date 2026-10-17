"""Tests for _LocalSlidingWindow — the in-process rate-limit fallback."""
import sys
import os
import time
import threading
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import only the class under test, avoid the module-level Redis connection
from app.middleware.rate_limit import _LocalSlidingWindow, WINDOW_SECONDS, MAX_REQUESTS_PER_WINDOW, _FALLBACK_MAX_KEYS


class TestLocalSlidingWindow(unittest.TestCase):

    def setUp(self):
        self.window = _LocalSlidingWindow()

    def test_first_request_has_zero_preceding(self):
        preceding = self.window.hit("key1", time.time())
        self.assertEqual(preceding, 0)

    def test_second_request_has_one_preceding(self):
        now = time.time()
        self.window.hit("key1", now)
        preceding = self.window.hit("key1", now + 1)
        self.assertEqual(preceding, 1)

    def test_requests_accumulate_within_window(self):
        now = time.time()
        for i in range(10):
            self.window.hit("key1", now + i)
        preceding = self.window.hit("key1", now + 10)
        self.assertEqual(preceding, 10)

    def test_old_requests_expire_after_window(self):
        # First batch: put 5 hits at t=0 (all will be outside the window later)
        old_now = 0.0
        for _ in range(5):
            self.window.hit("expiry_key", old_now)

        # Now move forward by WINDOW_SECONDS + 1: all old hits should be gone
        new_now = old_now + WINDOW_SECONDS + 1
        preceding = self.window.hit("expiry_key", new_now)
        self.assertEqual(preceding, 0)

    def test_requests_at_window_boundary_are_evicted(self):
        """Requests at exactly cutoff = now - WINDOW_SECONDS should be evicted."""
        now = 1000.0
        cutoff = now - WINDOW_SECONDS
        # Hit exactly at the cutoff timestamp
        self.window.hit("boundary_key", cutoff)
        # New request at `now`: the boundary hit should be evicted (cutoff <= cutoff)
        preceding = self.window.hit("boundary_key", now)
        self.assertEqual(preceding, 0)

    def test_requests_just_inside_window_are_kept(self):
        now = 1000.0
        # One second past the cutoff = still inside the window
        self.window.hit("inside_key", now - WINDOW_SECONDS + 1)
        preceding = self.window.hit("inside_key", now)
        self.assertEqual(preceding, 1)

    def test_different_keys_are_independent(self):
        now = time.time()
        self.window.hit("a", now)
        self.window.hit("a", now + 1)
        preceding_b = self.window.hit("b", now + 2)
        self.assertEqual(preceding_b, 0)

    def test_lru_eviction_when_keys_exceed_limit(self):
        """When the map exceeds _FALLBACK_MAX_KEYS, the oldest key is evicted."""
        now = time.time()
        # Fill up to the limit + 1
        for i in range(_FALLBACK_MAX_KEYS + 1):
            self.window.hit(f"key_{i}", now + i * 0.001)
        # The map should be capped at _FALLBACK_MAX_KEYS
        self.assertLessEqual(len(self.window._windows), _FALLBACK_MAX_KEYS)

    def test_thread_safety_no_data_races(self):
        """Multiple threads hammering the same key must not raise."""
        errors = []
        now = time.time()

        def hammer():
            try:
                for _ in range(50):
                    self.window.hit("shared_key", time.time())
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=hammer) for _ in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(errors, [])

    def test_max_requests_per_window_constant_is_positive(self):
        self.assertGreater(MAX_REQUESTS_PER_WINDOW, 0)

    def test_window_seconds_constant_is_positive(self):
        self.assertGreater(WINDOW_SECONDS, 0)

    def test_new_key_after_eviction_starts_fresh(self):
        """After an eviction, re-using an evicted key starts at 0 preceding."""
        now = time.time()
        # Fill beyond limit (evicts "key_0")
        for i in range(_FALLBACK_MAX_KEYS + 1):
            self.window.hit(f"key_{i}", now)
        # Re-introduce the likely-evicted key
        preceding = self.window.hit("key_0", now + WINDOW_SECONDS + 1)
        self.assertEqual(preceding, 0)

    def test_same_timestamp_requests_accumulate(self):
        """Two requests at the exact same timestamp both count."""
        now = 500.0
        self.window.hit("same_ts", now)
        preceding = self.window.hit("same_ts", now)
        self.assertEqual(preceding, 1)


if __name__ == '__main__':
    unittest.main()
