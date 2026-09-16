# ViralEngine

A monetization-enabled SaaS platform for content creators, covering all 7
features of the original spec: analyze a video URL or an uploaded file,
deep-dive an account, generate a script, get contextual tool
recommendations, spy on competitors, and plan a weekly posting calendar —
each one real end to end, none of them stubs.

This repo previously shipped a different product under this name
(ViralSync — paid ad amplification via TikTok Spark Ads/Google Ads). That
product has been retired; see `docs/DEBUG_RUN.md` for its historical debug
record if you're archaeology-minded.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript + React 19 + Tailwind
- Clerk (auth, session, user lifecycle webhook)
- Supabase (Postgres, RLS-enabled, Clerk wired in as a third-party auth
  provider)
- Stripe (Creator/Pro/Studio subscription billing, quota-gated usage)
- Tavily (`/extract` and `/search`) for URL content extraction and
  real-time topic/trend research
- YouTube Data API v3 for real channel/upload stats
- Cloudinary (signed direct-to-cloud video upload, frame + waveform
  extraction via delivery transformations)
- Mem0 (creator-voice memory, via the official `mem0ai` SDK)
- Anthropic Claude (Messages API, tool-use/structured output, and vision
  for the Upload Diagnostic) for the actual audit synthesis

## What's built

All 7 features from the original spec, real end to end, not stubs:

### Viral Gap Analyzer

1. `app/dashboard/analyze/page.tsx` + `components/AnalyzerForm.tsx` — paste
   a URL, see the score, hook evaluation, retention prediction, pacing
   audit, action plan, and timestamped recommendations.
2. `app/api/analyze/url/route.ts` — the orchestrator:
   - Authenticates via Clerk's `auth()`.
   - Detects the platform (`lib/platform.ts`) and rejects anything that
     isn't a TikTok video, YouTube Short, or Facebook Reel URL.
   - Atomically consumes one unit of the user's monthly analysis quota via
     the `consume_analysis_quota()` Postgres function — server-role-only,
     so a client can't call it directly to drain someone else's quota.
   - Extracts real page content via Tavily's `/extract` API
     (`lib/tavily.ts`), with a 15s timeout and typed rate-limit handling.
   - Sends that content to Claude (`lib/anthropic.ts`) with a system
     prompt that pins the real short-form benchmarks (60%+ retention at
     3s, 40%+ at 30s) and forces structured JSON output via tool use.
   - Writes the result to `audit_reports` and returns it.
   - **Refunds** the quota unit via `refund_analysis_quota()` if any step
     after the quota check fails — a scrape or LLM error should never
     permanently cost a user one of their monthly analyses.

### Creator Account Deep-Dive

1. `app/dashboard/deep-dive/page.tsx` + `components/DeepDiveForm.tsx` —
   enter a niche and one or more platform handles (YouTube, TikTok,
   Instagram), see a growth blueprint: thematic consistency, view-to-
   follower ratio, posting cadence, theme correction, view-maximization
   tactics, posting blindspots.
2. `app/api/creators/deep-dive/route.ts` — the orchestrator:
   - Same auth + quota consume/refund pattern as the Analyzer above.
   - **YouTube**: real, official YouTube Data API v3 calls
     (`lib/youtube.ts` — `channels.list`, `playlistItems.list`,
     `videos.list`), computing actual posting cadence and view-to-
     subscriber ratio from the last 15 uploads. No scraping.
   - **TikTok/Instagram**: Tavily extraction of the public profile page
     (same `lib/tavily.ts` as the Analyzer) — best-effort, since neither
     platform has an official, self-serve API a third-party app can call
     with just an API key (the same real constraint ViralSync's own
     TikTok/Google Ads OAuth flow hit, documented honestly there rather
     than faked).
   - One platform failing (bad handle, rate limit) doesn't sink a
     multi-platform request — the failure is recorded as data and the LLM
     is told what's missing and why, rather than the whole call 500ing.
   - Upserts `creators_profiles` (handles, niche, a `connected_metrics`
     cache of everything fetched), then Claude (`lib/anthropic.ts`,
     `generateGrowthBlueprint`) synthesizes the blueprint from the real
     data — grounded explicitly: the system prompt forbids inventing a
     metric that wasn't actually provided.
   - Writes to `audit_reports` (`source_type: 'account'`) and refunds the
     quota unit on any failure, same as the Analyzer.

### Multimodal Video Upload Diagnostic

1. `app/dashboard/upload/page.tsx` + `components/UploadDiagnosticForm.tsx`
   — pick an MP4/MOV, watch it upload with a real progress bar, then see
   visual hook clarity, audio balance, text-overlay pacing, B-roll
   recommendations, retention boosters, and timeline-pinned feedback.
2. **The upload itself never touches our server.** `app/api/uploads/sign`
   mints a Cloudinary-signed upload (`lib/cloudinary.ts`,
   `createSignedVideoUpload`) scoped to a per-user folder
   (`viralengine/uploads/<clerk user id>/`); the browser then POSTs the
   video bytes straight to Cloudinary. This is the real fix for Vercel's
   ~4.5MB serverless request body ceiling — a multi-hundred-MB video
   proxied through our own route would fail immediately.
3. `app/api/analyze/upload/route.ts` — the orchestrator:
   - Same auth + quota consume/refund pattern as the other two features.
   - Refuses any `publicId` outside the caller's own upload folder (403)
     — otherwise one user could hand us someone else's asset to analyze
     for free.
   - Looks up the asset's *authoritative* duration via Cloudinary's Admin
     API rather than trusting whatever the client claims.
   - Picks up to 6 frame timestamps (`pickFrameTimestamps`, always
     including the 0–3s hook window), fetches each as a real JPEG via
     Cloudinary's `so_<seconds>` on-the-fly transformation, and fetches a
     real waveform PNG via `fl_waveform` — no separate rendering pipeline
     of our own, Cloudinary generates and caches these on first request.
   - Sends the actual frame images and waveform image (as base64, not
     descriptions) to Claude's vision input (`lib/anthropic.ts`,
     `generateUploadDiagnosis`) — the model looks at real pixels, and its
     system prompt requires every timeline timestamp to be one it was
     actually shown a frame for.
   - Writes to `audit_reports` (`source_type: 'upload'`) and refunds the
     quota unit on any failure.

### Algorithmic Script & Storyboard Generator

1. `app/dashboard/script/page.tsx` + `components/ScriptGeneratorForm.tsx`
   — enter a prompt, optional target platform and tone, get a spoken hook
   (<3s), 2-6 scenes (visual action, dialogue/VO, audio/SFX cue, why that
   scene retains the viewer), and a closing CTA.
2. `app/api/generate/script/route.ts` — the orchestrator:
   - Same auth + quota consume/refund pattern as the other three features.
   - Ensures a `creators_profiles` row and a stable Mem0 scope key exist
     (creating both on first use if Deep-Dive never ran first).
   - **Retrieves** real prior creator-voice memories via Mem0's semantic
     search (`lib/mem0.ts`, `retrieveCreatorVoice`, using the official
     `mem0ai` SDK) scoped to that key and relevant to the current prompt.
   - Sends the prompt, tone, and retrieved memories to Claude
     (`lib/anthropic.ts`, `generateScript`) — the system prompt explicitly
     tells the model not to claim it's matching an established style when
     no memory was actually found, rather than faking consistency.
   - **Writes back** a summary of the style choices this script actually
     used (`recordScriptStyle`), so the *next* generation has something
     real to retrieve — this is how "historical voice and tone" actually
     accumulates rather than staying permanently empty.
   - Mem0 being unreachable degrades gracefully (the script still
     generates) but is never silently swallowed: the API response and UI
     both surface `memory_context_used` / whether the write-back
     succeeded, following this repo's own established rule about not
     hiding a failure behind an apparently-normal result (see
     `docs/DEBUG_RUN.md`'s "failures that were hidden rather than fixed").
   - Writes to `scripts` and refunds the quota unit on any failure.

### Creator Tool Suite Hub

1. `app/dashboard/tools/page.tsx` + `components/ToolSuiteHub.tsx` — no
   input needed; on load it fetches contextual recommendations for
   Descript, OpusClip, HyperFrames by HeyGen, and Canva, each with a real
   deep link and a reason grounded in one of your own recent reports.
2. `app/api/tools/recommendations/route.ts`:
   - Pulls your 5 most recent `audit_reports` and 3 most recent `scripts`,
     builds a plain-text digest of their actual weak points per report
     type (`digestReport`/`digestScript`), and sends that to Claude
     (`lib/anthropic.ts`, `generateToolRecommendations`) with a system
     prompt that forbids recommending a tool for a problem it doesn't
     solve and forbids citing a finding that wasn't actually in the
     digest.
   - **The LLM never controls the URL.** Its tool-use schema constrains
     `tool` to a 4-value enum; the actual deep link is looked up
     server-side from `lib/tool-suite.ts`'s fixed `TOOL_INFO` map. This
     is deliberate: letting a model emit an arbitrary URL that then
     renders as a clickable link is both a hallucination risk (a
     plausible but wrong or dead URL) and an injection risk.
   - A brand-new user with no reports yet gets a small set of honest
     starter recommendations instead of a wasted LLM call synthesizing
     advice from nothing.
   - **Not quota-gated**, unlike the other four features — this route
     doesn't analyze new external content, it's a free synthesis layer
     over analyses the user already paid a quota unit to generate. A
     deliberate scoping choice, documented in the route itself and in
     `docs/VIRALENGINE_ROADMAP.md`, not an oversight.
3. What's real vs. what isn't: recommendations and deep links are fully
   real. Actually *driving* Descript/OpusClip/HyperFrames/Canva on the
   user's behalf (e.g., auto-submitting a clip to OpusClip) would need a
   real per-user OAuth connection to each of those four services — the
   same category of constraint ViralSync's own TikTok/Google Ads OAuth
   flow already documented honestly for this repo, one product ago. That
   automation is intentionally not built or stubbed here; see
   `docs/VIRALENGINE_ROADMAP.md`.

### Competitor Espionage & Gap Engine

1. `app/dashboard/competitors/page.tsx` +
   `components/CompetitorTrackerForm.tsx` — track 3-5 competitor handles
   (YouTube/TikTok/Instagram) plus an optional niche, get outlier topics,
   topics missing from your own work, audience sentiment gaps, and
   untapped keyword clusters.
2. `app/api/competitors/track/route.ts` — the orchestrator:
   - Same auth + quota consume/refund pattern as the other real-analysis
     features (unlike the Tool Suite Hub, this one does analyze new
     external content, so it's quota-gated like the first three).
   - Reuses `fetchYoutubeChannelSnapshot` (real YouTube Data API v3) and
     `extractUrlContent` (Tavily) exactly as Deep-Dive does, including the
     same per-competitor graceful-failure handling — one bad handle among
     five doesn't sink the whole report.
   - **New**: `lib/tavily.ts`'s `searchTopics()`, a real Tavily `/search`
     call (distinct from `/extract`) grounding "untapped keyword
     clusters" in actual current search results, not invented trends.
   - Pulls this creator's own recent reports/scripts (via the same
     `lib/digest.ts` digest builders the Tool Suite Hub uses — extracted
     into a shared module rather than duplicated a third time) so Claude
     (`generateCompetitorGapAnalysis`) can identify what competitors
     cover that this creator's own work doesn't, not just describe the
     competitors in isolation.
   - Persists the tracked handle list into `creators_profiles.connected_metrics`
     and writes to `audit_reports` (`source_type: 'competitors'` — added
     to that column's check constraint via migration).

### Algorithmic Scheduling & Publishing Planner

1. `app/dashboard/schedule/page.tsx` + `components/ScheduleCalendar.tsx`
   — a list of your `scheduled_posts`, a "Generate this week" button, an
   inline datetime picker per row for rescheduling, and delete.
2. Plain CRUD, real and quota-free: `app/api/schedule/route.ts` (list,
   create) and `app/api/schedule/[id]/route.ts` (update, delete — both
   scoped to `id` **and** `user_id` together, so one user can never touch
   another's calendar entry). Creating or editing a slot by hand doesn't
   call an LLM, so it isn't quota-gated like the rest of this app.
3. The one AI-assisted piece, and the only quota-gated route here:
   `app/api/schedule/generate/route.ts`.
   - Real Tavily `/search` results for current best-time-to-post
     research, plus a digest of this creator's own recent reports (via
     `lib/digest.ts`, reused a third time), sent to Claude
     (`generateWeeklyCalendar`) to produce 5-10 suggested slots spread
     across platforms and days.
   - Each slot's `day_of_week`/`time_local` is turned into a real
     `publish_at` timestamp (`nextOccurrence()`) and inserted as a
     `draft` `scheduled_posts` row.
   - **Known limitation, not hidden**: there's no per-user timezone
     column in this schema yet, so `nextOccurrence()` resolves against
     the server's own clock rather than each creator's actual timezone —
     the spec's "audience timezone activity via Metricool" needs a
     per-user Metricool OAuth connection this pass doesn't build (the
     same category of gap as the Tool Suite Hub's four services).
4. **What's deliberately not built**: actually *publishing* a
   `scheduled_posts` row to a live platform at its `publish_at` time
   needs two things this pass doesn't have — a cron/queue trigger (Vercel
   Cron or a Supabase scheduled function) and a per-user OAuth connection
   to each platform's publishing API. Building the data model and the
   generation logic without faking the publish step is the same honest
   split ViralSync's own OAuth-flow-real/ad-placement-stub pattern used,
   one product ago. "Drag-and-drop rescheduling" from the spec is real as
   a datetime-picker edit calling the same `PATCH` endpoint a drag
   interaction would; an actual drag gesture wasn't built — a UI-only
   scoping choice, not a backend limitation.

### Shared platform pieces

- Billing: `app/api/stripe/checkout/route.ts` creates a real Stripe
  Checkout session against real test-mode prices (Creator/Pro/Studio,
  created via the Stripe MCP connector under the "Peshets sandbox"
  account); `app/api/stripe/webhook/route.ts` verifies the signature,
  dedupes on Stripe event id (`stripe_webhook_events`), and syncs plan
  tier + quota limit into `subscriptions`.
- Auth: `proxy.ts` (Next.js 16's renamed `middleware.ts`) gates
  `/dashboard/*` and `/api/*` behind a Clerk session, redirecting page
  requests to `/sign-in` and returning a JSON 401 for API requests.
  `app/api/webhooks/clerk/route.ts` syncs `user.created` /
  `user.updated` / `user.deleted` into the `users` table and creates a
  default `subscriptions` row (Creator tier, 10 analyses/month) on
  signup.

See `docs/DEBUG_RUN.md`'s "ViralEngine (current app)" section for the real
issues this surfaced and how each was fixed — including two genuine
Next.js 16 breaking changes (`middleware.ts` → `proxy.ts`, `next lint`
removed) that don't match most training data.

## What's genuinely not built

All 7 features are shipped, but two categories of "actually drive a
third-party platform on a user's behalf" were deliberately never
attempted or stubbed, across every feature that touched them:

- **Per-user OAuth to Descript, OpusClip, HyperFrames, Canva, or
  Metricool.** Each has a real API, but each needs its own per-creator
  account connection this pass doesn't build — the Tool Suite Hub
  recommends and deep-links instead of driving them; the Scheduling
  Planner plans instead of publishing.
- **Actual publish-time execution.** No cron/queue trigger exists to
  turn a `scheduled_posts` row into a live post at its `publish_at` time.

Both are the same honest split ViralSync's own
OAuth-flow-real/ad-placement-stub pattern already used in this repo, one
product ago — see `docs/VIRALENGINE_ROADMAP.md` for what each would
actually take to build.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in Clerk, Supabase,
   Stripe, Anthropic, Tavily, YouTube Data API v3, Cloudinary, and Mem0
   keys.
3. Apply `supabase/migrations/0001_viralengine_init.sql` to your Supabase
   project (`supabase db push`, or paste into the SQL editor). A live
   project already has it applied — project ref `dcesehxmssqsszzasott`
   ("unseen-reels"); ask for its URL/keys rather than provisioning a
   second one.
4. In the Supabase dashboard: Authentication → Sign In / Providers →
   Third Party Auth → add Clerk (needs your Clerk instance's Frontend API
   URL). This is a manual, one-time step no CLI/API here can perform —
   see the note in `.env.example` for exactly what breaks without it (the
   RLS-scoped clients in `lib/supabase/{server,client}.ts`; the shipped
   Analyzer route doesn't depend on it).
5. In the Clerk dashboard: add a webhook endpoint at
   `{NEXT_PUBLIC_APP_URL}/api/webhooks/clerk` subscribed to
   `user.created`, `user.updated`, `user.deleted`.
6. In the Stripe dashboard (or via the Stripe MCP connector): point a
   webhook at `{NEXT_PUBLIC_APP_URL}/api/stripe/webhook` for
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`.
7. `npm run dev`

## Database schema

`supabase/migrations/0001_viralengine_init.sql` — every table has RLS
enabled and a policy scoped to `auth.jwt()->>'sub'` (the Clerk user id,
once step 4 above is done):

- `users` — Clerk user id (as `id`, text, not uuid) + Stripe customer id.
- `creators_profiles` — niche, per-platform handles, cached connected
  metrics, Mem0 agent key.
- `audit_reports` — every analysis result (Gap Analyzer, Deep-Dive,
  Upload Diagnostic, Competitor Espionage), JSONB payload + viral score +
  timestamped recommendations. `source_type` grew a fourth value
  (`competitors`) beyond the original three via migration.
- `scripts` — generated storyboards, tone parameters, target platform.
- `scheduled_posts` — the content calendar.
- `subscriptions` — Stripe plan tier + atomic quota usage counters.
- `stripe_webhook_events` — dedupe table, service-role only.

Two service-role-only `SECURITY DEFINER` functions:
`consume_analysis_quota(user_id)` / `refund_analysis_quota(user_id)` —
see the security-advisor finding about these in `docs/DEBUG_RUN.md`
before assuming a similar function is safe to expose more broadly.

## Deployment checklist (Vercel)

1. Set every var from `.env.example`'s ViralEngine section in the Vercel
   project (Production **and** Preview — Preview needs its own
   Clerk/Stripe test-mode keys, or builds will fail the same way local
   `next build` does without `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`).
2. `NEXT_PUBLIC_APP_URL` must be the real deployed origin — Stripe
   Checkout success/cancel URLs and the Clerk/Stripe webhook URLs you
   register are built from it.
3. Confirm Supabase RLS is enabled on all six ViralEngine tables (it is,
   per the migration — re-verify after any schema change with
   `get_advisors(type: 'security')`, not just by reading the migration).
4. Complete the Clerk↔Supabase Third Party Auth dashboard step (above)
   before shipping any feature that uses the RLS-scoped Supabase clients.
5. Point the Clerk webhook and the Stripe webhook at their real
   `/api/webhooks/clerk` and `/api/stripe/webhook` URLs on the deployed
   origin, using each one's real signing secret.
6. Keep Stripe in test mode until you're ready to take real payments —
   flipping to live mode is a deliberate, user-visible, hard-to-reverse
   action worth its own go/no-go.
7. `npm run typecheck && npm run build && npm run lint` locally before
   every deploy — all three are real, working checks now (see
   `docs/DEBUG_RUN.md` for what was broken about `lint` before this pass).

## ViralVision platform expansion (separate, unbuilt scaffold)

`services/api/`, `services/collab/`, `k8s/`, and `argocd/` are an
organized-but-unrun scaffold for a much larger, separate "ViralVision"
AI video-generation platform described in a batch of architecture docs.
They don't affect anything above — the ViralEngine app you're reading
about still works exactly as documented, and `proxy.ts`'s tenant-routing
half (which belongs to this scaffold) stays disabled unless
`MULTI_TENANT_ROUTING_ENABLED=true` is set. See
**`docs/PLATFORM_ROADMAP.md`** for what's there, what it maps to, and
what's explicitly not done yet.
