"""Tests for the _LocalSlidingWindow rate limiter in services/api.

sys.path is set in conftest.py (services/api prepended) so `app.*` imports
find the real package instead of the Next.js app/ directory at repo root.
"""
import sys
import time
import threading
import unittest.mock as mock

# Mock redis and web-framework stubs before importing the module under test
_redis_mock = mock.MagicMock()
_redis_mock.from_url.return_value = mock.MagicMock()
sys.modules.setdefault('redis', _redis_mock)

for _mod in ('fastapi', 'fastapi.responses', 'starlette',
             'starlette.middleware', 'starlette.middleware.base'):
    sys.modules.setdefault(_mod, mock.MagicMock())

from app.middleware.rate_limit import (  # noqa: E402
    _LocalSlidingWindow,
    _log_outage,
    WINDOW_SECONDS,
    MAX_REQUESTS_PER_WINDOW,
    _FALLBACK_MAX_KEYS,
    _OUTAGE_LOG_INTERVAL_SECONDS,
)


class TestLocalSlidingWindowBasics:
    def setup_method(self):
        self.w = _LocalSlidingWindow()

    def test_first_hit_returns_zero_preceding(self):
        assert self.w.hit('key1', time.time()) == 0

    def test_second_hit_returns_one_preceding(self):
        now = time.time()
        self.w.hit('key1', now)
        assert self.w.hit('key1', now + 0.001) == 1

    def test_counts_increment_monotonically(self):
        now = time.time()
        for i in range(10):
            assert self.w.hit('keyA', now + i * 0.1) == i

    def test_separate_keys_are_independent(self):
        now = time.time()
        self.w.hit('k1', now)
        self.w.hit('k1', now + 0.1)
        assert self.w.hit('k2', now + 0.2) == 0

    def test_requests_older_than_window_excluded(self):
        now = time.time()
        self.w.hit('s', now - WINDOW_SECONDS - 1)
        assert self.w.hit('s', now) == 0

    def test_requests_at_window_boundary_excluded(self):
        now = time.time()
        self.w.hit('b', now - WINDOW_SECONDS)  # cutoff: <= now - WINDOW_SECONDS
        assert self.w.hit('b', now) == 0

    def test_requests_just_inside_window_counted(self):
        now = time.time()
        self.w.hit('i', now - WINDOW_SECONDS + 0.001)
        assert self.w.hit('i', now) == 1

    def test_rate_limit_threshold(self):
        now = time.time()
        counts = [self.w.hit('throttle', now + i * 0.01) for i in range(MAX_REQUESTS_PER_WINDOW + 1)]
        assert counts[-1] == MAX_REQUESTS_PER_WINDOW

    def test_window_slides_old_counts_drop(self):
        base = 0.0
        for i in range(5):
            self.w.hit('slide', base + i)
        assert self.w.hit('slide', base + WINDOW_SECONDS + 5) == 0

    def test_returns_integer(self):
        assert isinstance(self.w.hit('type', time.time()), int)

    def test_many_hits_same_timestamp(self):
        t = time.time()
        counts = [self.w.hit('ts', t) for _ in range(5)]
        assert counts == [0, 1, 2, 3, 4]

    def test_first_hit_on_fresh_window(self):
        assert self.w.hit('fresh', 12345.0) == 0

    def test_mixed_old_and_new_requests(self):
        base = time.time()
        for _ in range(3):
            self.w.hit('mix', base - WINDOW_SECONDS)  # at boundary → evicted
        self.w.hit('mix', base)
        assert self.w.hit('mix', base + 0.001) == 1

    def test_single_request_exactly_at_window_start(self):
        self.w.hit('edge', 100.0)
        # 100 <= 160 - 60 → evicted
        assert self.w.hit('edge', 160.0) == 0


class TestLocalSlidingWindowEviction:
    def test_evicts_lru_keys_at_capacity(self):
        w = _LocalSlidingWindow()
        now = time.time()
        for i in range(_FALLBACK_MAX_KEYS):
            w.hit(f'key_{i}', now)
        assert len(w._windows) == _FALLBACK_MAX_KEYS
        w.hit('overflow_key', now + 0.001)
        assert len(w._windows) <= _FALLBACK_MAX_KEYS

    def test_capacity_does_not_grow_unbounded(self):
        w = _LocalSlidingWindow()
        now = time.time()
        for i in range(_FALLBACK_MAX_KEYS + 500):
            w.hit(f'k{i}', now)
        assert len(w._windows) <= _FALLBACK_MAX_KEYS


class TestLocalSlidingWindowConcurrency:
    def test_concurrent_hits_no_corruption(self):
        w = _LocalSlidingWindow()
        results: list[int] = []
        errors: list[Exception] = []

        def worker():
            try:
                for _ in range(20):
                    results.append(w.hit('concurrent', time.time()))
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, f'Errors: {errors}'
        assert all(r >= 0 for r in results)

    def test_concurrent_different_keys_no_corruption(self):
        w = _LocalSlidingWindow()
        errors: list[Exception] = []

        def worker(key_id: int):
            try:
                for _ in range(10):
                    w.hit(f'key_{key_id}', time.time())
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors


class TestLogOutage:
    """Tests for the _log_outage throttle function."""

    def setup_method(self):
        # Reset the module-level timestamp before each test so tests are independent.
        import app.middleware.rate_limit as rl
        rl._last_outage_log = 0.0

    def test_logs_on_first_call(self):
        import app.middleware.rate_limit as rl
        with mock.patch.object(rl.logger, 'error') as mock_err:
            _log_outage(Exception('redis down'))
        mock_err.assert_called_once()

    def test_does_not_log_within_interval(self):
        import app.middleware.rate_limit as rl
        import time as _time
        with mock.patch.object(rl.logger, 'error') as mock_err:
            _log_outage(Exception('first'))
            _log_outage(Exception('second'))  # called immediately after — within interval
        assert mock_err.call_count == 1

    def test_logs_again_after_interval_passes(self):
        import app.middleware.rate_limit as rl
        with mock.patch.object(rl.logger, 'error') as mock_err:
            # Simulate interval already elapsed by backdating _last_outage_log.
            rl._last_outage_log = 0.0  # far in the past
            _log_outage(Exception('first'))
            assert mock_err.call_count == 1
            # Backdate again so the second call appears after the interval.
            rl._last_outage_log = 0.0
            _log_outage(Exception('second'))
            assert mock_err.call_count == 2

    def test_log_message_includes_max_requests(self):
        import app.middleware.rate_limit as rl
        with mock.patch.object(rl.logger, 'error') as mock_err:
            _log_outage(Exception('boom'))
        args = mock_err.call_args[0]
        # The format string should reference MAX_REQUESTS_PER_WINDOW and WINDOW_SECONDS.
        assert MAX_REQUESTS_PER_WINDOW in args
        assert WINDOW_SECONDS in args

    def test_outage_log_interval_constant_is_positive(self):
        assert _OUTAGE_LOG_INTERVAL_SECONDS > 0
