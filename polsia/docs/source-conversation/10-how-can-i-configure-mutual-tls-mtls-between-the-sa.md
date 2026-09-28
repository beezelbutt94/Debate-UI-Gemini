# How can I configure mutual TLS (mTLS) between the sandboxed containers and Envoy to prevent network spoofing inside the container network?

> Status in this repo: Deferred: mTLS to Envoy

Standard CLI runtimes (like Node.js used by Claude Code) do not natively support passing client certificates through `HTTPS_PROXY` environment variables during HTTP `CONNECT` handshakes. 

To solve this, the sandbox uses a **loopback mTLS bridge**: inside each ephemeral sandbox container, a lightweight local forwarder (`ghostunnel` or `socat`) listens on `127.0.0.1:10001` and tunnels traffic over mTLS across `sandbox_net` to Envoy. Any rogue container or process on `sandbox_net` without a CA-signed client certificate is rejected at the TLS handshake.

---

### Network Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│  polsia-agent-sandbox (gVisor Container)                               │
│                                                                        │
│   Claude Code CLI                                                      │
│   HTTP_PROXY=http://127.0.0.1:10001                                    │
│          │ Plain HTTP                                                  │
│          ▼                                                             │
│   ghostunnel (Client Mode on 127.0.0.1:10001)                          │
│   - Holds client.crt & client.key                                      │
└──────────┬─────────────────────────────────────────────────────────────┘
           │
           │  mTLS Encrypted & Authenticated
           │  Network: sandbox_net (internal: true)
           ▼
┌────────────────────────────────────────────────────────────────────────┐
│  envoy-proxy (Gateway)                                                 │
│                                                                        │
│   Listener :10001                                                      │
│   - require_client_certificate: true                                   │
│   - Verifies client.crt against internal ca.crt                        │
│   - Whitelist filter (api.anthropic.com, github.com)                   │
└──────────┬─────────────────────────────────────────────────────────────┘
           │ Egress WAN (public_net)
           ▼
      Public APIs
```

---

## 1. Automated PKI Generation (`scripts/generate_certs.sh`)

Generate an internal Root Certificate Authority (CA), an Envoy server certificate, and an agent client certificate:

```bash
#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="./certs"
mkdir -p "$CERT_DIR"

# 1. Generate Internal Root CA
openssl req -x509 -new -nodes -sha256 -days 3650 \
  -newkey rsa:4096 \
  -keyout "$CERT_DIR/ca.key" \
  -out "$CERT_DIR/ca.crt" \
  -subj "/CN=Polsia-Internal-CA/O=Polsia/C=US"

# 2. Generate Envoy Server Certificate
openssl req -new -nodes -sha256 \
  -newkey rsa:2048 \
  -keyout "$CERT_DIR/envoy.key" \
  -out "$CERT_DIR/envoy.csr" \
  -subj "/CN=envoy/O=Polsia"

cat <<EOF > "$CERT_DIR/envoy.ext"
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = envoy
DNS.2 = localhost
EOF

openssl x509 -req -sha256 -days 365 \
  -in "$CERT_DIR/envoy.csr" \
  -CA "$CERT_DIR/ca.crt" \
  -CAkey "$CERT_DIR/ca.key" \
  -CAcreateserial \
  -out "$CERT_DIR/envoy.crt" \
  -extfile "$CERT_DIR/envoy.ext"

# 3. Generate Agent Sandbox Client Certificate
openssl req -new -nodes -sha256 \
  -newkey rsa:2048 \
  -keyout "$CERT_DIR/client.key" \
  -out "$CERT_DIR/client.csr" \
  -subj "/CN=agent-sandbox/O=Polsia"

cat <<EOF > "$CERT_DIR/client.ext"
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth
EOF

openssl x509 -req -sha256 -days 365 \
  -in "$CERT_DIR/client.csr" \
  -CA "$CERT_DIR/ca.crt" \
  -CAkey "$CERT_DIR/ca.key" \
  -CAcreateserial \
  -out "$CERT_DIR/client.crt" \
  -extfile "$CERT_DIR/client.ext"

# Set strict permissions
chmod 600 "$CERT_DIR"/*.key
chmod 644 "$CERT_DIR"/*.crt
rm -f "$CERT_DIR"/*.csr "$CERT_DIR"/*.ext "$CERT_DIR"/*.srl
echo "[+] PKI successfully created in $CERT_DIR"
```

---

## 2. Configure Envoy for Downstream mTLS (`envoy/envoy.yaml`)

Update the listener configuration to enable downstream TLS with `require_client_certificate: true`:

```yaml
static_resources:
  listeners:
  - name: egress_forward_proxy
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 10001
    listener_filters:
    - name: envoy.filters.listener.tls_inspector
      typed_config:
        "@type": type.googleapis.com/envoy.extensions.filters.listener.tls_inspector.v3.TlsInspector
    filter_chains:
    - transport_socket:
        name: envoy.transport_sockets.tls
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.DownstreamTlsContext
          require_client_certificate: true
          common_tls_context:
            tls_certificates:
            - certificate_chain:
                filename: /etc/envoy/certs/envoy.crt
              private_key:
                filename: /etc/envoy/certs/envoy.key
            validation_context:
              trusted_ca:
                filename: /etc/envoy/certs/ca.crt
      filters:
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
            - name: anthropic_api
              domains: ["api.anthropic.com:443", "api.anthropic.com"]
              routes:
              - match: { connect_matcher: {} }
                route:
                  cluster: anthropic_upstream
                  upgrade_configs: [{ upgrade_type: CONNECT }]

            - name: github_core
              domains: ["github.com:443", "github.com", "api.github.com:443", "api.github.com"]
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
              socket_address: { address: api.anthropic.com, port_value: 443 }

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
              socket_address: { address: github.com, port_value: 443 }
```

---

## 3. Sandbox Container with Loopback mTLS (`Dockerfile.agent-sandbox`)

Install `ghostunnel` into the sandbox image. The container starts `ghostunnel` in the background, which bridges unauthenticated local calls from `127.0.0.1:10001` to `envoy:10001` using mTLS:

```dockerfile
FROM node:20-slim

# Install system utilities & download static ghostunnel binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    build-essential \
    && curl -fsSL -o /usr/local/bin/ghostunnel https://github.com/ghostunnel/ghostunnel/releases/download/v1.7.1/ghostunnel-v1.7.1-linux-amd64 \
    && chmod +x /usr/local/bin/ghostunnel \
    && npm install -g @anthropic-ai/claude-code \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 sandboxuser

# Copy container entrypoint script
COPY scripts/entrypoint-sandbox.sh /usr/local/bin/entrypoint-sandbox.sh
RUN chmod +x /usr/local/bin/entrypoint-sandbox.sh

USER sandboxuser
WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint-sandbox.sh"]
```

### Sandbox Entrypoint Script (`scripts/entrypoint-sandbox.sh`)

```bash
#!/usr/bin/env bash
set -e

# Start background mTLS forwarder: 127.0.0.1:10001 -> envoy:10001 (mTLS)
ghostunnel client \
  --listen 127.0.0.1:10001 \
  --target envoy:10001 \
  --cert /etc/ssl/polsia/client.crt \
  --key /etc/ssl/polsia/client.key \
  --cacert /etc/ssl/polsia/ca.crt \
  --server-name envoy &

TUNNEL_PID=$!

# Ensure ghostunnel process exits on container termination
trap "kill $TUNNEL_PID 2>/dev/null || true" EXIT

# Wait briefly for local socket readiness
while ! nc -z 127.0.0.1 10001 2>/dev/null; do
  sleep 0.05
done

# Route all local tools through the loopback proxy
export HTTP_PROXY="http://127.0.0.1:10001"
export HTTPS_PROXY="http://127.0.0.1:10001"
export ALL_PROXY="http://127.0.0.1:10001"
export GIT_CONFIG_PARAMETERS="'http.proxy=http://127.0.0.1:10001'"

# Execute the requested command (claude -p ...)
exec claude "$@"
```

---

## 4. Compose Configuration & Volume Mounts (`docker-compose.yml`)

Mount the certificates into Envoy and ensure both services are linked across the internal network:

```yaml
version: '3.8'

networks:
  public_net:
    driver: bridge
  sandbox_net:
    driver: bridge
    internal: true  # Absolute egress quarantine

services:
  envoy:
    image: envoyproxy/envoy:v1.30-latest
    restart: unless-stopped
    volumes:
      - ./envoy/envoy.yaml:/etc/envoy/envoy.yaml:ro
      - ./certs:/etc/envoy/certs:ro
    command: ["-c", "/etc/envoy/envoy.yaml", "--log-level", "warn"]
    networks:
      - sandbox_net
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
      - ./certs:/certs:ro
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      - envoy
    networks:
      - public_net
      - sandbox_net
```

---

## 5. Mount Client Certs into Ephemeral Sandbox (`app/sandbox/gvisor_runner.py`)

Update the container creation call to mount the client certificates read-only:

```python
# In app/sandbox/gvisor_runner.py:

CERT_DIR = os.path.abspath("./certs")

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

    container = client.containers.run(
        image="polsia-agent-sandbox:latest",
        command=cmd,
        runtime="runsc",
        network="polsia_sandbox_net",
        working_dir="/workspace",
        volumes={
            os.path.abspath(workspace_dir): {
                "bind": "/workspace",
                "mode": "rw"
            },
            # Inject mTLS identity into the sandbox container
            CERT_DIR: {
                "bind": "/etc/ssl/polsia",
                "mode": "ro"
            }
        },
        environment={
            "ANTHROPIC_API_KEY": settings.ANTHROPIC_API_KEY,
            "NO_PROXY": "localhost,127.0.0.1",
        },
        mem_limit="1g",
        nano_cpus=2_000_000_000,
        pids_limit=100,
        remove=False,
        detach=True,
        user="1000:1000",
    )
    # ... container wait and log collection logic ...
```

---

## 6. Verification and Anti-Spoofing Tests

### Test 1: Authenticated Connection via Loopback Forwarder (Success)
Inside a valid sandbox container containing the mTLS certificates:
```bash
docker run --rm \
  --network polsia_sandbox_net \
  -v $(pwd)/certs:/etc/ssl/polsia:ro \
  polsia-agent-sandbox:latest -p "Check network access"
# Handshake succeeds, Claude Code executes and egresses through Envoy.
```

### Test 2: Spoofed / Unauthorized Direct Connection (Rejected)
Simulate a rogue container on `sandbox_net` trying to use Envoy directly without client certificates:
```bash
docker run --rm \
  --network polsia_sandbox_net \
  curlimages/curl:latest -k --proxy https://envoy:10001 https://api.anthropic.com
```
**Result:**
```text
curl: (35) error:0A000412:SSL routines::ssl/tls alert bad certificate
```
Envoy drops the connection at the TCP/TLS layer. Unauthenticated processes cannot send HTTP `CONNECT` frames or access external APIs.
