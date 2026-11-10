"""Tests for _LocalSlidingWindow in services/api/app/middleware/rate_limit.py

The middleware itself requires Redis + FastAPI, so we test only the pure
local sliding-window logic, which has no external dependencies.
"""
import sys
import os
import time
import threading

# Avoid importing the full middleware module (which tries to connect to Redis
# at module load time). We extract just the class by patching the import.
import importlib
import types

# Provide a stub redis module so the module-level `redis.from_url()` call
# doesn't fail on import.
_redis_stub = types.ModuleType('redis')

class _FakeRedis:
    @staticmethod
    def from_url(*a, **kw):
        return None

_redis_stub.from_url = _FakeRedis.from_url
_redis_stub.RedisError = Exception
sys.modules.setdefault('redis', _redis_stub)

# Stub fastapi and starlette to avoid heavy imports
for _mod in ('fastapi', 'fastapi.responses', 'starlette', 'starlette.middleware', 'starlette.middleware.base'):
    if _mod not in sys.modules:
        sys.modules[_mod] = types.ModuleType(_mod)

# Provide minimal stubs so the module imports cleanly
sys.modules['fastapi'].Request = object  # type: ignore[attr-defined]
sys.modules['fastapi.responses'].JSONResponse = object  # type: ignore[attr-defined]
sys.modules['starlette.middleware.base'].BaseHTTPMiddleware = object  # type: ignore[attr-defined]

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'services', 'api'))

from app.middleware.rate_limit import _LocalSlidingWindow, WINDOW_SECONDS, MAX_REQUESTS_PER_WINDOW


class TestLocalSlidingWindow:
    def setup_method(self):
        self.window = _LocalSlidingWindow()

    # ── Basic counting ───────────────────────────────────────────────────────

    def test_first_hit_returns_zero_preceding(self):
        """The very first request in a window has 0 preceding requests."""
        assert self.window.hit('key1', time.time()) == 0

    def test_second_hit_returns_one_preceding(self):
        now = time.time()
        self.window.hit('key1', now)
        assert self.window.hit('key1', now + 0.1) == 1

    def test_hit_count_accumulates_within_window(self):
        now = time.time()
        for i in range(10):
            self.window.hit('key1', now + i * 0.1)
        # 11th hit should see 10 preceding
        assert self.window.hit('key1', now + 1.1) == 10

    def test_different_keys_are_independent(self):
        now = time.time()
        self.window.hit('keyA', now)
        self.window.hit('keyA', now + 0.1)
        # keyB starts fresh
        assert self.window.hit('keyB', now + 0.2) == 0

    # ── Sliding-window expiry ────────────────────────────────────────────────

    def test_old_requests_expire_after_window(self):
        """Requests older than WINDOW_SECONDS don't count."""
        old_time = time.time() - WINDOW_SECONDS - 1
        self.window.hit('key1', old_time)
        # A fresh request should see 0 preceding (old one expired)
        assert self.window.hit('key1', time.time()) == 0

    def test_requests_at_boundary_still_count(self):
        """A request exactly WINDOW_SECONDS ago is NOT counted (> cutoff)."""
        now = time.time()
        boundary = now - WINDOW_SECONDS
        self.window.hit('key1', boundary)
        # cutoff = now - WINDOW_SECONDS, boundary <= cutoff → evicted
        assert self.window.hit('key1', now) == 0

    def test_recent_requests_still_in_window(self):
        now = time.time()
        self.window.hit('key1', now - WINDOW_SECONDS + 10)  # still inside window
        assert self.window.hit('key1', now) == 1

    def test_mixed_old_and_recent(self):
        now = time.time()
        self.window.hit('key1', now - WINDOW_SECONDS - 5)   # expired
        self.window.hit('key1', now - 10)                    # still valid
        assert self.window.hit('key1', now) == 1

    # ── LRU eviction guard ───────────────────────────────────────────────────

    def test_does_not_grow_beyond_max_keys(self):
        from app.middleware.rate_limit import _FALLBACK_MAX_KEYS
        now = time.time()
        # Fill beyond the cap
        for i in range(_FALLBACK_MAX_KEYS + 50):
            self.window.hit(f'key_{i}', now)
        assert len(self.window._windows) <= _FALLBACK_MAX_KEYS

    # ── Thread safety ─────────────────────────────────────────────────────────

    def test_concurrent_hits_do_not_corrupt_state(self):
        """Multiple threads hitting different keys concurrently must not raise."""
        errors = []

        def worker(key):
            try:
                now = time.time()
                for _ in range(20):
                    self.window.hit(key, time.time())
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=worker, args=(f'k{i}',)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == [], f"Thread errors: {errors}"

    # ── Rate limit threshold ─────────────────────────────────────────────────

    def test_hit_at_max_requests_triggers_limit(self):
        """When preceding count reaches MAX_REQUESTS_PER_WINDOW, the next
        request is over the limit — the caller (middleware) blocks it."""
        now = time.time()
        for i in range(MAX_REQUESTS_PER_WINDOW):
            self.window.hit('key1', now + i * 0.001)
        # This hit returns MAX_REQUESTS_PER_WINDOW preceding, which is >= limit
        preceding = self.window.hit('key1', now + 1)
        assert preceding >= MAX_REQUESTS_PER_WINDOW
