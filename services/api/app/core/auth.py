"""API-key authentication and workspace role authorization.

The design docs reference `get_current_user` / `RoleChecker` from dozens of
routers but never spelled out a shared implementation -- each router simply
assumed one existed. This is that shared implementation: a straightforward
`X-API-Key` lookup plus a role-gate dependency factory, matching the
`APIKeyHeader` pattern used in the video-generation gateway.
"""
from fastapi import Depends, HTTPException, Security, status
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.models import User, WorkspaceRole

_API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

_ROLE_RANK = {
    WorkspaceRole.GUEST: 0,
    WorkspaceRole.VIEWER: 1,
    WorkspaceRole.EDITOR: 2,
    WorkspaceRole.ADMIN: 3,
    WorkspaceRole.OWNER: 4,
}


def get_current_user(
    api_key: str = Security(_API_KEY_HEADER),
    db: Session = Depends(get_db),
) -> User:
    if not api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing API key")

    user = db.query(User).filter(User.api_key == api_key, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

    return user


class RoleChecker:
    """Dependency factory gating an endpoint to a minimum workspace role."""

    def __init__(self, minimum_role: WorkspaceRole):
        self.minimum_role = minimum_role

    def __call__(self, user: User = Depends(get_current_user)) -> User:
        if _ROLE_RANK.get(user.role, -1) < _ROLE_RANK[self.minimum_role]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires '{self.minimum_role.value}' role or higher",
            )
        return user
