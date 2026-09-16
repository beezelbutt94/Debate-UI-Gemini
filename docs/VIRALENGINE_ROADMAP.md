# ViralEngine roadmap

What's built (Viral Gap Analyzer — see README.md) vs. what's left of the
original 7-feature spec. Keep this file in sync with actual progress:
update a row the moment its feature ships, don't batch it.

Every table named below already exists —
`supabase/migrations/0001_viralengine_init.sql` was written to cover the
whole spec's schema up front, not just the one shipped feature.

## Status

| # | Feature | Status |
|---|---|---|
| 1 | Viral Gap Analyzer (URL Ingestion) | **Shipped** — see README.md |
| 2 | Creator Account Deep-Dive | **Shipped** — see README.md |
| 3 | Multimodal Video Upload Diagnostic | **Shipped** — see README.md |
| 4 | Algorithmic Script & Storyboard Generator | **Shipped** — see README.md |
| 5 | Creator Tool Suite Hub | **Shipped** — see README.md |
| 6 | Competitor Espionage & Gap Engine | Not started |
| 7 | Algorithmic Scheduling & Publishing Planner | Not started |

## 2. Creator Account Deep-Dive — shipped

Built with **YouTube Data API v3** (`lib/youtube.ts`) for the YouTube half
and **Tavily extraction** (`lib/tavily.ts`, reused from the Analyzer) for
TikTok/Instagram — not vidIQ/Metricool. Investigating those two first
surfaced the actual constraint worth recording for the rest of this
roadmap: neither has a public, self-serve REST API a deployed third-party
server can call with just an API key (vidIQ's public API is limited;
Metricool's is account-linked) — both are only reachable from *this
session* via their MCP connectors, which isn't the same thing as the
*deployed app* being able to call them. YouTube's official API is
self-serve, well-documented, and zero-hallucination-risk, so it's the real
data source for the platform the spec cares most about; TikTok/Instagram
get the same honest, best-effort treatment the Analyzer already gives them
(and that ViralSync's own TikTok/Google Ads OAuth flow gave that same
constraint, one product ago).

Reused directly from the Analyzer: the quota consume/refund pattern, the
`lib/anthropic.ts` tool-use-for-structured-output approach (new schema:
`generateGrowthBlueprint`/`GrowthBlueprint`), and the service-role-client-
with-explicit-filter pattern for reads (see `app/dashboard/deep-dive/page.tsx`).
One addition worth reusing forward: a failed platform fetch is recorded as
`{error: message}` *inside* the data handed to Claude rather than failing
the whole request — a bad TikTok handle shouldn't block a YouTube result
when both were requested together.

## 3. Multimodal Video Upload Diagnostic — shipped

Built exactly as this section originally proposed, with one addition the
original plan didn't call out: no Cloudinary "video analysis add-on" was
needed for frame/audio extraction. Cloudinary's own on-the-fly delivery
transformations do it for free —  `so_<seconds>` extracts a real JPEG
frame at a timestamp, `fl_waveform` renders a real waveform PNG — both
generated lazily on first request and cached, no separate processing step
or add-on subscription. The frames and waveform are sent as actual base64
image blocks to Claude's vision input (`lib/anthropic.ts`,
`generateUploadDiagnosis`), not described in text — the model looks at
real pixels. The signed-upload flow matches the Cloudinary MCP
connector's own `sign-upload` contract, verified live before writing
`lib/cloudinary.ts`'s manual HMAC signing (sorted params + api_secret,
SHA-1 — Cloudinary's textbook algorithm, unchanged for years).

The payload-size note from the original plan was correct and is exactly
what got built: the browser uploads straight to Cloudinary
(`app/api/uploads/sign` only mints credentials), never through our own
serverless function.

One security addition worth reusing forward for any future
user-owns-this-asset check: `app/api/analyze/upload/route.ts` refuses any
`publicId` outside the caller's own `viralengine/uploads/<clerk id>/`
folder prefix (403) before doing anything else, and re-fetches the
asset's real duration from Cloudinary's Admin API rather than trusting
whatever the client claims.

**Also surfaced here, worth fixing before shipping feature 4**: every
third-party npm dependency added in this session so far
(`@anthropic-ai/sdk`, `@clerk/nextjs`, `stripe`, `svix`,
`@supabase/supabase-js`) was pinned from training-data memory of a
plausible version rather than checked against the npm registry.
`@anthropic-ai/sdk` was nearly 100 minor versions stale (`^0.32.1` vs.
the real latest `0.126.0`) and its old types didn't even export
`ContentBlockParam`, which is exactly the vision-input type this feature
needed — caught immediately by `tsc`, not silently wrong. Bumped just
that one dependency (verified via `npm view <pkg> version`, then
typechecked/built/lint clean against the new types) since it was the one
actually blocking; `@clerk/nextjs` (^6.9.6 vs. 7.9.4), `stripe` (^17.2.1
vs. 22.6.2), and `svix` (^1.42.0 vs. 2.5.0) are each a major version
behind but not currently broken — bumping those now is a real,
not-yet-done follow-up, deliberately not bundled into this feature to
avoid destabilizing the two already-shipped ones on an unrelated major
upgrade.

## 4. Algorithmic Script & Storyboard Generator — shipped

Unlike vidIQ/Metricool (feature 2) and unlike TikTok/Google Ads (ViralSync,
one product ago), Mem0 turned out to have a genuine, well-documented,
self-serve API with an official `mem0ai` npm SDK — a real third-party
Node dependency, not just an MCP-connector-only integration. Installed it
and read its shipped `.d.ts` directly rather than guessing the method
signatures: `MemoryClient.add(messages, {userId, ...})` and
`MemoryClient.search(query, {filters, topK, threshold, ...})`. One thing
that guessing would have gotten wrong: `search()`'s options do *not* take
a `userId` field the way `add()`'s does (`tsc` caught this in seconds) —
user-scoping for search goes through `filters: {AND: [{user_id: ...}]}`
instead, matching the same filter-object pattern the Mem0 MCP connector's
own tool descriptions already documented.

`lib/mem0.ts` wraps both calls to degrade non-fatally: a creator's first
script has nothing to retrieve, and Mem0 being unreachable shouldn't block
generation, but per this repo's own "failures that were hidden rather
than fixed" rule (see `docs/DEBUG_RUN.md`), that degradation is returned
to the caller (`{available: false, error}` / `{recorded: false, error}`)
and surfaced in both the API response and the UI, not silently
swallowed — `generateScript()`'s system prompt is even told explicitly
not to claim it's matching an established style when no memory was
actually retrieved.

Reused directly: the quota consume/refund pattern, the creators_profiles
upsert-by-most-recent-row pattern from Deep-Dive (extended here to also
mint a `mem0_agent_key` if one doesn't exist yet), and the
tool-use-for-structured-output approach in `lib/anthropic.ts`
(`generateScript`/`Storyboard`, matching the spec's per-scene shape:
Visual Action, Spoken Hook <3s, Audio/SFX Cue, Retention Loop, CTA).

## 5. Creator Tool Suite Hub — shipped

Built as what the spec actually called it — a "contextual recommendation
module," not a workflow-automation engine. Investigating Descript,
OpusClip, HyperFrames, and Canva first confirmed the constraint this
roadmap already flagged for feature 5 before it shipped: each needs its
own per-user OAuth/account-linking flow to actually *drive* on a user's
behalf (submit a clip to OpusClip, trigger Descript's Studio Sound,
render a HyperFrames composition, generate a Canva design against a
connected account) — the same category of gap ViralSync's own TikTok/
Google Ads OAuth flow already documented honestly, one product ago.
Building four such flows is a real, large, separate undertaking (each is
its own OAuth app registration, consent screen, and token-storage
problem, mirroring the effort `lib/oauth/` used to represent in this repo
before the ViralEngine pivot) — deliberately not attempted or stubbed
here.

What *is* real: `app/api/tools/recommendations/route.ts` pulls a
creator's actual recent `audit_reports`/`scripts`, digests their real
weak points per report type, and has Claude route each one to whichever
of the four tools actually addresses it, with reasoning that must cite
the specific finding — never a generic pitch. The one design choice worth
reusing forward: the model's structured output constrains `tool` to a
4-value enum, and the real deep-link URL is resolved server-side from
`lib/tool-suite.ts`, never trusted from the LLM's own output — the same
"don't let the model emit something that renders as a live link/action"
caution as the `publicId`-ownership check in feature 3.

This route is also the first of the five shipped features that isn't
quota-gated — it synthesizes over analyses the user already paid a quota
unit for, rather than analyzing new external content, so gating it again
would double-charge for the same underlying work.

## 6. Competitor Espionage & Gap Engine

- **Route**: `app/api/competitors/track/route.ts` (new).
- **Tables**: `creators_profiles.connected_metrics` (cache competitor
  snapshots), new `audit_reports` rows or a dedicated table if the
  4-competitor comparison payload outgrows a single JSONB column —
  decide once real Semrush/Ahrefs payload sizes are known.
- **Real API contracts**: Semrush MCP (`competitors_research`,
  `organic_research`, `audience_research`) and Ahrefs MCP
  (`site-explorer-organic-competitors`,
  `social-media-channels`/`social-media-post-metrics`) are both live,
  verified, self-serve APIs (unlike vidIQ/Metricool above, these two
  vendors do sell direct API-key access, so a real fetch()-based
  integration in the deployed app is plausible — confirm the specific
  endpoint/pricing tier before committing to it). Tavily's `tavily_search`
  covers the "untapped keyword clusters" / sentiment-gap research angle
  using the same real, already-integrated API as `lib/tavily.ts`.

## 7. Algorithmic Scheduling & Publishing Planner

- **Route**: `app/api/schedule/route.ts` (new, plain CRUD).
- **Table**: `scheduled_posts` — already has `publish_at`, `media_urls`,
  `platform`, `status` (`draft`/`scheduled`/`published`/`failed`).
- **Real API contract**: Metricool MCP's `getBestTimeToPostByNetwork`,
  `createScheduledPost` / `createScheduledPostForReview`,
  `getScheduledPosts` are live and directly match this feature's spec.
  Actual publish-time execution (turning a `scheduled_posts` row into a
  live post) needs a cron/queue trigger this Next.js app doesn't have
  yet — Vercel Cron or a Supabase scheduled function are the two
  options; neither is wired up.
