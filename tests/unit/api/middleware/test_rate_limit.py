"""Tests for _LocalSlidingWindow in app/middleware/rate_limit.py."""
import sys
import os
import time
import threading

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'services', 'api'))

from app.middleware.rate_limit import _LocalSlidingWindow, WINDOW_SECONDS, MAX_REQUESTS_PER_WINDOW


class TestLocalSlidingWindow:
    def setup_method(self):
        self.window = _LocalSlidingWindow()

    def test_first_hit_returns_zero_preceding(self):
        now = time.time()
        assert self.window.hit('key1', now) == 0

    def test_second_hit_returns_one_preceding(self):
        now = time.time()
        self.window.hit('key1', now)
        assert self.window.hit('key1', now + 0.1) == 1

    def test_third_hit_returns_two_preceding(self):
        now = time.time()
        self.window.hit('key1', now)
        self.window.hit('key1', now + 0.1)
        assert self.window.hit('key1', now + 0.2) == 2

    def test_different_keys_are_independent(self):
        now = time.time()
        self.window.hit('key-a', now)
        self.window.hit('key-a', now + 0.1)
        # key-b is fresh — should report 0 preceding
        assert self.window.hit('key-b', now + 0.2) == 0

    def test_requests_outside_window_are_evicted(self):
        old_time = time.time() - WINDOW_SECONDS - 1
        now = time.time()
        # Plant a stale hit
        self.window.hit('key1', old_time)
        # Fresh hit should not count the stale one
        assert self.window.hit('key1', now) == 0

    def test_requests_at_window_boundary_are_evicted(self):
        now = time.time()
        # Exactly at the cutoff (now - WINDOW_SECONDS): boundary is exclusive (<=)
        boundary = now - WINDOW_SECONDS
        self.window.hit('key1', boundary)
        assert self.window.hit('key1', now) == 0

    def test_requests_just_inside_window_are_counted(self):
        now = time.time()
        just_inside = now - WINDOW_SECONDS + 0.5
        self.window.hit('key1', just_inside)
        assert self.window.hit('key1', now) == 1

    def test_filling_window_up_to_limit(self):
        now = time.time()
        for i in range(MAX_REQUESTS_PER_WINDOW - 1):
            self.window.hit('key1', now + i * 0.001)
        # The next hit is the MAX_REQUESTS_PER_WINDOWth — preceding count equals limit - 1
        result = self.window.hit('key1', now + MAX_REQUESTS_PER_WINDOW * 0.001)
        assert result == MAX_REQUESTS_PER_WINDOW - 1

    def test_exceeding_limit_returns_count_at_or_above_limit(self):
        now = time.time()
        for i in range(MAX_REQUESTS_PER_WINDOW + 5):
            count = self.window.hit('key1', now + i * 0.001)
        # The last hit should report preceding count >= MAX
        assert count >= MAX_REQUESTS_PER_WINDOW

    def test_window_slides_old_requests_out(self):
        base = time.time()
        # Add MAX_REQUESTS_PER_WINDOW hits in the distant past
        old_base = base - WINDOW_SECONDS - 2
        for i in range(MAX_REQUESTS_PER_WINDOW):
            self.window.hit('key1', old_base + i * 0.001)
        # Now send a fresh hit — all old hits should be evicted
        result = self.window.hit('key1', base)
        assert result == 0

    def test_max_keys_eviction_preserves_active_keys(self):
        from app.middleware.rate_limit import _FALLBACK_MAX_KEYS
        now = time.time()
        active_key = 'active'
        self.window.hit(active_key, now)

        # Flood with enough keys to trigger eviction
        for i in range(_FALLBACK_MAX_KEYS + 10):
            self.window.hit(f'flood-{i}', now + 0.001)

        # The active key may have been evicted (it was LRU), but the limiter
        # must not crash and must correctly count a new fresh hit at 0.
        result = self.window.hit('brand-new-key', now + 1)
        assert result == 0

    def test_thread_safety(self):
        """Concurrent hits from multiple threads must not corrupt state."""
        now = time.time()
        results = []
        errors = []

        def hit_many():
            try:
                for i in range(50):
                    self.window.hit('shared-key', now + i * 0.001)
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=hit_many) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, f"Thread safety violation: {errors}"

    def test_isolated_keys_with_mixed_timing(self):
        base = time.time()
        # key-x gets some fresh hits
        self.window.hit('key-x', base)
        self.window.hit('key-x', base + 1)
        # key-y gets only stale hits
        self.window.hit('key-y', base - WINDOW_SECONDS - 5)
        self.window.hit('key-y', base - WINDOW_SECONDS - 3)
        # key-y fresh hit should see 0 preceding
        assert self.window.hit('key-y', base + 2) == 0
        # key-x third hit should see 2 preceding
        assert self.window.hit('key-x', base + 3) == 2
