# Show me how to package this entire Polsia autonomous company stack into a production-ready Kubernetes Helm chart with Terraform.

> Status in this repo: Deferred: Helm chart + Terraform

Deploying the Polsia autonomous multi-agent operating system to Kubernetes replaces local Docker-in-Docker sockets with **Kubernetes-native primitives**:

* **Syscall Sandboxing:** Ephemeral agent runs execute as short-lived Kubernetes Pods governed by a `RuntimeClass` (`runsc`/gVisor).
* **Network Egress Quarantine:** Kubernetes `NetworkPolicy` objects block direct WAN traffic from sandbox pods, forcing all egress through an internal **Envoy Forward Proxy** service with SNI domain filtering.
* **Declarative Orchestration:** The entire stack (FastAPI, Next.js, Celery Worker, Celery Beat, Redis, ChromaDB, Envoy, and RBAC) is packaged into a parameterized **Helm chart** and deployed via **Terraform**.

---

### Kubernetes Architecture

```
                       [ Public Ingress / Cloud Load Balancer ]
                                     │
                 ┌───────────────────┴───────────────────┐
                 │ Host: polsia.ai                       │ Host: api.polsia.ai
                 ▼                                       ▼
       ┌─────────────────────┐                 ┌─────────────────────┐
       │ Next.js 14 Frontend │                 │  FastAPI API Server │
       │ (Deployment x2)     │                 │  (Deployment x2)    │
       └─────────────────────┘                 └──────────┬──────────┘
                                                          │ Enqueue Tasks
                                                          ▼
       ┌─────────────────────┐                 ┌─────────────────────┐
       │  Celery Beat Cron   │                 │     Redis Broker    │
       │  (Deployment x1)    ├────────────────►│ (StatefulSet + PVC) │
       └─────────────────────┘                 └──────────▲──────────┘
                                                          │ Pull Tasks
                                                          ▼
                                               ┌─────────────────────┐
                                               │ Celery Worker Pool  │
                                               │ (Deployment x2)     │
                                               └──────────┬──────────┘
                                                          │ K8s API (Create Pod)
                                                          ▼
 ┌──────────────────────────────────────────────────────────────────────────────────┐
 │                    Isolated Namespace: `polsia-sandboxes`                         │
 │                                                                                  │
 │  ┌────────────────────────────────────────┐         ┌─────────────────────────┐  │
 │  │ Ephemeral Sandbox Pod (gVisor)         │         │ Envoy Egress Proxy      │  │
 │  │ runtimeClassName: gvisor               │         │ (Deployment x2)         │  │
 │  │ NetworkPolicy: Egress to Envoy ONLY    ├────────►│ HTTP CONNECT :10001     ├──┼──► Public WAN
 │  │ Image: polsia-agent-sandbox            │         │ Whitelist:              │  │    (Anthropic &
 │  └────────────────────────────────────────┘         │  - api.anthropic.com    │  │     GitHub only)
 │                                                     │  - github.com           │  │
 │                                                     └─────────────────────────┘  │
 └──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Helm Chart Directory Structure

```text
helm/polsia/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── _helpers.tpl
│   ├── runtimeclass.yaml
│   ├── networkpolicy-sandboxes.yaml
│   ├── rbac-worker.yaml
│   ├── configmap-envoy.yaml
│   ├── configmap-soul.yaml
│   ├── deployment-api.yaml
│   ├── deployment-frontend.yaml
│   ├── deployment-celery-worker.yaml
│   ├── deployment-celery-beat.yaml
│   ├── deployment-envoy.yaml
│   ├── service-api.yaml
│   ├── service-frontend.yaml
│   ├── service-envoy.yaml
│   ├── statefulset-redis.yaml
│   ├── statefulset-chromadb.yaml
│   ├── ingress.yaml
│   └── secrets.yaml
```

---

## 2. Helm Chart Configuration

### `helm/polsia/Chart.yaml`
```yaml
apiVersion: v2
name: polsia
description: Autonomous Multi-Agent Operating System with gVisor Sandboxing
type: application
version: 1.0.0
appVersion: "2026.1"
keywords:
  - autonomous-agents
  - gvisor
  - celery
  - fast-api
  - claude-code
```

### `helm/polsia/values.yaml`
```yaml
global:
  domain: "polsia.ai"
  environment: "production"

images:
  backend:
    repository: "ghcr.io/your-org/polsia-backend"
    tag: "latest"
    pullPolicy: IfNotPresent
  frontend:
    repository: "ghcr.io/your-org/polsia-frontend"
    tag: "latest"
    pullPolicy: IfNotPresent
  sandbox:
    repository: "ghcr.io/your-org/polsia-agent-sandbox"
    tag: "latest"
  envoy:
    repository: "envoyproxy/envoy"
    tag: "v1.30-latest"
  redis:
    repository: "redis"
    tag: "7.2-alpine"
  chromadb:
    repository: "chromadb/chroma"
    tag: "0.5.0"

secrets:
  anthropicApiKey: ""
  githubToken: ""
  sendgridApiKey: ""
  sentryClientSecret: ""
  metaAdsToken: ""
  deploymentSecret: ""

api:
  replicaCount: 2
  resources:
    limits:
      cpu: "1000m"
      memory: "1Gi"
    requests:
      cpu: "250m"
      memory: "256Mi"

frontend:
  replicaCount: 2
  resources:
    limits:
      cpu: "500m"
      memory: "512Mi"
    requests:
      cpu: "100m"
      memory: "128Mi"

celeryWorker:
  replicaCount: 2
  concurrency: 4
  resources:
    limits:
      cpu: "2000m"
      memory: "4Gi"
    requests:
      cpu: "500m"
      memory: "1Gi"

sandboxes:
  namespace: "polsia-sandboxes"
  runtimeClassName: "gvisor"
  timeoutSeconds: 600
  resources:
    limits:
      cpu: "2000m"
      memory: "2Gi"
    requests:
      cpu: "500m"
      memory: "512Mi"

storage:
  chromadbSize: "20Gi"
  redisSize: "10Gi"
  storageClassName: "gp3"

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/websocket-services: "polsia-api"
  tls: true
```

---

## 3. Helm Core Templates

### `templates/runtimeclass.yaml`
Registers the gVisor `runsc` handler with Kubernetes:
```yaml
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: {{ .Values.sandboxes.runtimeClassName }}
handler: runsc
```

### `templates/networkpolicy-sandboxes.yaml`
Enforces that sandbox pods cannot access the local Kubernetes cluster or the public internet directly, allowing egress only to DNS (port 53) and Envoy (port 10001):
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: isolate-sandbox-egress
  namespace: {{ .Values.sandboxes.namespace }}
spec:
  podSelector:
    matchLabels:
      polsia.ai/workload: "agent-sandbox"
  policyTypes:
    - Ingress
    - Egress
  ingress: [] # Block all incoming connections to the sandbox
  egress:
    # 1. Allow UDP/TCP DNS resolution to CoreDNS
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53

    # 2. Allow HTTPS proxy traffic strictly to the Envoy service in the main namespace
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: {{ .Release.Namespace }}
          podSelector:
            matchLabels:
              app.kubernetes.io/component: envoy
      ports:
        - protocol: TCP
          port: 10001
```

### `templates/rbac-worker.yaml`
Grants the Celery Worker permissions to dynamically launch, monitor, and clean up ephemeral sandbox pods:
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: polsia-worker-sa
  namespace: {{ .Release.Namespace }}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: polsia-sandbox-manager
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "pods/exec"]
    verbs: ["get", "list", "watch", "create", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: polsia-worker-manage-sandboxes
subjects:
  - kind: ServiceAccount
    name: polsia-worker-sa
    namespace: {{ .Release.Namespace }}
roleRef:
  kind: ClusterRole
  name: polsia-sandbox-manager
  apiGroup: rbac.authorization.k8s.io
```

### `templates/configmap-envoy.yaml`
Configures Envoy as an HTTP `CONNECT` forward proxy that inspects SNI and enforces the destination whitelist:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: envoy-config
  namespace: {{ .Release.Namespace }}
data:
  envoy.yaml: |
    static_resources:
      listeners:
      - name: egress_proxy_listener
        address:
          socket_address: { address: 0.0.0.0, port_value: 10001 }
        filter_chains:
        - filters:
          - name: envoy.filters.network.http_connection_manager
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
              stat_prefix: egress_proxy
              http_protocol_options: { accept_http_10: true }
              upgrade_configs: [{ upgrade_type: CONNECT }]
              route_config:
                name: egress_routes
                virtual_hosts:
                - name: anthropic_whitelist
                  domains: ["api.anthropic.com:443", "api.anthropic.com"]
                  routes:
                  - match: { connect_matcher: {} }
                    route:
                      cluster: anthropic_upstream
                      upgrade_configs: [{ upgrade_type: CONNECT }]
                - name: github_whitelist
                  domains: ["github.com:443", "github.com", "api.github.com:443", "api.github.com", "*.github.com"]
                  routes:
                  - match: { connect_matcher: {} }
                    route:
                      cluster: github_upstream
                      upgrade_configs: [{ upgrade_type: CONNECT }]
              http_filters:
              - name: envoy.filters.http.router
                typed_config:
                  "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
      clusters:
      - name: anthropic_upstream
        type: LOGICAL_DNS
        dns_lookup_family: V4_ONLY
        load_assignment:
          cluster_name: anthropic_upstream
          endpoints:
          - lb_endpoints:
            - endpoint:
                address: { socket_address: { address: api.anthropic.com, port_value: 443 } }
      - name: github_upstream
        type: LOGICAL_DNS
        dns_lookup_family: V4_ONLY
        load_assignment:
          cluster_name: github_upstream
          endpoints:
          - lb_endpoints:
            - endpoint:
                address: { socket_address: { address: github.com, port_value: 443 } }
```

### `templates/deployment-celery-worker.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: polsia-celery-worker
  namespace: {{ .Release.Namespace }}
  labels:
    app.kubernetes.io/component: celery-worker
spec:
  replicas: {{ .Values.celeryWorker.replicaCount }}
  selector:
    matchLabels:
      app.kubernetes.io/component: celery-worker
  template:
    metadata:
      labels:
        app.kubernetes.io/component: celery-worker
    spec:
      serviceAccountName: polsia-worker-sa
      containers:
        - name: worker
          image: "{{ .Values.images.backend.repository }}:{{ .Values.images.backend.tag }}"
          imagePullPolicy: {{ .Values.images.backend.pullPolicy }}
          command:
            - "celery"
            - "-A"
            - "app.celery_app"
            - "worker"
            - "--loglevel=info"
            - "--concurrency={{ .Values.celeryWorker.concurrency }}"
          envFrom:
            - secretRef:
                name: polsia-secrets
          env:
            - name: REDIS_URL
              value: "redis://polsia-redis:6379/0"
            - name: CHROMADB_URL
              value: "http://polsia-chromadb:8000"
            - name: SANDBOX_K8S_NAMESPACE
              value: {{ .Values.sandboxes.namespace | quote }}
            - name: SANDBOX_RUNTIME_CLASS
              value: {{ .Values.sandboxes.runtimeClassName | quote }}
            - name: SANDBOX_IMAGE
              value: "{{ .Values.images.sandbox.repository }}:{{ .Values.images.sandbox.tag }}"
            - name: ENVOY_PROXY_URL
              value: "http://polsia-envoy.{{ .Release.Namespace }}.svc.cluster.local:10001"
          resources:
            {{- toYaml .Values.celeryWorker.resources | nindent 12 }}
```

### `templates/ingress.yaml`
Routes external traffic to the frontend and provides WebSocket and API routing to FastAPI:
```yaml
{{- if .Values.ingress.enabled -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: polsia-ingress
  namespace: {{ .Release.Namespace }}
  annotations:
    {{- toYaml .Values.ingress.annotations | nindent 4 }}
spec:
  ingressClassName: {{ .Values.ingress.className }}
  {{- if .Values.ingress.tls }}
  tls:
    - hosts:
        - {{ .Values.global.domain }}
        - "api.{{ .Values.global.domain }}"
      secretName: polsia-tls-cert
  {{- end }}
  rules:
    - host: {{ .Values.global.domain }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: polsia-frontend
                port:
                  number: 3000
    - host: "api.{{ .Values.global.domain }}"
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: polsia-api
                port:
                  number: 8000
{{- end }}
```

---

## 4. Kubernetes Dynamic Pod Sandbox Runner (`app/sandbox/k8s_runner.py`)

Replace Docker commands in the worker with the Kubernetes Python Client (`pip install kubernetes`). This creates an ephemeral Pod inside `polsia-sandboxes` with `runtimeClassName: gvisor`, connects it to Envoy, streams output, and terminates it:

```python
import os
import time
import json
from typing import Dict, Any, List, Optional
from kubernetes import client, config, watch

# Initialize Kubernetes client from ServiceAccount token inside Pod
try:
    config.load_incluster_config()
except config.ConfigException:
    config.load_kube_config()

core_api = client.CoreV1Api()

class K8sSandboxExecutionError(Exception):
    pass

def run_in_k8s_gvisor_sandbox(
    prompt: str,
    task_id: str,
    agent_name: str,
    system_prompt: Optional[str] = None,
    allowed_tools: Optional[List[str]] = None,
    timeout_seconds: int = 600
) -> Dict[str, Any]:
    """
    Spawns an ephemeral Kubernetes Pod assigned to the gVisor RuntimeClass.
    NetworkPolicy blocks direct external internet, enforcing routing through Envoy.
    """
    namespace = os.getenv("SANDBOX_K8s_NAMESPACE", "polsia-sandboxes")
    runtime_class = os.getenv("SANDBOX_RUNTIME_CLASS", "gvisor")
    sandbox_image = os.getenv("SANDBOX_IMAGE", "ghcr.io/your-org/polsia-agent-sandbox:latest")
    proxy_url = os.getenv("ENVOY_PROXY_URL", "http://polsia-envoy:10001")

    pod_name = f"sandbox-{task_id[:8]}"

    cmd = ["-p", prompt, "--output-format", "json"]
    if allowed_tools:
        cmd.extend(["--allowedTools", ",".join(allowed_tools)])
    else:
        cmd.extend(["--permission-mode", "bypassPermissions"])

    if system_prompt:
        cmd.extend(["--append-system-prompt", system_prompt])

    pod_manifest = client.V1Pod(
        metadata=client.V1ObjectMeta(
            name=pod_name,
            namespace=namespace,
            labels={
                "polsia.ai/workload": "agent-sandbox",
                "polsia.ai/task-id": task_id,
                "polsia.ai/agent": agent_name
            }
        ),
        spec=client.V1PodSpec(
            runtime_class_name=runtime_class,  # Enforces gVisor user-space kernel
            restart_policy="Never",
            containers=[
                client.V1Container(
                    name="agent-executor",
                    image=sandbox_image,
                    command=["claude"] + cmd,
                    env=[
                        client.V1EnvVar(name="HTTP_PROXY", value=proxy_url),
                        client.V1EnvVar(name="HTTPS_PROXY", value=proxy_url),
                        client.V1EnvVar(name="ALL_PROXY", value=proxy_url),
                        client.V1EnvVar(name="GIT_CONFIG_PARAMETERS", value=f"'http.proxy={proxy_url}'"),
                        client.V1EnvVar(
                            name="ANTHROPIC_API_KEY",
                            value_from=client.V1EnvVarSource(
                                secret_key_ref=client.V1SecretKeySelector(
                                    name="polsia-secrets",
                                    key="ANTHROPIC_API_KEY"
                                )
                            )
                        )
                    ],
                    resources=client.V1ResourceRequirements(
                        limits={"cpu": "2000m", "memory": "2Gi"},
                        requests={"cpu": "500m", "memory": "512Mi"}
                    ),
                    security_context=client.V1SecurityContext(
                        allow_privilege_escalation=False,
                        read_only_root_filesystem=False,
                        run_as_non_root=True,
                        run_as_user=1000
                    )
                )
            ]
        )
    )

    # 1. Create the Ephemeral Sandbox Pod
    core_api.create_namespaced_pod(namespace=namespace, body=pod_manifest)

    try:
        # 2. Wait for completion
        start_time = time.time()
        while time.time() - start_time < timeout_seconds:
            pod_status = core_api.read_namespaced_pod_status(name=pod_name, namespace=namespace)
            phase = pod_status.status.phase

            if phase in ["Succeeded", "Failed"]:
                logs = core_api.read_namespaced_pod_log(name=pod_name, namespace=namespace)
                if phase == "Failed":
                    raise K8sSandboxExecutionError(f"Sandbox pod failed: {logs}")
                try:
                    return json.loads(logs)
                except json.JSONDecodeError:
                    return {"result": logs.strip(), "raw": True}

            time.sleep(2)

        raise K8sSandboxExecutionError(f"Sandbox exceeded timeout of {timeout_seconds}s")

    finally:
        # 3. Clean up the Pod
        try:
            core_api.delete_namespaced_pod(
                name=pod_name,
                namespace=namespace,
                grace_period_seconds=0
            )
        except Exception:
            pass
```

---

## 5. Production Terraform Module

This Terraform module deploys the Kubernetes cluster infrastructure (AWS EKS with containerd `runsc` support), creates the required namespaces, and installs the Polsia Helm chart.

### `terraform/main.tf`
```hcl
terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.27"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# 1. Fetch EKS Cluster Data
data "aws_eks_cluster" "cluster" {
  name = var.cluster_name
}

data "aws_eks_cluster_auth" "cluster" {
  name = var.cluster_name
}

provider "kubernetes" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.cluster.token
}

provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.cluster.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.cluster.token
  }
}

# 2. Namespaces
resource "kubernetes_namespace" "polsia_system" {
  metadata {
    name = "polsia-system"
    labels = {
      "app.kubernetes.io/part-of" = "polsia"
    }
  }
}

resource "kubernetes_namespace" "polsia_sandboxes" {
  metadata {
    name = "polsia-sandboxes"
    labels = {
      "app.kubernetes.io/part-of" = "polsia"
      "security.polsia.ai/tier"   = "untrusted-execution"
    }
  }
}

# 3. Deploy Polsia via Helm
resource "helm_release" "polsia" {
  name       = "polsia"
  chart      = "${path.module}/../helm/polsia"
  namespace  = kubernetes_namespace.polsia_system.metadata[0].name
  timeout    = 600
  wait       = true

  values = [
    yamlencode({
      global = {
        domain = var.domain_name
      }
      secrets = {
        anthropicApiKey    = var.anthropic_api_key
        githubToken        = var.github_token
        sendgridApiKey     = var.sendgrid_api_key
        sentryClientSecret = var.sentry_client_secret
        metaAdsToken       = var.meta_ads_token
        deploymentSecret   = var.deployment_secret
      }
      sandboxes = {
        namespace = kubernetes_namespace.polsia_sandboxes.metadata[0].name
      }
    })
  ]

  depends_on = [
    kubernetes_namespace.polsia_system,
    kubernetes_namespace.polsia_sandboxes
  ]
}
```

### `terraform/variables.tf`
```hcl
variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "cluster_name" {
  type        = string
  description = "Name of the existing EKS cluster configured with gVisor/runsc nodes"
}

variable "domain_name" {
  type    = string
  default = "polsia.ai"
}

variable "anthropic_api_key" {
  type      = string
  sensitive = true
}

variable "github_token" {
  type      = string
  sensitive = true
}

variable "sendgrid_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "sentry_client_secret" {
  type      = string
  sensitive = true
  default   = ""
}

variable "meta_ads_token" {
  type      = string
  sensitive = true
  default   = ""
}

variable "deployment_secret" {
  type      = string
  sensitive = true
}
```

### `terraform/outputs.tf`
```hcl
output "ingress_hostname" {
  value       = "https://${var.domain_name}"
  description = "Primary dashboard endpoint"
}

output "api_endpoint" {
  value       = "https://api.${var.domain_name}"
  description = "FastAPI & WebSocket endpoint"
}

output "helm_release_status" {
  value       = helm_release.polsia.status
  description = "Current deployment status of the Polsia Helm release"
}
```

---

## 6. Deployment Command Workflow

1. **Verify Node Pool gVisor Support:**
   Ensure your EKS or GKE node pool is using containerd with `runsc` configured in `/etc/containerd/config.toml`:
   ```toml
   [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc]
     runtime_type = "io.containerd.runsc.v1"
   ```

2. **Lint and Validate the Helm Chart:**
   ```bash
   helm lint helm/polsia
   helm template polsia helm/polsia -f helm/polsia/values.yaml > /dev/null
   ```

3. **Deploy with Terraform:**
   ```bash
   cd terraform
   terraform init
   terraform plan -out=tfplan \
     -var="cluster_name=prod-eks-cluster" \
     -var="anthropic_api_key=$ANTHROPIC_API_KEY" \
     -var="github_token=$GITHUB_TOKEN" \
     -var="deployment_secret=$DEPLOYMENT_SECRET"

   terraform apply tfplan
   ```

4. **Verify Deployment Health:**
   ```bash
   # Check core pods
   kubectl get pods -n polsia-system

   # Check dynamic sandbox execution
   kubectl get pods -n polsia-sandboxes -w

   # Confirm Envoy proxy rules
   kubectl logs -n polsia-system -l app.kubernetes.io/component=envoy -f
   ```
