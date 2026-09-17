"""FastAPI application assembly for the ViralVision platform service.

Run locally with `uvicorn app.main:app --reload` from `services/api/`
(after installing `requirements.txt` and setting the env vars documented
in `services/api/README.md`).
"""
import logging
import os

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

# Browser origins allowed to call this API. Comma-separated, exact matches
# only -- scheme, host and port all count, and a trailing slash does not
# belong in an origin.
#
#   CORS_ALLOWED_ORIGINS=https://viraltrending.online,https://app.viraltrending.online
#
# Starlette compares `allow_origins` entries as whole strings. A "*" inside
# one of them is a literal asterisk, not a wildcard: "https://*.example.com"
# matches nothing, and the preflight for https://shop.example.com comes back
# 400 "Disallowed CORS origin". Subdomain patterns belong in
# CORS_ALLOWED_ORIGIN_REGEX, which Starlette does apply as a regex:
#
#   CORS_ALLOWED_ORIGIN_REGEX=https://[a-z0-9-]+\.godaddysites\.com
#
# Anchor such a pattern to the end (Starlette uses re.fullmatch) and escape
# the dots, or "https://evil.com/x.godaddysites.com" slips through.
_raw_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip().rstrip("/") for o in _raw_origins.split(",") if o.strip()]
ALLOWED_ORIGIN_REGEX = os.getenv("CORS_ALLOWED_ORIGIN_REGEX") or None

# Failing closed is right for a deployed API, but an empty list is also what
# you get by forgetting the variable -- and the symptom is a browser console
# CORS error on the *client*, with nothing at all in the server log to explain
# it. Say so once at startup instead.
if not ALLOWED_ORIGINS and not ALLOWED_ORIGIN_REGEX:
    logging.getLogger("uvicorn.error").warning(
        "CORS_ALLOWED_ORIGINS and CORS_ALLOWED_ORIGIN_REGEX are both unset, so "
        "every cross-origin browser request to this API will be refused with "
        "400 'Disallowed CORS origin'. Set CORS_ALLOWED_ORIGINS to the web "
        "origin(s) that call it, e.g. http://localhost:3000 in development. "
        "Server-to-server callers are unaffected -- CORS is a browser rule."
    )

# No credentials: this API authenticates with an X-API-Key header, never with
# cookies, so the browser never needs to send credentials cross-origin.
# Keeping this False also removes the footgun where allow_credentials=True
# turns a permissive origin list into a session-stealing primitive.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=False,
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
