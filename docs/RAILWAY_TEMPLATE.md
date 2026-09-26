# Earning from a Railway template

Railway pays a kickback on the usage your published template generates in
other people's projects. This is how to turn `services/api` into that
template, and what it realistically pays.

## How the money actually works

From Railway's [kickback docs](https://docs.railway.com/templates/kickbacks):

- **15%** of the usage cost incurred by people who deploy your template.
- **+10% (25% total)** for answering questions in your
  [Template Queue](https://station.railway.com/my-template-queue). If nobody
  ever asks a question, you get the full 25% anyway.
- It is a share of **usage**, not of the $5/seat platform fee.
- Minimum payout $0.01; minimum *cash* withdrawal $100, in $100–$10,000
  increments.

Railway bills usage at **$10 per GB-month of RAM**, **$20 per vCPU-month**,
and **$0.05 per GB egress**, metered per minute.

So for this four-service stack idling at roughly 1.5 GB RAM and 0.5 vCPU:

| | |
|---|---|
| RAM | 1.5 GB × $10 = **$15/mo** |
| CPU | 0.5 vCPU × $20 = **$10/mo** |
| Usage per deployer | **≈ $25/mo** |
| Your 25% | **≈ $6.25 per active deployer per month** |

Which sets the honest expectation: **~16 people running it for a month gets
you to the $100 cash-withdrawal floor.** One or two deployers is coffee
money. This is an adoption game, not a code game — the template has to be
something people actually want and keep running.

### One setting to decide first

Your Earnings page currently has **Direct Deposit to Railway Credits**
switched **on**, which is why the page says cash withdrawals are
unavailable. That is not a bug:

- **Leave it on** → earnings become Railway Credits, which offset your own
  bill. Useful while you are on trial and paying for your own services.
- **Switch it off** → earnings accrue as cash in Available Balance, and you
  can withdraw once you clear $100.

Credits are the better deal while you are still paying Railway more than you
earn. Flip it once that reverses.

## What to publish

Not the Next.js app. It needs Clerk, Supabase, Stripe and Cloudinary keys
before it does anything, and a template that demands four external signups
before first render does not get deployed twice.

Publish the backend: **FastAPI + Celery + Postgres + Redis**. It is a
genuinely common stack, Railway supplies the Postgres and Redis natively, and
it needs no third-party account to boot. It also runs four services
continuously, which is what generates the usage the kickback is a share of.

## Repo changes that make this deployable

Three things were wrong for Railway and are now fixed.

**1. The API ignored `$PORT`.** `Dockerfile.api` had
`CMD ["uvicorn", ..., "--port", "8000"]`. Railway injects `PORT` and routes
its domain at it, so a hardcoded 8000 means the health check never connects
and the deploy is marked failed. It is now shell-form so the variable
actually expands — exec-form `CMD` does no expansion, and `${PORT}` would
have reached uvicorn as a literal string:

```dockerfile
CMD ["/bin/sh", "-c", "python -m app.system_init && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

**2. A fresh database had no tables.** `services/api/alembic/versions/`
contains only a README — there are no revisions. Without a bootstrap, every
route that touches a table 500s on a brand-new deploy. The start command now
runs `app/system_init.py` first, which does `Base.metadata.create_all`
(idempotent) and **exits 1** if the database is unreachable, so the container
fails to start instead of serving 500s. Verified:

```
$ DATABASE_URL=postgresql://nobody@127.0.0.1:59999/nope python -m app.system_init
[CRITICAL] Database initialization error: connection to server at "127.0.0.1", port 59999 failed
$ echo $?
1
```

**3. The worker image pulled several GB of ML wheels unconditionally.**
`torch`, `mediapipe`, `open_clip_torch` and `faster-whisper` are only needed
for the storyboard/subtitle/CLIP pipeline steps. On a template that is
actively harmful: the build can exceed the timeout and burns the deployer's
build minutes before they have seen anything work. It is now
`ARG INSTALL_ML_EXTRAS=false`, opt-in.

`.railway/railway.ts` describes the whole stack. Note it is **not** a
`railway.json` — Railway's docs mark Config as Code deprecated with a hard
cutoff of **2026-12-01**, and new services can no longer opt into it at all.

## The worker wedge, and why it needed a code fix

Two days after this stack went live the managed Redis restarted and rotated
its password. The worker did not crash — it sat in this, once every 32
seconds:

```
consumer: Cannot connect to redis://default:**@redis.railway.internal:6379//:
invalid username-password pair or user is disabled..
Trying again in 32.00 seconds... (16/100)
```

`REDIS_URL` is a reference variable, resolved and injected into the
container's environment **at deploy time**. A running process keeps the value
it started with, so no amount of retrying could ever succeed — the
credentials in hand were permanently wrong. Celery's default of 100 retries
with the backoff capped at 32s meant roughly **45 minutes of a worker that is
up, reports healthy, and consumes nothing.** A worker serves no HTTP, so
there is no health check to catch it. It resolved only because a redeploy
re-injected the variable.

Two changes, because either alone is insufficient:

- `services/api/app/workers/celery_app.py` sets
  `broker_connection_max_retries=5`, so stale credentials make the worker
  **exit** rather than retry. It also sets
  `broker_connection_retry_on_startup=True`, which is the documented
  successor to the setting Celery 5 warns about on every boot.
- The Railway service gets `restartPolicyType: ALWAYS`, which is what
  actually brings it back — with the current `REDIS_URL`.

Worth carrying into any template with a queue worker in it: **failing fast is
the recovery path when the bad input is an environment variable.** Retrying
only helps when the thing you are retrying against can change.

## Publishing it

The template composer is a UI flow; it cannot be driven from here. Steps:

1. **railway.com/workspace/templates → New Template.**
2. Add four services:

   | Service | Source | Key settings |
   |---|---|---|
   | `postgres` | Railway Postgres | — |
   | `redis` | Railway Redis | — |
   | `api` | `https://github.com/beezelbutt94/Debate-UI-Gemini` | Public networking on, healthcheck `/healthz` |
   | `worker` | same repo | No public networking, no healthcheck |

3. Variables. Use reference variables, not literals — Railway's own docs call
   this out as what separates a good template from a broken one:

   ```
   api      RAILWAY_DOCKERFILE_PATH = Dockerfile.api
            DATABASE_URL            = ${{Postgres.DATABASE_URL}}
            REDIS_URL               = ${{Redis.REDIS_URL}}
            CORS_ALLOWED_ORIGINS    = <deployer fills in>

   worker   RAILWAY_DOCKERFILE_PATH = Dockerfile.worker
            DATABASE_URL            = ${{Postgres.DATABASE_URL}}
            REDIS_URL               = ${{Redis.REDIS_URL}}
            INSTALL_ML_EXTRAS       = false
   ```

   `RAILWAY_DOCKERFILE_PATH` is required on both: Railway only auto-detects a
   file named exactly `Dockerfile`, and this repo has three.

4. **Also set the Dockerfile path in the service's build settings**, not only
   as a variable. Both, on both services.

   This is not belt-and-braces for its own sake. Building the source project
   for this template, the two services were created before the variable was
   set, and Railway's first build fell straight through to Railpack: it found
   `package.json`, decided the repo was a Node project, and tried to build
   the Next.js app instead:

   ```
   Railpack 0.39.0
     Detected Node ... Using npm package manager
     install $ npm install
     build   $ npm run build
   Build Failed: failed to compute cache key:
     "/k8s/overlays/production/patches": not found
   ```

   Both services recovered on the next deploy once the variable existed. But
   note the failure mode: **a missing Dockerfile path does not fail, it
   silently builds the wrong thing.** The service-level build setting closes
   that gap, so there is no window where clearing one variable quietly turns
   a Python API into a failed Next.js build.

   If you ever add a secret to the template, generate it rather than shipping
   one — `${{secret(32)}}` produces a fresh value per deploy.

5. **Rename it before publishing.** The project and its services are named
   after this codebase, and "Viral Trending Platform API" is not what anyone
   searches the marketplace for. The template's name and description are
   editable at publish time and are the whole listing -- they decide whether
   it gets deployed at all, which is the only thing kickbacks are a share
   of. Paste these:

   **Name**

   ```
   FastAPI + Celery + Postgres + Redis
   ```

   **Description** (one line, shows in search results)

   ```
   Production-shaped async task backend: FastAPI behind a healthcheck, a
   Celery worker on three priority queues, managed Postgres and Redis wired
   in. Boots with no third-party accounts.
   ```

   **README** (shows on the template page)

   ```markdown
   Four services, wired together and ready to deploy:

   - **api** — FastAPI on uvicorn, binds `$PORT`, healthcheck at `/healthz`
   - **worker** — Celery, three priority queues (`premium_sla`,
     `standard_jobs`, `draft_preview`)
   - **Postgres** — managed, schema created automatically on first boot
   - **Redis** — managed, broker and result backend

   The API creates its own schema before serving and exits non-zero if the
   database is unreachable, so a broken deploy fails loudly instead of
   serving 500s. Nothing here needs an external account or API key.

   Set `CORS_ALLOWED_ORIGINS` to the web origin that calls the API; leave it
   unset and cross-origin browser requests are refused (server-to-server
   callers are unaffected).
   ```

   Leave the service names `api`, `worker`, `Postgres`, `Redis` as they are
   — those are what a deployer sees on the canvas, and they are already
   generic.

6. **Create Template**, then **Publish**. Unpublished templates earn nothing;
   the marketplace listing is the eligibility requirement.

7. Turn on Template Queue emails in
   [account notifications](https://railway.com/account/notifications). That
   queue is the entire difference between 15% and 25%.

## What actually drives the earnings

The code is the easy part and it is done. The rest:

- **The README is the product page.** People deploy what they understand in
  thirty seconds. A one-paragraph "what this is", the four boxes, and one
  screenshot beats any amount of architecture prose.
- **Name it for what it is**, not for this project — exact copy to paste is
  in step 5 above. "FastAPI + Celery + Postgres + Redis" is searched for;
  "Viral Trending API" is not.
- **Answer the queue.** It is a 67% raise on every dollar the template earns
  (15% → 25%), and it is the only lever here that is fully in your control.
- **Cheap to deploy wins.** Every GB of RAM you shave is a GB the deployer
  does not pay for — but it is also a GB you do not earn 25% of. The reason
  to keep it lean anyway is that a template nobody keeps running earns 25% of
  nothing.

You already have an unpublished template called `blue-wild`. Either point it
at this repo and publish, or start fresh from the composer — but publish
something, because an unpublished template is explicitly ineligible.
