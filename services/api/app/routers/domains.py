"""Custom domain management: bind/unbind a white-label domain to a
workspace, report cert-manager SSL status, and resolve a hostname to a
tenant for the Next.js edge middleware's fallback lookup.
"""
import logging
import os

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import RoleChecker
from app.core.database import get_db
from app.core.models import User, Workspace, WorkspaceRole
from app.k8s_controller import CustomDomainController, NAMESPACE, redis_client

logger = logging.getLogger("domain_controller")
router = APIRouter(prefix="/api/v1/workspace", tags=["Custom Domains & SSL"])


class DomainBindPayload(BaseModel):
    custom_domain: str


@router.post("/domain/bind", status_code=status.HTTP_200_OK)
def bind_domain(
    payload: DomainBindPayload,
    current_user: User = Depends(RoleChecker(WorkspaceRole.ADMIN)),
    db: Session = Depends(get_db),
):
    ws = db.query(Workspace).filter(Workspace.id == current_user.workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    domain = payload.custom_domain.strip().lower()
    if not CustomDomainController.verify_dns_cname(domain):
        raise HTTPException(
            status_code=400,
            detail=f"DNS CNAME record not detected. Point {domain} at {CustomDomainController.PLATFORM_CNAME_TARGET}.",
        )

    if not CustomDomainController.provision_tenant_ssl_and_ingress(ws.id, domain):
        raise HTTPException(status_code=500, detail="Failed to initiate SSL provisioning in cluster")

    ws.custom_domain = domain
    db.commit()
    return {"status": "provisioning", "domain": domain}


@router.get("/domain/status")
def get_domain_ssl_status(
    current_user: User = Depends(RoleChecker(WorkspaceRole.ADMIN)),
    db: Session = Depends(get_db),
):
    ws = db.query(Workspace).filter(Workspace.id == current_user.workspace_id).first()
    if not ws or not ws.custom_domain:
        return {"configured": False}

    domain = ws.custom_domain
    resource_name = f"tenant-{ws.id[:8]}-{domain.replace('.', '-')}"
    dns_verified = CustomDomainController.verify_dns_cname(domain)

    try:
        from app.k8s_controller import _clients

        _, custom_objects_api = _clients()
        cert = custom_objects_api.get_namespaced_custom_object(
            group="cert-manager.io", version="v1", namespace=NAMESPACE, plural="certificates", name=resource_name
        )
        conditions = cert.get("status", {}).get("conditions", [])
        ssl_ready = any(c.get("type") == "Ready" and c.get("status") == "True" for c in conditions)
    except Exception:
        conditions, ssl_ready = [], False

    return {
        "configured": True,
        "domain": domain,
        "dns_verified": dns_verified,
        "ssl_ready": ssl_ready,
        "conditions": conditions,
    }


@router.delete("/domain/unbind", status_code=status.HTTP_200_OK)
def unbind_custom_domain(
    current_user: User = Depends(RoleChecker(WorkspaceRole.ADMIN)),
    db: Session = Depends(get_db),
):
    ws = db.query(Workspace).filter(Workspace.id == current_user.workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    domain = ws.custom_domain
    if not domain:
        return {"status": "noop", "message": "No custom domain currently configured for this workspace"}

    try:
        CustomDomainController.revoke_custom_domain(workspace_id=ws.id, custom_domain=domain)
    except Exception as exc:  # noqa: BLE001 - cluster cleanup best-effort, still clear DB state below
        logger.error("Cluster teardown error for %s: %s", domain, exc)

    ws.custom_domain = None
    db.commit()
    return {"status": "success", "unbound_domain": domain}


@router.get("/resolve-domain")
def resolve_tenant_by_hostname(
    host: str = Query(..., description="Apex domain or subdomain hostname"),
    x_edge_auth_secret: str = Header(None),
    db: Session = Depends(get_db),
):
    """Internal lookup the Next.js edge middleware calls when its Redis
    cache is cold. Protected by a shared secret, not user auth."""
    expected_secret = os.getenv("EDGE_INTERNAL_SECRET")
    if not expected_secret or x_edge_auth_secret != expected_secret:
        raise HTTPException(status_code=401, detail="Unauthorized edge caller")

    clean_host = host.strip().lower().split(":")[0]
    workspace = (
        db.query(Workspace)
        .filter((Workspace.custom_domain == clean_host) | (Workspace.slug == clean_host))
        .first()
    )
    if not workspace:
        raise HTTPException(status_code=404, detail=f"Host '{clean_host}' is not bound to any active workspace")

    return {
        "tenantId": workspace.id,
        "slug": workspace.slug,
        "customDomain": workspace.custom_domain,
        "tier": workspace.tier,
        "status": "active",
    }
