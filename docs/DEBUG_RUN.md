# Full run & debug pass

A record of actually running everything in this repo — the Next.js app in a
real browser, the FastAPI service under uvicorn, the Docker images, and the
database schema against the live Supabase project — and what that surfaced.
Each item below was reproduced before it was fixed and re-checked after.

## Next.js app

| Bug | Evidence | Fix |
|---|---|---|
| OAuth was broken in local dev: the CSRF `state` cookie was set with `secure: true` unconditionally, so browsers dropped it over `http://localhost` and the callback always failed its state check. | Cookie never present on the callback request. | `app/api/oauth/[platform]/start/route.ts` — `secure: req.nextUrl.protocol === 'https:'`. |
| Campaign status writes silently no-opped. `campaign_logs` has only a `SELECT` RLS policy, so the RLS-scoped update matched zero rows and returned no error. | Update returned `{ error: null }` with nothing changed. | `app/api/campaigns/route.ts` — status write goes through `createSupabaseAdminClient()`. |
| Three dashboard pages rendered a fabricated "Pipeline Execution Error" when the Python backend simply isn't wired up (the Next app has no `/api/v1/*` routes at all, so every call 404s). | Browser console + rendered DOM on `/dashboard/trends`, `/dashboard/settings/domain`, `/dashboard/renders/[id]`. | New `lib/platform-api.ts` returns `{state: 'ok' \| 'unavailable' \| 'error'}` and treats a 404 on `/api/v1/*` as "backend not connected"; new `components/PlatformServiceNotice.tsx` says so honestly. All three pages now render that instead. |
| Dead link to `/dashboard/generate`, a route that does not exist. | 404 on click. | Link removed; the post-action redirect goes to `/` instead of the nonexistent `/dashboard` index. |
| Favicon 404 on every page load. | Browser console. | Added `app/icon.svg`. |
| `@supabase/supabase-js` declares `engines.node >= 22`, but the Docker image and CI matrix used Node 20. | `npm warn EBADENGINE ... required: { node: '>=22.0.0' }, current: { node: 'v20.20.2' }` during `docker build`. | `package.json` `engines.node >= 22`; `Dockerfile.web` on `node:22-slim`; CI matrix is `[22.x, 24.x]`. |

## Docker

- `Dockerfile.web` failed at `COPY /app/public` — the directory doesn't exist
  in the repo. Reproduced with a real `docker build`; fixed by adding
  `public/.gitkeep`.
- Added `.dockerignore` (excludes `.env.local`, `node_modules`, `.next`,
  `docs/`, `k8s/`, `argocd/`) so secrets can't land in an image layer.
- `Dockerfile.web` now drops to `USER node` rather than running as root.

## FastAPI service (`services/api`)

- **Import-time crash.** `anthropic==0.34.2` builds its HTTP client with a
  `proxies` kwarg that modern `httpx` removed, so the whole service raised
  `TypeError` on import. Pinned `anthropic==1.6.0`.
- **Module-level client construction took down the service.** Four pipeline
  modules built an `AsyncAnthropic()` at import, so a missing
  `ANTHROPIC_API_KEY` killed every endpoint, not just the AI ones. Added
  `app/core/anthropic_client.py` with a lazily-cached `get_anthropic_client()`
  (mirroring this repo's existing `getStripe()` convention) and switched all
  four to it.
- **`temperature` removed** from every `messages.create` call — sampling
  parameters are rejected with a 400 on `claude-opus-5` and the rest of the
  current model family.
- **Rate limiter turned Redis blips into 500s.** Two bugs in
  `app/middleware/rate_limit.py`: the Redis pipeline wasn't guarded, and the
  429 was *raised* as an `HTTPException` — which, inside a
  `BaseHTTPMiddleware`, escapes the exception handlers and surfaces as a 500.
  Now it fails open with a logged warning, and returns a `JSONResponse`.

After these, `uvicorn app.main:app` boots and serves 43 OpenAPI paths;
`/healthz` returns OK; with Redis down the rate-limited endpoints return
401 (auth) rather than 500.

## Database

Ran a 10-assertion SQL integration test against the live Supabase project
covering the signup trigger, credit decrement, the credit ledger, the
overspend guard, `CHECK` constraints, and cascade cleanup. **10/10 passed.**
All test rows were removed afterwards; existing data was untouched.

## Still not verified

- No endpoint that talks to Postgres, Redis, S3, a GPU, or a social/ad API
  has been run end-to-end — those dependencies don't exist here.
- `npm ci` inside `node:22-slim` fails in this sandbox with
  "Exit handler never called!". Reproduced with a trivial one-dependency
  project in the same image, so it's a sandbox Docker-runtime limitation,
  not a Dockerfile bug.
- Everything under `k8s/` and `argocd/` is YAML-valid but has never been
  applied to a cluster.
