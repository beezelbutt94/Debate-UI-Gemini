"""Unit tests for the sliding-window rate limiter's in-process fallback.

The Redis-backed path requires a running Redis instance and is an integration
concern; these tests cover the pure Python _LocalSlidingWindow logic that
activates when Redis is unavailable.
"""
import threading
import time

import pytest


# ---------------------------------------------------------------------------
# Import the class under test without triggering the module-level Redis
# connection.  rate_limit.py calls redis.from_url() at import time, so we
# patch the redis module BEFORE importing rate_limit.
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True, scope="module")
def _patch_redis(module_mocker=None):
    """Stub out redis so rate_limit.py can be imported without a live Redis."""
    import sys
    from unittest.mock import MagicMock

    fake_redis = MagicMock()
    fake_redis.from_url.return_value = MagicMock()
    sys.modules.setdefault("redis", fake_redis)
    yield


# Import after patching happens in the fixture above; we import lazily inside
# each test so the autouse fixture is guaranteed to have run first.

def _get_limiter():
    from services.api.app.middleware.rate_limit import _LocalSlidingWindow
    return _LocalSlidingWindow()


class TestLocalSlidingWindow:
    def test_first_request_returns_zero_preceding(self):
        sw = _get_limiter()
        assert sw.hit("key1", time.time()) == 0

    def test_second_request_returns_one_preceding(self):
        sw = _get_limiter()
        t = time.time()
        sw.hit("key1", t)
        assert sw.hit("key1", t + 1) == 1

    def test_third_request_returns_two_preceding(self):
        sw = _get_limiter()
        t = time.time()
        for i in range(2):
            sw.hit("key", t + i)
        assert sw.hit("key", t + 2) == 2

    def test_requests_outside_window_are_not_counted(self):
        from services.api.app.middleware.rate_limit import WINDOW_SECONDS
        sw = _get_limiter()
        old = time.time() - WINDOW_SECONDS - 1   # clearly expired
        sw.hit("key", old)
        # A fresh request should see 0 preceding (old one is outside window)
        assert sw.hit("key", time.time()) == 0

    def test_requests_exactly_at_window_boundary_are_excluded(self):
        """Timestamps at exactly (now - WINDOW_SECONDS) are <= cutoff so removed."""
        from services.api.app.middleware.rate_limit import WINDOW_SECONDS
        sw = _get_limiter()
        now = 1_000_000.0
        boundary = now - WINDOW_SECONDS
        sw.hit("key", boundary)
        assert sw.hit("key", now) == 0

    def test_requests_just_inside_window_are_counted(self):
        from services.api.app.middleware.rate_limit import WINDOW_SECONDS
        sw = _get_limiter()
        now = 1_000_000.0
        just_inside = now - WINDOW_SECONDS + 0.001
        sw.hit("key", just_inside)
        assert sw.hit("key", now) == 1

    def test_different_keys_do_not_interfere(self):
        sw = _get_limiter()
        t = time.time()
        sw.hit("key_a", t)
        sw.hit("key_a", t + 1)
        # key_b is fresh
        assert sw.hit("key_b", t + 2) == 0

    def test_same_key_accumulates_over_multiple_hits(self):
        sw = _get_limiter()
        t = time.time()
        for i in range(10):
            sw.hit("counter", t + i)
        assert sw.hit("counter", t + 10) == 10

    def test_evicts_least_recently_used_when_over_max_keys(self, monkeypatch):
        """When the map fills up, LRU eviction keeps the total at _FALLBACK_MAX_KEYS."""
        import services.api.app.middleware.rate_limit as rl
        monkeypatch.setattr(rl, "_FALLBACK_MAX_KEYS", 3)

        sw = _get_limiter()
        t = time.time()
        sw.hit("a", t)
        sw.hit("b", t + 1)
        sw.hit("c", t + 2)
        # Adding a 4th key should evict the oldest (a)
        sw.hit("d", t + 3)
        assert len(sw._windows) <= 3

    def test_thread_safety_no_data_race(self):
        """Multiple threads hitting the same key must not raise or corrupt counts."""
        sw = _get_limiter()
        errors = []

        def worker():
            try:
                for _ in range(50):
                    sw.hit("shared", time.time())
            except Exception as exc:  # noqa: BLE001
                errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(8)]
        for th in threads:
            th.start()
        for th in threads:
            th.join()

        assert not errors, f"Thread errors: {errors}"

    def test_sliding_window_allows_new_requests_after_old_ones_expire(self):
        from services.api.app.middleware.rate_limit import WINDOW_SECONDS, MAX_REQUESTS_PER_WINDOW
        sw = _get_limiter()
        t0 = 1_000_000.0
        # Fill the window: hits at t0, t0+1, ..., t0+(N-1)
        for i in range(MAX_REQUESTS_PER_WINDOW):
            sw.hit("throttled", t0 + i)
        # The last entry is at t0 + (MAX_REQUESTS_PER_WINDOW - 1).
        # To expire ALL entries the new timestamp must be >
        # t0 + (MAX_REQUESTS_PER_WINDOW - 1) + WINDOW_SECONDS.
        t1 = t0 + WINDOW_SECONDS + MAX_REQUESTS_PER_WINDOW
        # All old entries are expired; the new request should see 0 preceding
        assert sw.hit("throttled", t1) == 0
