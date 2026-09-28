# Continue

> Status in this repo: Deferred: Karpenter (continuation)

To establish full observability across the Kubernetes cluster, we configure the **Prometheus Operator (`ServiceMonitor` & `PrometheusRule`)** resources and deploy **`celery-exporter`** into the Helm chart. 

This telemetry layer monitors four critical operational vectors:
1. **Envoy Egress Proxy Metrics:** Scrapes unauthorized egress attempts (HTTP 403s), active TCP connections, and bandwidth per destination domain.
2. **Celery Queue & Task Latency:** Tracks queue depths, worker concurrency saturation, and task failures across agent queues.
3. **FastAPI Application Telemetry:** Measures HTTP request duration, error rates, and WebSocket connection counts.
4. **SRE Alerting Rules:** Alerts immediately if a rogue sandbox triggers an egress spike or if Celery tasks stall.

---

### Telemetry & Scraping Architecture

```
 ┌────────────────────────────────────────────────────────────────────────────────┐
 │ Namespace: polsia-system                                                       │
 │                                                                                │
 │  ┌────────────────────────┐                   ┌─────────────────────────────┐  │
 │  │ Envoy Proxy            ├──────┐            │ Celery Exporter             │  │
 │  │ Admin Port: :9901      │      │            │ Port: :9808                 │  │
 │  │ Path: /stats/prometheus│      │            │ Scrapes Redis Queue Depths  │  │
 │  └────────────────────────┘      │            └──────────────┬──────────────┘  │
 │                                  │                           │                 │
 │  ┌────────────────────────┐      │                           │                 │
 │  │ FastAPI Server         │      │                           │                 │
 │  │ Port: :8000            ├──────┼────────────────────────┐  │                 │
 │  │ Path: /metrics         │      │                        │  │                 │
 │  └────────────────────────┘      │                        │  │                 │
 └──────────────────────────────────┼────────────────────────┼──┼─────────────────┘
                                    │                        │  │
                                    ▼                        ▼  ▼
 ┌────────────────────────────────────────────────────────────────────────────────┐
 │ Prometheus Operator (monitoring namespace)                                     │
 │                                                                                │
 │  ┌────────────────────────┐  ┌────────────────────────┐  ┌──────────────────┐  │
 │  │ ServiceMonitor: envoy  │  │ ServiceMonitor: api    │  │ SM: celery       │  │
 │  └───────────┬────────────┘  └───────────┬────────────┘  └─────────┬────────┘  │
 │              └───────────────────────────┼─────────────────────────┘           │
 │                                          ▼                                     │
 │                       ┌─────────────────────────────────────┐                  │
 │                       │ Prometheus Server (TSDB Engine)     │                  │
 │                       └──────────────────┬──────────────────┘                  │
 │                                          │ Evaluates rules & feeds panels      │
 │                         ┌────────────────┴────────────────┐                    │
 │                         ▼                                 ▼                    │
 │         ┌───────────────────────────────┐ ┌──────────────────────────────────┐ │
 │         │ PrometheusRule (Alertmanager) │ │ Grafana Dashboard (Auto-imported)│ │
 │         │ - EnvoyEgressViolationAlert   │ │ - Real-time Queue vs. Egress map │ │
 │         │ - CeleryQueueStallAlert       │ │ - gVisor Sandboxed Task Runtimes │ │
 │         └───────────────────────────────┘ └──────────────────────────────────┘ │
 └────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Exposing Envoy Prometheus Metrics (`configmap-envoy.yaml` & `service-envoy.yaml`)

Update Envoy's configuration in `helm/polsia/templates/configmap-envoy.yaml` to expose the administrative telemetry interface on port `9901`:

```yaml
# In helm/polsia/templates/configmap-envoy.yaml:
apiVersion: v1
kind: ConfigMap
metadata:
  name: envoy-config
  namespace: {{ .Release.Namespace }}
data:
  envoy.yaml: |
    # Expose administrative and Prometheus stats listener
    admin:
      address:
        socket_address:
          address: 0.0.0.0
          port_value: 9901

    static_resources:
      listeners:
      - name: egress_proxy_listener
        address:
          socket_address: { address: 0.0.0.0, port_value: 10001 }
        # ... [existing filter chains and RBAC configs] ...
```

Expose port `9901` on the Envoy Kubernetes Service in `helm/polsia/templates/service-envoy.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: polsia-envoy
  namespace: {{ .Release.Namespace }}
  labels:
    app.kubernetes.io/name: polsia
    app.kubernetes.io/component: envoy
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: polsia
    app.kubernetes.io/component: envoy
  ports:
    - name: proxy
      port: 10001
      targetPort: 10001
      protocol: TCP
    - name: metrics
      port: 9901
      targetPort: 9901
      protocol: TCP
```

---

## 2. Celery Queue Exporter (`deployment-celery-exporter.yaml`)

Because Celery workers process tasks asynchronously, queue depths and execution lags live inside the Redis broker. Add `celery-exporter` to `helm/polsia/templates/deployment-celery-exporter.yaml` to scrape task states and queue lengths:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: polsia-celery-exporter
  namespace: {{ .Release.Namespace }}
  labels:
    app.kubernetes.io/component: celery-exporter
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/component: celery-exporter
  template:
    metadata:
      labels:
        app.kubernetes.io/component: celery-exporter
    spec:
      containers:
        - name: exporter
          image: "danihodovic/celery-exporter:latest" #
          imagePullPolicy: IfNotPresent
          env:
            - name: BROKER_URL
              value: "redis://polsia-redis:6379/0"
            - name: CELERY_EXPORTER_PORT
              value: "9808"
          ports:
            - name: metrics
              containerPort: 9808
              protocol: TCP
          resources:
            limits:
              cpu: "200m"
              memory: "256Mi"
            requests:
              cpu: "50m"
              memory: "64Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: polsia-celery-exporter
  namespace: {{ .Release.Namespace }}
  labels:
    app.kubernetes.io/component: celery-exporter
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/component: celery-exporter
  ports:
    - name: metrics
      port: 9808
      targetPort: 9808
      protocol: TCP
```

---

## 3. Prometheus Operator `ServiceMonitor` Resources

Create `helm/polsia/templates/servicemonitors.yaml`. These Custom Resources instruct Prometheus Operator to dynamically register the scraping targets:

```yaml
{{- if .Values.monitoring.enabled -}}
# 1. Envoy Proxy Telemetry (403 blocks, SNI connections, bandwidth)
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor #
metadata:
  name: polsia-envoy-metrics
  namespace: {{ .Release.Namespace }}
  labels:
    release: {{ .Values.monitoring.prometheusRelease | default "prometheus" }} # Matches Prometheus instance selector
spec:
  selector:
    matchLabels:
      app.kubernetes.io/component: envoy
  endpoints:
    - port: metrics #
      path: /stats/prometheus
      interval: 15s
      scrapeTimeout: 10s
---
# 2. Celery Worker & Queue Telemetry (Task latency, queue depths)
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor #
metadata:
  name: polsia-celery-metrics
  namespace: {{ .Release.Namespace }}
  labels:
    release: {{ .Values.monitoring.prometheusRelease | default "prometheus" }} #
spec:
  selector:
    matchLabels:
      app.kubernetes.io/component: celery-exporter
  endpoints:
    - port: metrics #
      path: /metrics
      interval: 15s
      scrapeTimeout: 10s
---
# 3. FastAPI Core Telemetry (Request rate, HTTP status codes, latency)
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor #
metadata:
  name: polsia-api-metrics
  namespace: {{ .Release.Namespace }}
  labels:
    release: {{ .Values.monitoring.prometheusRelease | default "prometheus" }} #
spec:
  selector:
    matchLabels:
      app.kubernetes.io/component: api
  endpoints:
    - port: http #
      path: /metrics
      interval: 15s
      scrapeTimeout: 10s
{{- end }}
```

Enable monitoring in `helm/polsia/values.yaml`:

```yaml
# Add to helm/polsia/values.yaml:
monitoring:
  enabled: true
  prometheusRelease: "prometheus" # Set to match your kube-prometheus-stack release label
```

---

## 4. Autonomous SRE Alerting Rules (`prometheusrule-alerts.yaml`)

Create `helm/polsia/templates/prometheusrule-alerts.yaml`. These alerting rules trigger Alertmanager when security violations or task execution bottlenecks occur:

```yaml
{{- if .Values.monitoring.enabled -}}
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: polsia-operational-alerts
  namespace: {{ .Release.Namespace }}
  labels:
    role: alert-rules
    release: {{ .Values.monitoring.prometheusRelease | default "prometheus" }} #
spec:
  groups:
    - name: polsia.security.rules
      rules:
        # 1. Alert when Envoy intercepts an unauthorized egress attempt
        - alert: EnvoyEgressSecurityBreach
          expr: increase(envoy_http_downstream_rq_xx{envoy_response_code_class="4"}[2m]) > 0
          for: 10s
          labels:
            severity: critical
            tier: security
          annotations:
            summary: "Unauthorized Sandbox Egress Attempt Detected"
            description: "An agent sandbox pod attempted to establish an external connection outside the approved SNI whitelist (api.anthropic.com, github.com)."

    - name: polsia.queue.rules
      rules:
        # 2. Alert when Celery tasks are queuing faster than workers can process
        - alert: CeleryQueueBacklogHigh
          expr: celery_queue_length{queue_name="celery"} > 30
          for: 3m
          labels:
            severity: warning
            tier: operations
          annotations:
            summary: "High Celery Task Queue Backlog"
            description: "More than 30 agent tasks are pending in Redis for >3 minutes. Consider scaling worker replicas or checking for stuck gVisor sandboxes."

        # 3. Alert when agent tasks encounter an elevated failure rate
        - alert: AgentTaskFailureRateSpike
          expr: sum(rate(celery_tasks_total{state="FAILURE"}[5m])) / sum(rate(celery_tasks_total[5m])) * 100 > 15
          for: 2m
          labels:
            severity: critical
            tier: application
          annotations:
            summary: "Agent Task Failure Rate Exceeds 15%"
            description: "High error rate detected across headless Claude Code runner tasks."
{{- end }}
```

---

## 5. Grafana Dashboard ConfigMap (`configmap-grafana-dashboard.yaml`)

Create `helm/polsia/templates/configmap-grafana-dashboard.yaml`. If you run Grafana with the dashboard sidecar (`grafana_dashboard: "1"` label), this dashboard auto-provisions into your Grafana instance:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: polsia-grafana-dashboard
  namespace: {{ .Release.Namespace }}
  labels:
    grafana_dashboard: "1"
data:
  polsia-overview.json: |
    {
      "annotations": { "list": [] },
      "editable": true,
      "title": "Polsia Autonomous Operations & Security",
      "timezone": "browser",
      "schemaVersion": 38,
      "refresh": "10s",
      "panels": [
        {
          "title": "Envoy Egress Traffic (Requests/sec by Host)",
          "type": "timeseries",
          "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
          "targets": [
            {
              "expr": "sum by (cluster_name) (rate(envoy_cluster_upstream_rq_total[1m]))",
              "legendFormat": "{{cluster_name}}"
            }
          ]
        },
        {
          "title": "Blocked Egress Violations (HTTP 403s)",
          "type": "stat",
          "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
          "targets": [
            {
              "expr": "sum(increase(envoy_http_downstream_rq_xx{envoy_response_code_class=\"4\"}[1h]))",
              "legendFormat": "Blocked Breaches (1h)"
            }
          ],
          "fieldConfig": {
            "defaults": {
              "color": { "mode": "thresholds" },
              "thresholds": {
                "steps": [
                  { "color": "green", "value": null },
                  { "color": "red", "value": 1 }
                ]
              }
            }
          }
        },
        {
          "title": "Celery Queue Lengths by Agent Queue",
          "type": "timeseries",
          "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
          "targets": [
            {
              "expr": "celery_queue_length",
              "legendFormat": "{{queue_name}}"
            }
          ]
        },
        {
          "title": "Task Execution Duration (p50 / p95 / p99 seconds)",
          "type": "timeseries",
          "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
          "targets": [
            {
              "expr": "histogram_quantile(0.99, sum(rate(celery_task_runtime_seconds_bucket[5m])) by (le))",
              "legendFormat": "p99 Latency"
            },
            {
              "expr": "histogram_quantile(0.95, sum(rate(celery_task_runtime_seconds_bucket[5m])) by (le))",
              "legendFormat": "p95 Latency"
            },
            {
              "expr": "histogram_quantile(0.50, sum(rate(celery_task_runtime_seconds_bucket[5m])) by (le))",
              "legendFormat": "p50 Latency"
            }
          ]
        }
      ]
    }
```

---

## 6. Verification and Scrape Validation

Once deployed via Helm, verify that Prometheus has registered the targets:

```bash
# 1. Verify ServiceMonitor resources were created in the namespace
kubectl get servicemonitors -n polsia-system

# 2. Port-forward Prometheus Web UI to inspect scrape targets
kubectl port-forward svc/prometheus-k8s 9090:9090 -n monitoring
```

Open `http://localhost:9090/targets` in your browser. All three target groups—`polsia-envoy-metrics`, `polsia-celery-metrics`, and `polsia-api-metrics`—will display with state **`UP`**.
