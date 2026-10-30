"""Tests for _LocalSlidingWindow — pure in-process rate limiter logic.

We import the class directly from the module. The redis_client is created at
module import time, so we must patch redis.from_url before importing the module
to avoid a real Redis connection attempt.
"""
import sys
import time
import pytest
from unittest.mock import MagicMock, patch

# Patch redis before importing the module to avoid a real connection
with patch.dict('sys.modules', {'redis': MagicMock()}):
    # Also patch redis.from_url at module level
    import redis as _redis_mock
    _redis_mock.from_url = MagicMock(return_value=MagicMock())
    # Now we can safely import
    from app.middleware.rate_limit import (
        _LocalSlidingWindow,
        WINDOW_SECONDS,
        MAX_REQUESTS_PER_WINDOW,
        _FALLBACK_MAX_KEYS,
    )


class TestLocalSlidingWindowHit:
    def setup_method(self):
        self.window = _LocalSlidingWindow()

    def test_first_hit_returns_zero_preceding(self):
        assert self.window.hit("user1", time.time()) == 0

    def test_second_hit_within_window_returns_one_preceding(self):
        now = time.time()
        self.window.hit("user1", now)
        assert self.window.hit("user1", now + 1) == 1

    def test_third_hit_returns_two_preceding(self):
        now = time.time()
        self.window.hit("user1", now)
        self.window.hit("user1", now + 1)
        assert self.window.hit("user1", now + 2) == 2

    def test_hit_after_window_expiry_resets_count(self):
        now = time.time()
        self.window.hit("user1", now)
        self.window.hit("user1", now + 1)
        # Request after the window expires
        late_time = now + WINDOW_SECONDS + 1
        assert self.window.hit("user1", late_time) == 0

    def test_different_keys_are_independent(self):
        now = time.time()
        self.window.hit("user1", now)
        self.window.hit("user1", now + 1)
        # user2 starts fresh
        assert self.window.hit("user2", now + 2) == 0

    def test_expired_requests_are_evicted(self):
        now = time.time()
        # Make requests at the start of the window
        for i in range(5):
            self.window.hit("user1", now + i)
        # Move time past the window; those 5 requests should be evicted
        late = now + WINDOW_SECONDS + 10
        preceding = self.window.hit("user1", late)
        assert preceding == 0

    def test_requests_exactly_at_window_boundary(self):
        now = 1000.0
        self.window.hit("user1", now)
        # At exactly WINDOW_SECONDS later, the old request is on the boundary
        # cutoff = now + WINDOW_SECONDS - WINDOW_SECONDS = now, but
        # the eviction is "while window[0] <= cutoff: pop"
        # so a request at exactly `now` is popped when time is now + WINDOW_SECONDS
        boundary = now + WINDOW_SECONDS
        preceding = self.window.hit("user1", boundary)
        # The original request at `now` has cutoff = boundary - WINDOW_SECONDS = now
        # and window[0]=now <= cutoff=now, so it IS evicted
        assert preceding == 0

    def test_hit_count_accumulates_within_window(self):
        now = time.time()
        for i in range(10):
            result = self.window.hit("user1", now + i * 0.1)
        # After 10 hits within window, the 10th call sees 9 preceding
        assert result == 9

    def test_eviction_does_not_affect_other_keys(self):
        now = time.time()
        self.window.hit("user1", now)
        self.window.hit("user2", now + 1)
        # Expire user1's window
        late = now + WINDOW_SECONDS + 2
        self.window.hit("user1", late)  # evicts user1's old request
        # user2 still has its request within its own window
        result = self.window.hit("user2", late)
        # user2's request at now+1 should also be expired by late
        # because late - WINDOW_SECONDS > now+1
        assert result == 0

    def test_fallback_max_keys_constant_is_positive(self):
        assert _FALLBACK_MAX_KEYS > 0

    def test_window_seconds_constant_is_positive(self):
        assert WINDOW_SECONDS > 0

    def test_max_requests_constant_is_positive(self):
        assert MAX_REQUESTS_PER_WINDOW > 0

    def test_lru_eviction_when_max_keys_exceeded(self):
        # Fill the window beyond _FALLBACK_MAX_KEYS; shouldn't raise
        now = time.time()
        for i in range(_FALLBACK_MAX_KEYS + 10):
            self.window.hit(f"key_{i}", now)
        # Window should still work after eviction
        assert self.window.hit("new_key", now) == 0

    def test_thread_safety_basic(self):
        """Basic check that concurrent hits don't raise exceptions."""
        import threading
        now = time.time()
        errors = []

        def do_hit(key):
            try:
                self.window.hit(key, time.time())
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=do_hit, args=(f"u{i}",)) for i in range(50)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == []

    def test_returns_integer(self):
        result = self.window.hit("user1", time.time())
        assert isinstance(result, int)

    def test_preceding_is_non_negative(self):
        now = time.time()
        for _ in range(5):
            result = self.window.hit("user1", now)
        assert result >= 0
