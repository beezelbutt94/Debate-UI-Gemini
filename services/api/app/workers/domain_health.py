"""Periodic custom-domain DNS/SSL health probe.

Verifies every workspace's custom-domain CNAME still points at the
platform edge and how many days remain on its TLS certificate, publishing
both as Prometheus gauges. `k8s/monitoring/prometheus-rules-domains.yaml`
alerts on the metrics this produces.
"""
import os
import socket
import ssl
from datetime import datetime, timezone

import dns.resolver

from app.core.database import SessionLocal
from app.core.models import Workspace
from app.core.telemetry import DOMAIN_DNS_STATUS, DOMAIN_PROBE_ERRORS, DOMAIN_SSL_EXPIRY_DAYS
from app.workers.celery_app import celery_app

PLATFORM_CNAME_TARGET = os.getenv("PLATFORM_CNAME_TARGET", "cname.viraltrending.online")


def verify_cname_target(hostname: str) -> bool:
    resolver = dns.resolver.Resolver()
    resolver.nameservers = ["1.1.1.1", "8.8.8.8"]
    resolver.timeout = 3.0
    resolver.lifetime = 5.0
    try:
        answers = resolver.resolve(hostname, "CNAME")
        return any(str(r.target).rstrip(".") == PLATFORM_CNAME_TARGET for r in answers)
    except Exception:
        return False


def get_ssl_expiry_days(hostname: str, port: int = 443, timeout: float = 5.0) -> float:
    context = ssl.create_default_context()
    # create_default_context() leaves the floor at whatever OpenSSL was
    # built with, which still permits TLS 1.0/1.1 on older images. Both are
    # deprecated (RFC 8996); pin 1.2 so a downgrade cannot be negotiated
    # while we are reading a certificate we are about to trust.
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    with socket.create_connection((hostname, port), timeout=timeout) as sock:
        with context.wrap_socket(sock, server_hostname=hostname) as ssock:
            cert = ssock.getpeercert()
            expiry = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
            return max(0.0, (expiry - datetime.now(timezone.utc)).total_seconds() / 86400.0)


@celery_app.task(name="domains.audit_custom_domains")
def audit_custom_domains() -> None:
    db = SessionLocal()
    try:
        workspaces = db.query(Workspace).filter(Workspace.custom_domain.isnot(None)).all()
        for ws in workspaces:
            domain = ws.custom_domain.strip().lower()
            dns_valid = verify_cname_target(domain)
            DOMAIN_DNS_STATUS.labels(workspace_id=ws.id, domain=domain).set(1 if dns_valid else 0)

            if not dns_valid:
                DOMAIN_SSL_EXPIRY_DAYS.labels(workspace_id=ws.id, domain=domain).set(0)
                continue

            try:
                days_left = get_ssl_expiry_days(domain)
                DOMAIN_SSL_EXPIRY_DAYS.labels(workspace_id=ws.id, domain=domain).set(days_left)
            except ssl.SSLError:
                DOMAIN_PROBE_ERRORS.labels(workspace_id=ws.id, domain=domain, error_type="ssl_error").inc()
                DOMAIN_SSL_EXPIRY_DAYS.labels(workspace_id=ws.id, domain=domain).set(0)
            except Exception:
                DOMAIN_PROBE_ERRORS.labels(workspace_id=ws.id, domain=domain, error_type="connection_timeout").inc()
    finally:
        db.close()


celery_app.conf.beat_schedule = {
    **(celery_app.conf.beat_schedule or {}),
    "audit-custom-domains-hourly": {
        "task": "domains.audit_custom_domains",
        "schedule": 3600.0,
        "options": {"queue": "standard_jobs"},
    },
}
