# .github/workflows/release.yml
name: Release & Multi-Arch Container Build

on:
  push:
    tags:
      - "v[0-9]+.[0-9]+.[0-9]+"
      - "v[0-9]+.[0-9]+.[0-9]+-*"
  workflow_dispatch:
    inputs:
      tag:
        description: "Manual release tag (e.g., v2.4.0)"
        required: true
        type: string

permissions:
  contents: write
  packages: write
  id-token: write

env:
  REGISTRY: ghcr.io
  IMAGE_BASE: ghcr.io/${{ github.repository }}

jobs:
  validate-tag:
    runs-on: ubuntu-latest
    outputs:
      release_version: ${{ steps.version.outputs.clean_version }}
      is_prerelease: ${{ steps.version.outputs.is_prerelease }}
    steps:
      - name: Extract & Normalize Version
        id: version
        run: |
          RAW_TAG="${{ github.event.inputs.tag || github.ref_name }}"
          # Strip leading 'v' for standard SemVer reference
          CLEAN_VERSION="${RAW_TAG#v}"
          echo "clean_version=${CLEAN_VERSION}" >> "$GITHUB_OUTPUT"

          if [[ "$CLEAN_VERSION" =~ -(alpha|beta|rc|dev) ]]; then
            echo "is_prerelease=true" >> "$GITHUB_OUTPUT"
          else
            echo "is_prerelease=false" >> "$GITHUB_OUTPUT"
          fi

  build-and-push:
    needs: validate-tag
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        include:
          - service: api
            file: Dockerfile.api
            context: .
            platforms: linux/amd64,linux/arm64
          - service: web
            file: Dockerfile.web
            context: .
            platforms: linux/amd64,linux/arm64
          - service: worker
            file: Dockerfile.worker
            context: .
            # NVIDIA CUDA & NVENC toolkits compile specifically for x86_64 in standard runner setups
            platforms: linux/amd64

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3
        with:
          platforms: all

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        with:
          driver-opts: image=moby/buildkit:v0.13.1

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract Docker Metadata & SemVer Tags
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.IMAGE_BASE }}/${{ matrix.service }}
          flavor: |
            latest=${{ needs.validate-tag.outputs.is_prerelease == 'false' }}
          tags: |
            # SemVer matchers (e.g., 2.4.0, 2.4, 2)
            type=semver,pattern={{version}},value=v${{ needs.validate-tag.outputs.release_version }}
            type=semver,pattern={{major}}.{{minor}},value=v${{ needs.validate-tag.outputs.release_version }}
            type=semver,pattern={{major}},value=v${{ needs.validate-tag.outputs.release_version }}
            type=sha,format=long,prefix=sha-

      - name: Build & Push Multi-Arch Container
        uses: docker/build-push-action@v6
        with:
          context: ${{ matrix.context }}
          file: ${{ matrix.file }}
          platforms: ${{ matrix.platforms }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha,scope=${{ matrix.service }}
          cache-to: type=gha,mode=max,scope=${{ matrix.service }}

  publish-github-release:
    needs: [validate-tag, build-and-push]
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate Changelog & GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.event.inputs.tag || github.ref_name }}
          name: Release ${{ github.event.inputs.tag || github.ref_name }}
          prerelease: ${{ needs.validate-tag.outputs.is_prerelease == 'true' }}
          generate_release_notes: true
          body: |
            ### Production Multi-Arch Artifacts (GHCR)
            - `ghcr.io/${{ github.repository }}/api:${{ needs.validate-tag.outputs.release_version }}` (`linux/amd64`, `linux/arm64`)
            - `ghcr.io/${{ github.repository }}/web:${{ needs.validate-tag.outputs.release_version }}` (`linux/amd64`, `linux/arm64`)
            - `ghcr.io/${{ github.repository }}/worker:${{ needs.validate-tag.outputs.release_version }}` (`linux/amd64`)

Core Pipeline Mechanics
 * Architecture Routing by Workload Profile:
   * api and web images use QEMU emulation to compile cross-platform manifests for both linux/amd64 (Intel/AMD cloud VMs) and linux/arm64 (AWS Graviton, Apple Silicon local dev).
   * worker isolates deployment targets to linux/amd64. NVIDIA CUDA 12.2 developer toolkits, nv-codec-headers, and FFmpeg NVENC compilation target x86_64 hardware servers equipped with dedicated NVIDIA GPUs (e.g., T4, A10G, L4).
 * SemVer Tag Expansion Rules:
   Triggering the workflow with tag v2.4.1 generates the following image tags on GitHub Container Registry:
   * ghcr.io/<org>/<service>:2.4.1
   * ghcr.io/<org>/<service>:2.4
   * ghcr.io/<org>/<service>:2
   * ghcr.io/<org>/<service>:latest (automatically withheld if a pre-release suffix such as -rc.1 or -beta is detected)
   * ghcr.io/<org>/<service>:sha-<git_commit_hash>
 * Multi-Stage BuildKit Caching:
   The cache-from and cache-to flags hook directly into GitHub Actions cache (type=gha) scoped per service matrix (scope=${{ matrix.service }}). Unchanged intermediate layers—such as FFmpeg compilation steps, Next.js standalone node dependencies, and PyPI installations—skip rebuilding on incremental patches.
Directory Layout
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── api-deployment.yaml
│   ├── web-deployment.yaml
│   └── worker-deployment.yaml
└── overlays/
    └── production/
        ├── kustomization.yaml
        └── patches/
            ├── worker-gpu.yaml
            └── replicas.yaml
argocd/
├── application-production.yaml
└── secrets/
    ├── ghcr-pull-secret.yaml
    └── git-creds-secret.yaml

Production Kustomize Overlay (k8s/overlays/production/kustomization.yaml)
This overlay sets the production namespace, binds pinned base image definitions, and applies node scheduling and replica adjustments.
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: production

resources:
  - ../../base
  - ../../cert-manager-clusterissuer.yaml
  - ../../ingress-production.yaml
  - ../../keda-autoscaler.yaml

# Base image definitions rewritten by ArgoCD Image Updater
images:
  - name: ghcr.io/viralvision/api
    newName: ghcr.io/viralvision/api
    newTag: 2.4.0
  - name: ghcr.io/viralvision/web
    newName: ghcr.io/viralvision/web
    newTag: 2.4.0
  - name: ghcr.io/viralvision/worker
    newName: ghcr.io/viralvision/worker
    newTag: 2.4.0

patches:
  - path: patches/worker-gpu.yaml
    target:
      kind: Deployment
      name: viralvision-video-worker
  - path: patches/replicas.yaml
    target:
      kind: Deployment
      name: viralvision-api
  - path: patches/replicas.yaml
    target:
      kind: Deployment
      name: viralvision-web

configMapGenerator:
  - name: viralvision-production-config
    literals:
      - ENVIRONMENT=production
      - LOG_LEVEL=INFO
      - NEXT_PUBLIC_ROOT_DOMAIN=viralvision.io

Worker GPU & Node Affinity Patch (k8s/overlays/production/patches/worker-gpu.yaml)
Enforces scheduling onto GPU-enabled node pools (e.g., AWS g5 or GKE g2 instances equipped with NVIDIA A10G/L4 GPUs) with matching tolerations.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: viralvision-video-worker
spec:
  template:
    spec:
      nodeSelector:
        cloud.google.com/gke-accelerator: nvidia-l4
        kubernetes.io/arch: amd64
      tolerations:
        - key: "nvidia.com/gpu"
          operator: "Exists"
          effect: "NoSchedule"
      containers:
        - name: celery-worker
          resources:
            limits:
              nvidia.com/gpu: "1"
              memory: 16Gi
              cpu: "8"
            requests:
              nvidia.com/gpu: "1"
              memory: 8Gi
              cpu: "4"

Replicas Baseline Patch (k8s/overlays/production/patches/replicas.yaml)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: not-used
spec:
  replicas: 3

ArgoCD Application with Automated Image Updater (argocd/application-production.yaml)
This manifest configures the root ArgoCD application. The embedded argocd-image-updater annotations track Semantic Versioning releases (^2.4), poll GHCR for new tags every 2 minutes, update the newTag values directly inside k8s/overlays/production/kustomization.yaml, and push Git commits back to main.
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: viralvision-production
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
  annotations:
    # 1. Image Tracking Registration
    argocd-image-updater.argoproj.io/image-list: |
      api=ghcr.io/viralvision/api,
      web=ghcr.io/viralvision/web,
      worker=ghcr.io/viralvision/worker

    # 2. Update Strategy: Strict SemVer (Major.Minor.Patch)
    argocd-image-updater.argoproj.io/api.update-strategy: semver
    argocd-image-updater.argoproj.io/api.allowed-versions: "^2.4"
    argocd-image-updater.argoproj.io/api.pull-secret: pullsecret:argocd/ghcr-auth-token

    argocd-image-updater.argoproj.io/web.update-strategy: semver
    argocd-image-updater.argoproj.io/web.allowed-versions: "^2.4"
    argocd-image-updater.argoproj.io/web.pull-secret: pullsecret:argocd/ghcr-auth-token

    argocd-image-updater.argoproj.io/worker.update-strategy: semver
    argocd-image-updater.argoproj.io/worker.allowed-versions: "^2.4"
    argocd-image-updater.argoproj.io/worker.pull-secret: pullsecret:argocd/ghcr-auth-token

    # 3. Git Write-Back Configuration
    argocd-image-updater.argoproj.io/write-back-method: git:secret:argocd/git-updater-credentials
    argocd-image-updater.argoproj.io/write-back-target: kustomization
    argocd-image-updater.argoproj.io/git-branch: main
    argocd-image-updater.argoproj.io/git-commit-message: "chore(gitops): bump production images to {{ range .AppChanges }}{{ .Image }} to {{ .NewTag }} {{ end }}"
spec:
  project: default
  source:
    repoURL: https://github.com/viralvision/viralvision-core.git
    targetRevision: main
    path: k8s/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - ApplyOutOfSyncOnly=true
    retry:
      limit: 5
      backoff:
        duration: 10s
        factor: 2
        maxDuration: 3m

Git & GHCR Registry Credentials (argocd/secrets/)
Apply these secrets in the argocd namespace to enable authenticated polling against private GHCR packages and authenticated Git commits back to the GitHub repository.
# argocd/secrets/ghcr-pull-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: ghcr-auth-token
  namespace: argocd
type: kubernetes.io/dockerconfigjson
stringData:
  .dockerconfigjson: |
    {
      "auths": {
        "ghcr.io": {
          "username": "VIRALVISION_BOT",
          "password": "GITHUB_PAT_WITH_PACKAGE_READ"
        }
      }
    }
---
# argocd/secrets/git-creds-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: git-updater-credentials
  namespace: argocd
type: Opaque
stringData:
  # Base64-decoded SSH Private Key or HTTPS Credentials with write access to the repository
  username: "viralvision-automation[bot]"
  password: "GITHUB_PAT_WITH_REPO_CONTENTS_WRITE"

Deployment Runbook
# 1. Apply credentials to ArgoCD namespace
kubectl apply -f argocd/secrets/ghcr-pull-secret.yaml
kubectl apply -f argocd/secrets/git-creds-secret.yaml

# 2. Register Application in ArgoCD
kubectl apply -f argocd/application-production.yaml

# 3. Validate sync status via ArgoCD CLI
argocd app get viralvision-production --refresh
argocd app sync viralvision-production

Secrets Configuration (argocd/notifications/secrets.yaml)
Store the Slack Bot OAuth token (xoxb-...) and Discord Incoming Webhook URL in the argocd namespace.
apiVersion: v1
kind: Secret
metadata:
  name: argocd-notifications-secret
  namespace: argocd
type: Opaque
stringData:
  # Slack Bot User OAuth Token with 'chat:write' scope
  slack-token: "REPLACE_WITH_REAL_SLACK_BOT_OAUTH_TOKEN"
  # Discord Incoming Webhook URL
  discord-webhook-url: "[placeholder in the original doc, not a real webhook -- replace with your own Discord webhook URL]"

Notifications Engine ConfigMap (argocd/notifications/argocd-notifications-cm.yaml)
This ConfigMap registers the notification services (Slack API and Discord Webhook), specifies dynamic payload templates with commit and image tag extraction, and binds custom triggers.
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-notifications-cm
  namespace: argocd
data:
  # 1. Integration Service Definitions
  service.slack: |
    token: $slack-token

  service.webhook.discord: |
    url: $discord-webhook-url
    headers:
      - name: Content-Type
        value: application/json

  # 2. Reusable Templates (Slack Blocks & Discord Embeds)
  template.app-deployed: |
    message: |
      Application {{.app.metadata.name}} successfully synced to revision {{.app.status.sync.revision | call .repo.GetCommitMetadata .app.status.sync.revision | call .strings.Trunc 7}}.
    slack:
      attachments: |
        [{
          "color": "#10B981",
          "title": "🚀 {{.app.metadata.name}} Deployed to Production",
          "title_link": "{{.context.argocdUrl}}/applications/{{.app.metadata.name}}",
          "fields": [
            {
              "title": "Sync Status",
              "value": "{{.app.status.sync.status}} (Health: {{.app.status.health.status}})",
              "short": true
            },
            {
              "title": "Author",
              "value": "{{ (call .repo.GetCommitMetadata .app.status.sync.revision).Author }}",
              "short": true
            },
            {
              "title": "Active Container Images",
              "value": "{{ range .app.status.summary.images }}• `{{ . }}`\n{{ end }}",
              "short": false
            },
            {
              "title": "Commit Message",
              "value": "{{ (call .repo.GetCommitMetadata .app.status.sync.revision).Message }}",
              "short": false
            }
          ],
          "footer": "ViralVision GitOps Pipeline",
          "ts": {{.app.status.operationState.finishedAt.Unix}}
        }]
    webhook:
      discord:
        method: POST
        body: |
          {
            "embeds": [{
              "title": "🚀 {{.app.metadata.name}} Deployed to Production",
              "url": "{{.context.argocdUrl}}/applications/{{.app.metadata.name}}",
              "color": 1096065,
              "fields": [
                {
                  "name": "Sync Status",
                  "value": "{{.app.status.sync.status}} ({{.app.status.health.status}})",
                  "inline": true
                },
                {
                  "name": "Author",
                  "value": "{{ (call .repo.GetCommitMetadata .app.status.sync.revision).Author }}",
                  "inline": true
                },
                {
                  "name": "Active Images",
                  "value": "{{ range .app.status.summary.images }}• `{{ . }}`\n{{ end }}"
                }
              ],
              "footer": { "text": "ViralVision GitOps Pipeline" }
            }]
          }

  template.app-sync-failed: |
    message: |
      Sync failed for application {{.app.metadata.name}}.
    slack:
      attachments: |
        [{
          "color": "#EF4444",
          "title": "❌ {{.app.metadata.name}} Sync Failed",
          "title_link": "{{.context.argocdUrl}}/applications/{{.app.metadata.name}}",
          "fields": [
            {
              "title": "Target Revision",
              "value": "{{.app.status.sync.revision}}",
              "short": true
            },
            {
              "title": "Health Status",
              "value": "{{.app.status.health.status}}",
              "short": true
            },
            {
              "title": "Error Summary",
              "value": "```{{.app.status.operationState.message}}```",
              "short": false
            }
          ],
          "footer": "ViralVision GitOps Pipeline"
        }]
    webhook:
      discord:
        method: POST
        body: |
          {
            "embeds": [{
              "title": "❌ {{.app.metadata.name}} Sync Failed",
              "url": "{{.context.argocdUrl}}/applications/{{.app.metadata.name}}",
              "color": 15680580,
              "description": "```{{.app.status.operationState.message}}```",
              "fields": [
                {
                  "name": "Health Status",
                  "value": "{{.app.status.health.status}}",
                  "inline": true
                }
              ]
            }]
          }

  template.app-health-degraded: |
    message: |
      Health degraded on {{.app.metadata.name}}! Pod crashes or OOM events detected.
    slack:
      attachments: |
        [{
          "color": "#F59E0B",
          "title": "⚠️ {{.app.metadata.name}} Cluster Health Degraded",
          "title_link": "{{.context.argocdUrl}}/applications/{{.app.metadata.name}}",
          "text": "One or more resources in `production` entered a degraded state.",
          "footer": "ViralVision Cluster Sentinel"
        }]
    webhook:
      discord:
        method: POST
        body: |
          {
            "embeds": [{
              "title": "⚠️ {{.app.metadata.name}} Cluster Health Degraded",
              "url": "{{.context.argocdUrl}}/applications/{{.app.metadata.name}}",
              "color": 16096779,
              "description": "Resources in the cluster entered a degraded state. Inspect worker/API pods."
            }]
          }

  # 3. Trigger Conditions
  trigger.on-deployed: |
    - description: Application sync succeeded and healthy
      send: [app-deployed]
      when: app.status.operationState != nil and app.status.operationState.phase in ['Succeeded'] and app.status.health.status == 'Healthy'

  trigger.on-sync-failed: |
    - description: Application sync execution failed
      send: [app-sync-failed]
      when: app.status.operationState != nil and app.status.operationState.phase in ['Failed', 'Error']

  trigger.on-health-degraded: |
    - description: Cluster health status entered degraded state
      send: [app-health-degraded]
      when: app.status.health.status == 'Degraded'

Application Subscription Annotations (argocd/application-production.yaml)
Patch the root ArgoCD application manifest with subscription annotations to dispatch events to the #deployments Slack channel and the configured Discord webhook.
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: viralvision-production
  namespace: argocd
  annotations:
    # --- Slack Subscriptions (Channel name or ID) ---
    notifications.argoproj.io/subscribe.on-deployed.slack: "deployments"
    notifications.argoproj.io/subscribe.on-sync-failed.slack: "deployments"
    notifications.argoproj.io/subscribe.on-health-degraded.slack: "deployments"

    # --- Discord Subscriptions (Mapped via empty target string) ---
    notifications.argoproj.io/subscribe.on-deployed.discord: ""
    notifications.argoproj.io/subscribe.on-sync-failed.discord: ""
    notifications.argoproj.io/subscribe.on-health-degraded.discord: ""
spec:
  # ... existing spec ...

Verification and Delivery Test
 * Apply the configuration manifests:
   kubectl apply -f argocd/notifications/secrets.yaml
kubectl apply -f argocd/notifications/argocd-notifications-cm.yaml
kubectl apply -f argocd/application-production.yaml

 * Restart the notifications controller to load the new config:
   kubectl rollout restart deployment argocd-notifications-controller -n argocd

 * Trigger a test notification via the ArgoCD CLI:
   # Test Slack delivery
argocd-notifications template notify app-deployed viralvision-production --recipient slack:deployments

# Test Discord delivery
argocd-notifications template notify app-deployed viralvision-production --recipient discord:

