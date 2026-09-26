"""Prometheus metrics exported by the API process and by GPU render workers.

Scraped by the `ServiceMonitor`/`PodMonitor` resources in
`k8s/monitoring/service-monitors.yaml`.
"""
import time

from prometheus_client import Counter, Gauge, Histogram, start_http_server

ACTIVE_TRANSCODE_GAUGE = Gauge(
    "viral_trending_active_transcodes",
    "Current active video encoding jobs running across the cluster",
    ["tier"],
)

TRANSCODE_DURATION_HISTOGRAM = Histogram(
    "viral_trending_transcode_duration_seconds",
    "Time taken to render and transcode videos end-to-end",
    ["tier", "status"],
    buckets=(10, 30, 60, 90, 120, 180, 240, 300, 450, 600),
)

GPU_VRAM_UTILIZATION_PERCENT = Gauge(
    "viral_trending_gpu_vram_usage_percentage",
    "VRAM percentage utilization on active video encoding GPU nodes",
    ["device_id"],
)

FAILED_RENDERS_COUNTER = Counter(
    "viral_trending_render_failures_total",
    "Total failed video generation tasks",
    ["reason"],
)

DOMAIN_SSL_EXPIRY_DAYS = Gauge(
    "viral_trending_custom_domain_ssl_expiry_days",
    "Days remaining until a custom domain's SSL certificate expires",
    ["workspace_id", "domain"],
)

DOMAIN_DNS_STATUS = Gauge(
    "viral_trending_custom_domain_dns_valid",
    "Whether a custom domain's CNAME resolves to the platform edge (1=valid, 0=invalid)",
    ["workspace_id", "domain"],
)

DOMAIN_PROBE_ERRORS = Counter(
    "viral_trending_custom_domain_probe_errors_total",
    "Total connection or probe errors during domain verification",
    ["workspace_id", "domain", "error_type"],
)


def start_metrics_server(port: int = 9100) -> None:
    start_http_server(port)


def record_nvml_gpu_telemetry() -> None:
    """Pulls hardware VRAM usage via pynvml when NVIDIA hardware is present."""
    try:
        import pynvml

        pynvml.nvmlInit()
        try:
            for i in range(pynvml.nvmlDeviceGetCount()):
                handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
                usage_pct = (mem.used / mem.total) * 100.0
                GPU_VRAM_UTILIZATION_PERCENT.labels(device_id=f"gpu-{i}").set(round(usage_pct, 2))
        finally:
            pynvml.nvmlShutdown()
    except Exception:
        # No NVIDIA driver/library available (e.g. CPU-only dev machine).
        pass


class TrackTranscodeLatency:
    """Context manager recording an in-flight transcode's duration."""

    def __init__(self, tier: str):
        self.tier = tier
        self.start_time = 0.0

    def __enter__(self) -> "TrackTranscodeLatency":
        ACTIVE_TRANSCODE_GAUGE.labels(tier=self.tier).inc()
        self.start_time = time.time()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        duration = time.time() - self.start_time
        status_label = "failed" if exc_type else "completed"
        TRANSCODE_DURATION_HISTOGRAM.labels(tier=self.tier, status=status_label).observe(duration)
        ACTIVE_TRANSCODE_GAUGE.labels(tier=self.tier).dec()
        if exc_type:
            FAILED_RENDERS_COUNTER.labels(reason=exc_type.__name__).inc()
