# ViralSync

A credit-metered dashboard where a creator pastes a TikTok or YouTube link
and ViralSync allocates a micro-budget through that platform's **official**
ad API (TikTok Spark Ads, Google Ads) to amplify it to real people. No bots,
no click farms — only OAuth-authenticated, paid distribution through the
platform's own auction.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth, credit ledger with Row Level Security)
- Stripe (subscription billing, credit top-ups)

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in Supabase + Stripe keys.
   Leave `TIKTOK_API_KEY` / `GOOGLE_ADS_DEVELOPER_TOKEN` blank until you have
   real, approved developer credentials — see **What's stubbed out** below.
3. Apply the schema in `supabase/migrations/0001_init.sql` to your Supabase
   project (`supabase db push`, or paste it into the SQL editor).
4. `npm run dev`

## Architecture

- `app/page.tsx` — dashboard: paste-a-link input + credit meter + plan picker.
- `lib/supabase/` — `server.ts`/`client.ts` are RLS-scoped clients used for
  normal reads/writes; `admin.ts` is the service-role client, used only by
  the Stripe webhook to top up credits (never imported into client code).
- `supabase/migrations/0001_init.sql` — `users` (Stripe linkage + credit
  balance), `credit_ledger` (append-only audit trail), `campaign_logs`
  (one row per submitted link). All three have RLS enabled; every credit
  spend goes through the `consume_credits()` Postgres function, which
  atomically checks the balance and decrements it so two concurrent
  submissions can't both succeed against a balance that only covers one.
- `app/api/campaigns/route.ts` — the credit gateway. Calls
  `consume_credits()`; if the balance is insufficient it returns
  **402 Payment Required**, per the pay-as-you-go design.
- `lib/distribution.ts` — the *only* code allowed to call a platform's ad
  API. Both clients are typed stubs today (see below).
- `lib/stripe.ts`, `app/api/checkout/route.ts`,
  `app/api/webhooks/stripe/route.ts` — Starter/Pro/Agency subscription
  checkout and webhook-driven credit grants, idempotent on Stripe event id.

## What's stubbed out (and why)

`lib/distribution.ts`'s TikTok and Google Ads clients throw until real
credentials are supplied. Making them real requires, at minimum:

- A verified TikTok Business account + Marketing API app review (Spark Ads
  scope), and each creator OAuth-authorizing their own ad account.
- A Google Ads API developer token (subject to Google's approval process)
  and each creator OAuth-authorizing their own Ads account.
- A funded ad budget — this is real paid spend on real ad platforms, not
  free-tier infrastructure.

None of that exists yet, so no code here can actually place a live ad. The
gateway logic (credit check, 402 handling, campaign logging) is real and
testable independently of those integrations.

## Deploying

Before any production deploy:

1. Confirm Supabase RLS is enabled on all three tables (it is, per the
   migration above — verify after any schema change).
2. Set the env vars from `.env.example` in Vercel.
3. Point the Stripe webhook at `/api/webhooks/stripe` and use its signing
   secret for `STRIPE_WEBHOOK_SECRET`.
4. Keep Stripe in **test mode** and the distribution env vars unset until
   you're ready to take real payments and place real ad spend — both are
   irreversible, user-visible actions worth a deliberate go/no-go.
