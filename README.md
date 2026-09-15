# ViralSync

A credit-metered dashboard where a creator pastes a TikTok or YouTube link
and ViralSync allocates a micro-budget through that platform's **official**
ad API (TikTok Spark Ads, Google Ads) to amplify it to real people. No bots,
no click farms — only OAuth-authenticated, paid distribution through the
platform's own auction, spending the *creator's own* connected ad account.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth, credit ledger + OAuth token vault, all RLS-enabled)
- Stripe (subscription billing, credit top-ups)

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in Supabase + Stripe keys.
   Leave the TikTok/Google Ads vars blank until you have real, approved
   developer credentials — see **What's stubbed out** below.
3. Apply `supabase/migrations/0001_init.sql` and `0002_platform_connections.sql`
   to your Supabase project (`supabase db push`, or paste into the SQL editor,
   in that order).
4. `npm run dev`

A live test-mode Supabase project (`viralsync`, region eu-west-1) already
has both migrations applied — ask for its URL/anon key if you don't have
them, rather than creating a second one.

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
- `lib/distribution.ts` — the *only* code allowed to call a platform's ad
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
  `app/api/oauth/`) — once you register real TikTok/Google developer apps
  and set their client id/secret, creators can actually connect their own
  ad accounts and the refresh token is genuinely captured and encrypted.
- **Placing an actual ad is still a stub.** `lib/distribution.ts`'s
  `amplify()` checks the platform env vars, confirms the creator has a
  stored connection, and then throws "not yet implemented" — the TikTok
  Marketing API / Google Ads API campaign-creation calls themselves aren't
  written yet, because they need live testing against a real, approved
  developer app to get right, and none exists yet.

Getting past that stub requires, at minimum:

- A verified TikTok Business account + Marketing API app review (Spark Ads
  scope).
- A Google Ads API developer token (subject to Google's approval process).
- A funded ad budget — this is real paid spend on real ad platforms, not
  free-tier infrastructure.

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
5. Keep Stripe in **test mode** and the distribution env vars unset until
   you're ready to take real payments and place real ad spend — both are
   irreversible, user-visible actions worth a deliberate go/no-go.
