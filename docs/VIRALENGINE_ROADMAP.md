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
| 2 | Creator Account Deep-Dive | Not started |
| 3 | Multimodal Video Upload Diagnostic | Not started |
| 4 | Algorithmic Script & Storyboard Generator | Not started |
| 5 | Creator Tool Suite Hub | Not started |
| 6 | Competitor Espionage & Gap Engine | Not started |
| 7 | Algorithmic Scheduling & Publishing Planner | Not started |

## 2. Creator Account Deep-Dive

- **Route**: `app/api/creators/deep-dive/route.ts` (new).
- **Tables**: `creators_profiles` (write `handles`, `niche`,
  `connected_metrics`), `audit_reports` (write with `source_type:
  'account'`, `source_url: null`).
- **Real API contracts available in this workspace**: the vidIQ MCP
  connector exposes `vidiq_channel_stats`, `vidiq_channel_analytics`,
  `vidiq_channel_performance_trends`, `vidiq_subscriber_insights`, and
  `vidiq_similar_channels` — all verified live and well-suited to "posting
  patterns, view-to-follower ratios, engagement drops." Metricool's
  `getAnalyticsDataByMetrics` + `getBrandSettings` cover cross-platform
  posting cadence. Neither vidIQ nor Metricool has a public, self-serve
  REST API a deployed server can call with just an API key the way Tavily
  does — both are reachable from *this* session via their MCP connectors,
  but the deployed app itself would need whatever direct API access each
  vendor actually sells (vidIQ's public API is limited; Metricool's is
  account-linked). Confirm actual access before assuming a
  fetch()-with-API-key implementation is possible; don't hallucinate an
  endpoint the way the original spec's "vidIQ/Metricool benchmark" bullet
  implies is trivial.
- **Gotcha already found**: the Viral Gap Analyzer's `lib/anthropic.ts`
  pattern (tool-use for forced structured output) is directly reusable
  here — copy the tool-schema approach, not the specific schema.

## 3. Multimodal Video Upload Diagnostic

- **Route**: `app/api/analyze/upload/route.ts` (new).
- **Tables**: `audit_reports` with `source_type: 'upload'`.
- **Real API contract**: Cloudinary MCP connector has `sign-upload` (a
  verified, real signed-upload-preset flow — this is exactly the right
  primitive for direct-from-browser video upload without routing the
  file through the Next.js server). The route should mint a signed
  upload via Cloudinary and hand the browser a direct-upload URL, not
  proxy the video bytes itself.
- **Rate-limit / payload-size note carried over from the debug pass**:
  Vercel serverless functions have a hard request body ceiling (4.5MB on
  the default plan) — this is exactly why the upload must go
  browser→Cloudinary directly via a signed preset, never
  browser→Next.js route→Cloudinary. Getting this wrong is the most likely
  first bug in this feature.
- Frame/audio extraction for "visual hook clarity, audio/voice balance,
  B-roll recommendations" needs Cloudinary's video analysis add-ons or a
  separate frame-extraction step before the Claude call — not yet
  verified against a real Cloudinary account in this session.

## 4. Algorithmic Script & Storyboard Generator

- **Route**: `app/api/generate/script/route.ts` (new).
- **Tables**: `scripts` (storyboard JSONB, tone_parameters,
  target_platform), reads `creators_profiles.mem0_agent_key` for style
  retrieval.
- **Real API contract**: Mem0 MCP connector (`add_memory`,
  `search_memories`, `get_memories`) is live and verified reachable in
  this workspace. Store one Mem0 entry per creator keyed by
  `creators_profiles.mem0_agent_key`, updated after every accepted script
  (their actual chosen tone/voice), and retrieve it before generation.
- **Reuse**: `lib/anthropic.ts`'s tool-use pattern again, with a schema
  matching the spec's per-scene shape (Visual Action, Spoken Hook <3s,
  Audio/SFX Cue, Retention Loop, CTA).

## 5. Creator Tool Suite Hub

- No new table — this is a recommendation/deep-link layer over the other
  features' outputs, not its own data model.
- **Real, verified MCP connectors in this workspace**: Descript
  (`import_media`, `prompt_project_agent`, `publish_project`), OpusClip
  (`opusclip_create_upload_link`, `opusclip_analyze_video`,
  `opusclip_submit_project`), HyperFrames by HeyGen (`compose`,
  `render_video` — noted as disabled from CLI/IDE agents per that
  connector's own instructions; a hosted-chat-only path), Canva
  (`generate-design`, `create-design-from-brand-template`). All four have
  real tool schemas already loaded in this session — inspect them again
  (`ToolSearch`) before wiring the actual deep-link URLs, since each
  needs its own OAuth/account-linking flow the deployed app doesn't have
  yet.

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
