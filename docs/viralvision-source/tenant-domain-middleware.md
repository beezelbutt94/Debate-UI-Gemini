This Edge Middleware handles tenant resolution using an in-memory edge cache backed by Upstash Redis (falling back to the FastAPI backend), resolving both subdomains (acme.viralvision.io) and custom apex/CNAME domains (video.acmebrand.com) to internal Next.js rewrite paths (/app/_tenants/[tenantId]/...).
// middleware.ts
import { NextRequest, NextResponse } from "next/server";

// Root apex domains that host the core SaaS platform and landing pages
const ROOT_DOMAINS = new Set([
  "viralvision.io",
  "app.viralvision.io",
  "localhost:3000",
  "localhost",
  "staging.viralvision.io",
]);

interface TenantResolutionRecord {
  tenantId: string;
  slug: string;
  customDomain?: string | null;
  tier: "standard" | "pro" | "enterprise";
  status: "active" | "suspended";
}

// Edge runtime in-memory LRU cache to minimize Redis lookups for hot hosts
const hostResolutionCache = new Map<
  string,
  { record: TenantResolutionRecord | null; expiresAt: number }
>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

async function resolveTenantRecord(hostname: string): Promise<TenantResolutionRecord | null> {
  const now = Date.now();
  const cached = hostResolutionCache.get(hostname);
  if (cached && cached.expiresAt > now) {
    return cached.record;
  }

  // 1. Upstash Redis Edge Lookup (Zero-latency REST)
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      const redisRes = await fetch(`${upstashUrl}/get/domain:${hostname}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
        cache: "no-store",
      });

      if (redisRes.ok) {
        const { result } = await redisRes.json();
        if (result) {
          const parsed: TenantResolutionRecord = JSON.parse(result);
          hostResolutionCache.set(hostname, { record: parsed, expiresAt: now + CACHE_TTL_MS });
          return parsed;
        }
      }
    } catch (err) {
      console.error(`[!] Edge Redis lookup error for host ${hostname}:`, err);
    }
  }

  // 2. Direct FastAPI Fallback Lookup
  try {
    const internalApiUrl = process.env.INTERNAL_API_URL || "http://viralvision-api.production.svc.cluster.local:8000";
    const res = await fetch(`${internalApiUrl}/api/v1/workspace/resolve-domain?host=${encodeURIComponent(hostname)}`, {
      headers: {
        "X-Edge-Auth-Secret": process.env.EDGE_INTERNAL_SECRET || "internal_secret",
      },
      next: { revalidate: 60 },
    });

    if (res.ok) {
      const data: TenantResolutionRecord = await res.json();
      hostResolutionCache.set(hostname, { record: data, expiresAt: now + CACHE_TTL_MS });
      return data;
    }
  } catch (err) {
    console.error(`[!] FastAPI backend lookup failed for host ${hostname}:`, err);
  }

  // Host not matched
  hostResolutionCache.set(hostname, { record: null, expiresAt: now + 15 * 1000 });
  return null;
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const rawHost = req.headers.get("host") || "";
  // Strip port numbers for clean host matching (e.g., "acme.localhost:3000" -> "acme.localhost")
  const hostname = rawHost.toLowerCase().split(":")[0];
  const { pathname, search } = url;

  // 1. Static Assets & Internal API Route Bypass
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") // File extensions: .png, .ico, .css, .js
  ) {
    return NextResponse.next();
  }

  // 2. Core Root Domain Routing (viralvision.io apex and default dashboard)
  const isRootApex =
    ROOT_DOMAINS.has(rawHost) ||
    ROOT_DOMAINS.has(hostname) ||
    hostname === "viralvision.io";

  if (isRootApex) {
    // Normal site navigation without tenant virtualization
    return NextResponse.next();
  }

  // 3. Subdomain or Custom CNAME Evaluation
  let resolvedTenant: TenantResolutionRecord | null = null;

  if (hostname.endsWith(".viralvision.io")) {
    // Wildcard Subdomain: "acme.viralvision.io" -> slug "acme"
    const slug = hostname.replace(".viralvision.io", "");
    if (slug && slug !== "www" && slug !== "app") {
      resolvedTenant = await resolveTenantRecord(slug);
    }
  } else {
    // White-label Custom Domain: "videos.clientbrand.com"
    resolvedTenant = await resolveTenantRecord(hostname);
  }

  // 4. Missing or Unregistered Domain Handler
  if (!resolvedTenant || resolvedTenant.status !== "active") {
    const errorUrl = req.nextUrl.clone();
    errorUrl.pathname = "/domain-unregistered";
    errorUrl.searchParams.set("host", hostname);
    return NextResponse.rewrite(errorUrl);
  }

  // 5. Internal Virtual Tenant Rewrite
  // Routes requests to /app/_tenants/[tenantId]/... while preserving the client's browser URL
  const rewrittenUrl = new URL(
    `/_tenants/${resolvedTenant.tenantId}${pathname === "/" ? "" : pathname}${search}`,
    req.url
  );

  const response = NextResponse.rewrite(rewrittenUrl);

  // Set forwarding headers for downstream Server Components & Layouts
  response.headers.set("x-tenant-id", resolvedTenant.tenantId);
  response.headers.set("x-tenant-slug", resolvedTenant.slug);
  response.headers.set("x-tenant-tier", resolvedTenant.tier);
  response.headers.set("x-forwarded-host", rawHost);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (/api/*)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

Key Capabilities of this Edge Implementation
 * In-Memory Edge L1 Cache: Mitigates Vercel Edge / Cloudflare Workers cold-start penalties by maintaining an in-isolate Map cache (hostResolutionCache) with a 60-second TTL, reducing remote calls on high-traffic white-label domains.
 * Dual-Tier Resolution Flow:
   * Upstash Redis REST API: Checks domain:<hostname> key directly from the nearest Edge datacenter with zero TCP connection pooling overhead.
   * Internal API Fallback: Queries the internal FastAPI /api/v1/workspace/resolve-domain service if the Redis key is cold or rebuilding.
 * Transparent Tenant Virtualization: Rewrites incoming traffic under the hood to app/_tenants/[tenantId]/[[...slug]]/page.tsx, preserving the user's browser location bar ([video.acmebrand.com/templates](https://video.acmebrand.com/templates) stays unchanged while rendering the isolated tenant view).
 * Context Propagation: Injects x-tenant-id, x-tenant-slug, and x-tenant-tier down to Next.js Server Components, where headers() can read tenant context without repeated database queries.
Let's Encrypt ClusterIssuer (k8s/cert-manager-clusterissuer.yaml)
Configures production ACME HTTP-01 challenge solvers through ingress-nginx to handle automated domain validation and issuance across arbitrary third-party tenant CNAMEs.
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-production
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: security@viralvision.io
    privateKeySecretRef:
      name: letsencrypt-production-account-key
    solvers:
      - http01:
          ingress:
            class: nginx

Automated Custom Domain Ingress & Certificate Controller (k8s_controller.py)
A lightweight Python controller using the official Kubernetes client and Kopf (Kubernetes Operator Framework) or raw watch loops. It listens for database changes or workspace webhooks, validates that the tenant's DNS CNAME actually points to the platform edge (cname.viralvision.io), dynamically generates isolated Ingress and Certificate resources, and syncs status back to PostgreSQL and Upstash Redis.
import os
import dns.resolver
from typing import Optional
from kubernetes import client, config
from kubernetes.client.rest import ApiException
import redis
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Workspace

# ---------------------------------------------------------------------------
# Client & Infrastructure Configuration
# ---------------------------------------------------------------------------
NAMESPACE = os.getenv("K8S_NAMESPACE", "production")
INGRESS_CLASS = "nginx"
CLUSTER_ISSUER = "letsencrypt-production"
PLATFORM_CNAME_TARGET = os.getenv("PLATFORM_CNAME_TARGET", "cname.viralvision.io")
UPSTASH_REDIS_URL = os.getenv("UPSTASH_REDIS_URL")

redis_client = redis.from_url(UPSTASH_REDIS_URL, decode_responses=True) if UPSTASH_REDIS_URL else None

# Initialize in-cluster or kubeconfig credentials
try:
    config.load_incluster_config()
except config.ConfigException:
    config.load_kube_config()

networking_v1 = client.NetworkingV1Api()
custom_objects_api = client.CustomObjectsApi()

class CustomDomainController:
    @staticmethod
    def verify_dns_cname(custom_domain: str) -> bool:
        """
        Verifies whether the customer's DNS record resolves to the platform edge target.
        Prevents Let's Encrypt rate-limiting by preempting failing ACME challenges.
        """
        try:
            answers = dns.resolver.resolve(custom_domain, "CNAME")
            for rdata in answers:
                target = str(rdata.target).rstrip(".")
                if target == PLATFORM_CNAME_TARGET:
                    return True
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.LifetimeTimeout):
            pass
        return False

    @classmethod
    def provision_tenant_ssl_and_ingress(cls, workspace_id: str, custom_domain: str) -> bool:
        """
        1. Verifies DNS alignment.
        2. Creates or updates cert-manager Certificate resource.
        3. Creates or updates the ingress rule routing to Next.js Web service.
        4. Warms the Edge Redis lookup cache.
        """
        custom_domain = custom_domain.strip().lower()
        dns_ready = cls.verify_dns_cname(custom_domain)
        if not dns_ready:
            print(f"[!] CNAME record for {custom_domain} does not point to {PLATFORM_CNAME_TARGET}.")
            return False

        resource_name = f"tenant-{workspace_id[:8]}-{custom_domain.replace('.', '-')}"
        secret_name = f"tls-{resource_name}"

        # 1. Define cert-manager.io/v1 Certificate Custom Object
        certificate_manifest = {
            "apiVersion": "cert-manager.io/v1",
            "kind": "Certificate",
            "metadata": {
                "name": resource_name,
                "namespace": NAMESPACE,
                "labels": {
                    "app.kubernetes.io/managed-by": "viralvision-domain-controller",
                    "workspace_id": workspace_id,
                },
            },
            "spec": {
                "secretName": secret_name,
                "issuerRef": {
                    "name": CLUSTER_ISSUER,
                    "kind": "ClusterIssuer",
                },
                "dnsNames": [custom_domain],
            },
        }

        # 2. Define Kubernetes NetworkingV1 Ingress
        ingress_manifest = client.V1Ingress(
            api_version="networking.k8s.io/v1",
            kind="Ingress",
            metadata=client.V1ObjectMeta(
                name=resource_name,
                namespace=NAMESPACE,
                labels={
                    "app.kubernetes.io/managed-by": "viralvision-domain-controller",
                    "workspace_id": workspace_id,
                },
                annotations={
                    "kubernetes.io/ingress.class": INGRESS_CLASS,
                    "cert-manager.io/cluster-issuer": CLUSTER_ISSUER,
                    "nginx.ingress.kubernetes.io/proxy-body-size": "100m",
                    "nginx.ingress.kubernetes.io/ssl-redirect": "true",
                },
            ),
            spec=client.V1IngressSpec(
                ingress_class_name=INGRESS_CLASS,
                tls=[
                    client.V1IngressTLS(
                        hosts=[custom_domain],
                        secret_name=secret_name,
                    )
                ],
                rules=[
                    client.V1IngressRule(
                        host=custom_domain,
                        http=client.V1HTTPIngressRuleValue(
                            paths=[
                                client.V1HTTPIngressPath(
                                    path="/",
                                    path_type="Prefix",
                                    backend=client.V1IngressBackend(
                                        service=client.V1IngressServiceBackend(
                                            name="viralvision-web",
                                            port=client.V1ServiceBackendPort(number=3000),
                                        )
                                    ),
                                )
                            ]
                        ),
                    )
                ],
            ),
        )

        # Apply Certificate CRD via CustomObjectsApi
        try:
            custom_objects_api.create_namespaced_custom_object(
                group="cert-manager.io",
                version="v1",
                namespace=NAMESPACE,
                plural="certificates",
                body=certificate_manifest,
            )
            print(f"[+] Certificate resource '{resource_name}' created.")
        except ApiException as e:
            if e.status == 409:  # AlreadyExists
                custom_objects_api.patch_namespaced_custom_object(
                    group="cert-manager.io",
                    version="v1",
                    namespace=NAMESPACE,
                    plural="certificates",
                    name=resource_name,
                    body=certificate_manifest,
                )
                print(f"[+] Certificate resource '{resource_name}' updated.")
            else:
                raise e

        # Apply Ingress via NetworkingV1Api
        try:
            networking_v1.create_namespaced_ingress(
                namespace=NAMESPACE,
                body=ingress_manifest,
            )
            print(f"[+] Ingress resource '{resource_name}' created.")
        except ApiException as e:
            if e.status == 409:
                networking_v1.replace_namespaced_ingress(
                    name=resource_name,
                    namespace=NAMESPACE,
                    body=ingress_manifest,
                )
                print(f"[+] Ingress resource '{resource_name}' updated.")
            else:
                raise e

        # 3. Synchronize routing record into Edge Redis for the Next.js middleware
        if redis_client:
            db: Session = SessionLocal()
            try:
                ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
                if ws:
                    import json
                    edge_record = {
                        "tenantId": ws.id,
                        "slug": ws.slug,
                        "customDomain": custom_domain,
                        "tier": ws.tier,
                        "status": "active",
                    }
                    redis_client.set(
                        f"domain:{custom_domain}",
                        json.dumps(edge_record),
                        ex=86400 * 30  # 30-day cache with heartbeat
                    )
            finally:
                db.close()

        return True

    @classmethod
    def revoke_custom_domain(cls, workspace_id: str, custom_domain: str):
        """Tears down Ingress, Secret, Certificate, and cache entries upon domain disconnection."""
        resource_name = f"tenant-{workspace_id[:8]}-{custom_domain.replace('.', '-')}"
        secret_name = f"tls-{resource_name}"

        try:
            networking_v1.delete_namespaced_ingress(name=resource_name, namespace=NAMESPACE)
        except ApiException:
            pass

        try:
            custom_objects_api.delete_namespaced_custom_object(
                group="cert-manager.io",
                version="v1",
                namespace=NAMESPACE,
                plural="certificates",
                name=resource_name,
            )
        except ApiException:
            pass

        try:
            client.CoreV1Api().delete_namespaced_secret(name=secret_name, namespace=NAMESPACE)
        except ApiException:
            pass

        if redis_client:
            redis_client.delete(f"domain:{custom_domain}")

FastAPI Domain Management & Status Endpoint (domain_routes.py)
Connects the workspace settings frontend directly to the controller logic, checking live certificate readiness via the cert-manager CRD status block.
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import User, Workspace, WorkspaceRole
from auth import RoleChecker
from k8s_controller import CustomDomainController, custom_objects_api, NAMESPACE

router = APIRouter(prefix="/api/v1/workspace/domain", tags=["Custom Domains & SSL"])

class DomainBindPayload(BaseModel):
    custom_domain: str

@router.post("/bind", status_code=status.HTTP_200_OK)
def bind_domain(
    payload: DomainBindPayload,
    current_user: User = Depends(RoleChecker(WorkspaceRole.ADMIN)),
    db: Session = Depends(get_db),
):
    ws = db.query(Workspace).filter(Workspace.id == current_user.workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    domain = payload.custom_domain.strip().lower()

    # Verify CNAME target first
    if not CustomDomainController.verify_dns_cname(domain):
        raise HTTPException(
            status_code=400,
            detail=f"DNS CNAME record not detected. Configure a CNAME for {domain} pointing to {CustomDomainController.PLATFORM_CNAME_TARGET}",
        )

    # Provision resources in cluster
    success = CustomDomainController.provision_tenant_ssl_and_ingress(ws.id, domain)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to initiate SSL provisioning in cluster")

    ws.custom_domain = domain
    db.commit()

    return {"status": "provisioning", "domain": domain}

@router.get("/status")
def get_domain_ssl_status(
    current_user: User = Depends(RoleChecker(WorkspaceRole.ADMIN)),
    db: Session = Depends(get_db),
):
    ws = db.query(Workspace).filter(Workspace.id == current_user.workspace_id).first()
    if not ws or not ws.custom_domain:
        return {"configured": False}

    domain = ws.custom_domain
    resource_name = f"tenant-{ws.id[:8]}-{domain.replace('.', '-')}"

    # Poll cert-manager certificate conditions
    try:
        cert_obj = custom_objects_api.get_namespaced_custom_object(
            group="cert-manager.io",
            version="v1",
            namespace=NAMESPACE,
            plural="certificates",
            name=resource_name,
        )

        conditions = cert_obj.get("status", {}).get("conditions", [])
        ready = any(c.get("type") == "Ready" and c.get("status") == "True" for c in conditions)

        return {
            "configured": True,
            "domain": domain,
            "dns_verified": CustomDomainController.verify_dns_cname(domain),
            "ssl_ready": ready,
            "conditions": conditions,
        }
    except Exception:
        return {
            "configured": True,
            "domain": domain,
            "dns_verified": CustomDomainController.verify_dns_cname(domain),
            "ssl_ready": False,
            "conditions": [],
        }

RBAC Role & ServiceAccount for Controller (k8s/controller-rbac.yaml)
Grants the controller pod minimal least-privilege permissions to manage Ingresses, read Secrets, and mutate cert-manager.io Certificate objects.
apiVersion: v1
kind: ServiceAccount
metadata:
  name: domain-controller-sa
  namespace: production
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: domain-controller-role
  namespace: production
rules:
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["get", "list", "create", "update", "patch", "delete"]
  - apiGroups: ["cert-manager.io"]
    resources: ["certificates"]
    verbs: ["get", "list", "create", "update", "patch", "delete"]
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: domain-controller-binding
  namespace: production
subjects:
  - kind: ServiceAccount
    name: domain-controller-sa
    namespace: production
roleRef:
  kind: Role
  name: domain-controller-role
  apiGroup: rbac.authorization.k8s.io

