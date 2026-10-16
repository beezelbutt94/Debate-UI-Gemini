"""Unit tests for _LocalSlidingWindow in services/api/app/middleware/rate_limit.py

The sliding-window is a pure in-process data structure; tests run without
Redis or any other external dependency.
"""
import sys
import os
import time
import types
import threading

import pytest

# Make services/api importable
_API_ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "..", "services", "api")
sys.path.insert(0, _API_ROOT)

# Stub redis before importing the rate_limit module so the module-level
# `redis.from_url(...)` call doesn't fail in the test environment.
if "redis" not in sys.modules:
    _redis_mod = types.ModuleType("redis")

    class _FakeRedis:
        def __init__(self, *a, **kw): ...
        def pipeline(self): return self
        def execute(self): return [None, 0, None, None]
        def zremrangebyscore(self, *a): return self
        def zcard(self, *a): return self
        def zadd(self, *a, **kw): return self
        def expire(self, *a): return self

    class _FakeRedisError(Exception): ...

    _redis_mod.from_url = lambda *a, **kw: _FakeRedis()  # type: ignore
    _redis_mod.RedisError = _FakeRedisError  # type: ignore
    sys.modules["redis"] = _redis_mod

# Stub fastapi / starlette (not installed in test env)
for _stub_name in [
    "fastapi",
    "fastapi.responses",
    "starlette",
    "starlette.middleware",
    "starlette.middleware.base",
]:
    if _stub_name not in sys.modules:
        _m = types.ModuleType(_stub_name)
        sys.modules[_stub_name] = _m

# Provide just enough stubs for the import to succeed
sys.modules["fastapi"].Request = object  # type: ignore
sys.modules["fastapi.responses"].JSONResponse = object  # type: ignore
sys.modules["starlette.middleware.base"].BaseHTTPMiddleware = object  # type: ignore

from app.middleware.rate_limit import _LocalSlidingWindow, WINDOW_SECONDS, MAX_REQUESTS_PER_WINDOW  # noqa: E402


class TestLocalSlidingWindow:
    def test_first_hit_returns_zero_preceding(self):
        w = _LocalSlidingWindow()
        assert w.hit("key1", time.time()) == 0

    def test_second_hit_returns_one_preceding(self):
        w = _LocalSlidingWindow()
        now = time.time()
        w.hit("key", now)
        assert w.hit("key", now + 0.01) == 1

    def test_counts_accumulate_within_window(self):
        w = _LocalSlidingWindow()
        base = time.time()
        for i in range(5):
            w.hit("key", base + i * 0.1)
        assert w.hit("key", base + 0.6) == 5

    def test_old_requests_outside_window_are_evicted(self):
        w = _LocalSlidingWindow()
        past = time.time() - WINDOW_SECONDS - 1
        w.hit("key", past)
        w.hit("key", past)
        # Now advance past the window — old hits should be gone
        now = time.time()
        assert w.hit("key", now) == 0

    def test_requests_at_window_boundary_are_evicted(self):
        """Requests exactly at the cutoff (now - WINDOW_SECONDS) are excluded."""
        w = _LocalSlidingWindow()
        boundary = time.time() - WINDOW_SECONDS
        w.hit("key", boundary)  # exactly on the cutoff
        # A new hit right now should not count the boundary hit
        assert w.hit("key", time.time()) == 0

    def test_different_keys_are_independent(self):
        w = _LocalSlidingWindow()
        now = time.time()
        for _ in range(3):
            w.hit("keyA", now)
        assert w.hit("keyB", now) == 0

    def test_max_keys_eviction(self):
        """When more than _FALLBACK_MAX_KEYS distinct keys are inserted,
        old keys are evicted (the object doesn't grow unboundedly)."""
        from app.middleware.rate_limit import _FALLBACK_MAX_KEYS

        w = _LocalSlidingWindow()
        now = time.time()
        for i in range(_FALLBACK_MAX_KEYS + 50):
            w.hit(f"key{i}", now)

        with w._lock:
            assert len(w._windows) <= _FALLBACK_MAX_KEYS

    def test_thread_safety_no_exception(self):
        """Concurrent writes from multiple threads must not raise."""
        w = _LocalSlidingWindow()
        errors: list[Exception] = []

        def worker():
            try:
                now = time.time()
                for _ in range(50):
                    w.hit("shared_key", now)
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == [], f"Thread raised: {errors[0]}"

    def test_rate_limit_exceeded_after_max_requests(self):
        """After MAX_REQUESTS_PER_WINDOW hits the next hit returns >= MAX."""
        w = _LocalSlidingWindow()
        now = time.time()
        for i in range(MAX_REQUESTS_PER_WINDOW):
            w.hit("key", now + i * 0.001)
        result = w.hit("key", now + MAX_REQUESTS_PER_WINDOW * 0.001)
        assert result >= MAX_REQUESTS_PER_WINDOW

    def test_exactly_one_hit_below_limit(self):
        w = _LocalSlidingWindow()
        assert w.hit("solo", time.time()) < MAX_REQUESTS_PER_WINDOW

    def test_counts_reset_after_full_window_passes(self):
        """All hits from > WINDOW_SECONDS ago must not count."""
        w = _LocalSlidingWindow()
        old = time.time() - WINDOW_SECONDS - 5
        for _ in range(100):
            w.hit("key", old)
        # Simulate a fresh window
        now = time.time()
        assert w.hit("key", now) == 0

    def test_hit_count_never_negative(self):
        w = _LocalSlidingWindow()
        now = time.time()
        result = w.hit("fresh_key", now)
        assert result >= 0

    def test_returns_int_or_zero(self):
        w = _LocalSlidingWindow()
        result = w.hit("k", time.time())
        assert isinstance(result, int)
