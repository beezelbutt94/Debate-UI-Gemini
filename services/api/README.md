# Viral Trending Platform API (`services/api`)

A FastAPI + Celery backend organized from the Viral Trending architecture
docs archived in `../../docs/viralvision-source/` (see
`../../docs/PLATFORM_ROADMAP.md` for the full map). It is a **separate
service** from the Next.js app at the repo root — the two talk over HTTP,
not by sharing code.

## Status: organized scaffolding, not a running service

This code is a faithful, buildable-looking translation of the design
docs into a coherent package layout. It has **not** been run against a
real database, Redis, or any of the third-party APIs it calls, because
none of that infrastructure exists in this environment. Before treating
any endpoint as working:

- Stand up PostgreSQL + Redis and set `DATABASE_URL` / `REDIS_URL`.
- Run `alembic revision --autogenerate` once (see `alembic/versions/README.md`)
  — no migration exists yet.
- Install `requirements.txt`; install `requirements-ml.txt` only on a
  machine that will actually run the GPU worker (storyboarding,
  subtitles, smart-crop, and CLIP matching pull in torch/mediapipe/etc.
  and are effectively untestable without a real GPU pipeline).
- Provide real credentials for whichever third-party APIs a feature
  needs (Stripe, Anthropic, ElevenLabs, S3-compatible storage, TikTok/
  Meta/Google OAuth apps, LiveKit). Every module reads these from env
  vars and does nothing to validate them beyond what each provider's
  SDK does.
- `app/k8s_controller.py` and the domain endpoints in
  `app/routers/domains.py` require an actual Kubernetes cluster with
  cert-manager installed; they will raise on import/first-use otherwise
  (see the lazy client init in `k8s_controller.py`).

Think of this as: the code you'd start iterating on to build the
"Viral Trending" platform described in the docs, not a deployed system.

## Layout

- `app/core/` — `database.py` (single `Base`/engine/session factory),
  `models.py` (every table from the docs, consolidated onto that one
  `Base`), `auth.py` (API-key auth + role gate), `telemetry.py`
  (Prometheus metrics).
- `app/pipeline/` — the actual video/AI logic: FFmpeg composition
  (`video_pipeline.py`), kinetic subtitles, audio ducking, foley,
  smart-crop, CLIP B-roll matching, AI storyboarding, script
  optimization, long-form repurposing, and ElevenLabs voice synthesis.
- `app/workers/` — Celery app + SLA-tiered queues (`celery_app.py`),
  the transcode task and batch orchestration (`tasks.py`), signed
  webhook delivery (`webhooks.py`), and the custom-domain health probe
  (`domain_health.py`).
- `app/routers/` — one FastAPI router per feature area (billing,
  domains, videos, marketplace, integrations, reviews, collaborations,
  trends/analytics, A/B testing, storage, events, social).
- `app/k8s_controller.py` — provisions/tears down per-tenant Ingress +
  cert-manager `Certificate` resources for custom domains.
- `app/main.py` — mounts every router; run with `uvicorn app.main:app`.

## Env vars

See the consolidated list in the repo root `.env.example` under the
"Viral Trending platform service" section.
