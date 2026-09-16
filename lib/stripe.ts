import Stripe from 'stripe';

let cached: Stripe | null = null;

/**
 * Lazily constructed so importing this module (which happens at build
 * time, e.g. Next.js collecting route configs) never requires
 * STRIPE_SECRET_KEY to be set. The clear failure happens on first real
 * use instead, which is when it's actually actionable.
 */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  if (!cached) {
    cached = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
  }
  return cached;
}

export type PlanTier = 'creator' | 'pro' | 'studio';

export const PLAN_QUOTA: Record<PlanTier, number> = {
  creator: 10,
  pro: 50,
  studio: 200,
};

// Real Stripe test-mode price IDs, created via the Stripe MCP server under
// the "Peshets sandbox" account (acct_1UFaOJGZbTaqS7W8). Populate the env
// vars from .env.example with these (or your own account's equivalents)
// before wiring up checkout in a different Stripe account.
export const PLAN_PRICE_IDS: Record<PlanTier, string> = {
  creator: process.env.STRIPE_PRICE_CREATOR ?? '',
  pro: process.env.STRIPE_PRICE_PRO ?? '',
  studio: process.env.STRIPE_PRICE_STUDIO ?? '',
};

export function planFromPriceId(priceId: string): PlanTier | null {
  const entry = (Object.entries(PLAN_PRICE_IDS) as [PlanTier, string][]).find(
    ([, id]) => id && id === priceId
  );
  return entry ? entry[0] : null;
}
