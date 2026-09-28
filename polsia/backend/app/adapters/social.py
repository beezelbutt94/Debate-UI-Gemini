"""X (Twitter) thread publishing via the v2 API with a user-context OAuth 2.0 token."""

import uuid
from typing import Any

import httpx

from app.config import settings

MAX_POST_CHARS = 280


def post_thread(posts: list[str]) -> dict[str, Any]:
    posts = [p.strip() for p in posts if p and p.strip()]
    if not posts:
        raise ValueError("Thread has no posts")
    too_long = [i for i, p in enumerate(posts) if len(p) > MAX_POST_CHARS]
    if too_long:
        raise ValueError(f"Posts {too_long} exceed {MAX_POST_CHARS} characters")

    if settings.SANDBOX_MODE:
        return {"status": "simulated", "post_ids": [f"sandbox-{uuid.uuid4().hex[:8]}" for _ in posts]}
    if not settings.X_USER_ACCESS_TOKEN:
        raise RuntimeError("X_USER_ACCESS_TOKEN is required when SANDBOX_MODE is off")

    ids: list[str] = []
    with httpx.Client(headers={"Authorization": f"Bearer {settings.X_USER_ACCESS_TOKEN}"}, timeout=15) as client:
        for text in posts:
            body: dict[str, Any] = {"text": text}
            if ids:
                body["reply"] = {"in_reply_to_tweet_id": ids[-1]}
            resp = client.post("https://api.x.com/2/tweets", json=body)
            resp.raise_for_status()
            ids.append(resp.json()["data"]["id"])
    return {"status": "posted", "post_ids": ids}
