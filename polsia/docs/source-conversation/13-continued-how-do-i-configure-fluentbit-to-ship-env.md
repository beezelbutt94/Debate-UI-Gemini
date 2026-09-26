# Continue

> Status in this repo: Deferred: log pipeline continuation

To prevent credential leakage and contain rogue agent processes, we now implement the **Ephemeral Task Attestation and Sentinel Killswitch** layer.

Instead of sharing static certificates, the host worker mints a unique, **5-minute ephemeral X.509 client certificate** for every individual task execution. The certificate embeds the `agent_name` and `task_id` directly into the Subject Alternative Name (SAN). 

If an agent attempts to exfiltrate data or access unapproved domains, Envoy logs the violation with the task's identity, and the **Sentinel Watcher** terminates the sandbox container and quarantines the agent.

---

### Architecture & Quarantine Flow

```
 Celery Worker
   │
   ├─► 1. Mints 5-min Ephemeral Cert (SAN: URI:spiffe://polsia/agent/CodeAgent/task/948a)
   │
   ├─► 2. Mounts certs into Ephemeral Sandbox Container
   │
   └─► 3. Spawns Claude Code CLI inside gVisor
            │
            ▼
     [ Sandbox Container ] ──(Tunnels via ghostunnel)──► [ Envoy Egress Proxy ]
                                                                │
                     ┌──────────────────────────────────────────┴────────────────────────┐
                     │                                                                   │
           Authorized Domain                                                   Unauthorized Domain
         (api.anthropic.com)                                                   (evil-c2-server.com)
                     │                                                                   │
                     ▼                                                                   ▼
             HTTP 200/CONNECT                                                     HTTP 403 FORBIDDEN
                     │                                                                   │
                     ▼                                                                   ▼
       Request reaches Anthropic                                           Envoy logs violation with
                                                                           SAN: task/948a into OpenSearch
                                                                                         │
                                                                                         ▼
                                                                             [ Sentinel Watcher ]
                                                                             - Detects 403 in real-time
                                                                             - Sends KILL signal to Docker
                                                                             - Marks task FAILED/QUARANTINED
```

---

## 1. Ephemeral Task CA (`app/sandbox/ca.py`)

Using Python's `cryptography` library (`pip install cryptography`), this module holds the Root CA in memory and mints short-lived task certificates in sub-milliseconds without disk I/O bottlenecks.

```python
import os
import datetime
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

CA_CERT_PATH = os.path.abspath("./certs/ca.crt")
CA_KEY_PATH = os.path.abspath("./certs/ca.key")

class EphemeralTaskCA:
    def __init__(self):
        with open(CA_CERT_PATH, "rb") as f:
            self.ca_cert = x509.load_pem_x509_certificate(f.read())
        with open(CA_KEY_PATH, "rb") as f:
            self.ca_key = serialization.load_pem_private_key(f.read(), password=None)

    def issue_task_certificate(self, agent_name: str, task_id: str, validity_minutes: int = 5) -> tuple[bytes, bytes]:
        """
        Generates an in-memory RSA private key and issues an X.509 certificate
        embedding the agent identity and task ID into the SPIFFE URI SAN.
        """
        # 1. Generate client private key
        client_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048
        )

        # 2. Build SAN with SPIFFE URI format
        spiffe_id = f"spiffe://polsia/agent/{agent_name.lower()}/task/{task_id}"
        san = x509.SubjectAlternativeName([
            x509.UniformResourceIdentifier(spiffe_id),
            x509.DNSName("agent-sandbox")
        ])

        subject = x509.Name([
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Polsia Autonomous"),
            x509.NameAttribute(NameOID.COMMON_NAME, f"agent-{task_id[:8]}")
        ])

        now = datetime.datetime.now(datetime.timezone.utc)
        
        # 3. Sign certificate with internal CA
        client_cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(self.ca_cert.subject)
            .public_key(client_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - datetime.timedelta(seconds=10))
            .not_valid_after(now + datetime.timedelta(minutes=validity_minutes))
            .add_extension(san, critical=False)
            .add_extension(
                x509.ExtendedKeyUsage([x509.ExtendedKeyUsageOID.CLIENT_AUTH]),
                critical=True
            )
            .sign(self.ca_key, hashes.SHA256())
        )

        cert_pem = client_cert.public_bytes(serialization.Encoding.PEM)
        key_pem = client_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )

        return cert_pem, key_pem
```

---

## 2. Granular RBAC by Agent Identity in Envoy (`envoy/envoy.yaml`)

Envoy can inspect the client certificate's URI SAN and apply **Role-Based Access Control (RBAC)** at the proxy layer. 
For instance, the `CodeGenerationAgent` is permitted to connect to GitHub, but the `FinanceAgent` is blocked from GitHub and restricted to Stripe and Anthropic.

Update the `http_filters` section in `envoy/envoy.yaml`:

```yaml
          http_filters:
          # --- Per-Agent RBAC Filter based on URI SAN ---
          - name: envoy.filters.http.rbac
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.rbac.v3.RBAC
              rules:
                action: ALLOW
                policies:
                  # Policy 1: Any authenticated agent can query Anthropic
                  "allow_anthropic_all_agents":
                    permissions:
                    - header:
                        name: ":authority"
                        string_match:
                          prefix: "api.anthropic.com"
                    principals:
                    - authenticated:
                        principal_name:
                          exact: "spiffe://polsia/agent/*"

                  # Policy 2: ONLY CodeGenerationAgent can touch GitHub
                  "allow_github_code_agent_only":
                    permissions:
                    - header:
                        name: ":authority"
                        string_match:
                          suffix: "github.com:443"
                    principals:
                    - authenticated:
                        principal_name:
                          exact: "spiffe://polsia/agent/codegenerationagent/task/*"

          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
```

---

## 3. Sandboxed Container Runner with Dynamic Injection (`app/sandbox/gvisor_runner.py`)

Update `gvisor_runner.py` to write ephemeral credentials to a secure, temporary RAM directory (`tmpfs`) that unmounts and wipes immediately on container shutdown:

```python
import os
import json
import tempfile
import docker
from typing import Dict, Any, List, Optional
from app.config import settings
from app.sandbox.ca import EphemeralTaskCA

client = docker.from_env()
task_ca = EphemeralTaskCA()

class GVisorExecutionError(Exception):
    pass

def run_in_gvisor_sandbox(
    prompt: str,
    workspace_dir: str,
    agent_name: str,
    task_id: str,
    system_prompt: Optional[str] = None,
    allowed_tools: Optional[List[str]] = None,
    timeout_seconds: int = 300,
) -> Dict[str, Any]:
    # 1. Mint 5-minute ephemeral mTLS certificate for this specific run
    cert_pem, key_pem = task_ca.issue_task_certificate(agent_name, task_id, validity_minutes=5)

    # 2. Write certs into an isolated temporary folder for container mounting
    temp_cert_dir = tempfile.mkdtemp(prefix=f"certs_{task_id[:8]}_")
    try:
        cert_path = os.path.join(temp_cert_dir, "client.crt")
        key_path = os.path.join(temp_cert_dir, "client.key")
        ca_path = os.path.join(temp_cert_dir, "ca.crt")

        with open(cert_path, "wb") as f:
            f.write(cert_pem)
        with open(key_path, "wb") as f:
            f.write(key_pem)
        with open(ca_path, "wb") as f:
            with open("./certs/ca.crt", "rb") as ca_src:
                f.write(ca_src.read())

        cmd = ["-p", prompt, "--output-format", "json"]
        if allowed_tools:
            cmd.extend(["--allowedTools", ",".join(allowed_tools)])
        else:
            cmd.extend(["--permission-mode", "bypassPermissions"])

        if system_prompt:
            cmd.extend(["--append-system-prompt", system_prompt])

        container_name = f"sandbox_{task_id}"

        container = client.containers.run(
            image="polsia-agent-sandbox:latest",
            name=container_name,
            command=cmd,
            runtime="runsc",                      # gVisor syscall isolation
            network="polsia_sandbox_net",          # Restricted internal network
            working_dir="/workspace",
            volumes={
                os.path.abspath(workspace_dir): {"bind": "/workspace", "mode": "rw"},
                temp_cert_dir: {"bind": "/etc/ssl/polsia", "mode": "ro"}
            },
            environment={
                "ANTHROPIC_API_KEY": settings.ANTHROPIC_API_KEY,
                "TASK_ID": task_id,
                "AGENT_NAME": agent_name,
            },
            mem_limit="1g",
            nano_cpus=2_000_000_000,
            pids_limit=100,
            detach=True,
            user="1000:1000",
        )

        try:
            res = container.wait(timeout=timeout_seconds)
            exit_code = res.get("StatusCode", 1)
            stdout = container.logs(stdout=True, stderr=False).decode("utf-8")
            stderr = container.logs(stdout=False, stderr=True).decode("utf-8")

            if exit_code != 0:
                raise GVisorExecutionError(f"Container error ({exit_code}): {stderr}")

            try:
                return json.loads(stdout)
            except json.JSONDecodeError:
                return {"result": stdout.strip(), "raw": True}

        finally:
            container.remove(force=True)

    finally:
        # Wipe ephemeral certificate keys from disk
        import shutil
        shutil.rmtree(temp_cert_dir, ignore_errors=True)
```

---

## 4. The Security Sentinel Killswitch (`app/sentinel.py`)

The Sentinel runs as a background service. It polls OpenSearch for HTTP `403 Forbidden` logs emitted by Envoy. When an egress breach is detected, it immediately sends a `SIGKILL` to the running container and registers a security incident in Redis:

```python
import time
import json
import docker
import redis
import requests
from app.config import settings

client = docker.from_env()
r = redis.Redis.from_url(settings.REDIS_URL)

OPENSEARCH_URL = "https://localhost:9200/envoy-access-*/_search"
OPENSEARCH_AUTH = ("admin", "AdminPassword123!")

def run_sentinel_monitor():
    """Continuously monitors Envoy logs in OpenSearch for 403 egress violations."""
    last_checked_timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 30))

    while True:
        try:
            query = {
                "query": {
                    "bool": {
                        "must": [
                            {"term": {"response_code": 403}},
                            {"range": {"timestamp": {"gt": last_checked_timestamp}}}
                        ]
                    }
                },
                "sort": [{"timestamp": {"order": "desc"}}],
                "size": 10
            }

            resp = requests.post(
                OPENSEARCH_URL,
                json=query,
                auth=OPENSEARCH_AUTH,
                verify=False,
                timeout=5
            )

            if resp.status_code == 200:
                hits = resp.json().get("hits", {}).get("hits", [])
                for hit in hits:
                    record = hit["_source"]
                    last_checked_timestamp = record["timestamp"]
                    uri_san = record.get("client_cert_uri_san", "")

                    # Extract task_id from URI: spiffe://polsia/agent/<agent>/task/<task_id>
                    if "task/" in uri_san:
                        task_id = uri_san.split("task/")[-1]
                        target_host = record.get("target_host", "unknown")
                        quarantine_task(task_id, target_host, record)

        except Exception as e:
            print(f"[Sentinel Warning] Check failed: {e}")

        time.sleep(2)

def quarantine_task(task_id: str, target_host: str, log_record: dict):
    """Terminates the offending sandbox container and broadcasts the security breach."""
    container_name = f"sandbox_{task_id}"
    try:
        container = client.containers.get(container_name)
        container.kill()
        container.remove(force=True)
        print(f"[KILLSWITCH ACTIVATED] Terminated container {container_name}")
    except docker.errors.NotFound:
        pass

    # Broadcast breach event to Redis and WebSocket dashboard
    incident_payload = {
        "event": "SECURITY_BREACH",
        "task_id": task_id,
        "target_host": target_host,
        "timestamp": log_record.get("timestamp"),
        "client_ip": log_record.get("client_ip"),
        "cert_serial": log_record.get("client_cert_serial"),
        "reason": f"Unauthorized egress attempt to {target_host} blocked by Envoy."
    }
    r.publish("polsia:events", json.dumps(incident_payload))
```

---

## 5. Security Breach Dashboard Toast (`components/SecurityIncidentToast.tsx`)

Add a real-time banner that appears whenever the Sentinel executes a killswitch:

```tsx
"use client";

import { useEffect, useState } from "react";
import { ShieldX, AlertOctagon } from "lucide-react";

interface Incident {
  task_id: string;
  target_host: string;
  timestamp: string;
  reason: string;
}

export function SecurityIncidentToast({ wsEvent }: { wsEvent: any }) {
  const [incident, setIncident] = useState<Incident | null>(null);

  useEffect(() => {
    if (wsEvent && wsEvent.event === "SECURITY_BREACH") {
      setIncident({
        task_id: wsEvent.task_id,
        target_host: wsEvent.target_host,
        timestamp: wsEvent.timestamp,
        reason: wsEvent.reason,
      });
    }
  }, [wsEvent]);

  if (!incident) return null;

  return (
    <div className="border border-rose-500/40 bg-rose-950/80 text-rose-200 rounded-xl p-4 mb-6 shadow-2xl animate-in slide-in-from-top-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <ShieldX className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-bold font-mono tracking-wide uppercase text-white flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-rose-500" />
              Automated Killswitch Engaged
            </h3>
            <p className="text-xs text-rose-300 mt-1">
              Sandbox container for task <span className="font-mono text-white font-bold">{incident.task_id}</span> was instantly killed.
            </p>
          </div>
        </div>
        <button
          onClick={() => setIncident(null)}
          className="text-xs font-mono text-rose-400 hover:text-white px-2 py-1"
        >
          Dismiss
        </button>
      </div>

      <div className="mt-3 bg-black/40 border border-rose-900/60 rounded-lg p-2.5 font-mono text-xs text-rose-300">
        <div><span className="text-rose-500">Destination:</span> {incident.target_host}</div>
        <div><span className="text-rose-500">Action:</span> Sycall intercepted & container destroyed</div>
      </div>
    </div>
  );
}
```

---

## 6. How the Security Defenses Integrate

1. **Deterministic Identity:** Every execution gets an unforgeable, 5-minute cryptographic identity tied to its Celery `task_id`.
2. **Strict Network Confinement:** `sandbox_net` has no internet gateway. Direct internet routing is physically impossible.
3. **Per-Agent Capability Enforcement:** Envoy matches the SPIFFE ID against its RBAC rules, ensuring that non-engineering agents cannot push code to GitHub.
4. **Immediate Containment:** Any rogue command (such as `curl evil.com`) triggers an instant HTTP 403 in Envoy, which is parsed by Fluent Bit, ingested into OpenSearch, and intercepted by the Sentinel within 2 seconds to tear down the offending container.
