"""Sliding-window rate limiter (Redis ZSET) for the heavy AI generation and
competitor-analysis endpoints, protecting them from brute-force/DoS spikes.
"""
import logging
import os
import threading
import time
from collections import OrderedDict, deque

import redis
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

RATE_LIMITED_PREFIXES = ("/api/v1/videos/generate", "/api/v1/analytics/competitor-scan")
WINDOW_SECONDS = 60
MAX_REQUESTS_PER_WINDOW = 15

# Cap on distinct keys tracked by the in-process fallback. The limiter is
# keyed partly on caller-controlled input (X-API-Key), so an unbounded map
# would be a memory-exhaustion vector precisely when Redis -- the thing that
# would normally bound it -- is already down.
_FALLBACK_MAX_KEYS = 10_000

# How often to log that the fallback is in use. One line per dropped request
# would bury the outage in its own noise.
_OUTAGE_LOG_INTERVAL_SECONDS = 30


class _LocalSlidingWindow:
    """Per-process sliding window used while Redis is unreachable.

    This is deliberately not a silent no-op. Rate limiting is a protective
    control: dropping it the moment its backing store hiccups leaves the
    expensive endpoints wide open during exactly the kind of incident that
    tends to take Redis down in the first place.

    It is weaker than the Redis limiter -- each process keeps its own
    counts, so the effective limit across N replicas is N times the
    configured one -- but N times the limit is a bound, and no limit is not.
    """

    def __init__(self) -> None:
        self._windows: "OrderedDict[str, deque[float]]" = OrderedDict()
        self._lock = threading.Lock()

    def hit(self, key: str, now: float) -> int:
        """Records a request and returns how many preceded it in the window."""
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

            # Evict the least recently used keys, dropping any that have
            # gone idle first so active callers keep their counts.
            while len(self._windows) > _FALLBACK_MAX_KEYS:
                self._windows.popitem(last=False)

            return preceding


_local_limiter = _LocalSlidingWindow()
_last_outage_log = 0.0
_outage_log_lock = threading.Lock()


def _log_outage(exc: Exception) -> None:
    global _last_outage_log
    now = time.monotonic()
    with _outage_log_lock:
        if now - _last_outage_log < _OUTAGE_LOG_INTERVAL_SECONDS:
            return
        _last_outage_log = now
    logger.error(
        "Redis unavailable (%s); rate limiting has fallen back to per-process "
        "counters, so the effective limit is now %d requests/%ds per replica "
        "rather than per cluster.",
        exc,
        MAX_REQUESTS_PER_WINDOW,
        WINDOW_SECONDS,
    )


class SlidingWindowRateLimiterMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if not any(path.startswith(prefix) for prefix in RATE_LIMITED_PREFIXES):
            return await call_next(request)

        client_id = request.headers.get("X-API-Key") or (request.client.host if request.client else "unknown")
        now = time.time()
        redis_key = f"ratelimit:{client_id}:{path}"
        degraded = False

        try:
            pipe = redis_client.pipeline()
            pipe.zremrangebyscore(redis_key, 0, now - WINDOW_SECONDS)
            pipe.zcard(redis_key)
            pipe.zadd(redis_key, {str(now): now})
            pipe.expire(redis_key, WINDOW_SECONDS)
            _, request_count, _, _ = pipe.execute()
        except redis.RedisError as exc:
            # Keep enforcing a limit rather than failing open. Raising here
            # would also be wrong: it turns every Redis blip into a 500 on
            # the generation endpoints before auth even runs.
            _log_outage(exc)
            request_count = _local_limiter.hit(redis_key, now)
            degraded = True

        if request_count >= MAX_REQUESTS_PER_WINDOW:
            # Returned, not raised: HTTPException raised inside BaseHTTPMiddleware
            # escapes the exception handlers and surfaces as a 500.
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded. Maximum {MAX_REQUESTS_PER_WINDOW} requests per minute."
                },
                headers={
                    "Retry-After": str(WINDOW_SECONDS),
                    # Tells an operator reading a 429 whether it came from the
                    # cluster-wide limiter or the degraded per-process one.
                    "X-RateLimit-Mode": "local-fallback" if degraded else "redis",
                },
            )

        response = await call_next(request)
        if degraded:
            response.headers["X-RateLimit-Mode"] = "local-fallback"
        return response
