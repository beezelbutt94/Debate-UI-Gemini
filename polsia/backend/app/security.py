"""Request authentication for operator endpoints, CI callbacks and webhooks."""

import hmac

from fastapi import Header, HTTPException, status

from app.config import settings


def require_operator(authorization: str | None = Header(default=None)) -> None:
    """Operator endpoints are open only while OPERATOR_TOKEN is unset (local dev)."""
    if not settings.OPERATOR_TOKEN:
        return
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(token, settings.OPERATOR_TOKEN):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Operator token required")


def operator_token_ok(token: str | None) -> bool:
    # Browsers can't set headers on a WebSocket handshake, so the feed passes ?token=.
    return not settings.OPERATOR_TOKEN or (token is not None and hmac.compare_digest(token, settings.OPERATOR_TOKEN))


def require_deployment_secret(x_deployment_secret: str | None = Header(default=None)) -> None:
    if not settings.DEPLOYMENT_SECRET:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "DEPLOYMENT_SECRET is not configured")
    if not x_deployment_secret or not hmac.compare_digest(x_deployment_secret, settings.DEPLOYMENT_SECRET):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid deployment secret")


def webhook_secret(name: str, value: str) -> str | None:
    """Return the secret to verify with, None to skip (sandbox only), or refuse."""
    if value:
        return value
    if settings.SANDBOX_MODE:
        return None
    raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"{name} is not configured")
