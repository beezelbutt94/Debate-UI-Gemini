# How do I configure FluentBit to ship Envoy's JSON access logs from Docker into OpenSearch or Elasticsearch?

> Status in this repo: Deferred: FluentBit to OpenSearch

To ship Envoy's structured JSON access logs into OpenSearch or Elasticsearch, configure Docker's **`fluentd` logging driver** on the Envoy container to route stdout over TCP to **Fluent Bit**, parse the JSON payload into native fields, and index the documents.

---

### End-to-End Pipeline

```
┌─────────────────┐       stdout       ┌────────────────────────┐
│  envoy-proxy    ├───────────────────►│  Docker Engine         │
│  (JSON emitter) │                    │  (fluentd log driver)  │
└─────────────────┘                    └───────────┬────────────┘
                                                   │ Forward Protocol (:24224)
                                                   ▼
┌───────────────────────────────────────────────────────────────┐
│ Fluent Bit Container                                          │
│  [INPUT]   forward (listens on :24224)                        │
│  [FILTER]  parser (extracts & unnests Envoy JSON fields)      │
│  [OUTPUT]  opensearch / es (indexes into envoy-access-*)      │
└──────────────────────────────┬────────────────────────────────┘
                               │ HTTP/HTTPS (:9200)
                               ▼
            ┌──────────────────────────────────────┐
            │       OpenSearch / Elasticsearch     │
            │   - Index: envoy-access-YYYY.MM.DD   │
            │   - Searchable mTLS cert fields      │
            └──────────────────────────────────────┘
```

---

## 1. Fluent Bit Configuration

Create a dedicated directory `fluent-bit/` with two configuration files: `parsers.conf` and `fluent-bit.conf`.

### `fluent-bit/parsers.conf`
Defines a JSON decoder that preserves nested attributes and parses timestamps:

```ini
[PARSER]
    Name        envoy_json
    Format      json
    Time_Key    timestamp
    Time_Format %Y-%m-%dT%H:%M:%S.%L%z
    Time_Keep   On
```

### `fluent-bit/fluent-bit.conf`
Configures log ingestion via `forward`, extracts the JSON payload from Docker's outer wrapper, and ships directly to OpenSearch (or Elasticsearch):

```ini
[SERVICE]
    Flush         1
    Log_Level     info
    Parsers_File  /fluent-bit/etc/parsers.conf

# 1. Ingest logs from Docker daemon
[INPUT]
    Name          forward
    Listen        0.0.0.0
    Port          24224

# 2. Parse stringified JSON into top-level typed attributes
[FILTER]
    Name          parser
    Match         envoy.access
    Key_Name      log
    Parser        envoy_json
    Reserve_Data  Off

# 3. Add environment tags for multi-cluster filtering
[FILTER]
    Name          record_modifier
    Match         envoy.access
    Record        environment production
    Record        service_name egress-proxy

# 4A. Output to OpenSearch
[OUTPUT]
    Name                opensearch
    Match               envoy.access
    Host                opensearch
    Port                9200
    Index               envoy-access
    # Creates time-partitioned indices: envoy-access-2026.09.19
    Logstash_Format     On
    Logstash_Prefix     envoy-access
    Logstash_DateFormat %Y.%m.%d
    # OpenSearch 1.x/2.x schema compatibility
    Suppress_Type_Name  On
    # Credentials & TLS
    HTTP_User           admin
    HTTP_Passwd         admin
    tls                 On
    tls.verify          Off
    Retry_Limit         5

# 4B. Alternative: Output to Elasticsearch 8.x+
# (Uncomment below and comment out the OpenSearch block if using Elasticsearch)
# [OUTPUT]
#     Name                es
#     Match               envoy.access
#     Host                elasticsearch
#     Port                9200
#     Index               envoy-access
#     Logstash_Format     On
#     Logstash_Prefix     envoy-access
#     Logstash_DateFormat %Y.%m.%d
#     Suppress_Type_Name  On
#     HTTP_User           elastic
#     HTTP_Passwd         changeme
#     tls                 On
#     tls.verify          Off
#     Retry_Limit         5
```

---

## 2. Updated `docker-compose.yml`

1. Deploy `fluent-bit` attached to both `public_net` (to reach OpenSearch) and a logging bridge.
2. Direct `envoy` logs to Fluent Bit using the `fluentd` log driver.

```yaml
version: '3.8'

networks:
  public_net:
    driver: bridge
  sandbox_net:
    driver: bridge
    internal: true

services:
  # --- OpenSearch Single-Node Instance ---
  opensearch:
    image: opensearchproject/opensearch:2.14.0
    environment:
      - discovery.type=single-node
      - plugins.security.disabled=false
      - OPENSEARCH_INITIAL_ADMIN_PASSWORD=AdminPassword123!
      - "OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    networks:
      - public_net

  # --- Fluent Bit Log Shipper ---
  fluent-bit:
    image: fluent/fluent-bit:3.0
    restart: unless-stopped
    ports:
      - "127.0.0.1:24224:24224" # Forward socket
    volumes:
      - ./fluent-bit/fluent-bit.conf:/fluent-bit/etc/fluent-bit.conf:ro
      - ./fluent-bit/parsers.conf:/fluent-bit/etc/parsers.conf:ro
    networks:
      - public_net
    depends_on:
      - opensearch

  # --- Envoy Egress Proxy ---
  envoy:
    image: envoyproxy/envoy:v1.30-latest
    restart: unless-stopped
    volumes:
      - ./envoy/envoy.yaml:/etc/envoy/envoy.yaml:ro
      - ./certs:/etc/envoy/certs:ro
    command: ["-c", "/etc/envoy/envoy.yaml", "--log-level", "warn"]
    # Route stdout/stderr through the fluentd daemon driver to Fluent Bit
    logging:
      driver: "fluentd"
      options:
        fluentd-address: "127.0.0.1:24224"
        tag: "envoy.access"
        fluentd-async-connect: "true" # Prevents Envoy startup hangs if Fluent Bit boots after
        fluentd-sub-second-precision: "true"
    networks:
      - sandbox_net
      - public_net
    depends_on:
      - fluent-bit

  # Other services (celery_worker, redis, api)...
```

---

## 3. Verify Log Delivery and Indexing

### Step 1: Start Services
```bash
docker compose up -d fluent-bit opensearch envoy
```

### Step 2: Trigger a Sandboxed Request
Execute an authenticated call from a sandbox container through Envoy:
```bash
docker run --rm \
  --network polsia_sandbox_net \
  -v $(pwd)/certs:/etc/ssl/polsia:ro \
  polsia-agent-sandbox:latest -p "Audit repo structure"
```

### Step 3: Query OpenSearch for Indexed mTLS Access Records
```bash
curl -k -u admin:AdminPassword123! \
  "https://localhost:9200/envoy-access-*/_search?pretty" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": {
      "match": {
        "target_host": "api.anthropic.com:443"
      }
    },
    "_source": [
      "timestamp",
      "target_host",
      "response_code",
      "client_cert_serial",
      "client_cert_dns_san",
      "client_cert_subject",
      "duration_ms"
    ]
  }'
```

### Sample Document Returned:
```json
{
  "_index": "envoy-access-2026.09.19",
  "_id": "d8A1Y5IBH5Fw6h0-kLwP",
  "_score": 1.0,
  "_source": {
    "timestamp": "2026-09-19T11:42:01.382Z",
    "target_host": "api.anthropic.com:443",
    "response_code": 200,
    "duration_ms": 142,
    "client_cert_serial": "7b2d19f4a081",
    "client_cert_dns_san": "agent-sandbox",
    "client_cert_subject": "CN=agent-sandbox,O=Polsia"
  }
}
```

---

## 4. Key Operational Considerations

* **Field Collision Avoidance:** If Envoy's JSON contains a numeric string (like `client_cert_serial`) and you later send an alphabetic hex value, Elasticsearch dynamic mapping may reject subsequent records. Ensure an Index Template defines `client_cert_serial`, `client_cert_dns_san`, and `response_code` explicitly as `keyword` types before heavy ingestion.
* **Buffer Overflow Protection:** Under high concurrency, set `Buffer_Chunk_Size 512k` and `Buffer_Max_Size 5M` inside `[INPUT]` to prevent Fluent Bit from dropping bursts of agent egress events.
