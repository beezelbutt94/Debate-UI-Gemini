"""Live event bus behind the dashboard feed.

Publishing always fans out to in-process subscribers (the API's WebSocket
handlers). When REDIS_URL is set it also goes to the `polsia:events` channel,
which is how events raised inside Celery worker processes reach the API.
"""

import asyncio
import json
import logging
import threading
from datetime import UTC, datetime
from typing import Any

from app.config import settings

logger = logging.getLogger("polsia.events")

CHANNEL = "polsia:events"

_lock = threading.Lock()
_subscribers: set[tuple[asyncio.AbstractEventLoop, asyncio.Queue[str]]] = set()
_redis_client = None


def _redis():
    global _redis_client
    if _redis_client is None and settings.REDIS_URL:
        import redis

        _redis_client = redis.Redis.from_url(settings.REDIS_URL)
    return _redis_client


def publish(event: str, **data: Any) -> None:
    message = json.dumps(
        {"event": event, "ts": datetime.now(UTC).isoformat(), **data},
        default=str,
    )
    client = _redis()
    if client is not None:
        try:
            client.publish(CHANNEL, message)
            # With Redis configured the API's relay re-delivers this message to
            # local subscribers, so fanning out here too would duplicate it.
            return
        except Exception:
            logger.exception("Redis publish failed; delivering in-process only")
    deliver_local(message)


def deliver_local(message: str) -> None:
    with _lock:
        subscribers = list(_subscribers)
    for loop, queue in subscribers:
        try:
            loop.call_soon_threadsafe(queue.put_nowait, message)
        except RuntimeError:  # loop already closed
            unsubscribe(loop, queue)


def subscribe() -> tuple[asyncio.AbstractEventLoop, asyncio.Queue[str]]:
    entry = (asyncio.get_running_loop(), asyncio.Queue(maxsize=1000))
    with _lock:
        _subscribers.add(entry)
    return entry


def unsubscribe(loop: asyncio.AbstractEventLoop, queue: asyncio.Queue[str]) -> None:
    with _lock:
        _subscribers.discard((loop, queue))


async def relay_redis_to_local() -> None:
    """Runs inside the API process: forwards the Redis channel to local sockets."""
    if not settings.REDIS_URL:
        return
    import redis.asyncio as aioredis

    while True:
        try:
            client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            pubsub = client.pubsub()
            await pubsub.subscribe(CHANNEL)
            async for message in pubsub.listen():
                if message.get("type") == "message":
                    deliver_local(message["data"])
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Redis relay dropped; reconnecting in 2s")
            await asyncio.sleep(2)
