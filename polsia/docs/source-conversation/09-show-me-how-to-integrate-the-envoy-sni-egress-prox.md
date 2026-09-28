# Show me how to integrate the Envoy SNI egress proxy directly into our docker-compose.yml file alongside the Celery worker and sandbox.

> Status in this repo: Deferred: Envoy SNI egress proxy

This architecture pairs an **Envoy egress proxy** with Docker's native **`internal: true`** network driver. This eliminates manual host `iptables` scripting: the Docker daemon automatically drops all outbound WAN routing for the sandbox, forcing all agent traffic through the dual-homed Envoy container on a dedicated HTTP `CONNECT` forward-proxy port.

---

### Network & Container Topology

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 public_net (WAN Access)                │
                  └──────▲───────────────▲──────────────────────────▲──────┘
                         │               │                          │
                   ┌─────┴─────┐   ┌─────┴──────────┐        ┌──────┴──────┐
                   │  FastAPI  │   │  Celery Beat   │        │    Redis    │
                   │    App    │   │   Scheduler    │        │   Broker    │
                   └───────────┘   └────────────────┘        └─────────────┘
                                                                    ▲
                                                                    │
                   ┌────────────────────────────────────────┐       │
                   │             Celery Worker              ├───────┘
                   │  - Runs BaseAgent                      │
                   │  - Mounts /var/run/docker.sock         │
                   └───────────────────┬────────────────────┘
                                       │ Spawns via Docker SDK
                                       ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │                      sandbox_net (internal: true, NO WAN)                    │
 │                                                                              │
 │   ┌───────────────────────────┐                ┌─────────────────────────┐   │
 │   │  polsia-agent-sandbox     │  HTTP CONNECT  │      envoy-proxy        │   │
 │   │  (gVisor / runsc runtime) ├───────────────►│  (Dual-Homed Gateway)   ├───┼──► Internet
 │   │  HTTPS_PROXY=envoy:10001  │  Port 10001    │  Whitelist:             │   │    (Anthropic
 │   └───────────────────────────┘                │  - api.anthropic.com    │   │     & GitHub only)
 │                                                │  - github.com           │   │
 └────────────────────────────────────────────────┴─────────────────────────┴───┘
```

---

## 1. Envoy Proxy Configuration (`envoy/envoy.yaml`)

This configuration configures Envoy as an HTTP `CONNECT` forward proxy. It inspects the target hostname in the connection request, allows only whitelisted domains, and drops any unauthorized egress with an HTTP `403 Forbidden`.

```yaml
static_resources:
  listeners:
  - name: egress_forward_proxy
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 10001
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          stat_prefix: egress_proxy
          http_protocol_options:
            accept_http_10: true
          upgrade_configs:
          - upgrade_type: CONNECT
          route_config:
            name: egress_routes
            virtual_hosts:
            # 1. Allow Anthropic API
            - name: anthropic_api
              domains:
              - "api.anthropic.com:443"
              - "api.anthropic.com"
              routes:
              - match:
                  connect_matcher: {}
                route:
                  cluster: anthropic_upstream
                  upgrade_configs:
                  - upgrade_type: CONNECT
                    connect_config: {}

            # 2. Allow GitHub Web & Git Operations
            - name: github_core
              domains:
              - "github.com:443"
              - "github.com"
              routes:
              - match:
                  connect_matcher: {}
                route:
                  cluster: github_upstream
                  upgrade_configs:
                  - upgrade_type: CONNECT
                    connect_config: {}

            # 3. Allow GitHub REST API
            - name: github_api
              domains:
              - "api.github.com:443"
              - "api.github.com"
              routes:
              - match:
                  connect_matcher: {}
                route:
                  cluster: github_api_upstream
                  upgrade_configs:
                  - upgrade_type: CONNECT
                    connect_config: {}

          http_filters:
          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router

  clusters:
  - name: anthropic_upstream
    connect_timeout: 5s
    type: LOGICAL_DNS
    dns_lookup_family: V4_ONLY
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: anthropic_upstream
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: api.anthropic.com
                port_value: 443

  - name: github_upstream
    connect_timeout: 5s
    type: LOGICAL_DNS
    dns_lookup_family: V4_ONLY
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: github_upstream
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: github.com
                port_value: 443

  - name: github_api_upstream
    connect_timeout: 5s
    type: LOGICAL_DNS
    dns_lookup_family: V4_ONLY
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: github_api_upstream
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: api.github.com
                port_value: 443
```

---

## 2. Updated `docker-compose.yml`

This setup defines two networks:
* **`public_net`:** Standard bridge network with public gateway access.
* **`sandbox_net`:** Internal network (`internal: true`). Docker injects kernel rules preventing containers on this network from routing directly to the default gateway or WAN.

```yaml
version: '3.8'

networks:
  public_net:
    driver: bridge
  sandbox_net:
    driver: bridge
    internal: true  # Absolute egress quarantine: no WAN routing allowed

services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    networks:
      - public_net

  envoy:
    image: envoyproxy/envoy:v1.30-latest
    restart: unless-stopped
    volumes:
      - ./envoy/envoy.yaml:/etc/envoy/envoy.yaml:ro
    command: ["-c", "/etc/envoy/envoy.yaml", "--log-level", "warn"]
    networks:
      - sandbox_net  # Listens on internal network for sandbox requests
      - public_net   # Routes authorized outbound requests to external APIs

  api:
    build: .
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ports:
      - "8000:8000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - REDIS_URL=redis://redis:6379/0
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    volumes:
      - .:/workspace
    depends_on:
      - redis
    networks:
      - public_net

  celery_worker:
    build: .
    command: celery -A app.celery_app worker --loglevel=info --concurrency=2
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - REDIS_URL=redis://redis:6379/0
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    volumes:
      - .:/workspace
      - /var/run/docker.sock:/var/run/docker.sock  # Allows spawning sandbox containers
    depends_on:
      - redis
      - envoy
    networks:
      - public_net
      - sandbox_net

  celery_beat:
    build: .
    command: celery -A app.celery_app beat --loglevel=info
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - .:/workspace
    depends_on:
      - redis
    networks:
      - public_net
```

---

## 3. Sandboxed Container Execution Driver (`app/sandbox/gvisor_runner.py`)

When Celery launches a Claude Code subprocess, it attaches the ephemeral container exclusively to `sandbox_net` and injects the proxy configuration:

```python
import os
import json
import docker
from typing import Dict, Any, List, Optional
from app.config import settings

client = docker.from_env()

class GVisorExecutionError(Exception):
    pass

def run_in_gvisor_sandbox(
    prompt: str,
    workspace_dir: str,
    system_prompt: Optional[str] = None,
    allowed_tools: Optional[List[str]] = None,
    timeout_seconds: int = 300,
) -> Dict[str, Any]:
    cmd = ["-p", prompt, "--output-format", "json"]

    if allowed_tools:
        cmd.extend(["--allowedTools", ",".join(allowed_tools)])
    else:
        cmd.extend(["--permission-mode", "bypassPermissions"])

    if system_prompt:
        cmd.extend(["--append-system-prompt", system_prompt])

    # Direct all HTTP/HTTPS and Git traffic strictly through Envoy
    env_vars = {
        "ANTHROPIC_API_KEY": settings.ANTHROPIC_API_KEY,
        "HTTP_PROXY": "http://envoy:10001",
        "HTTPS_PROXY": "http://envoy:10001",
        "ALL_PROXY": "http://envoy:10001",
        "GIT_CONFIG_PARAMETERS": "'http.proxy=http://envoy:10001'",
        "NO_PROXY": "localhost,127.0.0.1",
    }

    try:
        container = client.containers.run(
            image="polsia-agent-sandbox:latest",
            command=cmd,
            runtime="runsc",                      # gVisor user-space isolation
            network="polsia_sandbox_net",          # Docker internal: true network
            working_dir="/workspace",
            volumes={
                os.path.abspath(workspace_dir): {
                    "bind": "/workspace",
                    "mode": "rw"
                }
            },
            environment=env_vars,
            mem_limit="1g",
            nano_cpus=2_000_000_000,
            pids_limit=100,
            remove=False,
            detach=True,
            user="1000:1000",
        )

        try:
            res = container.wait(timeout=timeout_seconds)
            exit_code = res.get("StatusCode", 1)
            stdout = container.logs(stdout=True, stderr=False).decode("utf-8")
            stderr = container.logs(stdout=False, stderr=True).decode("utf-8")

            if exit_code != 0:
                raise GVisorExecutionError(f"Container exited with code {exit_code}: {stderr}")

            try:
                return json.loads(stdout)
            except json.JSONDecodeError:
                return {"result": stdout.strip(), "raw": True}

        finally:
            container.remove(force=True)

    except Exception as e:
        raise GVisorExecutionError(f"Sandboxing error: {str(e)}")
```

---

## 4. Operational Verification

Run a quick test container inside `sandbox_net` to verify egress rules before running agents:

```bash
# 1. Start the stack
docker-compose up -d

# 2. Test permitted destination (Anthropic API returns 401/405 from the API, proving handshake reached Anthropic)
docker run --rm \
  --network polsia_sandbox_net \
  -e HTTPS_PROXY="http://envoy:10001" \
  curlimages/curl:latest -s -I https://api.anthropic.com/v1/messages

# Output: HTTP/1.1 405 Method Not Allowed (Connection succeeded through Envoy)

# 3. Test permitted destination (GitHub API)
docker run --rm \
  --network polsia_sandbox_net \
  -e HTTPS_PROXY="http://envoy:10001" \
  curlimages/curl:latest -s -I https://api.github.com/zen

# Output: HTTP/1.1 200 OK (Connection succeeded through Envoy)

# 4. Test blocked destination (Unauthorized egress attempt)
docker run --rm \
  --network polsia_sandbox_net \
  -e HTTPS_PROXY="http://envoy:10001" \
  curlimages/curl:latest -s -I https://google.com

# Output: HTTP/1.1 403 Forbidden (Blocked immediately by Envoy egress whitelist)

# 5. Test bypassing proxy directly to WAN
docker run --rm \
  --network polsia_sandbox_net \
  curlimages/curl:latest --max-time 3 -s -I https://1.1.1.1

# Output: curl: (28) Failed to connect (Dropped by Docker's internal: true bridge)
```
