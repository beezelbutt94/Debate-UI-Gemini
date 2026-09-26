# Viral Trending roadmap

All 7 features of the original spec are shipped — see README.md for what
each one does. This file is now a record of how each one actually got
built vs. what the roadmap originally guessed before it existed, kept for
whoever touches this code next: several early guesses here turned out
wrong once actually investigated (vidIQ/Metricool's real API access,
Semrush/Ahrefs's domain-vs-handle mismatch), and the corrected reasoning
is worth more than the original guess. Read `docs/DEBUG_RUN.md` for the
concrete bugs/fixes each feature surfaced.

Every table named below already exists —
`supabase/migrations/0001_viralengine_init.sql` was written to cover the
whole spec's schema up front, not just the one feature it started with.

## Status

| # | Feature | Status |
|---|---|---|
| 1 | Viral Gap Analyzer (URL Ingestion) | **Shipped** — see README.md |
| 2 | Creator Account Deep-Dive | **Shipped** — see README.md |
| 3 | Multimodal Video Upload Diagnostic | **Shipped** — see README.md |
| 4 | Algorithmic Script & Storyboard Generator | **Shipped** — see README.md |
| 5 | Creator Tool Suite Hub | **Shipped** — see README.md |
| 6 | Competitor Espionage & Gap Engine | **Shipped** — see README.md |
| 7 | Algorithmic Scheduling & Publishing Planner | **Shipped** — see README.md |

## 8. OAuth connections + publish trigger — shipped (partially -- see per-service verdicts)

The "what would come after this spec" layer below turned into real, shipped
infrastructure once investigated properly rather than staying speculative.
The first step was verifying, service by service, which of the five
candidates (Descript, OpusClip, HeyGen/HyperFrames, Metricool, Canva) even
*have* a genuine self-serve, multi-tenant OAuth product a deployed third
party can register without a sales/partnership conversation and use to act
on an arbitrary end user's own account — as opposed to an account-linked,
single-workspace API key (what this session's own MCP connectors to those
services expose, which is access *for this session as one operator*, not
for a SaaS's many end users).

| Service | Verdict | Why |
|---|---|---|
| **Canva** | Genuine self-serve OAuth2 (Connect API) | `canva.dev` Developer Portal issues a `client_id`/`client_secret` immediately for a private integration; Authorization Code + PKCE; real per-user consent screen. Going live for arbitrary users needs Canva's integration review queue, but registration itself needs no conversation. |
| **YouTube** | Genuine self-serve OAuth2 (standard Google) | Same Google Cloud Console OAuth client model as any "Sign in with Google" integration. No review gate for the grant itself. |
| **TikTok** | Genuine self-serve OAuth2, audit-gated for public visibility | `developers.tiktok.com` app registration is self-serve; Content Posting API's Direct Post works immediately but restricts all posts to private/self-only until TikTok completes a content audit (5-10 business days). |
| **Facebook** (Reels, via Pages) | Genuine self-serve OAuth2, App-Review-gated | Standard Meta app registration; `pages_manage_posts` requires Meta App Review before it works for accounts beyond a Tester/Developer role on the app. |
| **Descript** | No multi-tenant OAuth | API tokens are generated manually per-account and tied to one Drive (workspace) — no `client_id`/secret registration, no consent screen for another user's account. |
| **OpusClip** | No multi-tenant OAuth | A single Bearer API key per org/workspace, gated by plan tier (self-serve to *obtain*, but still one fixed account, not per-end-user consent). |
| **HeyGen / HyperFrames** | OAuth2 exists but partnership-gated | A real Authorization Code + PKCE flow exists, but HeyGen's Partnerships team must manually issue the `client_id` and approve the redirect URI first — fails the "no sales conversation" bar the other four clear. Unclear the grant even extends to HyperFrames-specific actions vs. general HeyGen video API. |
| **Metricool** | No multi-tenant OAuth (confirms feature 2/7's finding) | Static `userToken` header tied to one account/workspace, gated behind the Advanced/Custom plan — no registration, no consent screen. |

What shipped, matching the four real verdicts:

- `supabase/migrations/0002_platform_connections.sql` — one table for all
  four platforms, Vault-encrypted tokens (mirrors the `store_platform_refresh_token`/
  `get_platform_refresh_token` pattern `lib/oauth/` used for ViralSync's
  TikTok/Google Ads flow, adapted to Clerk's text user ids and to storing
  both an access *and* refresh token since these providers, unlike
  ViralSync's two, mostly issue short-lived access tokens).
- `lib/oauth/{youtube,tiktok,facebook,canva}.ts` — real authorization URLs
  and token exchange against each provider's verified current endpoints
  (Canva's PKCE requirement, Facebook's short-lived → long-lived → Page
  token indirection, TikTok's `client_key` naming all confirmed against
  live docs this session, not assumed from training data).
  `app/api/oauth/[platform]/{start,callback}` is the connect flow itself.
- `lib/publish/{youtube,tiktok,facebook}.ts` — the actual publish calls:
  YouTube's resumable upload protocol (streams the Cloudinary-hosted video
  straight through, no full buffering), TikTok's Direct Post `init` call
  (`PULL_FROM_URL`, which requires verifying Cloudinary's domain in
  TikTok's developer portal — a real one-time setup step this code can't
  do for you), Facebook's 3-phase Reels upload. Canva has no publish
  function yet — connecting it is real and live, but wiring the Tool
  Suite Hub to actually call `design:content:write` instead of showing a
  deep link is a follow-up, not part of this round.
- `app/api/cron/publish/route.ts` + `vercel.json` — the actual trigger:
  finds `scheduled_posts` rows past their `publish_at` with
  `status = 'scheduled'`, calls the matching publisher, records success or
  a real `publish_error` message (not just a boolean). Deliberately
  trigger-agnostic (checks a `CRON_SECRET` bearer header rather than
  assuming Vercel specifically) since Vercel Cron's Hobby-plan minimum
  interval is once/day regardless of what `vercel.json` requests.
  `proxy.ts` had to gain a `/api/cron/(.*)` exception to Clerk's blanket
  `/api/*` auth gate — an external scheduler never carries a Clerk
  session, only the bearer secret the route checks itself; caught by
  smoke-testing the endpoint the same way every other feature in this app
  has been, not assumed to work.
- `app/dashboard/settings/connections` + `components/ConnectionsPanel.tsx`
  — connect/disconnect UI with live status, including each platform's real
  caveat (audit/review gate or lack thereof) surfaced in the UI itself
  rather than left for a support ticket to discover.

Real, documented gaps left in this layer: no per-Page/per-channel picker
(Facebook and a creator with multiple Pages connects whichever one
`/me/accounts` returns first); TikTok's publish call doesn't poll
`post/publish/status/fetch/` for terminal state, just confirms the job was
accepted; Canva's OAuth is live but nothing calls its API yet. Each is the
same category of honestly-scoped gap as the un-built calendar drag gesture
in feature 7 — a real follow-up, not something silently assumed away.

## What would come after this spec, if it kept going

1. **Per-user timezone storage.** `nextOccurrence()` in
   `app/api/schedule/generate/route.ts` resolves against the server's own
   clock today; a `timezone` column on `users` (populated from the
   browser at signup) would let the Scheduling Planner compute real local
   times per creator instead.
2. **Wire Canva into the Tool Suite Hub.** The OAuth connection is real and
   live (`lib/oauth/canva.ts`); nothing calls `design:content:write` yet
   to turn a tool recommendation into an actual Canva design.
3. **TikTok publish-status polling** and **multi-Page selection for
   Facebook** — see the gaps noted in section 8 above.

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
`publicId` outside the caller's own `viral-trending/uploads/<clerk id>/`
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
before the Viral Trending pivot) — deliberately not attempted or stubbed
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

## 6. Competitor Espionage & Gap Engine — shipped

Went a different direction than this section originally proposed.
Semrush and Ahrefs's real, verified self-serve APIs are both
domain/website-centric (`competitors_research`, `organic_research`,
`site-explorer-organic-competitors`, ...) — genuinely real APIs, just not
ones that take a TikTok or Instagram *handle* as input, which is what
"track 3-5 competitor handles" actually requires. Rather than force a fit
or commit to an unverified endpoint, this reused the exact same real data
sources Deep-Dive already established for the same problem: YouTube Data
API v3 (`fetchYoutubeChannelSnapshot`) for YouTube competitors, Tavily
extraction for TikTok/Instagram. Semrush/Ahrefs stay a real option for a
*future* website-centric competitor angle, not for handle-based social
tracking — worth remembering if a later feature needs it.

New in this feature: `lib/tavily.ts`'s `searchTopics()`, wrapping the
real Tavily `/search` endpoint (verified live, distinct from `/extract`)
to ground "untapped keyword clusters" in actual current search results.

Also extracted `lib/digest.ts` (`digestReport`/`digestScript`) out of the
Tool Suite Hub route, since this feature needed the exact same
"summarize a creator's own past reports/scripts into plain text" logic
to compare against competitors — one shared implementation instead of a
second copy, and it also fixed a latent bug: the Tool Suite Hub's inline
version had no branch for `source_type: 'competitors'` and would have
mis-cast that shape once this feature started writing rows, caught while
refactoring rather than at runtime.

`audit_reports.source_type`'s check constraint gained a fourth value,
`'competitors'`, via a live `alter table` against the `unseen-reels`
project (verified after with a `pg_constraint` query) and folded
directly into `supabase/migrations/0001_viralengine_init.sql`'s `create
table` statement as the source of truth for a fresh install, matching
how every other schema change this session has been handled.

## 7. Algorithmic Scheduling & Publishing Planner — shipped

Metricool's `getBestTimeToPostByNetwork` (the tool this plan originally
pointed at) answers the spec's "audience timezone activity" question
directly *from this session's MCP connector* — but, same as vidIQ and
Metricool's other endpoints back in feature 2, that's account-linked
access, not a self-serve API key a deployed third-party server can call
for an arbitrary end user. Rather than guess at an unverified direct
integration, this used the same real substitute Deep-Dive and Competitor
Espionage already established: `lib/tavily.ts`'s `searchTopics()` for
real current best-time-to-post research, blended with the creator's own
actual cadence data (via `lib/digest.ts`, now used by three features).

Plain CRUD (`app/api/schedule/route.ts`, `app/api/schedule/[id]/route.ts`)
came together exactly as planned — no surprises, no new packages. The one
piece worth flagging for whoever builds feature set (1) in "what would
come after this spec" above: `nextOccurrence()` computes real calendar
math (next occurrence of a weekday + time within 7 days) but has nowhere
to read a creator's actual timezone from, since that column doesn't
exist yet — documented as a known limitation in README.md rather than
quietly assumed away.
