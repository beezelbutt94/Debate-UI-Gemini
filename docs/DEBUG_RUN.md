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
| Three dashboard pages rendered a fabricated "Pipeline Execution Error" when the Python backend simply isn't wired up (the Next app has no `/api/v1/*` routes at all, so every call 404s). | Browser console + rendered DOM on `/dashboard/trends`, `/dashboard/settings/domain`, `/dashboard/renders/[id]`. | New `lib/platform-api.ts` + `components/PlatformServiceNotice.tsx`. (The first cut inferred "not connected" from a 404, which the second pass below replaces with an authoritative server-side check.) |
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
  Now it returns a `JSONResponse`. (The first cut then failed open, which
  the second pass below replaces with an enforcing fallback.)

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

---

# Second pass: failures that were hidden rather than fixed

A follow-up sweep for the opposite problem — code that responded to a
broken dependency by going quiet or dying, instead of reporting what went
wrong. Ordered by what each one cost the user.

## Credits were taken for campaigns that never ran

`POST /api/campaigns` charged credits via `consume_credits()`, called the
distribution gateway, caught the failure, logged it, and returned
**`201 Created`**. The creator paid, nothing was placed, and the API
reported success. Since neither ad platform is implemented yet, this was
the outcome of *every* campaign submission.

Three changes, root cause outward:

1. **`preflight()`** on `DistributionClient`. Missing platform credentials
   and a creator who never connected their ad account are both knowable
   before spending anything, so the route now establishes the campaign
   *can* be placed and returns a specific error **before** charging. No
   charge, no refund needed.
2. **`fail_campaign_and_refund()`** (`supabase/migrations/0003_campaign_refund.sql`)
   for failures that only appear at spend time. One `SECURITY DEFINER`
   function marks the campaign failed, restores the balance and writes the
   offsetting ledger row; it locks the campaign row and no-ops unless the
   status is still `pending`, so retries can't double-credit.
3. **Typed `DistributionError`** with a `code` and a `remedy`, replacing
   string-matched messages. The route maps codes to real statuses —
   `not_connected` → 409 (the creator can fix it), `not_configured` → 503
   and `not_implemented` → 501 (an operator must).

If the refund itself fails, that is the one unrecoverable state, and it now
logs `CREDIT LEAK` with the campaign id and returns 500 saying so. If
`amplify()` *succeeds* but the status write fails, it returns 201 with an
explicit `status_write_failed` warning — refunding would be wrong and a
retry would double-spend the creator's real ad budget.

Verified against the live database, 8/8: refund restores the balance, marks
the campaign failed, writes exactly one compensating ledger row, is
idempotent under retry, refuses to refund a campaign that went live, and
raises on an unknown campaign or a blank reason. Test rows removed.

## The rate limiter stopped limiting

On any `redis.RedisError` the middleware logged a warning and allowed the
request — so a Redis blip silently removed the protection from the
expensive generation endpoints, during exactly the kind of incident that
takes Redis down.

It now falls back to a per-process sliding window. Weaker than the Redis
limiter (the effective limit becomes N times the configured one across N
replicas) but a bound rather than none, with the key map capped at 10k
entries because the limit key is partly caller-controlled. The outage logs
once per 30s instead of once per request, and both the 429 and the passing
response carry `X-RateLimit-Mode: local-fallback`.

Verified 8/8 by driving the real middleware through a real ASGI app with
Redis forced to fail: still serves traffic, still enforces the limit,
allows exactly the configured budget, per-caller not global, `Retry-After`
present, unrelated routes untouched, key map bounded.

## "Backend is down" was inferred from a 404

`platformApiFetch` treated any 404 as "the platform service isn't
deployed". A genuine *no such render* from a perfectly healthy backend
therefore rendered as an outage notice.

The question is now answered authoritatively by `/api/platform-status`
(server-side, reads `INTERNAL_API_URL`), memoized per page load. The result
type gained `not_found` and `unreachable`, so all four situations read
differently: not deployed, deployed-but-unreachable, deployed-and-no-such-record,
deployed-and-errored.

Verified in a real browser across three backend conditions — absent (15/15),
connected and answering (11/11), and configured but down (8/8).

## Other silent failures

| Where | Was | Now |
|---|---|---|
| `Dashboard.handleUpgrade` | A failed checkout did nothing at all — the button looked inert forever. | Reports the failure; network errors caught. |
| `Dashboard.handleSubmit` | Showed raw codes (`not_implemented`), and a network error left the form looking idle. | Shows `detail` + `remedy`, says when credits were refunded, catches network errors. |
| Both handlers | `res.json()` threw on an HTML error page, turning a reportable error into an unhandled rejection. | `readJson()` degrades to a status-code message. |
| Trends page | Any error fell through to "No trend data yet" — claiming the data was empty when no answer ever arrived. | Distinguishes empty from failed. |
| Renders page | Every failure was headed "Pipeline Execution Error", implying the render blew up. | Heading matches the cause. |
| `handleDirectPublish` | Discarded the server's reason ("TikTok account not connected") for a generic line, and its failure blanked the whole page. | Shows the server's reason inline, keeping the render visible. |
| `handleDisconnect` (domain) | A failed unbind did nothing — domain stayed connected, nothing on screen changed. | Reports it, including the backend's new `partial` status. |
| `system_init.py` | Logged "Schema sync encountered a warning" and started anyway, so every query against a missing table 500'd at request time. | Exits 1. Stopping the rollout is the job. |
| `domains.py` status | A failed cluster call returned `ssl_ready: false`, indistinguishable from "still issuing" — customers waited on a certificate nobody was issuing. | `ssl_state` of ready / provisioning / not_provisioned / unknown, plus `ssl_error`. The page stops polling and drops the spinner for the terminal states. |
| `domains.py` unbind | Returned `"success"` even when cluster teardown failed, leaving an Ingress and Certificate still serving the old domain. | Returns `"partial"` with the error; logs `ORPHANED CLUSTER RESOURCES`. |

---

# Final verification pass

A from-scratch re-verification of everything, which turned up one more
issue — the most serious one found in the whole project.

## Critical: OAuth refresh tokens were readable by anyone

Supabase's own security advisor flagged `get_platform_refresh_token` and
`store_platform_refresh_token` as executable by `anon`, despite the
`REVOKE` statements at the bottom of `0002_platform_connections.sql`.
Checking `pg_proc.proacl` directly confirmed it:

```
get_platform_refresh_token   anon=true   authenticated=true
fail_campaign_and_refund     anon=false  authenticated=false   <- correct shape
```

Confirmed exploitable against the live project by calling the REST RPC
endpoint with the **public anon key** — the one that ships in every
browser bundle:

```
POST /rest/v1/rpc/get_platform_refresh_token   ->  HTTP 200
```

200, not 403. It returned `null` only because that user id had no
connection row; with a real id it returns the **decrypted Vault secret**.
So any visitor could have enumerated user ids and harvested every
creator's TikTok / Google Ads refresh token — full takeover of their ad
accounts. `store_platform_refresh_token` was the write-side equivalent:
repoint any creator's connection at an attacker's account.

The cause is Supabase's default privileges granting `EXECUTE` on public
functions to `anon`/`authenticated`. A bare `REVOKE` in the creating
migration does not survive that, which is why the newer
`fail_campaign_and_refund` (created after, in its own migration) had the
correct ACL while the 0002 pair did not.

`0004_lock_down_definer_functions.sql` fixes the four existing functions
*and* removes the default-privilege grant, so the next migration doesn't
silently reintroduce the hole.

After: the same call returns **HTTP 401**, and the advisor drops from 8
findings to 1 — `consume_credits` callable by `authenticated`, which is
intentional and required (it derives the caller from `auth.uid()`).

Revoking `EXECUTE` on `handle_new_user` risked breaking the signup
trigger, so that was tested rather than assumed: 5/5 — the trigger still
creates the `users` row, refunds still restore the balance, the negative
balance CHECK still fires, and deletes still cascade.

## Everything re-checked, from clean

| Check | Result |
|---|---|
| `rm -rf node_modules && npm ci` | 141 packages, **0 vulnerabilities** |
| `npm run typecheck` | clean |
| `npm run build` | clean, 13 routes |
| `python -m compileall services/api/app` | clean |
| FastAPI boot (no Redis, no `ANTHROPIC_API_KEY`) | 43 OpenAPI paths, `/healthz` ok |
| Rate-limited route with Redis down | **401**, `x-ratelimit-mode: local-fallback` — enforcing, not 500, not open |
| Rate limiter suite | 8/8 |
| Live DB integrity + refund + trigger | 5/5 |
| Supabase security advisor | 8 findings → 1 (intentional) |
| Browser, backend absent | 15/15 |
| Landing page / tenant fallback / 404 | render clean, no console errors |
| Secrets in tracked files | none; every `k8s/`+`argocd/` secret is a `REPLACE_WITH_*` placeholder |
| Pre-existing `leads` table | 3 rows, untouched |

One note on process: a stale `next dev` from an earlier test was still
holding port 3000 with `INTERNAL_API_URL` set, which made the first
browser run look like a regression (8/15). It wasn't — the pages were
correctly reporting "configured but unreachable" against a stub that had
been killed. Re-run on a clean server: 15/15.
