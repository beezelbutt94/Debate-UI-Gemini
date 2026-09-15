Prometheus Alerting Rules (k8s/monitoring/prometheus-rules-gpu.yaml)
This PrometheusRule resource monitors custom telemetry (viralvision_gpu_vram_usage_percentage), NVIDIA DCGM hardware metrics, Celery transcode failure counters, and Kubernetes pod terminations to capture impending OOM bottlenecks before workers crash.
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: viralvision-gpu-alerts
  namespace: production
  labels:
    role: alert-rules
    prometheus: k8s
spec:
  groups:
    - name: gpu.vram.rules
      rules:
        # Warning: Sustained VRAM utilization over 85%
        - alert: GPUVRAMSaturationWarning
          expr: |
            viralvision_gpu_vram_usage_percentage > 85
            or
            (DCGM_FI_DEV_FB_USED / (DCGM_FI_DEV_FB_USED + DCGM_FI_DEV_FB_FREE) * 100) > 85
          for: 3m
          labels:
            severity: warning
            service: video-worker
            tier: transcode-cluster
          annotations:
            summary: "NVIDIA GPU VRAM nearing capacity ({{ $labels.device_id }})"
            description: "GPU VRAM usage is at {{ $value | printf \"%.1f\" }}% on device {{ $labels.device_id }} (Node: {{ $labels.instance }}). Risk of CUDA allocation failures on incoming premium 2K/60fps jobs."

        # Critical: Immediate VRAM saturation (>95%)
        - alert: GPUVRAMCriticalSaturation
          expr: |
            viralvision_gpu_vram_usage_percentage > 95
            or
            (DCGM_FI_DEV_FB_USED / (DCGM_FI_DEV_FB_USED + DCGM_FI_DEV_FB_FREE) * 100) > 95
          for: 1m
          labels:
            severity: critical
            service: video-worker
            tier: transcode-cluster
          annotations:
            summary: "CRITICAL: NVIDIA GPU VRAM Exhaustion ({{ $labels.device_id }})"
            description: "GPU VRAM is at {{ $value | printf \"%.1f\" }}% on {{ $labels.device_id }}. Workers will trigger fallback degradation or drop NVENC sessions."

        # Critical: Active Celery transcode abort due to CUDA/OOM
        - alert: TranscodeJobOOMKilled
          expr: |
            increase(viralvision_render_failures_total{reason=~"(?i).*(out_of_memory|oom|cuda_error).*"}[2m]) > 0
          labels:
            severity: critical
            service: video-worker
            tier: transcode-cluster
          annotations:
            summary: "Video render failed due to OOM / CUDA error"
            description: "Job aborted inside Celery worker due to memory exhaustion: {{ $labels.reason }}. Automatic CPU transcode fallback was engaged."

        # Critical: Kubernetes kernel killing worker pod container
        - alert: CeleryWorkerPodOOMKilled
          expr: |
            increase(kube_pod_container_status_terminated_reason{container="celery-worker", reason="OOMKilled"}[5m]) > 0
          labels:
            severity: critical
            service: video-worker
            tier: transcode-cluster
          annotations:
            summary: "Celery worker container OOMKilled by Linux cgroups"
            description: "Pod {{ $labels.pod }} in namespace {{ $labels.namespace }} was terminated by SIGKILL due to exceeding container RAM limits (16Gi allocation limit)."

Alertmanager Secret Credentials (k8s/monitoring/alertmanager-secret.yaml)
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-viralvision-routing
  namespace: monitoring
type: Opaque
stringData:
  alertmanager.yaml: |
    global:
      resolve_timeout: 5m
      slack_api_url: "[placeholder in the original doc, not a real webhook -- replace with your own Slack Incoming Webhook URL]"

    templates:
      - "/etc/alertmanager/templates/*.tmpl"

    route:
      group_by: ["alertname", "cluster", "service", "device_id"]
      group_wait: 15s
      group_interval: 2m
      repeat_interval: 3h
      receiver: "slack-gpu-ops"
      routes:
        # Route high-severity hardware issues immediately to both Slack and Discord
        - matchers:
            - severity = "critical"
          receiver: "all-critical-channels"
          continue: true
        - matchers:
            - tier = "transcode-cluster"
          receiver: "slack-gpu-ops"

    receivers:
      - name: "slack-gpu-ops"
        slack_configs:
          - channel: "#alerts-gpu-ops"
            send_resolved: true
            icon_emoji: ":nvidia:"
            username: "GPU Sentinel"
            title: '{{ template "slack.gpu.title" . }}'
            text: '{{ template "slack.gpu.text" . }}'
            color: '{{ if eq .Status "firing" }}{{ if eq .CommonLabels.severity "critical" }}#EF4444{{ else }}#F59E0B{{ end }}{{ else }}#10B981{{ end }}'

      - name: "all-critical-channels"
        slack_configs:
          - channel: "#alerts-critical-incidents"
            send_resolved: true
            icon_emoji: ":rotating_light:"
            username: "Cluster Emergency Sentinel"
            title: '[CRITICAL HARDWARE EVENT] {{ .CommonLabels.alertname }}'
            text: '{{ template "slack.gpu.text" . }}'
            color: "#EF4444"
        discord_configs:
          - webhook_url: "[placeholder in the original doc, not a real webhook -- replace with your own Discord webhook URL]"
            send_resolved: true
            title: '{{ template "discord.gpu.title" . }}'
            message: '{{ template "discord.gpu.message" . }}'

    inhibit_rules:
      # Suppress warning alerts if critical VRAM saturation is already firing on the same device
      - source_matchers:
          - alertname = "GPUVRAMCriticalSaturation"
        target_matchers:
          - alertname = "GPUVRAMSaturationWarning"
        equal: ["device_id", "instance"]

Notification Formatting Templates (k8s/monitoring/alertmanager-templates-cm.yaml)
Creates unified, action-oriented message blocks with direct links to Grafana dashboards and Kubernetes pod logs.
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-templates
  namespace: monitoring
data:
  gpu-alerts.tmpl: |
    {{ define "slack.gpu.title" }}
      [{{ .Status | toUpper }}{{ if eq .Status "firing" }}:{{ .Alerts.Firing | len }}{{ end }}] {{ .CommonLabels.alertname }} - {{ .CommonLabels.service }}
    {{ end }}

    {{ define "slack.gpu.text" }}
      {{ range .Alerts }}
        *Alert:* `{{ .Labels.alertname }}` (Severity: `{{ .Labels.severity }}`)
        *Component:* {{ .Annotations.summary }}
        *Description:* {{ .Annotations.description }}
        *Device / Pod:* `{{ .Labels.device_id }}{{ if .Labels.pod }}{{ .Labels.pod }}{{ end }}`
        *Started At:* <!date^{{ .StartsAt.Unix }}^{date_num} {time_secs}|{{ .StartsAt }}>
        ---
      {{ end }}
      *Action:* <https://grafana.viralvision.io/d/gpu-telemetry?var-device={{ .CommonLabels.device_id }}|Open GPU Dashboard> | <https://argocd.viralvision.io/applications/viralvision-production|Inspect ArgoCD>
    {{ end }}

    {{ define "discord.gpu.title" }}
      [{{ .Status | toUpper }}] {{ .CommonLabels.alertname }} ({{ .CommonLabels.severity }})
    {{ end }}

    {{ define "discord.gpu.message" }}
      {{ range .Alerts }}
        **Summary:** {{ .Annotations.summary }}
        **Description:** {{ .Annotations.description }}
        **Affected Device:** `{{ .Labels.device_id }}`
        **Node/Host:** `{{ .Labels.instance }}`
      {{ end }}
      **Grafana Telemetry:** https://grafana.viralvision.io/d/gpu-telemetry
    {{ end }}

Deployment & Testing Verification
 * Apply the manifests:
   kubectl apply -f k8s/monitoring/alertmanager-templates-cm.yaml
kubectl apply -f k8s/monitoring/alertmanager-secret.yaml
kubectl apply -f k8s/monitoring/prometheus-rules-gpu.yaml

 * Validate rule evaluation in Prometheus:
   # Verify rule syntax and compilation inside Prometheus pod
promtool check rules k8s/monitoring/prometheus-rules-gpu.yaml

 * Trigger a synthetic alert via Alertmanager API to test webhook routing:
   curl -H "Content-Type: application/json" -d '[{
  "labels": {
    "alertname": "TranscodeJobOOMKilled",
    "service": "video-worker",
    "severity": "critical",
    "tier": "transcode-cluster",
    "device_id": "gpu-0",
    "instance": "g5.2xlarge-node-1"
  },
  "annotations": {
    "summary": "Simulated GPU CUDA OOM Execution Abort",
    "description": "Synthetic test triggering the transcode OOM routing pipeline."
  }
}]' http://alertmanager-operated.monitoring.svc:9093/api/v2/alerts

Prometheus ServiceMonitors & PodMonitors (k8s/monitoring/service-monitors.yaml)
Links the Prometheus Operator scraping engine to the FastAPI core gateway metrics endpoint (:8000/metrics), the standalone Celery GPU worker metrics exporter (:9100/metrics), and the NVIDIA DCGM hardware exporter.
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: viralvision-api-monitor
  namespace: production
  labels:
    release: prometheus-stack
spec:
  selector:
    matchLabels:
      app: viralvision-api
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
      scrapeTimeout: 10s
---
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: viralvision-worker-monitor
  namespace: production
  labels:
    release: prometheus-stack
spec:
  selector:
    matchLabels:
      app: viralvision-video-worker
  podMetricsEndpoints:
    - port: telemetry # Worker Prometheus HTTP server started on port 9100
      path: /metrics
      interval: 10s
      scrapeTimeout: 5s
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: nvidia-dcgm-exporter
  namespace: gpu-operator
  labels:
    release: prometheus-stack
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: nvidia-dcgm-exporter
  endpoints:
    - port: gpu-metrics
      path: /metrics
      interval: 5s
      scrapeTimeout: 4s

Production Grafana Dashboard Specification (k8s/monitoring/grafana-dashboard-cm.yaml)
Defines a complete Grafana operations dashboard tracking active NVENC transcoding sessions, VRAM consumption, queue backlogs across SLA tiers, and Celery error rates.
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboard-gpu-transcode
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  gpu-transcode-overview.json: |
    {
      "annotations": { "list": [] },
      "editable": false,
      "fiscalYearStartMonth": 0,
      "graphTooltip": 1,
      "id": null,
      "links": [],
      "liveNow": false,
      "panels": [
        {
          "collapsed": false,
          "gridPos": { "h": 1, "w": 24, "x": 0, "y": 0 },
          "id": 1,
          "title": "GPU Hardware Telemetry & VRAM Allocation",
          "type": "row"
        },
        {
          "datasource": { "type": "prometheus", "uid": "prometheus" },
          "fieldConfig": {
            "defaults": {
              "color": { "mode": "thresholds" },
              "max": 100,
              "min": 0,
              "thresholds": {
                "mode": "absolute",
                "steps": [
                  { "color": "green", "value": null },
                  { "color": "orange", "value": 80 },
                  { "color": "red", "value": 92 }
                ]
              },
              "unit": "percent"
            }
          },
          "gridPos": { "h": 8, "w": 8, "x": 0, "y": 1 },
          "id": 2,
          "options": {
            "orientation": "auto",
            "reduceOptions": { "calcs": ["lastNotNull"], "fields": "", "values": false },
            "showThresholdLabels": false,
            "showThresholdMarkers": true
          },
          "pluginVersion": "10.2.0",
          "targets": [
            {
              "expr": "viralvision_gpu_vram_usage_percentage",
              "legendFormat": "{{device_id}} VRAM",
              "refId": "A"
            }
          ],
          "title": "GPU Memory (VRAM) Utilization",
          "type": "gauge"
        },
        {
          "datasource": { "type": "prometheus", "uid": "prometheus" },
          "fieldConfig": {
            "defaults": {
              "custom": {
                "drawStyle": "line",
                "lineInterpolation": "smooth",
                "lineWidth": 2
              },
              "unit": "short"
            }
          },
          "gridPos": { "h": 8, "w": 16, "x": 8, "y": 1 },
          "id": 3,
          "targets": [
            {
              "expr": "sum(viralvision_active_transcodes) by (tier)",
              "legendFormat": "Active ({{tier}})",
              "refId": "A"
            },
            {
              "expr": "sum(rate(viralvision_render_failures_total[2m])) by (reason)",
              "legendFormat": "Failures: {{reason}}",
              "refId": "B"
            }
          ],
          "title": "Active Encoding Streams vs. Failures",
          "type": "timeseries"
        },
        {
          "collapsed": false,
          "gridPos": { "h": 1, "w": 24, "x": 0, "y": 9 },
          "id": 4,
          "title": "Queue Pressures & Pipeline Latencies",
          "type": "row"
        },
        {
          "datasource": { "type": "prometheus", "uid": "prometheus" },
          "fieldConfig": {
            "defaults": {
              "custom": { "fillOpacity": 20, "lineWidth": 2 },
              "unit": "s"
            }
          },
          "gridPos": { "h": 8, "w": 12, "x": 0, "y": 10 },
          "id": 5,
          "targets": [
            {
              "expr": "histogram_quantile(0.95, sum(rate(viralvision_transcode_duration_seconds_bucket[5m])) by (le, tier))",
              "legendFormat": "p95 Duration ({{tier}})",
              "refId": "A"
            },
            {
              "expr": "histogram_quantile(0.50, sum(rate(viralvision_transcode_duration_seconds_bucket[5m])) by (le, tier))",
              "legendFormat": "p50 Duration ({{tier}})",
              "refId": "B"
            }
          ],
          "title": "Transcode Execution Latency (p50 / p95)",
          "type": "timeseries"
        },
        {
          "datasource": { "type": "prometheus", "uid": "prometheus" },
          "fieldConfig": {
            "defaults": {
              "custom": { "fillOpacity": 15, "lineWidth": 2 },
              "unit": "short"
            }
          },
          "gridPos": { "h": 8, "w": 12, "x": 12, "y": 10 },
          "id": 6,
          "targets": [
            {
              "expr": "redis_queue_length{queue='premium_sla'}",
              "legendFormat": "Queue: Premium SLA",
              "refId": "A"
            },
            {
              "expr": "redis_queue_length{queue='standard_jobs'}",
              "legendFormat": "Queue: Standard Jobs",
              "refId": "B"
            },
            {
              "expr": "redis_queue_length{queue='draft_preview'}",
              "legendFormat": "Queue: Draft Previews",
              "refId": "C"
            }
          ],
          "title": "Redis Queue Backlog Depth (KEDA Scaling Trigger)",
          "type": "timeseries"
        }
      ],
      "refresh": "10s",
      "schemaVersion": 38,
      "style": "dark",
      "tags": ["viralvision", "gpu", "nvenc", "production"],
      "time": { "from": "now-1h", "to": "now" },
      "timepicker": { "refresh_intervals": ["5s", "10s", "30s", "1m"] },
      "timezone": "browser",
      "title": "ViralVision GPU Rendering Pipeline",
      "uid": "viralvision-gpu-pipeline"
    }

Zero-Downtime Database Migration Job (k8s/jobs/db-migration-job.yaml)
Executes Alembic migrations as an ArgoCD PreSync hook. The deployment pauses rollout until all schema changes, vector dimension checks, and table locks succeed.
apiVersion: batch/v1
kind: Job
metadata:
  name: viralvision-db-migration
  namespace: production
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: BeforeHookCreation,HookSucceeded
spec:
  backoffLimit: 2
  activeDeadlineSeconds: 300
  template:
    metadata:
      labels:
        app: viralvision-db-migration
    spec:
      restartPolicy: Never
      containers:
        - name: alembic-migrator
          image: ghcr.io/viralvision/api:latest
          imagePullPolicy: IfNotPresent
          command:
            - "alembic"
            - "upgrade"
            - "head"
          envFrom:
            - secretRef:
                name: viralvision-production-secrets
            - configMapRef:
                name: viralvision-production-config
          resources:
            limits:
              cpu: "1"
              memory: 1Gi
            requests:
              cpu: "250m"
              memory: 512Mi

Automated PostgreSQL Backup & S3 Encryption CronJob (k8s/cron/postgres-backup-cronjob.yaml)
Executes a nightly database snapshot, streams the data through AES-256 (gpg), uploads the archive to cold object storage, and purges backups older than 30 days.
apiVersion: batch/v1
kind: CronJob
metadata:
  name: viralvision-postgres-backup
  namespace: production
spec:
  schedule: "0 3 * * *" # Daily at 03:00 UTC
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: pg-dump-backup
              image: postgres:16-alpine
              command: ["/bin/sh", "-c"]
              args:
                - |
                  set -eo pipefail
                  apk add --no-cache aws-cli gnupg

                  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
                  BACKUP_FILE="/tmp/viralvision_db_${TIMESTAMP}.sql.gz.enc"
                  S3_TARGET="s3://${S3_BACKUP_BUCKET}/database-snapshots/viralvision_db_${TIMESTAMP}.sql.gz.enc"

                  echo "[*] Creating compressed PostgreSQL archive..."
                  pg_dump -h postgres.production.svc.cluster.local -U postgres viralvision | \
                    gzip -9 | \
                    gpg --symmetric --batch --yes --passphrase "${BACKUP_ENCRYPTION_KEY}" -o "${BACKUP_FILE}"

                  echo "[*] Uploading encrypted archive to S3..."
                  aws s3 cp "${BACKUP_FILE}" "${S3_TARGET}" --sse AES256

                  echo "[*] Pruning snapshots older than 30 days..."
                  aws s3 rm "s3://${S3_BACKUP_BUCKET}/database-snapshots/" --recursive --exclude "*" --include "viralvision_db_*.sql.gz.enc" \
                    | awk '{print $4}' \
                    | while read -r file; do
                        FILE_DATE=$(echo "$file" | grep -oE '[0-9]{8}')
                        LIMIT_DATE=$(date -d "30 days ago" +%Y%m%d 2>/dev/null || date -v-30d +%Y%m%d)
                        if [ "$FILE_DATE" -lt "$LIMIT_DATE" ]; then
                          aws s3 rm "s3://${S3_BACKUP_BUCKET}/database-snapshots/${file}"
                        fi
                      done

                  rm -f "${BACKUP_FILE}"
                  echo "[+] Database backup and rotation completed successfully."
              env:
                - name: PGPASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: viralvision-production-secrets
                      key: POSTGRES_PASSWORD
                - name: S3_BACKUP_BUCKET
                  valueFrom:
                    configMapRef:
                      name: viralvision-production-config
                      key: S3_BACKUP_BUCKET
                - name: BACKUP_ENCRYPTION_KEY
                  valueFrom:
                    secretKeyRef:
                      name: viralvision-production-secrets
                      key: BACKUP_ENCRYPTION_KEY
                - name: AWS_ACCESS_KEY_ID
                  valueFrom:
                    secretKeyRef:
                      name: viralvision-production-secrets
                      key: AWS_ACCESS_KEY_ID
                - name: AWS_SECRET_ACCESS_KEY
                  valueFrom:
                    secretKeyRef:
                      name: viralvision-production-secrets
                      key: AWS_SECRET_ACCESS_KEY
                - name: AWS_DEFAULT_REGION
                  value: "us-east-1"
              resources:
                limits:
                  cpu: "2"
                  memory: 4Gi
                requests:
                  cpu: "500m"
                  memory: 1Gi

Prometheus ServiceMonitors & PodMonitors (k8s/monitoring/service-monitors.yaml)
Links the Prometheus Operator scraping engine to the FastAPI core gateway metrics endpoint (:8000/metrics), the standalone Celery GPU worker metrics exporter (:9100/metrics), and the NVIDIA DCGM hardware exporter.
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: viralvision-api-monitor
  namespace: production
  labels:
    release: prometheus-stack
spec:
  selector:
    matchLabels:
      app: viralvision-api
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
      scrapeTimeout: 10s
---
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: viralvision-worker-monitor
  namespace: production
  labels:
    release: prometheus-stack
spec:
  selector:
    matchLabels:
      app: viralvision-video-worker
  podMetricsEndpoints:
    - port: telemetry # Worker Prometheus HTTP server started on port 9100
      path: /metrics
      interval: 10s
      scrapeTimeout: 5s
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: nvidia-dcgm-exporter
  namespace: gpu-operator
  labels:
    release: prometheus-stack
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: nvidia-dcgm-exporter
  endpoints:
    - port: gpu-metrics
      path: /metrics
      interval: 5s
      scrapeTimeout: 4s

Production Grafana Dashboard Specification (k8s/monitoring/grafana-dashboard-cm.yaml)
Defines a complete Grafana operations dashboard tracking active NVENC transcoding sessions, VRAM consumption, queue backlogs across SLA tiers, and Celery error rates.
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboard-gpu-transcode
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  gpu-transcode-overview.json: |
    {
      "annotations": { "list": [] },
      "editable": false,
      "fiscalYearStartMonth": 0,
      "graphTooltip": 1,
      "id": null,
      "links": [],
      "liveNow": false,
      "panels": [
        {
          "collapsed": false,
          "gridPos": { "h": 1, "w": 24, "x": 0, "y": 0 },
          "id": 1,
          "title": "GPU Hardware Telemetry & VRAM Allocation",
          "type": "row"
        },
        {
          "datasource": { "type": "prometheus", "uid": "prometheus" },
          "fieldConfig": {
            "defaults": {
              "color": { "mode": "thresholds" },
              "max": 100,
              "min": 0,
              "thresholds": {
                "mode": "absolute",
                "steps": [
                  { "color": "green", "value": null },
                  { "color": "orange", "value": 80 },
                  { "color": "red", "value": 92 }
                ]
              },
              "unit": "percent"
            }
          },
          "gridPos": { "h": 8, "w": 8, "x": 0, "y": 1 },
          "id": 2,
          "options": {
            "orientation": "auto",
            "reduceOptions": { "calcs": ["lastNotNull"], "fields": "", "values": false },
            "showThresholdLabels": false,
            "showThresholdMarkers": true
          },
          "pluginVersion": "10.2.0",
          "targets": [
            {
              "expr": "viralvision_gpu_vram_usage_percentage",
              "legendFormat": "{{device_id}} VRAM",
              "refId": "A"
            }
          ],
          "title": "GPU Memory (VRAM) Utilization",
          "type": "gauge"
        },
        {
          "datasource": { "type": "prometheus", "uid": "prometheus" },
          "fieldConfig": {
            "defaults": {
              "custom": {
                "drawStyle": "line",
                "lineInterpolation": "smooth",
                "lineWidth": 2
              },
              "unit": "short"
            }
          },
          "gridPos": { "h": 8, "w": 16, "x": 8, "y": 1 },
          "id": 3,
          "targets": [
            {
              "expr": "sum(viralvision_active_transcodes) by (tier)",
              "legendFormat": "Active ({{tier}})",
              "refId": "A"
            },
            {
              "expr": "sum(rate(viralvision_render_failures_total[2m])) by (reason)",
              "legendFormat": "Failures: {{reason}}",
              "refId": "B"
            }
          ],
          "title": "Active Encoding Streams vs. Failures",
          "type": "timeseries"
        },
        {
          "collapsed": false,
          "gridPos": { "h": 1, "w": 24, "x": 0, "y": 9 },
          "id": 4,
          "title": "Queue Pressures & Pipeline Latencies",
          "type": "row"
        },
        {
          "datasource": { "type": "prometheus", "uid": "prometheus" },
          "fieldConfig": {
            "defaults": {
              "custom": { "fillOpacity": 20, "lineWidth": 2 },
              "unit": "s"
            }
          },
          "gridPos": { "h": 8, "w": 12, "x": 0, "y": 10 },
          "id": 5,
          "targets": [
            {
              "expr": "histogram_quantile(0.95, sum(rate(viralvision_transcode_duration_seconds_bucket[5m])) by (le, tier))",
              "legendFormat": "p95 Duration ({{tier}})",
              "refId": "A"
            },
            {
              "expr": "histogram_quantile(0.50, sum(rate(viralvision_transcode_duration_seconds_bucket[5m])) by (le, tier))",
              "legendFormat": "p50 Duration ({{tier}})",
              "refId": "B"
            }
          ],
          "title": "Transcode Execution Latency (p50 / p95)",
          "type": "timeseries"
        },
        {
          "datasource": { "type": "prometheus", "uid": "prometheus" },
          "fieldConfig": {
            "defaults": {
              "custom": { "fillOpacity": 15, "lineWidth": 2 },
              "unit": "short"
            }
          },
          "gridPos": { "h": 8, "w": 12, "x": 12, "y": 10 },
          "id": 6,
          "targets": [
            {
              "expr": "redis_queue_length{queue='premium_sla'}",
              "legendFormat": "Queue: Premium SLA",
              "refId": "A"
            },
            {
              "expr": "redis_queue_length{queue='standard_jobs'}",
              "legendFormat": "Queue: Standard Jobs",
              "refId": "B"
            },
            {
              "expr": "redis_queue_length{queue='draft_preview'}",
              "legendFormat": "Queue: Draft Previews",
              "refId": "C"
            }
          ],
          "title": "Redis Queue Backlog Depth (KEDA Scaling Trigger)",
          "type": "timeseries"
        }
      ],
      "refresh": "10s",
      "schemaVersion": 38,
      "style": "dark",
      "tags": ["viralvision", "gpu", "nvenc", "production"],
      "time": { "from": "now-1h", "to": "now" },
      "timepicker": { "refresh_intervals": ["5s", "10s", "30s", "1m"] },
      "timezone": "browser",
      "title": "ViralVision GPU Rendering Pipeline",
      "uid": "viralvision-gpu-pipeline"
    }

Zero-Downtime Database Migration Job (k8s/jobs/db-migration-job.yaml)
Executes Alembic migrations as an ArgoCD PreSync hook. The deployment pauses rollout until all schema changes, vector dimension checks, and table locks succeed.
apiVersion: batch/v1
kind: Job
metadata:
  name: viralvision-db-migration
  namespace: production
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: BeforeHookCreation,HookSucceeded
spec:
  backoffLimit: 2
  activeDeadlineSeconds: 300
  template:
    metadata:
      labels:
        app: viralvision-db-migration
    spec:
      restartPolicy: Never
      containers:
        - name: alembic-migrator
          image: ghcr.io/viralvision/api:latest
          imagePullPolicy: IfNotPresent
          command:
            - "alembic"
            - "upgrade"
            - "head"
          envFrom:
            - secretRef:
                name: viralvision-production-secrets
            - configMapRef:
                name: viralvision-production-config
          resources:
            limits:
              cpu: "1"
              memory: 1Gi
            requests:
              cpu: "250m"
              memory: 512Mi

Automated PostgreSQL Backup & S3 Encryption CronJob (k8s/cron/postgres-backup-cronjob.yaml)
Executes a nightly database snapshot, streams the data through AES-256 (gpg), uploads the archive to cold object storage, and purges backups older than 30 days.
apiVersion: batch/v1
kind: CronJob
metadata:
  name: viralvision-postgres-backup
  namespace: production
spec:
  schedule: "0 3 * * *" # Daily at 03:00 UTC
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: pg-dump-backup
              image: postgres:16-alpine
              command: ["/bin/sh", "-c"]
              args:
                - |
                  set -eo pipefail
                  apk add --no-cache aws-cli gnupg

                  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
                  BACKUP_FILE="/tmp/viralvision_db_${TIMESTAMP}.sql.gz.enc"
                  S3_TARGET="s3://${S3_BACKUP_BUCKET}/database-snapshots/viralvision_db_${TIMESTAMP}.sql.gz.enc"

                  echo "[*] Creating compressed PostgreSQL archive..."
                  pg_dump -h postgres.production.svc.cluster.local -U postgres viralvision | \
                    gzip -9 | \
                    gpg --symmetric --batch --yes --passphrase "${BACKUP_ENCRYPTION_KEY}" -o "${BACKUP_FILE}"

                  echo "[*] Uploading encrypted archive to S3..."
                  aws s3 cp "${BACKUP_FILE}" "${S3_TARGET}" --sse AES256

                  echo "[*] Pruning snapshots older than 30 days..."
                  aws s3 rm "s3://${S3_BACKUP_BUCKET}/database-snapshots/" --recursive --exclude "*" --include "viralvision_db_*.sql.gz.enc" \
                    | awk '{print $4}' \
                    | while read -r file; do
                        FILE_DATE=$(echo "$file" | grep -oE '[0-9]{8}')
                        LIMIT_DATE=$(date -d "30 days ago" +%Y%m%d 2>/dev/null || date -v-30d +%Y%m%d)
                        if [ "$FILE_DATE" -lt "$LIMIT_DATE" ]; then
                          aws s3 rm "s3://${S3_BACKUP_BUCKET}/database-snapshots/${file}"
                        fi
                      done

                  rm -f "${BACKUP_FILE}"
                  echo "[+] Database backup and rotation completed successfully."
              env:
                - name: PGPASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: viralvision-production-secrets
                      key: POSTGRES_PASSWORD
                - name: S3_BACKUP_BUCKET
                  valueFrom:
                    configMapRef:
                      name: viralvision-production-config
                      key: S3_BACKUP_BUCKET
                - name: BACKUP_ENCRYPTION_KEY
                  valueFrom:
                    secretKeyRef:
                      name: viralvision-production-secrets
                      key: BACKUP_ENCRYPTION_KEY
                - name: AWS_ACCESS_KEY_ID
                  valueFrom:
                    secretKeyRef:
                      name: viralvision-production-secrets
                      key: AWS_ACCESS_KEY_ID
                - name: AWS_SECRET_ACCESS_KEY
                  valueFrom:
                    secretKeyRef:
                      name: viralvision-production-secrets
                      key: AWS_SECRET_ACCESS_KEY
                - name: AWS_DEFAULT_REGION
                  value: "us-east-1"
              resources:
                limits:
                  cpu: "2"
                  memory: 4Gi
                requests:
                  cpu: "500m"
                  memory: 1Gi

