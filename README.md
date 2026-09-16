# ViralSync

A credit-metered content studio: a creator brings a video, the app
generates and edits it **on your own hardware**, and publishes it to the
creator's own account through each platform's **official** Content API.

No bots, no click farms, no simulated engagement — posting happens through
OAuth-authenticated official APIs, on the creator's own account.

> **This app used to buy ads.** It allocated a micro-budget through TikTok
> Spark Ads / Google Ads to amplify a creator's post. That model is gone:
> ad spend is inherently a paid service and cannot be replaced by anything
> self-hosted, so the product moved to organic publishing, which the
> platforms' APIs support for free. See `docs/LOCAL_STACK.md`.

Credits now meter **work this app performs**, not ad spend — so there is no
per-unit cost of goods behind them.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth, credit ledger + OAuth token vault, all RLS-enabled)
- Stripe (subscription billing, credit top-ups)
- **Local inference**: Ollama (structured generation), Kokoro (speech),
  faster-whisper, FFmpeg, CLIP — no hosted AI APIs, no per-token cost

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in Supabase + Stripe keys.
   Leave the TikTok/Google vars blank until you have approved developer
   credentials — see **What's stubbed out** below.
3. Apply everything in `supabase/migrations/` to your Supabase project in
   filename order (`supabase db push`, or paste into the SQL editor).
4. `npm run dev`

A live test-mode Supabase project (`unseen-reels`, region eu-central-1)
already has both migrations applied — ask for its URL/anon key if you
don't have them, rather than creating a second one. (An earlier `viralsync`
project in eu-west-1 also has them applied and still exists, but this repo
has since standardized on `unseen-reels`.)

## Architecture

- `app/page.tsx` — dashboard: paste-a-link input + credit meter + ad-account
  connect buttons + plan picker.
- `lib/supabase/` — `server.ts`/`client.ts` are RLS-scoped clients for normal
  reads/writes; `admin.ts` is the service-role client, used only by the
  Stripe webhook and the OAuth callback (never imported into client code).
- `supabase/migrations/0001_init.sql` — `users` (Stripe linkage + credit
  balance), `credit_ledger` (append-only audit trail), `campaign_logs`
  (one row per submitted link). Every credit spend goes through the
  `consume_credits()` Postgres function, which atomically checks the
  balance and decrements it so two concurrent submissions can't both
  succeed against a balance that only covers one.
- `supabase/migrations/0002_platform_connections.sql` — `platform_connections`
  links a creator to their own TikTok/Google Ads account. The OAuth
  refresh token itself is never stored in a plain column: it goes into
  Supabase Vault (encrypted), and only the `store_platform_refresh_token()`
  / `get_platform_refresh_token()` functions — restricted to `service_role`
  — can write or read it.
- `lib/oauth/` — `tiktok.ts`/`google.ts` implement each platform's OAuth
  flow (authorization URL + code exchange); `state.ts` handles CSRF via a
  short-lived httpOnly cookie compared against the provider's `state` echo.
- `app/api/oauth/[platform]/start` and `.../callback` — the connect flow:
  start requires an authenticated session and redirects to the provider;
  callback verifies CSRF state, exchanges the code, and persists the token
  via the Vault-backed function above.
- `app/api/campaigns/route.ts` — the credit gateway. Calls
  `consume_credits()`; if the balance is insufficient it returns
  **402 Payment Required**, per the pay-as-you-go design.
- `lib/publishing.ts` — the *only* code allowed to call a platform's
  API. Before attempting anything, it looks up the creator's own stored
  OAuth connection and refuses to proceed without one — see below for what's
  still a stub past that point.
- `lib/stripe.ts`, `app/api/checkout/route.ts`,
  `app/api/webhooks/stripe/route.ts` — Starter/Pro/Agency subscription
  checkout and webhook-driven credit grants, idempotent on Stripe event id.
  `getStripe()` is lazy so a missing `STRIPE_SECRET_KEY` fails at first use,
  not at build/import time.

## What's stubbed out (and why)

Two different things are true at once:

- **The OAuth connect flow is real, working code** (`lib/oauth/`,
  `app/api/oauth/`) — once you register TikTok/Google developer apps and set
  their client id/secret, creators can actually connect their accounts and
  the refresh token is genuinely captured and encrypted into Supabase Vault.
- **The actual upload call is still a stub.** `lib/publishing.ts`'s
  `preflight()` checks the platform env vars and confirms the creator has a
  stored connection, then reports `not_reviewed` — because neither platform
  has granted this app the permission to post yet, and writing upload code
  that cannot be tested against a real approved app would be guesswork.

Crucially, `preflight()` runs **before** credits are charged, so a creator
is never billed for a publish that cannot happen.

Getting past that stub requires, at minimum:

- **TikTok**: a developer app with the `video.publish` scope, and a pass on
  TikTok's Content Posting audit. Until that audit passes every upload is
  forced to private and the creator has to finish the post in the app. The
  API itself is free — the audit is the gate, not a price.
- **YouTube**: a Google Cloud OAuth client with the `youtube.upload` scope,
  and Google's OAuth verification for it. Unverified apps are capped to a
  test-user list. Also free.

Both are review timelines (weeks), not bills.

## Deploying

Before any production deploy:

1. Confirm Supabase RLS is enabled on all tables (it is, per both
   migrations — verify after any schema change with the security advisor).
2. Set the env vars from `.env.example` in Vercel, including
   `NEXT_PUBLIC_APP_URL` set to the real deployed origin (OAuth redirect
   URIs and Stripe Checkout URLs are built from it).
3. Register the deployed origin's `/api/oauth/tiktok/callback` and
   `/api/oauth/google/callback` URLs with each platform's developer app.
4. Point the Stripe webhook at `/api/webhooks/stripe` and use its signing
   secret for `STRIPE_WEBHOOK_SECRET`.
5. Keep Stripe in **test mode** and the publishing env vars unset until
   you're ready to take real payments and place real ad spend — both are
   irreversible, user-visible actions worth a deliberate go/no-go.

## ViralVision platform expansion (separate, unbuilt scaffold)

`services/api/`, `services/collab/`, `k8s/`, and `argocd/` are an
organized-but-unrun scaffold for a much larger, separate "ViralVision"
AI video-generation platform described in a batch of architecture docs.
They don't affect anything above — the app you're reading about here
still works exactly as documented. See **`docs/PLATFORM_ROADMAP.md`**
for what's there, what it maps to, and what's explicitly not done yet.
