"""Sliding-window rate limiter (Redis ZSET) for the heavy AI generation and
competitor-analysis endpoints, protecting them from brute-force/DoS spikes.
"""
import os
import time

import redis
from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

RATE_LIMITED_PREFIXES = ("/api/v1/videos/generate", "/api/v1/analytics/competitor-scan")
WINDOW_SECONDS = 60
MAX_REQUESTS_PER_WINDOW = 15


class SlidingWindowRateLimiterMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if not any(path.startswith(prefix) for prefix in RATE_LIMITED_PREFIXES):
            return await call_next(request)

        client_id = request.headers.get("X-API-Key") or (request.client.host if request.client else "unknown")
        now = time.time()
        redis_key = f"ratelimit:{client_id}:{path}"

        pipe = redis_client.pipeline()
        pipe.zremrangebyscore(redis_key, 0, now - WINDOW_SECONDS)
        pipe.zcard(redis_key)
        pipe.zadd(redis_key, {str(now): now})
        pipe.expire(redis_key, WINDOW_SECONDS)
        _, request_count, _, _ = pipe.execute()

        if request_count >= MAX_REQUESTS_PER_WINDOW:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {MAX_REQUESTS_PER_WINDOW} requests per minute.",
            )

        return await call_next(request)
