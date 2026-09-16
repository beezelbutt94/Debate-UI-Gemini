# ViralEngine

A monetization-enabled SaaS platform for content creators. Paste a TikTok,
YouTube Short, or Facebook Reel URL and the Viral Gap Analyzer scores it
against the hook and retention benchmarks that separate viral videos from
the rest, then returns a timestamped action plan for what's missing.

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
- Tavily (`/extract`) for URL content extraction
- YouTube Data API v3 for real channel/upload stats
- Cloudinary (signed direct-to-cloud video upload, frame + waveform
  extraction via delivery transformations)
- Anthropic Claude (Messages API, tool-use/structured output, and vision
  for the Upload Diagnostic) for the actual audit synthesis

## What's built

Three features, real end to end, not stubs:

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

## What's not built yet

Script & Storyboard Generator, Creator Tool Suite Hub, Competitor
Espionage Engine, and the Scheduling/Publishing Planner. See
**`docs/VIRALENGINE_ROADMAP.md`** — it names the exact schema tables
(already created, see below) and API routes each one needs, and which
already-verified API contracts (Metricool, Mem0, OpusClip, Descript,
HyperFrames, Canva, Semrush, Ahrefs) to build against.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in Clerk, Supabase,
   Stripe, Anthropic, Tavily, YouTube Data API v3, and Cloudinary keys.
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
- `audit_reports` — every analysis result (Gap Analyzer, Deep-Dive, and
  Upload Diagnostic), JSONB payload + viral score + timestamped
  recommendations.
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
