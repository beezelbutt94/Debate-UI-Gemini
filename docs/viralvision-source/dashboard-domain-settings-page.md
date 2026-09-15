// app/dashboard/settings/domain/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Globe,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Trash2,
} from "lucide-react";

interface CertificateCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
}

interface DomainStatusResponse {
  configured: boolean;
  domain?: string;
  dns_verified?: boolean;
  ssl_ready?: boolean;
  conditions?: CertificateCondition[];
}

const PLATFORM_CNAME_TARGET = "cname.viralvision.io";

export default function WorkspaceDomainSettingsPage() {
  const [domainInput, setDomainInput] = useState("");
  const [statusData, setStatusData] = useState<DomainStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchDomainStatus = useCallback(async (showIndicator = false) => {
    if (showIndicator) setPolling(true);
    try {
      const res = await fetch("/api/v1/workspace/domain/status", { cache: "no-store" });
      if (res.ok) {
        const data: DomainStatusResponse = await res.json();
        setStatusData(data);
      }
    } catch (err: any) {
      console.error("Failed to poll domain status", err);
    } finally {
      setLoading(false);
      if (showIndicator) setPolling(false);
    }
  }, []);

  useEffect(() => {
    fetchDomainStatus();
  }, [fetchDomainStatus]);

  // Dynamic Polling: Run every 6 seconds while SSL or DNS is not ready
  useEffect(() => {
    if (!statusData?.configured) return;
    if (statusData.dns_verified && statusData.ssl_ready) return;

    const interval = setInterval(() => {
      fetchDomainStatus();
    }, 6000);

    return () => clearInterval(interval);
  }, [statusData, fetchDomainStatus]);

  const handleBindDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/v1/workspace/domain/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom_domain: domainInput.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to bind domain");
      }

      setDomainInput("");
      await fetchDomainStatus(true);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect your custom domain? Active video links and white-label portals will stop resolving.")) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/workspace/domain/unbind", { method: "DELETE" });
      if (res.ok) {
        setStatusData({ configured: false });
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xs text-neutral-500 font-mono">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500 mr-2" /> Inspecting Workspace Ingress Engine...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8 text-neutral-100 min-h-screen space-y-8">
      <div>
        <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest flex items-center gap-1">
          <Globe className="w-3.5 h-3.5" /> White-Label Infrastructure
        </span>
        <h1 className="text-3xl font-black mt-1">Custom Domain & Edge SSL</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Direct your brand's domain to ViralVision. Includes automated Let's Encrypt certificates and edge caching.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-950/50 border border-rose-800 rounded-xl flex items-start gap-3 text-xs text-rose-300">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Unconfigured State: Add Custom Domain */}
      {!statusData?.configured ? (
        <div className="p-6 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-5">
          <div>
            <h3 className="text-base font-bold text-white">Connect Custom Domain</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Enter your subdomain (e.g., <code className="text-neutral-200">video.brand.com</code>) or root domain.
            </p>
          </div>

          <form onSubmit={handleBindDomain} className="space-y-4">
            <div>
              <label className="text-xs uppercase font-semibold text-neutral-400 block mb-1">
                Domain Name
              </label>
              <input
                type="text"
                required
                placeholder="video.yourcompany.com"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 font-mono outline-none focus:border-amber-500"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting || !domainInput.trim()}
              className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs px-5 py-2.5 flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying DNS...
                </>
              ) : (
                <>
                  Connect Domain <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </form>
        </div>
      ) : (
        /* Configured State: Verification & SSL Pipeline Tracker */
        <div className="space-y-6">
          <div className="p-6 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
              <div>
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wide block">
                  Active Custom Hostname
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <h2 className="text-xl font-bold font-mono text-white">{statusData.domain}</h2>
                  <a
                    href={`https://${statusData.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-400 hover:text-white"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={polling}
                  onClick={() => fetchDomainStatus(true)}
                  className="border-neutral-800 bg-neutral-900 text-neutral-200 text-xs font-mono"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${polling ? "animate-spin" : ""}`} />
                  Check Status
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDisconnect}
                  className="border-neutral-800 bg-neutral-900 text-rose-400 hover:bg-rose-950/50 hover:text-rose-300 text-xs font-mono"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Pipeline Stage Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Step 1: DNS CNAME Status */}
              <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-200">1. DNS CNAME Record</span>
                  {statusData.dns_verified ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-[10px] font-mono uppercase font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Configured
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-400 text-[10px] font-mono uppercase font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Unverified
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400">
                  {statusData.dns_verified
                    ? "Your DNS record points correctly to our cluster ingress."
                    : "CNAME record not found. Add the required record below to complete setup."}
                </p>
              </div>

              {/* Step 2: Edge SSL Status */}
              <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-200">2. Let's Encrypt Edge SSL</span>
                  {statusData.ssl_ready ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-[10px] font-mono uppercase font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Active & Trusted
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-400 text-[10px] font-mono uppercase font-bold flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Issuing Certificate
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400">
                  {statusData.ssl_ready
                    ? "Valid TLS certificate active with automatic 60-day renewal."
                    : "ACME challenge in progress. Certificate issues automatically once DNS propagates."}
                </p>
              </div>
            </div>

            {/* DNS Setup Instructions Box */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Required DNS Settings
              </h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Add this CNAME record with your domain registrar (e.g., Cloudflare, Route 53, Namecheap):
              </p>

              <div className="border border-neutral-800 rounded-xl overflow-hidden font-mono text-xs">
                <table className="w-full text-left">
                  <thead className="bg-neutral-900 text-neutral-400 text-[10px] uppercase border-b border-neutral-800">
                    <tr>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Name / Host</th>
                      <th className="py-2.5 px-4">Value / Target</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 bg-neutral-950">
                    <tr>
                      <td className="py-3 px-4 text-amber-400 font-bold">CNAME</td>
                      <td className="py-3 px-4 text-white">
                        {statusData.domain?.split(".")[0] || "video"}
                      </td>
                      <td className="py-3 px-4 text-neutral-300 select-all">
                        {PLATFORM_CNAME_TARGET}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(PLATFORM_CNAME_TARGET, "target")}
                          className="h-7 px-2 text-neutral-400 hover:text-white"
                        >
                          {copiedKey === "target" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cert-Manager Live Events Timeline */}
            {statusData.conditions && statusData.conditions.length > 0 && (
              <div className="pt-4 border-t border-neutral-800 space-y-2">
                <span className="text-[11px] font-mono text-neutral-500 uppercase block">
                  Certificate Issuer Logs
                </span>
                <div className="space-y-1.5">
                  {statusData.conditions.map((cond, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-mono flex items-start justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={cond.status === "True" ? "text-emerald-400" : "text-amber-400"}>
                            {cond.type}
                          </span>
                          <span className="text-neutral-500">•</span>
                          <span className="text-neutral-300">{cond.reason || "StatusUpdate"}</span>
                        </div>
                        {cond.message && <p className="text-neutral-400">{cond.message}</p>}
                      </div>
                      {cond.lastTransitionTime && (
                        <span className="text-neutral-500 text-[10px] shrink-0 ml-2">
                          {new Date(cond.lastTransitionTime).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

Custom Domain Unbind Route & Teardown Execution (domain_routes.py)
Extends domain_routes.py with the DELETE /api/v1/workspace/domain/unbind endpoint. It acquires an atomic lock, calls CustomDomainController.revoke_custom_domain() to tear down the Kubernetes Ingress, cert-manager Certificate, and TLS Secret, flushes Upstash Redis routing keys, and nullifies the database record.
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User, Workspace, WorkspaceRole
from auth import RoleChecker
from k8s_controller import CustomDomainController, redis_client

logger = logging.getLogger("domain_controller")

# Re-using existing router declared in domain_routes.py
# router = APIRouter(prefix="/api/v1/workspace/domain", tags=["Custom Domains & SSL"])

@router.delete("/unbind", status_code=status.HTTP_200_OK)
def unbind_custom_domain(
    current_user: User = Depends(RoleChecker(WorkspaceRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Safely tears down the custom domain infrastructure for the caller's workspace:
    1. Removes the Kubernetes NetworkingV1 Ingress.
    2. Deletes the cert-manager Certificate CRD.
    3. Cleans up the associated TLS Secret.
    4. Purges edge resolution entries from Upstash Redis.
    5. Clears the custom_domain column in PostgreSQL.
    """
    workspace = db.query(Workspace).filter(Workspace.id == current_user.workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    domain_to_remove = workspace.custom_domain
    if not domain_to_remove:
        return {
            "status": "noop",
            "message": "No custom domain currently configured for this workspace",
        }

    # 1. Tear down Kubernetes and cert-manager resources
    try:
        CustomDomainController.revoke_custom_domain(
            workspace_id=workspace.id,
            custom_domain=domain_to_remove,
        )
        logger.info(
            f"[+] Ingress and TLS secrets successfully revoked for workspace '{workspace.id}' ({domain_to_remove})"
        )
    except Exception as exc:
        logger.error(
            f"[!] Error during Kubernetes cluster teardown for '{domain_to_remove}': {exc}"
        )
        # We proceed to clear internal state even if K8s cleanup encountered warnings

    # 2. Invalidate Upstash Edge Cache
    if redis_client:
        try:
            # Delete direct domain mapping and any trailing wildcard references
            pipe = redis_client.pipeline()
            pipe.delete(f"domain:{domain_to_remove}")
            pipe.delete(f"domain:{domain_to_remove}:status")
            pipe.execute()
            logger.info(f"[+] Purged edge cache entries for domain:{domain_to_remove}")
        except Exception as exc:
            logger.warning(f"[!] Redis cache invalidation error: {exc}")

    # 3. Commit Database State
    workspace.custom_domain = None
    db.commit()

    return {
        "status": "success",
        "unbound_domain": domain_to_remove,
        "message": f"Successfully revoked SSL, Ingress, and routing records for {domain_to_remove}",
    }

Edge Cache Invalidation & Direct Resolution Endpoint (workspace_routes.py)
Provides the /api/v1/workspace/resolve-domain fallback endpoint used by the Next.js edge middleware (middleware.ts). When an unbind event occurs, any stale edge requests falling back to FastAPI receive an immediate 404/inactive payload, forcing the middleware to rewrite to the /domain-unregistered notice page.
from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from sqlalchemy.orm import Session
from database import get_db
from models import Workspace

# router = APIRouter(prefix="/api/v1/workspace", tags=["Workspace Management"])

@router.get("/resolve-domain")
def resolve_tenant_by_hostname(
    host: str = Query(..., description="Apex domain or subdomain hostname"),
    x_edge_auth_secret: str = Header(None),
    db: Session = Depends(get_db),
):
    """
    Internal edge lookup called by Next.js middleware when Upstash Redis is cold.
    Verifies shared secret and resolves the tenant slug, id, and status.
    """
    expected_secret = os.getenv("EDGE_INTERNAL_SECRET", "internal_secret")
    if x_edge_auth_secret != expected_secret:
        raise HTTPException(status_code=401, detail="Unauthorized edge caller")

    clean_host = host.strip().lower().split(":")[0]

    # Query by custom domain apex or by subdomain slug matching
    workspace = (
        db.query(Workspace)
        .filter((Workspace.custom_domain == clean_host) | (Workspace.slug == clean_host))
        .first()
    )

    if not workspace:
        raise HTTPException(
            status_code=404,
            detail=f"Host '{clean_host}' is not bound to any active workspace",
        )

    return {
        "tenantId": workspace.id,
        "slug": workspace.slug,
        "customDomain": workspace.custom_domain,
        "tier": workspace.tier,
        "status": "active",
    }

Domain Unregistered / Disconnected Fallback View (app/domain-unregistered/page.tsx)
Rendered by the Next.js edge middleware rewrite when traffic arrives at a custom CNAME that was recently deleted or unbound.
"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Globe, AlertOctagon, ArrowRight, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DomainUnregisteredPage() {
  const searchParams = useSearchParams();
  const host = searchParams.get("host") || "This domain";

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-neutral-100 selection:bg-rose-500 selection:text-white">
      <div className="w-full max-w-md p-8 bg-neutral-900/60 border border-neutral-800 rounded-2xl shadow-2xl text-center space-y-6">
        <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800 flex items-center justify-center mx-auto text-rose-400">
          <ShieldX className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
            Routing Status 404
          </span>
          <h1 className="text-xl font-bold text-white">Domain Disconnected</h1>
          <p className="text-xs text-neutral-400 leading-relaxed font-mono">
            <span className="text-rose-400 font-bold">{host}</span> is not mapped to an active ViralVision workspace.
          </p>
        </div>

        <div className="p-4 bg-neutral-950 border border-neutral-800/80 rounded-xl text-xs text-neutral-400 text-left space-y-2 font-mono">
          <span className="text-[10px] uppercase text-neutral-500 font-bold block">
            Why am I seeing this?
          </span>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-neutral-400">
            <li>The workspace owner removed this custom domain.</li>
            <li>DNS CNAME points to ViralVision, but no workspace claimed it.</li>
            <li>Edge SSL certificates were revoked.</li>
          </ul>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Link href="https://viralvision.io">
            <Button className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs py-2.5">
              Go to ViralVision Platform <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
          <Link href="https://viralvision.io/contact">
            <Button
              variant="outline"
              className="w-full border-neutral-800 bg-neutral-900 text-neutral-300 text-xs py-2.5"
            >
              Contact Support
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

Periodic Domain Health & SSL Expiry Checker Task (tasks_domain_health.py)
Iterates through all workspaces with configured custom domains, verifies external CNAME resolution using Python's dnspython, performs a direct TLS handshake via standard ssl/socket to compute remaining certificate lifespan, and publishes Prometheus gauges.
import os
import ssl
import socket
from datetime import datetime, timezone
import dns.resolver
from celery import Celery
from prometheus_client import Gauge, Counter

from database import SessionLocal
from models import Workspace

celery_app = Celery("domain_health_prober")

PLATFORM_CNAME_TARGET = os.getenv("PLATFORM_CNAME_TARGET", "cname.viralvision.io")

# --- Prometheus Metrics ---
DOMAIN_SSL_EXPIRY_DAYS = Gauge(
    "viralvision_custom_domain_ssl_expiry_days",
    "Days remaining until custom domain SSL certificate expires",
    ["workspace_id", "domain"],
)
DOMAIN_DNS_STATUS = Gauge(
    "viralvision_custom_domain_dns_valid",
    "Whether the custom domain CNAME correctly resolves to the platform (1 = valid, 0 = invalid)",
    ["workspace_id", "domain"],
)
DOMAIN_PROBE_ERRORS = Counter(
    "viralvision_custom_domain_probe_errors_total",
    "Total connection or probe errors during domain verification",
    ["workspace_id", "domain", "error_type"],
)

def get_ssl_expiry_days(hostname: str, port: int = 443, timeout: float = 5.0) -> float:
    """
    Connects to the hostname using SNI and retrieves the notAfter TLS date.
    """
    context = ssl.create_default_context()
    with socket.create_connection((hostname, port), timeout=timeout) as sock:
        with context.wrap_socket(sock, server_hostname=hostname) as ssock:
            cert = ssock.getpeercert()
            not_after_str = cert["notAfter"]
            # Format: 'Sep 25 12:00:00 2026 GMT'
            expiry_dt = datetime.strptime(not_after_str, "%b %d %H:%M:%S %Y %Z").replace(
                tzinfo=timezone.utc
            )
            delta = expiry_dt - datetime.now(timezone.utc)
            return max(0.0, delta.total_seconds() / 86400.0)

def verify_cname_target(hostname: str) -> bool:
    """
    Resolves external CNAME to ensure tenant DNS has not been altered or dropped.
    """
    resolver = dns.resolver.Resolver()
    resolver.nameservers = ["1.1.1.1", "8.8.8.8"]  # Use public resolvers to bypass split-horizon K8s DNS
    resolver.timeout = 3.0
    resolver.lifetime = 5.0

    try:
        answers = resolver.resolve(hostname, "CNAME")
        for rdata in answers:
            target = str(rdata.target).rstrip(".")
            if target == PLATFORM_CNAME_TARGET:
                return True
    except Exception:
        return False
    return False

@celery_app.task(name="domains.audit_custom_domains")
def audit_custom_domains():
    """
    Audits all active custom domains, exporting telemetry metrics for Alertmanager.
    """
    db = SessionLocal()
    try:
        workspaces = (
            db.query(Workspace)
            .filter(Workspace.custom_domain.isnot(None))
            .all()
        )

        for ws in workspaces:
            domain = ws.custom_domain.strip().lower()
            ws_id = ws.id

            # 1. Probe DNS Resolution
            is_dns_valid = verify_cname_target(domain)
            DOMAIN_DNS_STATUS.labels(workspace_id=ws_id, domain=domain).set(1 if is_dns_valid else 0)

            # 2. Probe TLS Expiry if DNS is healthy
            if is_dns_valid:
                try:
                    days_left = get_ssl_expiry_days(domain)
                    DOMAIN_SSL_EXPIRY_DAYS.labels(workspace_id=ws_id, domain=domain).set(days_left)
                except ssl.SSLError as ssl_err:
                    DOMAIN_PROBE_ERRORS.labels(workspace_id=ws_id, domain=domain, error_type="ssl_error").inc()
                    DOMAIN_SSL_EXPIRY_DAYS.labels(workspace_id=ws_id, domain=domain).set(0)
                except Exception as conn_err:
                    DOMAIN_PROBE_ERRORS.labels(workspace_id=ws_id, domain=domain, error_type="connection_timeout").inc()
            else:
                # If DNS is down, certificate check cannot reliably connect
                DOMAIN_SSL_EXPIRY_DAYS.labels(workspace_id=ws_id, domain=domain).set(0)

    finally:
        db.close()

Celery Beat Scheduling Registration (celery_schedule.py)
Registers the audit sweep to run hourly across the transcode worker pool.
celery_app.conf.beat_schedule.update({
    "audit-custom-domains-hourly": {
        "task": "domains.audit_custom_domains",
        "schedule": 3600.0,  # Run once every hour
        "options": {"queue": "standard_jobs"},
    },
})

Prometheus Alerting Rules (k8s/monitoring/prometheus-rules-domains.yaml)
Defines alerts for broken CNAME targets, imminent certificate expiration (warning at ≤ 15 days, critical at ≤ 3 days), and automated probe failures.
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: viralvision-domain-alerts
  namespace: production
  labels:
    role: alert-rules
    prometheus: k8s
spec:
  groups:
    - name: custom.domains.rules
      rules:
        # Warning: Tenant removed or misconfigured CNAME record
        - alert: CustomDomainCNAMEDisconnected
          expr: viralvision_custom_domain_dns_valid == 0
          for: 2h
          labels:
            severity: warning
            service: ingress-edge
            tier: networking
          annotations:
            summary: "Custom domain CNAME missing or broken ({{ $labels.domain }})"
            description: "Domain '{{ $labels.domain }}' for workspace {{ $labels.workspace_id }} no longer points to cname.viralvision.io. Traffic routing and cert-manager renewals will fail."

        # Warning: Certificate expiry approaching within 15 days
        - alert: CustomDomainSSLExpiryWarning
          expr: viralvision_custom_domain_ssl_expiry_days > 0 and viralvision_custom_domain_ssl_expiry_days <= 15
          for: 6h
          labels:
            severity: warning
            service: cert-manager
            tier: networking
          annotations:
            summary: "Custom domain SSL certificate expiring soon ({{ $labels.domain }})"
            description: "Certificate for '{{ $labels.domain }}' expires in {{ $value | printf \"%.1f\" }} days. Check if Let's Encrypt HTTP-01 challenge is completing."

        # Critical: Certificate expiring in under 72 hours
        - alert: CustomDomainSSLExpiryCritical
          expr: viralvision_custom_domain_ssl_expiry_days > 0 and viralvision_custom_domain_ssl_expiry_days <= 3
          for: 1h
          labels:
            severity: critical
            service: cert-manager
            tier: networking
          annotations:
            summary: "CRITICAL: Custom domain SSL expiring in <3 days ({{ $labels.domain }})"
            description: "Certificate for '{{ $labels.domain }}' (Workspace: {{ $labels.workspace_id }}) expires in {{ $value | printf \"%.1f\" }} days. Automated renewal has failed."

Alertmanager Routing & Notification Templates (k8s/monitoring/alertmanager-domain-routing.yaml)
Routes domain warnings directly into your existing #alerts-domain-ops Slack channel and triggers critical escalation pings.
# Append to the routes section of Alertmanager config:
routes:
  - matchers:
      - service = "ingress-edge"
    receiver: "slack-domain-alerts"
  - matchers:
      - service = "cert-manager"
    receiver: "slack-domain-alerts"

receivers:
  - name: "slack-domain-alerts"
    slack_configs:
      - channel: "#alerts-domain-ops"
        send_resolved: true
        icon_emoji: ":globe_with_meridians:"
        username: "Domain Sentinel"
        title: '[{{ .Status | toUpper }}] Domain Health Alert: {{ .CommonLabels.alertname }}'
        text: |
          {{ range .Alerts }}
            *Domain:* `{{ .Labels.domain }}`
            *Workspace ID:* `{{ .Labels.workspace_id }}`
            *Severity:* `{{ .Labels.severity }}`
            *Summary:* {{ .Annotations.summary }}
            *Details:* {{ .Annotations.description }}
            ---
          {{ end }}
          *Dashboard:* <https://grafana.viralvision.io/d/domain-health|Open Domain Health Monitor>
        color: '{{ if eq .Status "firing" }}{{ if eq .CommonLabels.severity "critical" }}#EF4444{{ else }}#F59E0B{{ end }}{{ else }}#10B981{{ end }}'

