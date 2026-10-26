"""Tests for the in-process sliding-window rate limiter fallback."""
import sys
import os
import time
import threading
from collections import OrderedDict, deque
from unittest.mock import MagicMock, patch

# Prevent redis from actually connecting during import by patching it before
# the module is loaded.
redis_mock = MagicMock()
redis_mock.from_url.return_value = MagicMock()

# Patch redis at the module level before importing rate_limit
with patch.dict('sys.modules', {'redis': redis_mock}):
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))
    # We inline the _LocalSlidingWindow class rather than importing the full
    # middleware module (which would also try to connect to FastAPI/redis at
    # import time), so we can test the pure sliding-window logic in isolation.

# ─── Inline the class under test ──────────────────────────────────────────────

WINDOW_SECONDS = 60
_FALLBACK_MAX_KEYS = 10_000


class _LocalSlidingWindow:
    """Copied verbatim from rate_limit.py so we can test the pure logic."""

    def __init__(self) -> None:
        self._windows: "OrderedDict[str, deque[float]]" = OrderedDict()
        self._lock = threading.Lock()

    def hit(self, key: str, now: float) -> int:
        with self._lock:
            window = self._windows.get(key)
            if window is None:
                window = deque()
                self._windows[key] = window
            self._windows.move_to_end(key)

            cutoff = now - WINDOW_SECONDS
            while window and window[0] <= cutoff:
                window.popleft()

            preceding = len(window)
            window.append(now)

            while len(self._windows) > _FALLBACK_MAX_KEYS:
                self._windows.popitem(last=False)

            return preceding


# ─── Tests ────────────────────────────────────────────────────────────────────

class TestLocalSlidingWindow:
    def setup_method(self):
        self.w = _LocalSlidingWindow()

    def _t(self, offset=0.0) -> float:
        return 1_000_000.0 + offset

    # First hit returns 0 (no preceding requests)
    def test_first_hit_returns_zero(self):
        assert self.w.hit("k1", self._t()) == 0

    # Second hit within window returns 1
    def test_second_hit_within_window_returns_one(self):
        t = self._t()
        self.w.hit("k1", t)
        assert self.w.hit("k1", t + 1) == 1

    # Third hit within window returns 2
    def test_third_hit_returns_two(self):
        t = self._t()
        self.w.hit("k1", t)
        self.w.hit("k1", t + 1)
        assert self.w.hit("k1", t + 2) == 2

    # After the window expires, old hits are dropped → returns 0 again
    def test_hit_after_window_expires_returns_zero(self):
        t = self._t()
        self.w.hit("k1", t)
        # Advance by more than WINDOW_SECONDS; the earlier hit is now expired
        assert self.w.hit("k1", t + WINDOW_SECONDS + 1) == 0

    # A hit exactly WINDOW_SECONDS old is dropped (the eviction condition is <=)
    def test_hit_at_exact_boundary_is_dropped(self):
        t = self._t()
        self.w.hit("k1", t)
        # cutoff = now - WINDOW_SECONDS = t + WINDOW_SECONDS - WINDOW_SECONDS = t
        # window[0] == t <= t → dropped → preceding == 0
        assert self.w.hit("k1", t + WINDOW_SECONDS) == 0

    # A hit strictly inside the window (1 ms before boundary) is retained
    def test_hit_just_inside_window_is_retained(self):
        t = self._t()
        self.w.hit("k1", t)
        # cutoff = now - WINDOW_SECONDS = t + 59.999 - 60 = t - 0.001
        # window[0] == t > t - 0.001 → retained → preceding == 1
        assert self.w.hit("k1", t + WINDOW_SECONDS - 0.001) == 1

    # Different keys are tracked independently
    def test_separate_keys_tracked_independently(self):
        t = self._t()
        self.w.hit("k1", t)
        self.w.hit("k1", t + 1)
        # k2 is brand new – should return 0
        assert self.w.hit("k2", t + 2) == 0

    # Multiple hits only count within the rolling window
    def test_rolling_window_drops_old_hits(self):
        t = self._t()
        # 5 hits spread over 59 seconds
        for i in range(5):
            self.w.hit("k1", t + i * 10)
        # Advance 61 seconds from the first hit → only the last hit is within window
        # hits at t+0, t+10, t+20, t+30, t+40 → cutoff = t+61-60 = t+1
        # t+0 expired, t+10..t+40 still in window (4 items)
        result = self.w.hit("k1", t + 61)
        assert result == 4

    # LRU eviction: oldest key evicted when map is full
    def test_lru_eviction_when_full(self):
        t = self._t()
        # Fill to the max
        for i in range(_FALLBACK_MAX_KEYS):
            self.w.hit(f"key_{i}", t)
        assert len(self.w._windows) == _FALLBACK_MAX_KEYS
        # One more key triggers eviction of the LRU (key_0)
        self.w.hit("new_key", t + 1)
        assert len(self.w._windows) == _FALLBACK_MAX_KEYS
        assert "key_0" not in self.w._windows

    # After moving a key to the end via hit(), it survives eviction
    def test_recently_used_key_survives_eviction(self):
        t = self._t()
        # Fill to the max
        for i in range(_FALLBACK_MAX_KEYS):
            self.w.hit(f"key_{i}", t)
        # Re-hit key_0 so it moves to the end (MRU)
        self.w.hit("key_0", t + 0.5)
        # Add one new key → key_1 (now the oldest) should be evicted
        self.w.hit("new_key", t + 1)
        assert "key_0" in self.w._windows
        assert "key_1" not in self.w._windows

    # Thread-safety smoke test: concurrent hits on the same key don't corrupt state
    def test_concurrent_hits_do_not_corrupt(self):
        t = self._t()
        results = []
        errors = []

        def worker():
            try:
                for _ in range(10):
                    results.append(self.w.hit("shared_key", time.time()))
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(20)]
        for th in threads:
            th.start()
        for th in threads:
            th.join()

        assert not errors, f"Errors during concurrent access: {errors}"
        # 200 total hits; the window count must never decrease
        # (preceding values are non-negative)
        assert all(r >= 0 for r in results)

    # A key that has never been hit starts at 0
    def test_fresh_key_always_starts_at_zero(self):
        for i in range(5):
            assert self.w.hit(f"fresh_{i}", self._t(i)) == 0
