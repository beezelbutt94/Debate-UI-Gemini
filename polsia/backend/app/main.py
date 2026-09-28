"""FastAPI entrypoint: REST API, webhooks and the live WebSocket feed."""

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app import events
from app.config import settings
from app.db import init_db
from app.routers import business, sre, swarm, webhooks
from app.security import operator_token_ok

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    relay = asyncio.create_task(events.relay_redis_to_local())
    yield
    relay.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await relay


app = FastAPI(title="Polsia Autonomous OS", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(swarm.router)
app.include_router(business.router)
app.include_router(sre.ci)
app.include_router(sre.ops)
app.include_router(webhooks.router)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "time": datetime.now(UTC).isoformat(),
        "llm_mode": settings.LLM_MODE,
        "sandbox_mode": settings.SANDBOX_MODE,
        "broker": "redis" if settings.REDIS_URL else "inline",
    }


@app.websocket("/ws/live")
async def live_feed(websocket: WebSocket, token: str | None = None) -> None:
    if not operator_token_ok(token):
        await websocket.close(code=4401)
        return
    await websocket.accept()
    loop, queue = events.subscribe()
    try:
        await websocket.send_json({"event": "CONNECTED", "ts": datetime.now(UTC).isoformat()})
        while True:
            try:
                message = await asyncio.wait_for(queue.get(), timeout=25)
            except TimeoutError:
                # Keep proxies from idling the socket out.
                await websocket.send_json({"event": "PING"})
                continue
            await websocket.send_text(message)
    except WebSocketDisconnect:
        pass
    finally:
        events.unsubscribe(loop, queue)
