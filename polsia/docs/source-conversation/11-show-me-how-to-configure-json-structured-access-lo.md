# Show me how to configure JSON structured access logging in Envoy to capture client certificate serial numbers and SAN identifiers.

> Status in this repo: Deferred: Envoy JSON access logs

To capture client certificate metadata in Envoy, configure the `access_log` block inside the `http_connection_manager` filter using Envoy's command operators for downstream TLS.

---

### 1. Updated Envoy Configuration (`envoy/envoy.yaml`)

Add `access_log` pointing to `/dev/stdout` using `json_format`:

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

          # --- Structured JSON Access Log Configuration ---
          access_log:
          - name: envoy.access_loggers.file
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.access_loggers.file.v3.FileAccessLog
              path: /dev/stdout
              log_format:
                json_format:
                  timestamp: "%START_TIME%"
                  client_ip: "%DOWNSTREAM_REMOTE_ADDRESS%"
                  protocol: "%PROTOCOL%"
                  http_method: "%REQ(:METHOD)%"
                  target_host: "%REQ(:AUTHORITY)%"
                  response_code: "%RESPONSE_CODE%"
                  response_flags: "%RESPONSE_FLAGS%"
                  duration_ms: "%DURATION%"
                  bytes_received: "%BYTES_RECEIVED%"
                  bytes_sent: "%BYTES_SENT%"
                  upstream_cluster: "%UPSTREAM_CLUSTER%"
                  upstream_host: "%UPSTREAM_HOST%"
                  # TLS Connection Details
                  tls_version: "%DOWNSTREAM_TLS_VERSION%"
                  tls_cipher: "%DOWNSTREAM_TLS_CIPHER%"
                  # Client Certificate (mTLS) Audit Fields
                  client_cert_serial: "%DOWNSTREAM_PEER_SERIAL%"
                  client_cert_subject: "%DOWNSTREAM_PEER_SUBJECT%"
                  client_cert_issuer: "%DOWNSTREAM_PEER_ISSUER%"
                  client_cert_dns_san: "%DOWNSTREAM_PEER_DNS_SAN%"
                  client_cert_uri_san: "%DOWNSTREAM_PEER_URI_SAN%"
                  client_cert_valid_start: "%DOWNSTREAM_PEER_CERT_V_START%"
                  client_cert_valid_end: "%DOWNSTREAM_PEER_CERT_V_END%"

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
            address: { address: api.anthropic.com, port_value: 443 }

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
            address: { address: github.com, port_value: 443 }
```

---

### 2. TLS Command Operator Reference

| Operator | Extracted Data | Example Output |
| :--- | :--- | :--- |
| `%DOWNSTREAM_PEER_SERIAL%` | Hex serial number of the client certificate | `3e4a8b12f901c2` |
| `%DOWNSTREAM_PEER_DNS_SAN%`| SAN of type DNS | `agent-sandbox` |
| `%DOWNSTREAM_PEER_URI_SAN%`| SAN of type URI (used by SPIFFE IDs) | `spiffe://polsia.local/ns/default/sa/worker` |
| `%DOWNSTREAM_PEER_SUBJECT%`| Full Distinguished Name (DN) subject | `CN=agent-sandbox,O=Polsia` |
| `%DOWNSTREAM_PEER_ISSUER%` | Full DN of issuing Certificate Authority | `CN=Polsia-Internal-CA,O=Polsia,C=US` |
| `%DOWNSTREAM_PEER_CERT_V_START%` | Validity start timestamp | `2026-09-19T10:00:00Z` |
| `%DOWNSTREAM_PEER_CERT_V_END%`   | Expiration timestamp | `2027-09-19T10:00:00Z` |

---

### 3. Sample Structured Log Output

When a sandboxed container issues a `CONNECT` request to `api.anthropic.com`, Envoy outputs a single JSON line to standard output:

```json
{
  "timestamp": "2026-09-19T11:42:01.382Z",
  "client_ip": "172.28.0.4:49812",
  "protocol": "HTTP/1.1",
  "http_method": "CONNECT",
  "target_host": "api.anthropic.com:443",
  "response_code": 200,
  "response_flags": "-",
  "duration_ms": 142,
  "bytes_received": 1840,
  "bytes_sent": 4210,
  "upstream_cluster": "anthropic_upstream",
  "upstream_host": "104.18.2.14:443",
  "tls_version": "TLSv1.3",
  "tls_cipher": "TLS_AES_256_GCM_SHA384",
  "client_cert_serial": "7b2d19f4a081",
  "client_cert_subject": "CN=agent-sandbox,O=Polsia",
  "client_cert_issuer": "CN=Polsia-Internal-CA,O=Polsia,C=US",
  "client_cert_dns_san": "agent-sandbox",
  "client_cert_uri_san": "-",
  "client_cert_valid_start": "2026-09-19T00:00:00Z",
  "client_cert_valid_end": "2027-09-19T00:00:00Z"
}
```

If an unauthorized client connects without a valid certificate or attempts to route to an unapproved destination, `response_code` returns `403` or a handshake reset, and `response_flags` outputs `NR` (No Route) or `UF` (Upstream Failure) with empty client certificate fields.
