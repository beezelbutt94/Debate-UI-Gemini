# How can I isolate each agent's Claude Code subprocess inside secure microVMs using Firecracker or gVisor for safe untrusted code execution?

> Status in this repo: Deferred: Firecracker/gVisor sandboxing

Running Claude Code with `--permission-mode bypassPermissions` or unrestricted `Bash` tool access allows an agent to execute arbitrary shell commands. If an agent processes untrusted inputs, audits foreign GitHub repos, or runs unverified customer code, executing it directly on the host worker exposes the entire infrastructure to credential theft, container escapes, and host compromise.

Below is the comparison and implementation guide for isolating agent runs using **gVisor** (syscall interception via user-space kernel) and **Firecracker** (hardware-virtualized microVMs).

---

## 1. Architecture & Threat Model Comparison

| Feature | gVisor (`runsc`) | Firecracker MicroVM |
| :--- | :--- | :--- |
| **Isolation Level** | User-space kernel (`Sentry`) intercepting Linux syscalls | Hardware virtualization (KVM) with guest Linux kernel |
| **Startup Overhead** | ~150ms – 400ms | ~5ms – 25ms (VMM) + ~100ms – 300ms (Guest boot) |
| **Memory Overhead** | ~15MB – 30MB per container | ~5MB (VMM) + 128MB–512MB dedicated guest RAM |
| **Hardware Prerequisite**| Any Linux kernel with ptrace/KVM | Bare metal or nested virtualization (`/dev/kvm`) |
| **Orchestration Simplicity** | **Drop-in OCI runtime** for Docker / containerd | Requires custom disk image snapshots, TAP/vsock, and VMM lifecycle management |
| **Best Used For** | Standard production workloads, quick CI/CD sandboxes, Docker stacks | Multi-tenant untrusted execution, hard zero-trust multi-tenancy |

---

## 2. Approach A: Sandboxing via gVisor and Docker

gVisor replaces `runc` with `runsc`. System calls from Claude Code or its spawned bash commands are intercepted by the gVisor `Sentry` sandbox, preventing privilege escalation and host kernel vulnerabilities.

### Step 1: Install and Configure gVisor on Host / Worker Node

```bash
# 1. Install runsc binary
curl -fsSL https://gvisor.dev/archive.key | sudo gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" | sudo tee /etc/apt/sources.list.d/gvisor.list > /dev/null
sudo apt-get update && sudo apt-get install -y runsc

# 2. Register runsc with Docker
sudo runsc install
```

Verify `/etc/docker/daemon.json` contains the `runsc` runtime definition:
```json
{
  "runtimes": {
    "runsc": {
      "path": "/usr/bin/runsc"
    }
  }
}
```
Restart Docker: `sudo systemctl restart docker`.

---

### Step 2: Dedicated Sandbox Container Image (`Dockerfile.agent-sandbox`)

Create an unprivileged image stripped of host utilities:

```dockerfile
FROM node:20-slim

# Install minimal tools needed by Claude Code
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    python3 \
    build-essential \
    && npm install -g @anthropic-ai/claude-code \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root agent user
RUN useradd -m -u 1000 sandboxuser
USER sandboxuser
WORKDIR /workspace

ENTRYPOINT ["claude"]
```

Build the sandbox image:
```bash
docker build -t polsia-agent-sandbox:latest -f Dockerfile.agent-sandbox .
```

---

### Step 3: gVisor Isolated Runner (`app/sandbox/gvisor_runner.py`)

Replace `subprocess.run` with this ephemeral container manager using the Docker Python SDK (`pip install docker`):

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
    network_enabled: bool = False,
) -> Dict[str, Any]:
    """
    Executes Claude Code inside an ephemeral gVisor (runsc) container.
    - User-space kernel intercepts all syscalls.
    - Workspace is mounted isolated.
    - CPU, RAM, and PID count are strictly throttled.
    - Network is disabled unless external internet is explicitly permitted.
    """
    cmd = ["-p", prompt, "--output-format", "json"]

    if allowed_tools:
        cmd.extend(["--allowedTools", ",".join(allowed_tools)])
    else:
        cmd.extend(["--permission-mode", "bypassPermissions"])

    if system_prompt:
        cmd.extend(["--append-system-prompt", system_prompt])

    # Security constraints
    network_mode = "bridge" if network_enabled else "none"
    environment = {
        "ANTHROPIC_API_KEY": settings.ANTHROPIC_API_KEY,
        "NODE_ENV": "production",
    }

    try:
        # Spin up ephemeral container under runsc runtime
        container = client.containers.run(
            image="polsia-agent-sandbox:latest",
            command=cmd,
            runtime="runsc",                      # Enforces gVisor isolation
            network_mode=network_mode,            # Drops network access if untrusted
            working_dir="/workspace",
            volumes={
                os.path.abspath(workspace_dir): {
                    "bind": "/workspace",
                    "mode": "rw"
                }
            },
            environment=environment,
            mem_limit="1g",                       # RAM ceiling
            nano_cpus=2_000_000_000,              # Max 2 CPUs
            pids_limit=100,                       # Thwarts fork bombs
            read_only=False,
            remove=False,                         # Manual removal to capture logs cleanly
            detach=True,
            user="1000:1000",                     # Non-root UID inside VM
        )

        try:
            # Wait for execution or timeout
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
            # Enforce clean teardown of ephemeral container
            container.remove(force=True)

    except docker.errors.ContainerError as e:
        raise GVisorExecutionError(f"Container runtime failure: {str(e)}")
    except Exception as e:
        raise GVisorExecutionError(f"Sandboxing error: {str(e)}")
```

---

## 3. Approach B: Hardware MicroVM Sandboxing via Firecracker

Firecracker spins up a dedicated virtual machine running its own Linux kernel via KVM. Communication between the host and guest microVM is mediated over an **AF_VSOCK** channel without exposing standard network interfaces.

### Architecture Overview

```
Host Worker (Linux + KVM)
├── Celery Task
│    └── firecracker_runner.py
│         ├── 1. Spawns /usr/bin/firecracker (REST API over unix socket)
│         ├── 2. Configures Boot Source (vmlinux) & Drives (rootfs.ext4 snapshot)
│         ├── 3. Boots MicroVM (~120ms total)
│         └── 4. Transmits task JSON over AF_VSOCK (CID 3, Port 5005)
│
└── Firecracker MicroVM (Hardware Isolated)
     ├── Guest Kernel (vmlinux)
     └── Alpine Rootfs (OverlayFS)
          └── agent-daemon (Python listener on vsock)
               └── Executes: claude -p ... inside isolated guest
```

---

### Step 1: Base Rootfs & Guest Daemon

Inside the base rootfs image for Firecracker, a lightweight daemon listens on vsock port `5005`, runs Claude Code, and returns the result.

```python
# /usr/local/bin/guest_agent.py (Runs inside Firecracker MicroVM at boot)
import socket
import json
import subprocess

VSOCK_PORT = 5005

def run_server():
    # AF_VSOCK binding to listen for host commands
    s = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
    s.bind((socket.VMADDR_CID_ANY, VSOCK_PORT))
    s.listen(1)

    while True:
        conn, addr = s.accept()
        raw_data = b""
        while True:
            chunk = conn.recv(4096)
            if not chunk:
                break
            raw_data += chunk

        if not raw_data:
            conn.close()
            continue

        request = json.loads(raw_data.decode("utf-8"))
        prompt = request["prompt"]
        api_key = request.get("api_key", "")

        # Run Claude Code in the guest environment
        cmd = ["claude", "-p", prompt, "--output-format", "json", "--permission-mode", "bypassPermissions"]
        res = subprocess.run(
            cmd,
            cwd="/workspace",
            capture_output=True,
            text=True,
            env={"PATH": "/usr/local/bin:/usr/bin:/bin", "ANTHROPIC_API_KEY": api_key}
        )

        response = {
            "stdout": res.stdout,
            "stderr": res.stderr,
            "exit_code": res.returncode
        }
        conn.sendall(json.dumps(response).encode("utf-8"))
        conn.close()

if __name__ == "__main__":
    run_server()
```

---

### Step 2: Host Firecracker MicroVM Controller (`app/sandbox/firecracker_runner.py`)

This controller prepares a CoW (Copy-on-Write) rootfs snapshot, controls Firecracker via its local Unix domain socket, and sends the prompt over the vsock connection:

```python
import os
import time
import json
import socket
import shutil
import tempfile
import subprocess
import requests_unixsocket
from typing import Dict, Any
from app.config import settings

FIRECRACKER_BIN = "/usr/bin/firecracker"
KERNEL_IMAGE = "/var/lib/firecracker/vmlinux-5.10.bin"
BASE_ROOTFS = "/var/lib/firecracker/rootfs.ext4"

class FirecrackerSandbox:
    def __init__(self, vm_id: str):
        self.vm_id = vm_id
        self.temp_dir = tempfile.mkdtemp(prefix=f"fc_{vm_id}_")
        self.socket_path = os.path.join(self.temp_dir, "firecracker.sock")
        self.vsock_path = os.path.join(self.temp_dir, "vsock.sock")
        self.rootfs_path = os.path.join(self.temp_dir, "rootfs.ext4")
        self.session = requests_unixsocket.Session()
        self.process = None

    def _socket_url(self, endpoint: str) -> str:
        encoded_path = self.socket_path.replace("/", "%2F")
        return f"http+unix://{encoded_path}{endpoint}"

    def launch(self):
        # 1. Create a copy-on-write snapshot of the base rootfs for this execution
        shutil.copyfile(BASE_ROOTFS, self.rootfs_path)

        # 2. Launch Firecracker VMM process
        self.process = subprocess.Popen(
            [FIRECRACKER_BIN, "--api-sock", self.socket_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

        # Wait for API socket to exist
        for _ in range(50):
            if os.path.exists(self.socket_path):
                break
            time.sleep(0.01)

        # 3. Configure Boot Source (Kernel & boot args)
        self.session.put(
            self._socket_url("/boot-source"),
            json={
                "kernel_image_path": KERNEL_IMAGE,
                "boot_args": "console=ttyS0 reboot=k panic=1 pci=off nomodules rw"
            }
        ).raise_for_status()

        # 4. Attach Drive (Root Filesystem)
        self.session.put(
            self._socket_url("/drives/rootfs"),
            json={
                "drive_id": "rootfs",
                "path_on_host": self.rootfs_path,
                "is_root_device": True,
                "is_read_only": False
            }
        ).raise_for_status()

        # 5. Configure Vsock Device for host-guest communication
        self.session.put(
            self._socket_url("/vsock"),
            json={
                "vsock_id": "vsock0",
                "guest_cid": 3,
                "uds_path": self.vsock_path
            }
        ).raise_for_status()

        # 6. Configure Resources (2 vCPUs, 512 MB RAM)
        self.session.put(
            self._socket_url("/machine-config"),
            json={
                "vcpu_count": 2,
                "mem_size_mib": 512
            }
        ).raise_for_status()

        # 7. Start Instance
        self.session.put(
            self._socket_url("/actions"),
            json={"action_type": "InstanceStart"}
        ).raise_for_status()

    def execute_task(self, prompt: str) -> Dict[str, Any]:
        """Connects over host UDS vsock to the guest daemon."""
        # Wait for guest OS boot and agent startup (~200ms)
        time.sleep(0.3)

        client_sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        client_sock.connect(self.vsock_path)

        # Firecracker multiplexed vsock handshake: CONNECT <port>\n
        client_sock.sendall(b"CONNECT 5005\n")
        ack = client_sock.recv(32)
        if not ack.startswith(b"OK"):
            raise RuntimeError(f"Vsock handshake failed: {ack.decode('utf-8')}")

        # Send execution request
        payload = json.dumps({
            "prompt": prompt,
            "api_key": settings.ANTHROPIC_API_KEY
        }).encode("utf-8")
        client_sock.sendall(payload)
        client_sock.shutdown(socket.SHUT_WR)

        # Receive output
        response = b""
        while True:
            chunk = client_sock.recv(4096)
            if not chunk:
                break
            response += chunk
        client_sock.close()

        data = json.loads(response.decode("utf-8"))
        return json.loads(data["stdout"])

    def teardown(self):
        """Immediately terminate process and wipe disk state."""
        if self.process:
            self.process.kill()
            self.process.wait()
        shutil.rmtree(self.temp_dir, ignore_errors=True)
```

---

## 4. Defense-in-Depth: Scoped Credential Proxy

Do not pass master keys (`ANTHROPIC_API_KEY`, `GITHUB_TOKEN`) directly into the sandbox environment. If an agent executes an untrusted script that inspects `/proc/$PID/environ` or dumps shell variables, credentials are leaked.

Instead, route Anthropic requests through an **authenticating sidecar proxy**:

```
[Sandbox (gVisor/Firecracker)]
      │
      │ HTTP Request to: http://192.168.127.1:8080/v1/messages
      │ Headers: X-Agent-Session-Token: ephemeral-jwt-1234
      ▼
[Host Sidecar Proxy]
      │ 1. Validate session token matches active Celery task_id.
      │ 2. Enforce rate limits and max token spend per call.
      │ 3. Inject real Authorization: Bearer sk-ant-api03-...
      ▼
[api.anthropic.com]
```

### Implementing the Proxy (`app/sandbox/credential_proxy.py`)

```python
import os
import httpx
from fastapi import FastAPI, Request, Response, Header, HTTPException

proxy_app = FastAPI()
UPSTREAM_URL = "https://api.anthropic.com"
MASTER_KEY = os.getenv("ANTHROPIC_API_KEY")

@proxy_app.post("/v1/messages")
async def proxy_anthropic_call(request: Request, x_session_token: str = Header(None)):
    # 1. Verify that this session token belongs to an active running agent task
    if not x_session_token or not x_session_token.startswith("task_"):
        raise HTTPException(status_code=403, detail="Unauthorized sandbox call")

    body = await request.body()
    headers = dict(request.headers)

    # 2. Scrub host headers & inject the secret key on the host side
    headers["host"] = "api.anthropic.com"
    headers["x-api-key"] = MASTER_KEY

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{UPSTREAM_URL}/v1/messages",
            content=body,
            headers=headers,
            timeout=120.0
        )

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers={"content-type": resp.headers.get("content-type", "application/json")}
    )
```

When invoking Claude Code inside the sandbox, configure:
```bash
export ANTHROPIC_BASE_URL="http://192.168.127.1:8080"
export ANTHROPIC_API_KEY="task_session_id_xyz"
```
The sandboxed environment never holds the real API key.

---

## 5. Swapping the Runner into `BaseAgent`

Update `app/agents.py` to route all Claude Code executions through the sandbox:

```python
# In app/agents.py:
from app.sandbox.gvisor_runner import run_in_gvisor_sandbox

class BaseAgent:
    # ...
    def generate(self, task_instruction: str) -> str:
        prompt = (
            f"You are the {self.name}.\n"
            f"Role: {self.role_prompt}\n"
            f"Task: {task_instruction}\n"
            "Produce the final artifact directly."
        )

        # Runs isolated inside gVisor container with strict boundaries
        output = run_in_gvisor_sandbox(
            prompt=prompt,
            workspace_dir=settings.WORK_DIR,
            system_prompt=self.soul,
            allowed_tools=["Read", "Bash"],
            timeout_seconds=300,
            network_enabled=False # Keep fully offline unless explicitly required
        )
        return output.get("result", "")
```

Now, even if Claude Code runs malicious scripts, infinite loops, or destructive file deletions, operations remain quarantined in ephemeral user-space memory and are wiped immediately upon task completion.
