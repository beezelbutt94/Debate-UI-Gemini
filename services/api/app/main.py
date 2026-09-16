"""FastAPI application assembly for the ViralVision platform service.

Run locally with `uvicorn app.main:app --reload` from `services/api/`
(after installing `requirements.txt` and setting the env vars documented
in `services/api/README.md`).
"""
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from app.middleware.rate_limit import SlidingWindowRateLimiterMiddleware
from app.routers import (
    ab_testing,
    analytics,
    billing,
    collaborations,
    domains,
    events,
    integrations,
    marketplace,
    reviews,
    social,
    storage,
    trends,
    videos,
)

app = FastAPI(title="ViralVision Platform API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to the deployed web origin(s) before shipping
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SlidingWindowRateLimiterMiddleware)

for router in (
    billing.router,
    domains.router,
    videos.router,
    marketplace.router,
    marketplace.creator_router,
    integrations.router,
    reviews.router,
    collaborations.router,
    collaborations.mentorship_router,
    trends.router,
    analytics.router,
    ab_testing.router,
    storage.router,
    events.router,
    social.router,
):
    app.include_router(router)


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/healthz/llm")
async def healthz_llm():
    """Whether local inference is actually usable right now.

    Separate from /healthz on purpose: the API serves plenty of routes that
    never touch the model, so a missing model should not mark the whole
    service unhealthy and pull it out of rotation. Returns 503 so a probe
    scoped to the generation workers can still fail on it.
    """
    from app.core.llm import healthcheck

    result = await healthcheck()
    return JSONResponse(result, status_code=200 if result.get("ok") else 503)


@app.get("/healthz/tts")
def healthz_tts():
    """Whether local speech synthesis is usable right now."""
    from app.core.tts import healthcheck as tts_healthcheck

    result = tts_healthcheck()
    return JSONResponse(result, status_code=200 if result.get("ok") else 503)
