# How can I configure Karpenter provisioners on EKS to dynamically spin up arm64/amd64 spot nodes exclusively for gVisor sandbox pods?

> Status in this repo: Deferred: Karpenter node pools

To have Karpenter dynamically provision ephemeral `arm64` and `amd64` Spot instances exclusively for gVisor sandbox pods, you need a three-part configuration:

1. **`EC2NodeClass`**: Bootstraps the node, detects CPU architecture at runtime, installs the matching `runsc` binary, registers it with `containerd`, and attaches IAM/security groups.
2. **`NodePool`**: Configures multi-architecture Spot selection (`arm64`, `amd64`), enforces a dedicated **taint** for workload exclusivity, and enables fast scale-down consolidation when tasks complete.
3. **Pod Manifest / Runner**: Employs the required toleration, node selector, and `runtimeClassName: gvisor`.

---

### Architecture Overview

```
 [ Pending Sandbox Pod ]
   - runtimeClassName: gvisor
   - nodeSelector: polsia.ai/workload: agent-sandbox
   - toleration: polsia.ai/workload: agent-sandbox (NoSchedule)
   - arch: arm64 OR amd64
             │
             ▼
 ┌────────────────────────────────────────────────────────┐
 │ Karpenter v1 NodePool Evaluation                       │
 │  - Matches taint & requirements                       │
 │  - Chooses cheapest Spot instance (c7g, c6i, m7g, etc.)│
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │ EC2NodeClass UserData Bootstrap                        │
 │  1. `uname -m` identifies `aarch64` vs `x86_64`        │
 │  2. Downloads architecture-specific `runsc` binary     │
 │  3. Registers containerd runtime `runsc`               │
 │  4. Node joins cluster with taint                      │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │ Pod Schedules -> Executes in gVisor -> Terminates      │
 │  - NodePool consolidates & terminates node after 30s   │
 └────────────────────────────────────────────────────────┘
```

---

### 1. Karpenter `EC2NodeClass` with Architecture-Aware UserData

Create `helm/polsia/templates/karpenter-nodeclass.yaml` (or apply directly via `kubectl`). 

The `userData` script dynamically pulls the official Google gVisor release binary for either `aarch64` (`arm64`) or `x86_64` (`amd64`), injects the `runsc` runtime plugin into `containerd`, and restarts the daemon before node registration completes:

```yaml
apiVersion: karpenter.k8s.aws/v1
kind: EC2NodeClass
metadata:
  name: gvisor-sandbox-nodeclass
spec:
  amiFamily: AL2023 # Amazon Linux 2023 (or AL2)
  role: "KarpenterNodeRole-prod-eks-cluster" # Replace with your EKS Node IAM role
  subnetSelectorTerms:
    - tags:
        karpenter.sh/discovery: "prod-eks-cluster"
  securityGroupSelectorTerms:
    - tags:
        karpenter.sh/discovery: "prod-eks-cluster"

  # UserData to install runsc on both arm64 and amd64 dynamically
  userData: |
    MIME-Version: 1.0
    Content-Type: multipart/mixed; boundary="//"

    --//
    Content-Type: text/x-shellscript; charset="us-ascii"

    #!/bin/bash
    set -xeuo pipefail

    echo "=== [Polsia] Configuring gVisor on $(uname -m) ==="

    # 1. Detect architecture and set gVisor artifact URL
    ARCH=$(uname -m)
    if [ "$ARCH" = "aarch64" ]; then
      GVISOR_ARCH="aarch64"
    elif [ "$ARCH" = "x86_64" ]; then
      GVISOR_ARCH="x86_64"
    else
      echo "Unsupported architecture: $ARCH"
      exit 1
    fi

    # 2. Download and verify runsc binary
    URL="https://storage.googleapis.com/gvisor/releases/release/latest/${GVISOR_ARCH}"
    curl -fsSL "${URL}/runsc" -o /usr/local/bin/runsc
    chmod 0755 /usr/local/bin/runsc

    # 3. Configure containerd CRI runtime for runsc
    mkdir -p /etc/containerd/config.d
    cat << 'EOF' > /etc/containerd/config.d/gvisor.toml
    [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc]
      runtime_type = "io.containerd.runsc.v1"
      privileged_without_host_devices = false
    EOF

    # 4. Restart containerd to load the drop-in configuration
    systemctl restart containerd
    --//--
```

---

### 2. Karpenter `NodePool` for Dynamic Spot Instances

Create `helm/polsia/templates/karpenter-nodepool.yaml`.

This `NodePool`:
* Enforces **Workload Exclusivity** via a custom taint (`polsia.ai/workload=agent-sandbox:NoSchedule`). General pods lacking this toleration cannot land here.
* Allows Karpenter to select the most cost-effective Spot instance across both `arm64` (e.g., `c7g`, `m7g`, `t4g`) and `amd64` (e.g., `c6i`, `c6a`, `m6i`, `m6a`).
* Automatically consolidates and terminates the node within **30 seconds** of becoming empty (`consolidationPolicy: WhenEmpty`).

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: gvisor-sandbox-pool
spec:
  template:
    metadata:
      labels:
        polsia.ai/workload: "agent-sandbox"
    spec:
      nodeClassRef:
        group: karpenter.k8s.aws
        kind: EC2NodeClass
        name: gvisor-sandbox-nodeclass

      # Exclusivity Taint: Only pods tolerating this taint can schedule here
      taints:
        - key: polsia.ai/workload
          value: "agent-sandbox"
          effect: NoSchedule

      requirements:
        # 1. Capacity: Spot instances only
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot"]

        # 2. Multi-Arch: Allow both Graviton (arm64) and Intel/AMD (amd64)
        - key: kubernetes.io/arch
          operator: In
          values: ["arm64", "amd64"]

        # 3. Instance Categories: Compute & General Purpose
        - key: karpenter.k8s.aws/instance-category
          operator: In
          values: ["c", "m", "t"]

        # 4. Exclude older generation types for better performance and cost
        - key: karpenter.k8s.aws/instance-generation
          operator: Gt
          values: ["4"]

        # 5. Prevent expensive oversized instances
        - key: karpenter.k8s.aws/instance-cpu
          operator: In
          values: ["2", "4", "8"]

  # Scale-to-zero when no sandboxes are running
  disruption:
    consolidationPolicy: WhenEmpty
    consolidateAfter: 30s
    budgets:
      - nodes: 100% # Allow terminating all empty sandbox nodes simultaneously

  # Budget limit across sandbox instances
  limits:
    cpu: "100"
    memory: "200Gi"
```

---

### 3. Update Sandbox Runner to Match Karpenter Requirements

Update `app/sandbox/k8s_runner.py` so that ephemeral pods carry the required labels, node selector, tolerations, and resource requests. 

Karpenter uses `requests` to compute the instance size:

```python
# In app/sandbox/k8s_runner.py (spec definition):

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
            runtime_class_name=runtime_class,  # "gvisor"
            restart_policy="Never",

            # 1. Target the Karpenter-provisioned nodes
            node_selector={
                "polsia.ai/workload": "agent-sandbox"
            },

            # 2. Tolerate the Karpenter exclusivity taint
            tolerations=[
                client.V1Toleration(
                    key="polsia.ai/workload",
                    operator="Equal",
                    value="agent-sandbox",
                    effect="NoSchedule"
                )
            ],

            # 3. Multi-arch sandbox container
            containers=[
                client.V1Container(
                    name="agent-executor",
                    image=sandbox_image, # Must be a multi-arch image (linux/amd64, linux/arm64)
                    command=["claude"] + cmd,
                    resources=client.V1ResourceRequirements(
                        limits={"cpu": "2000m", "memory": "2Gi"},
                        requests={"cpu": "1000m", "memory": "1Gi"} # Karpenter uses this to bin-pack
                    ),
                    env=[...],
                    security_context=client.V1SecurityContext(
                        allow_privilege_escalation=False,
                        run_as_non_root=True,
                        run_as_user=1000
                    )
                )
            ]
        )
    )
```

---

### 4. Verification Workflow

#### Step 1: Confirm gVisor RuntimeClass Exists
```bash
kubectl apply -f - <<EOF
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
EOF
```

#### Step 2: Apply Karpenter Resources
```bash
kubectl apply -f helm/polsia/templates/karpenter-nodeclass.yaml
kubectl apply -f helm/polsia/templates/karpenter-nodepool.yaml
```

#### Step 3: Trigger an Arm64/Amd64 Sandbox Run
Deploy a test pod matching the node pool criteria:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-gvisor-probe
  namespace: polsia-sandboxes
  labels:
    polsia.ai/workload: agent-sandbox
spec:
  runtimeClassName: gvisor
  nodeSelector:
    polsia.ai/workload: agent-sandbox
  tolerations:
    - key: polsia.ai/workload
      operator: Equal
      value: agent-sandbox
      effect: NoSchedule
  containers:
    - name: probe
      image: alpine:latest
      command: ["sh", "-c", "dmesg | grep -i gvisor && uname -m && sleep 10"]
      resources:
        requests:
          cpu: "1000m"
          memory: "1Gi"
```

#### Step 4: Inspect Karpenter Controller Logs & Node Spin-Up
Watch Karpenter trigger node claims and provisioning:

```bash
# View Karpenter provisioning decision
kubectl logs -n karpenter -l app.kubernetes.io/name=karpenter -f | grep -E "found provisionable pod|launched nodeclaim"

# Output will show dynamic Spot selection:
# {"level":"INFO","message":"found provisionable pod","pod":"polsia-sandboxes/test-gvisor-probe"}
# {"level":"INFO","message":"launched nodeclaim","instance-type":"c7g.medium","zone":"us-east-1a","capacity-type":"spot","arch":"arm64"}
```

#### Step 5: Verify gVisor Kernel Isolation
Check the pod's logs once running to confirm it is executing under the gVisor sandbox kernel rather than the host Linux kernel:

```bash
kubectl logs -n polsia-sandboxes test-gvisor-probe
```

**Expected output:**
```text
[    0.000000] Starting gVisor...
aarch64   # (or x86_64 depending on spot pricing at execution time)
```

After the pod completes, Karpenter will detect that the node has been empty for 30 seconds and will terminate the EC2 Spot instance, scaling sandbox capacity back to zero.
