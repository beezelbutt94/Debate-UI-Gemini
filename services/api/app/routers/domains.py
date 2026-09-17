"""Custom domain management: bind/unbind a white-label domain to a
workspace, report cert-manager SSL status, and resolve a hostname to a
tenant for the Next.js edge middleware's fallback lookup.
"""
import logging
import os

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from kubernetes.client.exceptions import ApiException
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

    # "We asked and the cert isn't ready" and "we couldn't ask" are different
    # answers. Collapsing both into ssl_ready=False tells the customer their
    # certificate is still pending when the real problem is that this service
    # can't reach the cluster -- so they wait instead of escalating, and the
    # outage stays invisible.
    ssl_error: str | None = None
    try:
        from app.k8s_controller import _clients

        _, custom_objects_api = _clients()
        cert = custom_objects_api.get_namespaced_custom_object(
            group="cert-manager.io", version="v1", namespace=NAMESPACE, plural="certificates", name=resource_name
        )
        conditions = cert.get("status", {}).get("conditions", [])
        ssl_ready = any(c.get("type") == "Ready" and c.get("status") == "True" for c in conditions)
        ssl_state = "ready" if ssl_ready else "provisioning"
    except ApiException as exc:
        conditions, ssl_ready = [], False
        if exc.status == 404:
            # The cluster answered: no Certificate resource for this domain.
            # Provisioning never started (or was torn down) -- actionable,
            # and distinct from an unreachable cluster.
            ssl_state = "not_provisioned"
            ssl_error = "No certificate resource exists for this domain. Re-bind the domain to start provisioning."
            logger.warning("No Certificate %s found for domain %s", resource_name, domain)
        else:
            ssl_state = "unknown"
            ssl_error = f"cert-manager query failed ({exc.status})."
            logger.error("cert-manager query failed for %s: %s", domain, exc)
    except Exception as exc:  # noqa: BLE001 - kube client raises a wide range on config/network failure
        conditions, ssl_ready = [], False
        ssl_state = "unknown"
        ssl_error = "Could not reach the cluster to check certificate status."
        logger.error("Cluster unreachable while checking SSL for %s: %s", domain, exc)

    return {
        "configured": True,
        "domain": domain,
        "dns_verified": dns_verified,
        # Retained for existing clients; `ssl_state` is what new callers
        # should branch on, because ssl_ready=False is ambiguous on its own.
        "ssl_ready": ssl_ready,
        "ssl_state": ssl_state,
        "ssl_error": ssl_error,
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

    # The DB unbind happens either way -- leaving the workspace pointed at a
    # domain the customer asked to remove is worse than an orphaned cluster
    # resource. But reporting "success" when the Ingress and Certificate are
    # still live means nobody ever cleans them up, and the old domain keeps
    # serving the tenant.
    teardown_error: str | None = None
    try:
        CustomDomainController.revoke_custom_domain(workspace_id=ws.id, custom_domain=domain)
    except Exception as exc:  # noqa: BLE001 - kube client raises a wide range on config/network failure
        teardown_error = str(exc)
        logger.error(
            "ORPHANED CLUSTER RESOURCES: unbound %s from workspace %s in the database but "
            "cert-manager/ingress teardown failed and must be cleaned up manually: %s",
            domain, ws.id, exc,
        )

    ws.custom_domain = None
    db.commit()

    if teardown_error:
        # The caller is told *that* cleanup failed and what it means, but not
        # the raw exception: kube client errors carry API-server hostnames,
        # namespaces and config details that a tenant has no business seeing.
        # The full text is in the ORPHANED CLUSTER RESOURCES log line above,
        # which is where an operator will look anyway.
        return {
            "status": "partial",
            "unbound_domain": domain,
            "detail": (
                "The domain was unbound from this workspace, but its cluster resources "
                "could not be removed and may still serve traffic. This needs operator cleanup."
            ),
        }

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
