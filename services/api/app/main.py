"""FastAPI application assembly for the ViralVision platform service.

Run locally with `uvicorn app.main:app --reload` from `services/api/`
(after installing `requirements.txt` and setting the env vars documented
in `services/api/README.md`).
"""
from fastapi import FastAPI
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
