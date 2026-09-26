import Stripe from 'stripe';
import { ConfigurationError } from '@/lib/errors';
import type { PaidPlanTier } from '@/lib/plans';

let cached: Stripe | null = null;

/**
 * Lazily constructed so importing this module (which happens at build
 * time, e.g. Next.js collecting route configs) never requires
 * STRIPE_SECRET_KEY to be set. The clear failure happens on first real
 * use instead, which is when it's actually actionable.
 */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new ConfigurationError('STRIPE_SECRET_KEY');
  }
  if (!cached) {
    // STRIPE_API_BASE points the SDK at stripe-mock for local testing
    // (e.g. http://localhost:12111). Leave it unset in every deployment.
    const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
    cached = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
      ...(base && {
        host: base.hostname,
        port: base.port ? Number(base.port) : undefined,
        protocol: base.protocol === 'http:' ? 'http' : 'https',
      }),
    });
  }
  return cached;
}

export { PLAN_QUOTA, type PlanTier, type PaidPlanTier } from '@/lib/plans';

/**
 * Stripe price ids for the paid plans, from the environment. Read on each
 * call rather than at import so a changed env var is picked up without a
 * rebuild in environments that inject variables at runtime.
 */
export function planPriceIds(): Record<PaidPlanTier, string> {
  return {
    creator: process.env.STRIPE_PRICE_CREATOR ?? '',
    pro: process.env.STRIPE_PRICE_PRO ?? '',
    studio: process.env.STRIPE_PRICE_STUDIO ?? '',
  };
}

export function priceIdFor(plan: PaidPlanTier): string {
  const id = planPriceIds()[plan];
  if (!id) throw new ConfigurationError(`STRIPE_PRICE_${plan.toUpperCase()}`);
  return id;
}

export function planFromPriceId(priceId: string): PaidPlanTier | null {
  const entry = (Object.entries(planPriceIds()) as [PaidPlanTier, string][]).find(([, id]) => id && id === priceId);
  return entry ? entry[0] : null;
}
