# ViralVision platform expansion — roadmap & source map

This documents a large set of architecture/design material uploaded for
this repo, describing a much bigger "ViralVision" AI video-generation and
distribution platform than the app currently at the repo root (**ViralSync**
— a small, working, compliant tool that boosts a creator's own posts
through official ad APIs; see the root `README.md`). The two are different
products in the source material: same general space (short-form video /
creator distribution), different name, different scope, different stack
(ViralSync is Next.js + Supabase only; ViralVision's docs assume a
separate Python/FastAPI + Celery + Kubernetes backend).

Nothing here replaces or modifies ViralSync. Everything is additive:
new files, new directories, a new (separate) backend service. If the two
products are meant to converge, that's a product decision for a human to
make, not something to infer silently from a batch of design docs.

## What "organized" means here

The 16 uploaded documents (~20,000 lines combined) describe an 18-24
month, multi-team engineering roadmap (they say so explicitly — the epics
in `docs/viralvision-source/main-analytics-dashboard.md` are labeled
"Months 6-9", "Months 9-12", etc.). That is not something to fully build
and wire up in one pass. What actually happened:

1. **Nothing was lost.** Every document is archived verbatim in
   `docs/viralvision-source/`, renamed from opaque upload hashes to
   descriptive filenames. If a mapping below feels incomplete, the full
   original text is there.
2. **Where the docs described a coherent backend service**, that code
   was extracted, consolidated (duplicate model/router declarations
   across docs were merged onto one `Base`/one router), and organized
   into `services/api/` (FastAPI + Celery) and `services/collab/`
   (Yjs websocket server). It compiles (`py_compile` clean) but has
   **never been run** — no Postgres, Redis, GPU, or third-party API key
   exists in this environment to test it against. See
   `services/api/README.md` for exactly what's needed before treating
   any endpoint as real.
3. **Where the docs described infrastructure**, that became real,
   YAML-valid manifests under `k8s/` and `argocd/` — again, never applied
   to an actual cluster.
4. **Where a frontend page only depended on this repo's new
   `components/ui/button.tsx` + `lucide-react`**, it was wired into the
   live Next.js app under `app/dashboard/` as working, buildable
   (verified with `npm run build`) additions.
5. **Where a frontend page depended on components the docs referenced
   but never defined** (`VideoAnalyticsDashboard`, `BanditTelemetryCard`,
   `DeveloperWebhookPortal`, the full landing-page component set —
   `Hero`, `Pricing`, `SiteHeader`, etc.), it was **not** wired in, to
   avoid shipping broken imports or inventing filler components that
   weren't actually specified. Those pages' source is in
   `docs/viralvision-source/` for whoever builds the missing pieces.

## Source document map

| Source file (`docs/viralvision-source/`) | Landed in |
|---|---|
| `stripe-metering-and-rate-limiting.md` | `services/api/app/routers/billing.py`, `app/middleware/rate_limit.py` |
| `tenant-domain-middleware.md` | `services/api/app/k8s_controller.py`, `app/routers/domains.py`, `proxy.ts`, `k8s/cert-manager-clusterissuer.yaml`, `k8s/controller-rbac.yaml` |
| `dashboard-domain-settings-page.md` | `app/dashboard/settings/domain/page.tsx`, `app/domain-unregistered/page.tsx`, `services/api/app/workers/domain_health.py`, `k8s/monitoring/prometheus-rules-domains.yaml`, `k8s/monitoring/alertmanager-domain-routing.yaml` |
| `platform-buildout-plan-and-core-engine.md` | `services/api/app/pipeline/{video_pipeline,subtitles,audio_mix}.py`, `app/workers/tasks.py`, `app/pipeline/storyboard.py` (early draft, superseded by the one below), enterprise SSO / Yjs collab / trend detection sections are reference-only (SSO needs `@boxyhq/saml-jackson`, not added as a dependency; nothing currently calls it) |
| `load-testing-and-video-worker-modules.md` | `tests/load/k6_distributed_benchmark.js`, `k8s/testing/k6-testrun.yaml`, `services/api/app/pipeline/clip_matcher.py`, `app/pipeline/crop_engine.py`, `app/pipeline/foley.py`, `app/routers/events.py`, `app/routers/collaborations.py` (mentorship), `app/core/models.py` (consolidated), `app/routers/ab_testing.py` |
| `main-analytics-dashboard.md` | `app/dashboard/page.tsx` **not** added (needs `VideoAnalyticsDashboard`, not defined anywhere in the source docs) — reference-only. `services/api/alembic/env.py` pattern reused. |
| `trend-detection-dashboard.md` | `app/dashboard/trends/page.tsx`, `services/api/app/routers/trends.py`, `app/pipeline/competitor.py`, `app/routers/analytics.py`, `app/workers/tasks.py` (batch orchestration), `app/pipeline/script_opt.py` + `storyboard.py` (final versions used), `k8s/monitoring/prometheus-rules-gpu.yaml` |
| `render-progress-and-repurposing.md` | `app/dashboard/renders/[id]/page.tsx`, `services/api/app/pipeline/repurpose.py` |
| `autonomous-video-director.md` | Reference-only. Describes an orchestrator (`AutonomousVideoDirector`) chaining every pipeline module plus several never-defined ones (`emoji_enhancer.py`, `color_grade.py`, `thumbnails.py`, `social_seo.py`, `assembly.py`). Write that orchestrator once those modules exist. |
| `voice-synthesis-and-smart-crop.md` | `services/api/app/pipeline/avatar.py`, `app/workers/celery_app.py` (SLA queues) |
| `storage-multipart-upload.md` | `services/api/app/routers/storage.py`, `services/api/app/core/telemetry.py` |
| `social-oauth-and-misc-notes.md` | `services/api/app/routers/social.py` (OAuth + dispatch) — the `AuthModal`/SSO frontend pieces in this doc are reference-only |
| `nextjs-production-config-and-landing.md` | `next.config.mjs` (headers, `output: standalone`, image remote patterns) — the full landing-page rebuild (`Providers`, `LandingPage`, etc.) is reference-only; it would replace ViralSync's actual homepage and wasn't applied |
| `k8s-gpu-worker-keda.md` | `k8s/video-worker-deployment.yaml`, `k8s/keda-autoscaler.yaml` |
| `prometheus-gpu-monitoring.md` | `k8s/monitoring/prometheus-rules-gpu.yaml`, `service-monitors.yaml`, `grafana-dashboard-cm.yaml`, `alertmanager-secret.yaml`, `alertmanager-templates-cm.yaml`, `k8s/jobs/db-migration-job.yaml`, `k8s/cron/postgres-backup-cronjob.yaml` |
| `ci-cd-release-workflow-and-gitops.md` | `.github/workflows/release.yml`, `Dockerfile.{api,web,worker}`, `k8s/base/`, `k8s/overlays/`, `argocd/` |

## Known gaps (don't assume these work)

- **No database migration exists yet.** `services/api/alembic/versions/`
  is empty on purpose — see the README there for why (autogenerate
  against the consolidated `models.py`, don't hand-write it).
- **`k8s/base/kustomization.yaml` only references the GPU worker
  Deployment.** The source docs mention `api-deployment.yaml` and
  `web-deployment.yaml` but never included their content, and this repo
  has no evidence the Next.js app is meant to run on Kubernetes at all
  (its README talks about Vercel-style env vars, not a cluster). Decide
  the actual deployment target before writing those.
- **`services/collab/` is a standalone Yjs server nothing calls.** The
  `CollaborativeTimeline` component it's meant to sync was referenced in
  the docs but its full implementation depends on a `useCollaborativeTimeline`
  hook that was never fully specified either.
- **The Anthropic model id in the source docs (`claude-opus-4-6`) doesn't
  exist.** Every pipeline module using it reads `ANTHROPIC_MODEL` from
  the environment instead, defaulting to `claude-opus-5` — verify that
  against Anthropic's current model list before deploying, and pin an
  exact dated model id rather than tracking "latest" in production.
- **`proxy.ts` (formerly `middleware.ts` — Next.js 16 renamed the file
  convention) is disabled by default** (`MULTI_TENANT_ROUTING_ENABLED`
  must be `"true"`). Turning it on without also setting
  `NEXT_PUBLIC_ROOT_DOMAIN` to your real apex domain will make every
  request look like an unregistered tenant and 404 the whole site — see
  the comment at the top of the file.
- **Every placeholder credential in `k8s/` and `argocd/`** (Slack
  webhook URLs, GHCR tokens, Git write-back PATs) is a literal
  `REPLACE_WITH_...` string, not a real secret. Fill them in outside
  version control.
