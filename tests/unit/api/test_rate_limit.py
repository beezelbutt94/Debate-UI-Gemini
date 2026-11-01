"""Tests for _LocalSlidingWindow — the per-process fallback rate limiter.

The module under test imports redis, fastapi, and starlette at the top level.
We mock those into sys.modules *before* loading the module so the class under
test is importable without any of those dependencies installed.
"""
import sys
import time
import types
import threading
from collections import OrderedDict, deque
from unittest.mock import MagicMock

import pytest

# ── sys.modules mocking (must happen before importing rate_limit) ───────────

class _FakeBaseHTTPMiddleware:
    """Minimal stand-in so SlidingWindowRateLimiterMiddleware can inherit."""
    def __init__(self, app=None):
        self.app = app


_starlette_base_mod = types.ModuleType("starlette.middleware.base")
_starlette_base_mod.BaseHTTPMiddleware = _FakeBaseHTTPMiddleware

for key, mod in [
    ("redis", MagicMock()),
    ("fastapi", MagicMock()),
    ("fastapi.responses", MagicMock()),
    ("starlette", MagicMock()),
    ("starlette.middleware", MagicMock()),
    ("starlette.middleware.base", _starlette_base_mod),
]:
    sys.modules.setdefault(key, mod)

# ── load module under test ──────────────────────────────────────────────────

import importlib.util
import os

_RL_PATH = os.path.join(
    os.path.dirname(__file__),
    "../../../services/api/app/middleware/rate_limit.py",
)

_spec = importlib.util.spec_from_file_location("rate_limit", os.path.abspath(_RL_PATH))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

_LocalSlidingWindow = _mod._LocalSlidingWindow
WINDOW_SECONDS = _mod.WINDOW_SECONDS
MAX_REQUESTS_PER_WINDOW = _mod.MAX_REQUESTS_PER_WINDOW
_FALLBACK_MAX_KEYS = _mod._FALLBACK_MAX_KEYS


# ── helpers ─────────────────────────────────────────────────────────────────

def make_window() -> _LocalSlidingWindow:
    return _LocalSlidingWindow()


# ── tests ────────────────────────────────────────────────────────────────────

class TestLocalSlidingWindowHit:
    def test_first_hit_returns_zero_preceding(self):
        w = make_window()
        preceding = w.hit("key1", time.time())
        assert preceding == 0

    def test_second_hit_within_window_returns_one(self):
        w = make_window()
        now = time.time()
        w.hit("key1", now)
        preceding = w.hit("key1", now + 1)
        assert preceding == 1

    def test_third_hit_within_window_returns_two(self):
        w = make_window()
        now = time.time()
        w.hit("key", now)
        w.hit("key", now + 1)
        preceding = w.hit("key", now + 2)
        assert preceding == 2

    def test_hit_after_window_expires_resets_to_zero(self):
        w = make_window()
        now = time.time()
        w.hit("key", now)
        # Advance time past the full window.
        expired_now = now + WINDOW_SECONDS + 1
        preceding = w.hit("key", expired_now)
        assert preceding == 0

    def test_hit_exactly_at_window_boundary_is_expired(self):
        """A hit exactly WINDOW_SECONDS old is on the cutoff boundary and removed."""
        w = make_window()
        t0 = time.time()
        w.hit("key", t0)
        # t0 is at exactly the cutoff for t0 + WINDOW_SECONDS: t0 <= t0 + WINDOW_SECONDS - WINDOW_SECONDS
        # The cutoff is `now - WINDOW_SECONDS`; a timestamp equal to the cutoff is removed.
        preceding = w.hit("key", t0 + WINDOW_SECONDS)
        assert preceding == 0

    def test_different_keys_are_independent(self):
        w = make_window()
        now = time.time()
        w.hit("keyA", now)
        w.hit("keyA", now + 0.1)
        preceding_b = w.hit("keyB", now + 0.2)
        assert preceding_b == 0

    def test_same_key_accumulates_across_hits(self):
        w = make_window()
        now = time.time()
        n = 5
        for i in range(n):
            preceding = w.hit("same-key", now + i * 0.1)
        assert preceding == n - 1

    def test_evicts_oldest_keys_when_over_limit(self):
        """After exceeding _FALLBACK_MAX_KEYS distinct keys, old keys are evicted."""
        w = make_window()
        now = time.time()
        # Fill the window with exactly max keys.
        for i in range(_FALLBACK_MAX_KEYS):
            w.hit(f"key-{i}", now)
        with w._lock:
            assert len(w._windows) == _FALLBACK_MAX_KEYS
        # One more key should trigger eviction.
        w.hit("overflow-key", now)
        with w._lock:
            assert len(w._windows) <= _FALLBACK_MAX_KEYS

    def test_is_thread_safe(self):
        """Concurrent hits from multiple threads must not raise or corrupt state."""
        w = make_window()
        errors: list[Exception] = []

        def bombard(key: str, n: int):
            for i in range(n):
                try:
                    w.hit(key, time.time())
                except Exception as exc:  # noqa: BLE001
                    errors.append(exc)

        threads = [threading.Thread(target=bombard, args=(f"t{i}", 50)) for i in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == [], f"Thread-safety errors: {errors}"

    def test_returns_integer(self):
        w = make_window()
        result = w.hit("key", time.time())
        assert isinstance(result, int)

    def test_window_constants_are_sane(self):
        """Configuration sanity: window is 60s, limit is 15 req."""
        assert WINDOW_SECONDS == 60
        assert MAX_REQUESTS_PER_WINDOW == 15

    def test_fallback_max_keys_is_large(self):
        """The cap must be large enough for real traffic but bounded."""
        assert _FALLBACK_MAX_KEYS == 10_000
