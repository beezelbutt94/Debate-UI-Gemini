"""Tests for _LocalSlidingWindow in services/api/app/middleware/rate_limit.py."""
import sys
import os
import time

# Allow importing from the services/api directory.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'services', 'api'))

# Stub heavy / network-dependent imports before importing the module under test.
import types, unittest.mock

# Stub 'redis' so the module-level redis.from_url() call doesn't fail.
redis_stub = types.ModuleType('redis')
class _FakeRedis:
    pass
class _FakeRedisError(Exception):
    pass
redis_stub.from_url = lambda *a, **kw: _FakeRedis()
redis_stub.RedisError = _FakeRedisError
sys.modules.setdefault('redis', redis_stub)

# Stub 'fastapi' and 'starlette' so BaseHTTPMiddleware import works.
fastapi_stub = types.ModuleType('fastapi')
fastapi_stub.Request = object
fastapi_stub.responses = types.ModuleType('fastapi.responses')
fastapi_stub.responses.JSONResponse = object
sys.modules.setdefault('fastapi', fastapi_stub)
sys.modules.setdefault('fastapi.responses', fastapi_stub.responses)

starlette_stub = types.ModuleType('starlette')
starlette_middleware = types.ModuleType('starlette.middleware')
starlette_middleware_base = types.ModuleType('starlette.middleware.base')
class _BaseHTTPMiddleware:
    pass
starlette_middleware_base.BaseHTTPMiddleware = _BaseHTTPMiddleware
sys.modules.setdefault('starlette', starlette_stub)
sys.modules.setdefault('starlette.middleware', starlette_middleware)
sys.modules.setdefault('starlette.middleware.base', starlette_middleware_base)

from app.middleware.rate_limit import _LocalSlidingWindow, WINDOW_SECONDS, MAX_REQUESTS_PER_WINDOW  # noqa: E402


class TestLocalSlidingWindow:
    def _window(self):
        return _LocalSlidingWindow()

    # ── First request ─────────────────────────────────────────────────────
    def test_first_request_returns_zero_preceding(self):
        w = self._window()
        assert w.hit('key1', time.time()) == 0

    # ── Counting preceding requests ───────────────────────────────────────
    def test_second_request_returns_one_preceding(self):
        w = self._window()
        now = time.time()
        w.hit('key1', now)
        assert w.hit('key1', now + 1) == 1

    def test_counts_accumulate_within_window(self):
        w = self._window()
        base = time.time()
        for i in range(9):
            w.hit('mykey', base + i)
        # 10th hit should see 9 preceding
        assert w.hit('mykey', base + 9) == 9

    # ── Key isolation ─────────────────────────────────────────────────────
    def test_different_keys_are_independent(self):
        w = self._window()
        now = time.time()
        # Key A gets 5 hits
        for i in range(5):
            w.hit('keyA', now + i)
        # Key B should have 0 preceding regardless
        assert w.hit('keyB', now + 10) == 0

    # ── Sliding window expiry ─────────────────────────────────────────────
    def test_old_requests_expire_outside_window(self):
        w = self._window()
        old_time = time.time() - WINDOW_SECONDS - 1
        w.hit('expkey', old_time)  # This should be dropped
        # A fresh hit at 'now' should see 0 preceding
        assert w.hit('expkey', time.time()) == 0

    def test_requests_on_the_boundary_are_expired(self):
        """Requests exactly at the cutoff (now - WINDOW_SECONDS) should be dropped."""
        w = self._window()
        now = time.time()
        cutoff = now - WINDOW_SECONDS
        w.hit('bkey', cutoff)  # exactly at cutoff, should be expelled
        assert w.hit('bkey', now) == 0

    def test_requests_just_inside_window_are_kept(self):
        w = self._window()
        now = time.time()
        # 1 second before cutoff → still inside the window
        recent = now - WINDOW_SECONDS + 1
        w.hit('rkey', recent)
        assert w.hit('rkey', now) == 1

    # ── Rate limit enforcement pattern ───────────────────────────────────
    def test_reaches_limit_at_max_requests(self):
        w = self._window()
        base = time.time()
        for i in range(MAX_REQUESTS_PER_WINDOW - 1):
            w.hit('lkey', base + i * 0.1)
        # MAX_REQUESTS_PER_WINDOW-th hit: preceding count == MAX - 1 (allowed)
        assert w.hit('lkey', base + (MAX_REQUESTS_PER_WINDOW - 1) * 0.1) == MAX_REQUESTS_PER_WINDOW - 1

    def test_exceeds_limit_on_next_request(self):
        w = self._window()
        base = time.time()
        for i in range(MAX_REQUESTS_PER_WINDOW):
            w.hit('lkey2', base + i * 0.1)
        # (MAX+1)-th hit: preceding == MAX → caller should reject
        result = w.hit('lkey2', base + MAX_REQUESTS_PER_WINDOW * 0.1)
        assert result >= MAX_REQUESTS_PER_WINDOW

    # ── Thread safety smoke test ──────────────────────────────────────────
    def test_concurrent_hits_do_not_raise(self):
        import threading
        w = self._window()
        errors = []

        def worker():
            try:
                for _ in range(20):
                    w.hit('shared', time.time())
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == [], f"Unexpected errors in concurrent access: {errors}"

    # ── LRU eviction cap ─────────────────────────────────────────────────
    def test_eviction_does_not_raise_beyond_max_keys(self):
        from app.middleware.rate_limit import _FALLBACK_MAX_KEYS
        w = self._window()
        now = time.time()
        # Add one more than the cap; should not raise
        for i in range(_FALLBACK_MAX_KEYS + 10):
            w.hit(f'key_{i}', now)
        # Internal dict should be capped
        assert len(w._windows) <= _FALLBACK_MAX_KEYS
