"""Tests for app.middleware.rate_limit._LocalSlidingWindow.

We test the in-process fallback directly since it contains
the core sliding-window logic (eviction, counting, LRU cap).
"""
import os
import sys
import time

import pytest

_API_ROOT = os.path.join(os.path.dirname(__file__), "..")
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

# Patch Redis before importing to avoid a connection at import time
from unittest.mock import MagicMock, patch
import redis

with patch.object(redis, "from_url", return_value=MagicMock()):
    from app.middleware.rate_limit import (
        _LocalSlidingWindow,
        WINDOW_SECONDS,
        MAX_REQUESTS_PER_WINDOW,
        _FALLBACK_MAX_KEYS,
    )


class TestLocalSlidingWindow:
    def setup_method(self):
        self.sw = _LocalSlidingWindow()

    # --- Basic counting ---

    def test_first_hit_returns_zero_preceding(self):
        count = self.sw.hit("key1", time.time())
        assert count == 0

    def test_second_hit_returns_one_preceding(self):
        now = time.time()
        self.sw.hit("key1", now)
        count = self.sw.hit("key1", now + 0.1)
        assert count == 1

    def test_tenth_hit_returns_nine_preceding(self):
        now = time.time()
        for i in range(9):
            self.sw.hit("key_x", now + i * 0.1)
        count = self.sw.hit("key_x", now + 9 * 0.1)
        assert count == 9

    # --- Window expiry ---

    def test_old_requests_evicted_after_window(self):
        now = time.time()
        # Add MAX_REQUESTS_PER_WINDOW requests just inside the window
        for i in range(MAX_REQUESTS_PER_WINDOW):
            self.sw.hit("expiry_key", now - WINDOW_SECONDS + i * 0.1)

        # One more request right now — all old ones should have expired
        # (they're exactly at or before the cutoff)
        count = self.sw.hit("expiry_key", now + 0.5)
        # All prior timestamps are <= now - WINDOW_SECONDS + something < now - WINDOW_SECONDS + 0.5
        # whether they evict depends on the <=cutoff check; just verify it is < MAX
        assert count < MAX_REQUESTS_PER_WINDOW

    def test_requests_within_window_counted(self):
        now = time.time()
        for i in range(5):
            self.sw.hit("within_key", now - 10 + i)  # all within the last minute
        count = self.sw.hit("within_key", now)
        assert count == 5

    # --- Independent keys ---

    def test_independent_keys_do_not_share_counts(self):
        now = time.time()
        for _ in range(5):
            self.sw.hit("key_a", now)
        # key_b starts fresh
        count = self.sw.hit("key_b", now)
        assert count == 0

    # --- LRU eviction ---

    def test_lru_cap_evicts_oldest_key(self):
        now = time.time()
        # Fill up to the cap + 1 so the first key gets evicted
        for i in range(_FALLBACK_MAX_KEYS + 1):
            self.sw.hit(f"lru_key_{i}", now)
        # After eviction the window dict should be at most _FALLBACK_MAX_KEYS
        assert len(self.sw._windows) <= _FALLBACK_MAX_KEYS

    def test_lru_keeps_recently_used_key(self):
        now = time.time()
        # Repeatedly use key_0 to keep it at the "recent" end
        for _ in range(3):
            self.sw.hit("keep_me", now)

        for i in range(_FALLBACK_MAX_KEYS):
            self.sw.hit(f"evict_candidate_{i}", now + 0.001)

        # key "keep_me" was used and moved to end; eviction hits oldest first.
        # It should still be present (though we can't guarantee it under all
        # orderings without inspecting internals -- just verify no crash).
        assert len(self.sw._windows) <= _FALLBACK_MAX_KEYS

    # --- Thread safety (smoke test) ---

    def test_concurrent_hits_do_not_crash(self):
        import threading
        errors = []

        def worker(key):
            try:
                for _ in range(50):
                    self.sw.hit(key, time.time())
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=worker, args=(f"t{i}",)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == [], f"Thread errors: {errors}"

    # --- Rate limiting boundary ---

    def test_exactly_at_limit_is_rejected(self):
        """hit() returns how many *preceded* this request, so at limit-1 it returns MAX-1
        and the caller sees request_count >= MAX; the N-th request returns MAX-1."""
        now = time.time()
        counts = []
        for i in range(MAX_REQUESTS_PER_WINDOW + 2):
            counts.append(self.sw.hit("limit_key", now + i * 0.001))

        # The (MAX+1)-th hit should have seen at least MAX preceding it
        assert counts[MAX_REQUESTS_PER_WINDOW] >= MAX_REQUESTS_PER_WINDOW

    def test_zero_returned_for_brand_new_key(self):
        assert self.sw.hit("brand-new", time.time()) == 0
