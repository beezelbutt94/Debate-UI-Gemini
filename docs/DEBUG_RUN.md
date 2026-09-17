# Full run & debug pass

> Everything below "ViralEngine (current app)" predates the pivot from
> ViralSync (paid-ad amplification) to ViralEngine (viral-gap analysis +
> content generation) — see README.md. Several files it references
> (`app/api/campaigns`, `lib/oauth/`, `lib/distribution.ts`,
> `supabase/migrations/0001_init.sql`) no longer exist. Kept as a historical
> record of that era's debug work; the FastAPI/Docker/k8s findings below
> still apply since `services/api` wasn't touched by the pivot.

## ViralEngine (current app)

Findings from actually building and running the ViralEngine rebuild — all
7 features of the original spec (Viral Gap Analyzer, Creator Account
Deep-Dive, Multimodal Video Upload Diagnostic, Algorithmic Script &
Storyboard Generator, Creator Tool Suite Hub, Competitor Espionage & Gap
Engine, Algorithmic Scheduling & Publishing Planner): real
`npm run typecheck`, `npm run build`, `npm run lint`, and repeated live
`next dev` smoke tests against every route added, plus real
infrastructure checks via the Supabase and Stripe MCP connectors
(`get_advisors`, `information_schema`, `pg_constraint` queries against
the live `unseen-reels` project).

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
| Semrush/Ahrefs's real, verified self-serve APIs are domain/website-centric, not handle-based — they don't actually solve "track 3-5 competitor handles" the way the original roadmap entry for this feature assumed before it was built. | Re-checked both vendors' actual tool surfaces against the feature's real input (a TikTok/Instagram handle, not a domain) before writing any integration code. | Reused Deep-Dive's already-real data sources (YouTube Data API v3, Tavily extraction) instead of committing to a fetch() call against an endpoint that doesn't take the input this feature actually has. `docs/VIRALENGINE_ROADMAP.md` corrected in place rather than left describing a plan that was never actually followed. |
| The Tool Suite Hub's inline `digestReport()` had no branch for `source_type: 'competitors'` — harmless while that value didn't exist yet, but would have mis-cast a `CompetitorGapAnalysis` payload as `UploadDiagnosis` (its `if`/`if`/fallback-`else` structure) the moment this feature started writing rows with the new source_type. | Caught while extracting the function into shared `lib/digest.ts` for reuse, not a live incident -- the new source_type didn't exist until this same feature's migration. | Added the fourth branch as part of the extraction, so both callers (Tool Suite Hub, Competitor Espionage) get the fix from the same shared function rather than needing it fixed twice. |
| Metricool's `getBestTimeToPostByNetwork` (this feature's original planned data source) answers "audience timezone activity" directly in *this session*, but that's the same account-linked-not-self-serve access pattern already ruled out for vidIQ/Metricool in feature 2 -- confirmed rather than assumed before committing to it a second time. | Re-checked the same constraint against this feature's actual real-time-research need before writing `app/api/schedule/generate/route.ts`. | Reused `lib/tavily.ts`'s `searchTopics()` (already real, already verified) instead of a second unverified direct-integration attempt. |
| `app/api/schedule/[id]/route.ts`'s `PATCH`/`DELETE` needed the same ownership check every other per-resource mutation in this app has needed (Cloudinary `publicId`, Mem0 scope key, Tool Suite Hub URLs) -- one user must not be able to touch another's calendar row by guessing/enumerating an id. | Design review before writing the route, not a live incident. | Every query is scoped by `.eq('id', id).eq('user_id', userId)` together, so a mismatched id/owner pair returns 404, not another user's data. |

Confirmed working end-to-end after fixes: `npm run typecheck` (clean),
`npm run build` (all 28 routes compile), `npm run lint` (clean except the
2 pre-existing ViralVision findings -- and, unlike every prior feature,
zero new findings in this one's own code: the `useEffect` fetch-on-mount
pattern got its `eslint-disable` pre-emptively this time, based directly
on the identical case hit while shipping the Tool Suite Hub), and live
`next dev` passes covering every route across all 7 features -- unauthenticated
page routes redirect (307) to `/sign-in`, unauthenticated API routes
return 401 JSON. One test run without `.env.local` present, several
features back, produced `/dashboard/tools` -> 200 instead of 307 and was
written off here as a gap in test discipline. That was only half right.
It was re-root-caused later (see "Clerk keyless mode silently skips the
proxy handler" below): the 200 is real behaviour, not a bad test, and it
is worth understanding rather than working around with a checklist.

All 7 features of the original spec are now shipped. The throughline
worth remembering across all of them: every "real API" claim in this
document was checked against either a live MCP connector call or an
installed package's actual shipped types before code was written against
it, not assumed from training data -- and the cases where that check
changed the plan (vidIQ/Metricool in feature 2, Semrush/Ahrefs in feature
6, Metricool again in feature 7) were exactly the cases worth checking.

## OAuth connections + publish trigger, then a full beta test pass

Same build discipline as the 7 features, plus one thing done differently
this time: after `typecheck`/`build`/`lint` came back clean, a systematic
beta test was run against every route in the app (not just the new ones)
with the dev server pointed at the real `unseen-reels` Supabase project,
specifically *because* "clean lint" had never actually caught a wiring
bug between two features built in different sessions -- and it hadn't
been checked. It found two, both real, both now fixed.

| Finding | Evidence | Fix |
|---|---|---|
| **`store_platform_connection()`'s Vault secret naming crashed on the very first reconnect/refresh.** The function derives a deterministic `vault.secrets.name` from `platform:kind:user_id` and created the *new* secret before deleting the *old* one -- `vault.secrets.name` has a unique constraint, so any second call for the same user+platform (exactly what `lib/publish/tokens.ts`'s token-refresh path does on every expiring access token) would throw. This would have broken every connected account within one access-token lifetime (as short as ~55 minutes for TikTok/Canva) after the first successful connect. | Reproduced live: a `do $$ ... $$` block against the real database calling `store_platform_connection()` twice for the same user+platform (simulating connect, then a token refresh) failed with `23505: duplicate key value violates unique constraint "secrets_name_idx"` on the second call, via the Supabase MCP connector's `execute_sql`. | Reordered the function to delete the old Vault secret(s) *before* creating the new one, not after (`0002_platform_connections.sql`, reapplied live). Re-ran the same test plus five more scenarios (round-trip decrypt correctness, refresh preserving label/scope via `coalesce`, no orphaned Vault rows after a refresh, two different platforms for one user coexisting, and disconnecting one platform not touching another's secrets) -- all 6 passed against the live database, then the test rows were deleted and verified gone. |
| **The real Stripe webhook route was unreachable -- Clerk auth blocked it before Stripe's own signature check ever ran.** `proxy.ts`'s public-route allowlist listed `/api/webhooks/stripe`, but the actual route (built in an earlier feature) lives at `app/api/stripe/webhook/route.ts` -> `/api/stripe/webhook`. Every real Stripe webhook delivery would have hit Clerk's blanket `/api/*` auth gate first and gotten a 401 with no session, meaning `checkout.session.completed`/`customer.subscription.updated`/`.deleted` would never reach the signature-verification code that actually syncs `subscriptions` -- billing would silently never update after the first checkout. Pre-existing since the Stripe feature shipped, not introduced this session; caught only because this pass tested every route systematically instead of just the new ones. | `curl -X POST /api/stripe/webhook` (no signature, no session) returned `401 {"error":"Not authenticated."}` -- the wrong failure. It should reach Stripe's own signature check and fail *there* instead. | Fixed the path in `proxy.ts`'s `isPublicRoute` matcher to the real route, `/api/stripe/webhook`. Re-verified live: same request now returns `400 {"error":"Missing stripe-signature header."}` -- Clerk correctly steps aside, Stripe's own verification correctly rejects an unsigned request. |

Full beta test scope and results:

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run build` | clean, 34 routes (up from 28) |
| `npm run lint` | clean except the 2 pre-existing ViralVision findings |
| Supabase security advisor, before and after both fixes | 1 finding both times (`stripe_webhook_events` RLS-enabled-no-policy, intentional -- service-role-only table) |
| Live DB test: `platform_connections` Vault round-trip (6 scenarios) | 6/6, after the fix above |
| Live `next dev`, all 18 API routes, unauthenticated | 401 JSON, none crashed |
| Live `next dev`, all 14 page routes, unauthenticated | 307 to `/sign-in` for every `/dashboard/*` route, 200 for `/`, `/sign-in`, `/sign-up` |
| Live `next dev`, both webhook routes, unauthenticated + unsigned | Both correctly bypass Clerk and fail on their own signature check instead (Clerk: `400 Invalid signature`; Stripe: `400 Missing stripe-signature header`, after the fix above) |
| Live `next dev`, cron trigger, no/wrong/right `CRON_SECRET` | 401, 401, then reaches the real DB query (failed only because this run's `SUPABASE_SERVICE_ROLE_KEY` was a placeholder, not a real one -- expected, see below) |

What this pass could **not** verify, honestly: there is no real Clerk
session available in this sandbox (no way to mint one without a real
`CLERK_SECRET_KEY` and a test user), so no route's actual business logic
past the auth gate was exercised end-to-end over HTTP -- every 401/307
above confirms the gate itself, not what's behind it. Real third-party
credentials (Anthropic, Tavily, Cloudinary, Mem0, YouTube Data API v3,
and the four new OAuth apps' client secrets) are likewise unavailable
here, so live calls to those providers are unverified beyond their
documented contracts (checked against live docs/MCP connectors while
building, per the discipline note above) and, for the new
`platform_connections` schema specifically, the direct SQL test above --
which is the strongest test actually available without those keys, since
it exercises the real database rather than a mock. Getting past this
ceiling needs the user to supply real keys; see `.env.example` and
`README.md`'s "Local setup" for exactly which ones.

## GitHub Actions CI had never actually passed

Opening the PR for the above and looking at its real GitHub Actions
checks (not just the local sandbox verification every feature's commit
message has been citing) surfaced that `.github/workflows/ci.yml` has
failed on **every run since the Mem0 feature landed** — every PR in this
repo's history, all the way back, confirmed via `list_workflow_runs`.
"Local `npm run build` passes" was never the same claim as "CI passes,"
and nothing had checked the second one until now.

| Finding | Evidence | Fix |
|---|---|---|
| `npm ci` (what CI runs, unlike an interactive `npm install`) fails outright with `ERESOLVE`: `mem0ai@3.1.8`'s optional peer `@anthropic-ai/sdk@^0.40.1` conflicts with the root's real `^0.126.0`. `--legacy-peer-deps` was used locally when `mem0ai` was first installed (documented above), but that flag was never persisted anywhere -- a fresh `npm ci` in CI has no way to know to use it. | `npm ci` in the `build (22.x)`/`build (24.x)` jobs: `npm error ERESOLVE could not resolve ... peerOptional @anthropic-ai/sdk@"^0.40.1" from mem0ai@3.1.8`. Reproduced locally with `rm -rf node_modules && npm ci` (no flags). | Added `.npmrc` with `legacy-peer-deps=true` at the repo root, so both local installs and CI resolve the same way without a manual flag. Re-verified: `rm -rf node_modules && npm ci` succeeds with 0 vulnerabilities, no `.npmrc` present before this fix. |
| Even past that, `npm run build` in CI would still fail: the workflow sets no env vars, and `ClerkProvider` needs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` at build time (documented above for the local case) -- the workflow predates Clerk being added to this app and was never updated. | Reproduced locally: `npm run build` with no env vars set fails prerendering `/_not-found` the same way it did the first time this was hit, several features ago. | Added a syntactically-valid placeholder `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to the `Build` step's `env:` in `ci.yml` -- safe to check in since publishable keys are meant to be public (embedded in the client bundle), it only needs to satisfy Clerk's key-format validation, not authenticate anything. Re-verified: `npm run build` with only that one env var set completes and emits all 34 routes. |

Not fixed, and correctly so -- pre-existing on `main`, not this PR's:
**`Workers Builds: debate-ui-gemini`** (a Cloudflare Pages/Workers Git
integration check) fails on every commit in this repo's history,
confirmed by checking PR #7's checks before any of this session's changes
existed. There is no `wrangler.toml` or Cloudflare Pages config anywhere
in this repo for a code change to fix -- it's an external Cloudflare
project pointed at this repo, configured outside it. `Supabase Preview`
is `skipped`, not failing, and points at a different Supabase project ref
than the one this app actually uses -- also external configuration, not
a red check this PR owns.

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

---

## Clerk keyless mode silently skips the proxy handler

Found while doing a full `clerk init` pass against app
`app_3JRibQ43qQifgDfLS7n8X16Gxzh`. It explains the `/dashboard/*` -> 200
result noted near the top of this document, which had been written off as
a testing artifact.

**Symptom.** With no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in the
environment, every `/dashboard/*` route answers **200** to an
unauthenticated request instead of redirecting. The dev server still
reports a `proxy.ts: 7ms` timing for those requests, which makes it look
like the gate ran and allowed them.

**How it was pinned down.** Instrumenting the handler proved it never
runs: a `console.log` printed nothing, `x-dbg-*` response headers never
appeared, and an unconditional `return new NextResponse('PROXY-RAN', {
status: 418 })` at the top of the handler still produced `200` HTML. The
reported `proxy.ts` timing is `clerkMiddleware` itself, not our callback.

**Root cause.** `node_modules/@clerk/nextjs/dist/esm/server/clerkMiddleware.js`,
the `keylessMiddleware` branch:

```js
const isMissingPublishableKey = !(resolvedParams.publishableKey || PUBLISHABLE_KEY || keyless?.publishableKey);
if (isMissingPublishableKey && !isMachineTokenByPrefix(authHeader)) {
  const res = NextResponse.next();
  setRequestHeadersOnNextResponse(res, request2, { [constants.Headers.AuthStatus]: "signed-out" });
  return res;   // <- the user handler is never called
}
```

`keyless?.publishableKey` comes from a **cookie**, not from
`.clerk/.tmp/keyless.json` directly. A browser picks that cookie up on
its first visit, so the gate works there — which is exactly why this is
easy to miss. `curl`, server-to-server `fetch`, and any first request
without the cookie are ungated.

**Scope.** Development only: `canUseKeyless` is
`isDevelopmentEnvironment()`-gated (`dist/esm/utils/feature-flags.js`), so
a production build always reaches the handler. The `/api/*` routes were
never exposed by this — each one re-checks `auth()` itself and returns its
own 401, which is why `/api/schedule` answered 401 throughout. It was the
page routes, and only the page routes, that were open.

**Proven fix.** Running the same server with the keys set:

| Run | `/dashboard/upload` | `location` |
|---|---|---|
| keyless, no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `200` | — |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` set | `307` | `https://viable-ocelot-5012.accounts.dev/sign-in?...` |
| ...plus `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` | `307` | `/sign-in?redirect_url=...` |

Two things came out of that third row. The app ships its own
`app/sign-in/[[...sign-in]]` and `app/sign-up/[[...sign-up]]` pages, but
without `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `..._SIGN_UP_URL` set,
`redirectToSignIn()` sends users to Clerk's hosted portal and those two
routes are never reached. Both are now documented in `.env.example`.

`proxy.ts` now logs a loud warning at module scope whenever it loads in a
non-production environment without a publishable key, so this state
announces itself instead of looking like working auth.

## `/__clerk/(.*)` was missing from the matcher

Clerk's current recommended matcher has a third entry this repo did not
have. It is not redundant with the first: the first pattern deliberately
excludes anything ending in a static-asset extension, and Clerk's Frontend
API proxy endpoints under `/__clerk` carry real `.js` extensions.

Verified against the running server, using the dev log's per-request
`proxy.ts` timing as the signal for "did the proxy run":

| Path | Before | After |
|---|---|---|
| `/__clerk/foo.js` | no `proxy.ts` timing — proxy skipped | `proxy.ts: 10ms` — proxy ran |
| `/nonexistent-page.js` (control) | no `proxy.ts` timing | no `proxy.ts` timing |

## `clerk init` could not be completed from this container

`clerk` CLI 3.3.0 (npm `clerk`, repo `github.com/clerk/cli`) installed and
working. `clerk init --app app_3JRibQ43qQifgDfLS7n8X16Gxzh` blocks on
`clerk auth login`, which is browser-OAuth only with a **loopback**
redirect (`http://127.0.0.1:<port>/callback`) that only resolves on the
machine running the CLI. `clerk api` states the same requirement
outright: `Not authenticated. Run 'clerk auth login' or set
CLERK_PLATFORM_API_KEY`. No file in the repo was modified by the attempt.

`clerk doctor` additionally reports the project is running on an
**unclaimed accountless application**, instance
`ins_3JRhrbHgUdtLXznzxzn1OETm9W8`, publishable key
`pk_test_dmlhYmxlLW9jZWxvdC01MDEyLmNsZXJrLmFjY291bnRzLmRldiQ`
(`viable-ocelot-5012.clerk.accounts.dev`), with the secret key coming from
`.clerk/.tmp/keyless.json` — and that it must be claimed from the Clerk
Dashboard, because `clerk auth login` only claims applications that
`clerk init` itself created.

To finish, on a machine with a browser:

```
npm i -g clerk
clerk auth login
clerk init --app app_3JRibQ43qQifgDfLS7n8X16Gxzh
clerk env pull            # writes the real keys into .env.local
clerk doctor
```
