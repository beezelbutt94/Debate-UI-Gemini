import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-02-24.acacia',
});

export type Plan = 'starter' | 'pro' | 'agency';

// Views included per plan; credits are tracked 1 credit = 1 view.
export const PLAN_CREDITS: Record<Plan, number> = {
  starter: 50_000,
  pro: 200_000,
  agency: 1_000_000,
};

// Populate with real Price IDs from the Stripe dashboard/test mode before
// wiring up checkout. Left blank so a misconfiguration fails loudly.
export const PLAN_PRICE_IDS: Record<Plan, string> = {
  starter: process.env.STRIPE_PRICE_STARTER ?? '',
  pro: process.env.STRIPE_PRICE_PRO ?? '',
  agency: process.env.STRIPE_PRICE_AGENCY ?? '',
};

export function planFromPriceId(priceId: string): Plan | null {
  const entry = (Object.entries(PLAN_PRICE_IDS) as [Plan, string][]).find(
    ([, id]) => id && id === priceId
  );
  return entry ? entry[0] : null;
}
