# Full run & debug pass

> Everything below "ViralEngine (current app)" predates the pivot from
> ViralSync (paid-ad amplification) to ViralEngine (viral-gap analysis +
> content generation) — see README.md. Several files it references
> (`app/api/campaigns`, `lib/oauth/`, `lib/distribution.ts`,
> `supabase/migrations/0001_init.sql`) no longer exist. Kept as a historical
> record of that era's debug work; the FastAPI/Docker/k8s findings below
> still apply since `services/api` wasn't touched by the pivot.

## ViralEngine (current app)

Findings from actually building and running the ViralEngine rebuild
(Viral Gap Analyzer, Creator Account Deep-Dive, Multimodal Video Upload
Diagnostic, Algorithmic Script & Storyboard Generator, Creator Tool Suite
Hub): real `npm run typecheck`, `npm run build`, `npm run lint`, and
repeated live `next dev` smoke tests against every route added, plus real
infrastructure checks via the Supabase and Stripe MCP connectors
(`get_advisors`, `information_schema` queries against the live
`unseen-reels` project).

| Finding | Evidence | Fix |
|---|---|---|
| Next.js 16 removed the `middleware.ts` convention in favor of `proxy.ts` (one exported proxy function per project). This repo already had a `proxy.ts` (ViralVision's disabled-by-default tenant routing); adding Clerk's `middleware.ts` alongside it hard-fails the build. | `next build`: `Error: Both middleware file "./middleware.ts" and proxy file "./proxy.ts" are detected.` | Merged Clerk's `clerkMiddleware` auth gating and the existing tenant-routing logic into a single exported `proxy` in `proxy.ts`. |
| `next lint` no longer exists as a command in Next.js 16 — the `lint` script was silently broken (parsed "lint" as a directory argument). | `npm run lint` -> `Invalid project directory provided, no such directory: .../lint`. | Installed `eslint` + `eslint-config-next`, added `eslint.config.mjs` (flat config), changed the script to `eslint .`. Now finds 2 real, pre-existing issues in the untouched ViralVision scaffold (`app/dashboard/settings/domain/page.tsx`, `postcss.config.mjs`) — left alone, out of scope for this pass. |
| `ClerkProvider` needs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` at `next build` time, not just at runtime (it's read during static prerendering of `/_not-found`). | `next build` failed prerendering `/_not-found`: `@clerk/clerk-react: Missing publishableKey`. | Not a bug — documented in `.env.example`. Verified the rest of the build (all 14 routes) is otherwise sound by building once with a syntactically-valid placeholder key. |
| Clerk's `redirectToSignIn()` inside `clerkMiddleware` returns an HTML redirect (307) for *every* unauthenticated protected route, including `/api/*`. A JSON API consumer (fetch, curl, Postman) would receive a redirect instead of a 401 body. | `curl -X POST /api/analyze/url` (no session) -> `307`, confirmed live against `next dev`. | `proxy.ts` now branches: `/api/*` gets `NextResponse.json({error}, {status:401})`, page routes still redirect. Re-verified: same request now returns `401 {"error":"Not authenticated."}`. |
| Stripe SDK v17.7.0's shipped TypeScript types put `current_period_end` on `Subscription`, not per-item — using `subscription.items.data[0].current_period_end` (a plausible guess from newer Stripe API changelogs) doesn't compile. | `tsc --noEmit`: `Property 'current_period_end' does not exist on type 'SubscriptionItem'`. | Confirmed the real field location by grepping the installed package's `.d.ts` files rather than guessing twice; fixed to `subscription.current_period_end`. |
| `consume_analysis_quota()`/`refund_analysis_quota()` (`SECURITY DEFINER`, take an arbitrary `p_user_id`) were executable by the `anon` and `authenticated` Postgres roles by default — Postgres grants `EXECUTE` to `PUBLIC` on function creation, and revoking from `anon`/`authenticated` alone doesn't override a standing `PUBLIC` grant. Any signed-in user could have called the RPC directly with someone else's Clerk id and drained their quota. | Supabase `get_advisors(type: security)` flagged both `anon_security_definer_function_executable` and `authenticated_security_definer_function_executable`; confirmed via `select grantee from information_schema.role_routine_grants where routine_name = 'consume_analysis_quota'` still showing `PUBLIC` after the first fix attempt. | `revoke execute ... from public; grant execute ... to service_role;` — re-checked `role_routine_grants` afterward: only `service_role`/`postgres` remain, and `get_advisors` came back clean. |
| A scrape or LLM failure after the quota RPC succeeded would permanently cost the user an analysis for nothing (mirrors the exact bug already fixed once in this repo for ViralSync's credits — see `fail_campaign_and_refund()` below). | Code-review of the failure path before shipping, not a live incident. | Added `refund_analysis_quota()` (same `SECURITY DEFINER`/service-role-only pattern) and call it from every catch branch in `app/api/analyze/url/route.ts`, including the Tavily-rate-limit branch. |
| Tavily's `/extract` can rate-limit (429) or hang. | Verified the success response shape live via the Tavily MCP connector against a real YouTube Shorts URL; the 429/timeout paths are handled defensively rather than reproduced live (no way to force Tavily to rate-limit on demand). | `lib/tavily.ts`: typed `TavilyRateLimitError` carrying `Retry-After`, propagated as a `429` with that header; a 15s `AbortController` timeout so a hung request can't pin a serverless invocation open indefinitely. |
| `auth.jwt()->>'sub'` RLS policies only resolve once Clerk is configured as a Supabase "Third Party Auth" provider in the dashboard — a manual step no API/CLI tool here can perform. | N/A — a configuration gap, not a code bug. | Documented prominently in `.env.example`. The shipped Viral Gap Analyzer route avoids depending on it entirely: it reads/writes via the service-role client with an explicit `user_id` filter sourced from Clerk's server-verified session, not the RLS-scoped client. |
| Multimodal video upload size/format constraints: a multi-hundred-MB video proxied through our own serverless function would exceed Vercel's ~4.5MB request body ceiling. | N/A — no way to reproduce a real oversized-payload rejection without a deployed Vercel instance and a large test file in this session. | `app/api/uploads/sign` mints Cloudinary-signed upload credentials; the browser (`components/UploadDiagnosticForm.tsx`, via `XMLHttpRequest` for real progress events) POSTs the video bytes straight to Cloudinary. Our server never sees the file. |
| `@anthropic-ai/sdk` was pinned to `^0.32.1` from training-data memory rather than checked against the registry — nearly 100 minor versions stale. Its old types don't export `ContentBlockParam`, the exact vision-input type the Upload Diagnostic needed. | `tsc --noEmit`: `'Anthropic' has no exported member named 'ContentBlockParam'`. `npm view @anthropic-ai/sdk version` -> real latest is `0.126.0`. | Bumped to `^0.126.0`, reinstalled, re-typechecked/built/linted clean against the new types (which do export `ContentBlockParam`, and whose `Model` union includes `'claude-sonnet-5'` as a named literal — confirms that model id was correct all along). `@clerk/nextjs`, `stripe`, and `svix` are each a major version behind too (checked via the same `npm view` sweep) but not currently broken by it — deliberately not bumped in this pass; see `docs/VIRALENGINE_ROADMAP.md`. |
| One user could pass another user's (or any public) Cloudinary `publicId` to the diagnostic route and get it analyzed on their own quota. | Code-review of the route before shipping, not a live incident. | `app/api/analyze/upload/route.ts` refuses any `publicId` outside the caller's own `viralengine/uploads/<clerk id>/` prefix (403) before spending a Claude call on it, and re-fetches the asset's real duration from Cloudinary's Admin API rather than trusting the client's claim. |
| `mem0ai`'s `SearchMemoryOptions` type doesn't have a `userId` field the way `AddMemoryOptions` does (`add()` and `search()` scope users differently) — a plausible guess that matched `add()`'s shape didn't compile for `search()`. | `tsc --noEmit`: `Object literal may only specify known properties, and 'userId' does not exist in type 'SearchMemoryOptions'`. | Read the shipped `node_modules/mem0ai/dist/index.d.ts` directly instead of guessing twice: `search()` scopes by `filters: {AND: [{user_id: ...}]}`, matching the pattern already documented in the Mem0 MCP connector's own tool descriptions. Fixed `lib/mem0.ts` accordingly. |
| Mem0 install initially failed outright: `mem0ai@3.1.8` declares an optional peer dependency on `@anthropic-ai/sdk@^0.40.1`, which our already-bumped `^0.126.0` doesn't satisfy (0.x caret ranges are patch-only). | `npm install mem0ai`: `ERESOLVE ... peerOptional @anthropic-ai/sdk@"^0.40.1"`. | Installed with `--legacy-peer-deps` — safe here since the conflicting peer is optional and unused (we only call `mem0ai`'s plain `MemoryClient.add`/`search`, none of its Anthropic-specific helpers). |
| A creator's very first script (or any request during a real Mem0 outage) has no prior-voice memory to retrieve — without an explicit signal, the LLM could plausibly claim to be "staying consistent with your established style" when nothing was actually retrieved. | Read through `generateScript()`'s prompt construction before shipping, not a live incident. | `lib/anthropic.ts`'s system prompt branches on `hasMemory` and explicitly forbids claiming consistency with a style that wasn't actually provided when no memories were found. `Storyboard.memory_context_used` carries the same signal into the UI. |
| A tool-recommendation LLM response could plausibly emit or invent a URL for one of the four linked tools — rendered directly as a clickable link, that's both a hallucination risk (a dead/wrong URL) and an injection risk (a crafted response steering a user elsewhere). | Design review before writing `app/api/tools/recommendations/route.ts`, not a live incident. | The tool-use schema constrains `tool` to a 4-value enum; `lib/tool-suite.ts`'s fixed `TOOL_INFO` map resolves the real URL server-side, never trusting anything URL-shaped from the model's own output. |
| `components/ToolSuiteHub.tsx`'s fetch-on-mount `useEffect` hit the same `react-hooks/set-state-in-effect` lint rule already flagging the pre-existing, untouched `app/dashboard/settings/domain/page.tsx` — restructuring to defer all `setState` calls until after the first `await` (the textbook fix) didn't satisfy it either; the rule flags any effect that transitively reaches a `setState` call at all, sync or not. | `npm run lint`: same rule, same message, new file. | Deliberate, commented `eslint-disable-next-line react-hooks/set-state-in-effect` on the one line that calls the fetch function — migrating to a Suspense/loader-based data-fetching setup to satisfy the rule "properly" is a real architectural change out of scope for one component, and would leave this repo with two different data-fetching patterns for no functional gain. |

Confirmed working end-to-end after fixes: `npm run typecheck` (clean),
`npm run build` (all 23 routes compile), `npm run lint` (clean except the
2 pre-existing ViralVision findings — plus two real findings in this
session's own new code, an unescaped apostrophe and the `useEffect` lint
rule above, both caught and resolved the same run each was introduced),
and live `next dev` passes — `GET /` -> 200,
`GET /dashboard/{analyze,deep-dive,upload,script,tools}` unauthenticated
-> 307 to `/sign-in`, `POST/GET /api/{analyze/url,creators/deep-dive,
uploads/sign,analyze/upload,generate/script,tools/recommendations}`
unauthenticated -> 401 JSON, `GET /sign-in` -> 200. One test run without
`.env.local` present caught a real gap in test discipline, not the app:
`/dashboard/tools` returned 200 instead of 307 because Clerk had no
configured key in that run, not because auth was actually broken —
re-verified with the env file in place before trusting the result.

---

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
