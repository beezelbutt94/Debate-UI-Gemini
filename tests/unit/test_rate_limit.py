"""Tests for the _LocalSlidingWindow rate limiter.

The module imports redis at load time (module-level redis.from_url call), so we
patch sys.modules before importing to avoid needing a live Redis connection.
"""
import sys
import time
import threading
from collections import OrderedDict, deque
from unittest.mock import MagicMock

import pytest

# ── Mock redis before importing the module ───────────────────────────────────

_redis_mock = MagicMock()
_redis_mock.from_url.return_value = MagicMock()
sys.modules.setdefault("redis", _redis_mock)

# fastapi / starlette are also imported at module level in rate_limit.py
_fastapi_mock = MagicMock()
_starlette_mock = MagicMock()
_starlette_middleware_mock = MagicMock()
sys.modules.setdefault("fastapi", _fastapi_mock)
sys.modules.setdefault("fastapi.responses", MagicMock())
sys.modules.setdefault("starlette", _starlette_mock)
sys.modules.setdefault("starlette.middleware", _starlette_middleware_mock)
sys.modules.setdefault("starlette.middleware.base", MagicMock())

import sys as _sys
_sys.path.insert(0, "/home/circleci/project/services/api")

from app.middleware.rate_limit import (  # noqa: E402
    _LocalSlidingWindow,
    WINDOW_SECONDS,
    MAX_REQUESTS_PER_WINDOW,
    _FALLBACK_MAX_KEYS,
)

# ── Helpers ───────────────────────────────────────────────────────────────────

def make_window() -> _LocalSlidingWindow:
    return _LocalSlidingWindow()


# ── Tests for _LocalSlidingWindow.hit() ───────────────────────────────────────

class TestLocalSlidingWindowFirstRequest:
    def test_first_request_returns_zero(self):
        w = make_window()
        assert w.hit("key", time.time()) == 0

    def test_returns_int(self):
        w = make_window()
        result = w.hit("key", 1000.0)
        assert isinstance(result, int)


class TestLocalSlidingWindowCounting:
    def test_second_request_returns_one(self):
        w = make_window()
        now = 1000.0
        w.hit("key", now)
        assert w.hit("key", now + 0.1) == 1

    def test_counts_increment_within_window(self):
        w = make_window()
        now = 1000.0
        for i in range(10):
            result = w.hit("key", now + i * 0.1)
            assert result == i

    def test_separate_keys_are_independent(self):
        w = make_window()
        now = 1000.0
        w.hit("key-a", now)
        w.hit("key-a", now + 0.1)
        assert w.hit("key-b", now) == 0

    def test_same_key_multiple_processes_via_different_instances(self):
        # Each process gets its own instance — counts don't bleed over
        w1 = make_window()
        w2 = make_window()
        now = 1000.0
        w1.hit("key", now)
        w1.hit("key", now + 0.1)
        # w2 has a fresh window
        assert w2.hit("key", now) == 0


class TestLocalSlidingWindowExpiry:
    def test_old_requests_expire_after_window(self):
        w = make_window()
        # Hit at time 0 — well outside the 60-second window relative to 'now'
        w.hit("key", 0.0)
        now = float(WINDOW_SECONDS + 1)
        # That hit is stale; preceding count should be 0
        assert w.hit("key", now) == 0

    def test_requests_exactly_at_cutoff_are_excluded(self):
        # cutoff = now - WINDOW_SECONDS; timestamps <= cutoff are removed
        w = make_window()
        now = float(WINDOW_SECONDS)
        w.hit("key", 0.0)   # timestamp 0 == cutoff when now == WINDOW_SECONDS
        assert w.hit("key", now) == 0

    def test_requests_one_tick_inside_window_are_kept(self):
        w = make_window()
        now = float(WINDOW_SECONDS)
        w.hit("key", 0.01)  # just inside the window
        assert w.hit("key", now) == 1

    def test_sliding_window_rolls_forward(self):
        w = make_window()
        base = 1000.0
        # Hits at base+0, base+5, base+10, base+15, base+20
        for i in range(5):
            w.hit("key", base + i * 5)
        # later = 1075; cutoff = 1075 - 60 = 1015
        # Hits <= 1015 (i.e. 1000, 1005, 1010, 1015) are removed
        # Only hit at 1020 is still inside the window → preceding = 1
        later = base + 5 * 5 + WINDOW_SECONDS - 10  # 1075
        count = w.hit("key", later)
        assert count == 1

    def test_after_full_window_passes_count_resets_to_zero(self):
        w = make_window()
        base = 500.0
        for _ in range(MAX_REQUESTS_PER_WINDOW):
            w.hit("key", base)
        # Advance past entire window
        assert w.hit("key", base + WINDOW_SECONDS + 1) == 0


class TestLocalSlidingWindowEviction:
    def test_evicts_lru_key_when_over_limit(self):
        w = make_window()
        now = 1000.0
        # Fill up to the max
        for i in range(_FALLBACK_MAX_KEYS):
            w.hit(f"key-{i}", now)
        # One more key should trigger eviction of the LRU key
        w.hit("new-key", now)
        assert len(w._windows) <= _FALLBACK_MAX_KEYS

    def test_active_key_not_evicted_while_lru_present(self):
        w = make_window()
        now = 1000.0
        # Access "hot" key first so it becomes LRU
        w.hit("hot", now)
        # Fill rest of capacity
        for i in range(_FALLBACK_MAX_KEYS - 1):
            w.hit(f"cold-{i}", now + 0.001 * i)
        # Re-access "hot" to promote it to MRU
        w.hit("hot", now + 1)
        # Trigger eviction by adding a new key
        w.hit("trigger", now + 2)
        # "hot" should still be in the window (was MRU)
        assert "hot" in w._windows


class TestLocalSlidingWindowThreadSafety:
    def test_concurrent_hits_do_not_corrupt_count(self):
        """Multiple threads hitting the same key concurrently should not crash
        or produce negative counts."""
        w = make_window()
        results = []
        barrier = threading.Barrier(10)

        def worker():
            barrier.wait()
            for _ in range(5):
                r = w.hit("shared-key", time.time())
                results.append(r)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert all(r >= 0 for r in results)
        assert len(results) == 50

    def test_different_keys_concurrently_remain_independent(self):
        w = make_window()
        errors = []
        barrier = threading.Barrier(5)

        def worker(key_id):
            barrier.wait()
            now = time.time()
            try:
                first = w.hit(f"key-{key_id}", now)
                assert first == 0, f"key-{key_id}: expected 0, got {first}"
            except AssertionError as e:
                errors.append(str(e))

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, f"Thread safety errors: {errors}"


class TestLocalSlidingWindowConstants:
    def test_window_seconds_is_positive(self):
        assert WINDOW_SECONDS > 0

    def test_max_requests_is_positive(self):
        assert MAX_REQUESTS_PER_WINDOW > 0

    def test_fallback_max_keys_is_positive(self):
        assert _FALLBACK_MAX_KEYS > 0

    def test_window_seconds_is_60(self):
        assert WINDOW_SECONDS == 60

    def test_max_requests_per_window_is_15(self):
        assert MAX_REQUESTS_PER_WINDOW == 15
