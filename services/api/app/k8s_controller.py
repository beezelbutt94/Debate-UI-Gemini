"""Custom-domain SSL/ingress controller: verifies a tenant's DNS CNAME
points at the platform edge, then creates/updates the matching
cert-manager `Certificate` and Kubernetes `Ingress`, and warms the edge
Redis cache the Next.js middleware reads from.

Requires a real Kubernetes cluster with cert-manager installed; importing
this module outside a cluster (e.g. local dev) will fail at
`config.load_kube_config()` unless a kubeconfig is present.
"""
import json
import logging
import os

import dns.resolver
import redis
from kubernetes import client, config
from kubernetes.client.rest import ApiException

from app.core.database import SessionLocal
from app.core.models import Workspace

logger = logging.getLogger("k8s_controller")

NAMESPACE = os.getenv("K8S_NAMESPACE", "production")
INGRESS_CLASS = "nginx"
CLUSTER_ISSUER = "letsencrypt-production"
PLATFORM_CNAME_TARGET = os.getenv("PLATFORM_CNAME_TARGET", "cname.viraltrending.online")
UPSTASH_REDIS_URL = os.getenv("UPSTASH_REDIS_URL")

redis_client = redis.from_url(UPSTASH_REDIS_URL, decode_responses=True) if UPSTASH_REDIS_URL else None

_networking_v1 = None
_custom_objects_api = None


def _clients():
    """Lazily initializes Kubernetes API clients on first real use, so
    importing this module doesn't require in-cluster or kubeconfig
    credentials to exist."""
    global _networking_v1, _custom_objects_api
    if _networking_v1 is None:
        try:
            config.load_incluster_config()
        except config.ConfigException:
            config.load_kube_config()
        _networking_v1 = client.NetworkingV1Api()
        _custom_objects_api = client.CustomObjectsApi()
    return _networking_v1, _custom_objects_api


class CustomDomainController:
    PLATFORM_CNAME_TARGET = PLATFORM_CNAME_TARGET

    @staticmethod
    def verify_dns_cname(custom_domain: str) -> bool:
        try:
            answers = dns.resolver.resolve(custom_domain, "CNAME")
            return any(str(r.target).rstrip(".") == PLATFORM_CNAME_TARGET for r in answers)
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.LifetimeTimeout):
            return False

    @classmethod
    def provision_tenant_ssl_and_ingress(cls, workspace_id: str, custom_domain: str) -> bool:
        custom_domain = custom_domain.strip().lower()
        if not cls.verify_dns_cname(custom_domain):
            logger.warning("CNAME for %s does not point to %s", custom_domain, PLATFORM_CNAME_TARGET)
            return False

        networking_v1, custom_objects_api = _clients()
        resource_name = f"tenant-{workspace_id[:8]}-{custom_domain.replace('.', '-')}"
        secret_name = f"tls-{resource_name}"

        certificate_manifest = {
            "apiVersion": "cert-manager.io/v1",
            "kind": "Certificate",
            "metadata": {
                "name": resource_name,
                "namespace": NAMESPACE,
                "labels": {"app.kubernetes.io/managed-by": "viral-trending-domain-controller", "workspace_id": workspace_id},
            },
            "spec": {
                "secretName": secret_name,
                "issuerRef": {"name": CLUSTER_ISSUER, "kind": "ClusterIssuer"},
                "dnsNames": [custom_domain],
            },
        }

        ingress_manifest = client.V1Ingress(
            api_version="networking.k8s.io/v1",
            kind="Ingress",
            metadata=client.V1ObjectMeta(
                name=resource_name,
                namespace=NAMESPACE,
                labels={"app.kubernetes.io/managed-by": "viral-trending-domain-controller", "workspace_id": workspace_id},
                annotations={
                    "kubernetes.io/ingress.class": INGRESS_CLASS,
                    "cert-manager.io/cluster-issuer": CLUSTER_ISSUER,
                    "nginx.ingress.kubernetes.io/proxy-body-size": "100m",
                    "nginx.ingress.kubernetes.io/ssl-redirect": "true",
                },
            ),
            spec=client.V1IngressSpec(
                ingress_class_name=INGRESS_CLASS,
                tls=[client.V1IngressTLS(hosts=[custom_domain], secret_name=secret_name)],
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
                                            name="viral-trending-web", port=client.V1ServiceBackendPort(number=3000)
                                        )
                                    ),
                                )
                            ]
                        ),
                    )
                ],
            ),
        )

        try:
            custom_objects_api.create_namespaced_custom_object(
                group="cert-manager.io", version="v1", namespace=NAMESPACE, plural="certificates", body=certificate_manifest
            )
        except ApiException as exc:
            if exc.status == 409:
                custom_objects_api.patch_namespaced_custom_object(
                    group="cert-manager.io", version="v1", namespace=NAMESPACE, plural="certificates",
                    name=resource_name, body=certificate_manifest,
                )
            else:
                raise

        try:
            networking_v1.create_namespaced_ingress(namespace=NAMESPACE, body=ingress_manifest)
        except ApiException as exc:
            if exc.status == 409:
                networking_v1.replace_namespaced_ingress(name=resource_name, namespace=NAMESPACE, body=ingress_manifest)
            else:
                raise

        if redis_client:
            db = SessionLocal()
            try:
                ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
                if ws:
                    edge_record = {
                        "tenantId": ws.id,
                        "slug": ws.slug,
                        "customDomain": custom_domain,
                        "tier": ws.tier,
                        "status": "active",
                    }
                    redis_client.set(f"domain:{custom_domain}", json.dumps(edge_record), ex=86400 * 30)
            finally:
                db.close()

        return True

    @classmethod
    def revoke_custom_domain(cls, workspace_id: str, custom_domain: str) -> None:
        networking_v1, custom_objects_api = _clients()
        resource_name = f"tenant-{workspace_id[:8]}-{custom_domain.replace('.', '-')}"
        secret_name = f"tls-{resource_name}"

        for action in (
            lambda: networking_v1.delete_namespaced_ingress(name=resource_name, namespace=NAMESPACE),
            lambda: custom_objects_api.delete_namespaced_custom_object(
                group="cert-manager.io", version="v1", namespace=NAMESPACE, plural="certificates", name=resource_name
            ),
            lambda: client.CoreV1Api().delete_namespaced_secret(name=secret_name, namespace=NAMESPACE),
        ):
            try:
                action()
            except ApiException:
                pass

        if redis_client:
            redis_client.delete(f"domain:{custom_domain}")
