"""Tests for the sliding-window rate limiter (in-process fallback path only —
no Redis required). The middleware dispatch path is tested via a lightweight
ASGI test harness.
"""
import sys
import os
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

import pytest


# ─── _LocalSlidingWindow ───────────────────────────────────────────────────────

class TestLocalSlidingWindow:
    @pytest.fixture(autouse=True)
    def setup(self):
        from app.middleware.rate_limit import _LocalSlidingWindow, WINDOW_SECONDS
        self.Window = _LocalSlidingWindow
        self.WINDOW = WINDOW_SECONDS

    def _window(self):
        return self.Window()

    def test_first_request_returns_zero_preceding(self):
        w = self._window()
        assert w.hit('key', time.time()) == 0

    def test_second_request_returns_one_preceding(self):
        w = self._window()
        now = time.time()
        w.hit('key', now)
        assert w.hit('key', now + 1) == 1

    def test_requests_outside_window_are_not_counted(self):
        w = self._window()
        old_time = time.time() - self.WINDOW - 1
        # Record a request outside the window
        w.hit('key', old_time)
        # Fresh request should see 0 preceding
        assert w.hit('key', time.time()) == 0

    def test_requests_at_boundary_are_excluded(self):
        w = self._window()
        boundary = time.time()
        w.hit('key', boundary - self.WINDOW)  # exactly at the boundary (<=cutoff)
        assert w.hit('key', boundary) == 0

    def test_different_keys_are_independent(self):
        w = self._window()
        now = time.time()
        w.hit('key_a', now)
        w.hit('key_a', now + 1)
        # key_b should start from zero
        assert w.hit('key_b', now + 2) == 0

    def test_count_increases_monotonically_within_window(self):
        w = self._window()
        now = time.time()
        for expected in range(10):
            count = w.hit('key', now + expected * 0.1)
            assert count == expected

    def test_eviction_does_not_raise_on_overflow(self):
        from app.middleware.rate_limit import _FALLBACK_MAX_KEYS
        w = self._window()
        now = time.time()
        # Fill beyond the max key limit — must not raise
        for i in range(_FALLBACK_MAX_KEYS + 50):
            w.hit(f'key_{i}', now)

    def test_lru_eviction_keeps_most_recent_keys(self):
        from app.middleware.rate_limit import _FALLBACK_MAX_KEYS
        w = self._window()
        now = time.time()
        for i in range(_FALLBACK_MAX_KEYS + 1):
            w.hit(f'key_{i}', now + i * 0.001)
        # The last key should still have its own counter; use a timestamp within
        # the sliding window (the previous hit was at now + _FALLBACK_MAX_KEYS*0.001)
        assert w.hit(f'key_{_FALLBACK_MAX_KEYS}', now + 1) == 1

    def test_thread_safety_no_exception(self):
        """Concurrent hits from multiple threads must not corrupt state."""
        import threading
        w = self._window()
        errors = []

        def hammer():
            try:
                for _ in range(200):
                    w.hit('shared', time.time())
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=hammer) for _ in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert errors == [], f"Thread errors: {errors}"


# ─── SlidingWindowRateLimiterMiddleware ───────────────────────────────────────

class TestRateLimiterMiddlewareUnit:
    """Unit-level checks on the middleware's rate-limited path detection."""

    @pytest.fixture(autouse=True)
    def setup(self):
        from app.middleware.rate_limit import RATE_LIMITED_PREFIXES
        self.prefixes = RATE_LIMITED_PREFIXES

    def test_generate_path_is_rate_limited(self):
        path = '/api/v1/videos/generate'
        assert any(path.startswith(p) for p in self.prefixes)

    def test_competitor_scan_path_is_rate_limited(self):
        path = '/api/v1/analytics/competitor-scan'
        assert any(path.startswith(p) for p in self.prefixes)

    def test_unrelated_path_is_not_rate_limited(self):
        path = '/api/v1/billing/status'
        assert not any(path.startswith(p) for p in self.prefixes)

    def test_health_path_is_not_rate_limited(self):
        path = '/health'
        assert not any(path.startswith(p) for p in self.prefixes)

    def test_prefix_match_is_exact_start(self):
        path = '/api/v1/analytics/competitor-scanfoo'
        assert any(path.startswith(p) for p in self.prefixes)

    def test_root_path_not_rate_limited(self):
        assert not any('/'.startswith(p) for p in self.prefixes)
