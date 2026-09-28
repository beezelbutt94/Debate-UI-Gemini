/**
 * Plan catalogue and subscription-state rules. Pure: no framework or SDK
 * imports, so it runs in unit tests (tests/unit) and on the client.
 */

export type PlanTier = 'free' | 'creator' | 'pro' | 'studio';
export type PaidPlanTier = Exclude<PlanTier, 'free'>;

export const PAID_PLANS: PaidPlanTier[] = ['creator', 'pro', 'studio'];

/** Analyses (any AI feature run) included per quota period. */
export const PLAN_QUOTA: Record<PlanTier, number> = {
  free: 3,
  creator: 10,
  pro: 50,
  studio: 200,
};

export const PLAN_INFO: Record<PlanTier, { name: string; blurb: string }> = {
  free: { name: 'Free', blurb: 'Try every tool. Renews monthly.' },
  creator: { name: 'Creator', blurb: 'For a creator posting a few times a week.' },
  pro: { name: 'Pro', blurb: 'Daily posting across several platforms.' },
  studio: { name: 'Studio', blurb: 'Teams and agencies running many accounts.' },
};

/**
 * Stripe subscription statuses that keep paid features. `past_due` stays
 * entitled while Stripe retries the card (Smart Retries), matching Stripe's
 * own guidance; `unpaid`, `canceled`, `incomplete` and
 * `incomplete_expired` fall back to the free plan.
 */
const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due']);

export function isEntitledStatus(status: string | null | undefined): boolean {
  return !!status && ENTITLED_STATUSES.has(status);
}

export function isPaidPlan(tier: string | null | undefined): tier is PaidPlanTier {
  return PAID_PLANS.includes(tier as PaidPlanTier);
}

/**
 * The plan a Stripe subscription actually entitles its owner to: the paid
 * tier while its status is entitled, otherwise free.
 */
export function effectivePlan(pricedTier: PaidPlanTier | null, status: string | null | undefined): PlanTier {
  return pricedTier && isEntitledStatus(status) ? pricedTier : 'free';
}

export function planRank(tier: PlanTier): number {
  return ['free', 'creator', 'pro', 'studio'].indexOf(tier);
}

/**
 * The exact message the API returns when a quota is used up. Shared so the
 * UI can recognise it and offer an upgrade link (components/ErrorNotice).
 */
export const QUOTA_EXCEEDED_MESSAGE =
  "You've used all the analyses included in your plan for this period. Upgrade on the Billing page for more.";
