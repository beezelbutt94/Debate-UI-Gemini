import type Stripe from 'stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getStripe, planFromPriceId, planPriceIds } from '@/lib/stripe';
import { effectivePlan, isEntitledStatus, PAID_PLANS, PLAN_QUOTA, type PaidPlanTier } from '@/lib/plans';
import { logEvent } from '@/lib/events';

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/**
 * The pinned API version (2025-02-24.acacia) puts current_period_end on the
 * subscription; newer versions moved it onto each item. Read either, and
 * never let a missing value throw.
 */
function periodEndIso(subscription: Stripe.Subscription): string | null {
  const item = subscription.items.data[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const seconds = subscription.current_period_end ?? item?.current_period_end;
  return typeof seconds === 'number' && Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;
}

/** Statuses after which a subscription can never become active again. */
const TERMINAL_STATUSES = new Set(['canceled', 'incomplete_expired']);

async function resolveUserId(admin: Admin, subscription: Stripe.Subscription, hint: string | null): Promise<string | null> {
  if (hint) return hint;
  const fromMetadata = subscription.metadata?.clerk_user_id;
  if (typeof fromMetadata === 'string' && fromMetadata) return fromMetadata;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const { data } = await admin.from('users').select('id').eq('stripe_customer_id', customerId).maybeSingle();
  return data?.id ?? null;
}

/**
 * Brings the `subscriptions` row in line with Stripe. Always re-reads the
 * subscription from Stripe, so webhook events that arrive out of order or
 * are replayed can never apply a stale state.
 *
 * - Entitled (active, trialing, past_due) paid subscription: its tier and
 *   quota limit.
 * - Anything else: the free plan. A terminal subscription (canceled,
 *   incomplete_expired) is detached and the user starts a fresh free
 *   period.
 */
export async function syncSubscription(subscriptionId: string, clerkUserIdHint: string | null = null): Promise<void> {
  const stripe = getStripe();
  const admin = createSupabaseAdminClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const userId = await resolveUserId(admin, subscription, clerkUserIdHint);
  if (!userId) {
    await logEvent('error', 'billing.sync_unknown_user', { detail: { subscriptionId } });
    return;
  }

  const { data: row } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', userId)
    .maybeSingle();

  // A user can briefly have two subscriptions (e.g. an abandoned checkout
  // that later expired). Never let the old one's end downgrade the user
  // off the one that is active.
  if (
    row?.stripe_subscription_id &&
    row.stripe_subscription_id !== subscription.id &&
    isEntitledStatus(row.status) &&
    !isEntitledStatus(subscription.status)
  ) {
    await logEvent('info', 'billing.sync_ignored_stale_subscription', {
      userId,
      detail: { subscriptionId: subscription.id, status: subscription.status },
    });
    return;
  }

  const priceId = subscription.items.data[0]?.price.id ?? null;
  const pricedTier = priceId ? planFromPriceId(priceId) : null;
  if (priceId && !pricedTier) {
    await logEvent('error', 'billing.unknown_price', { userId, detail: { priceId } });
  }
  const plan = effectivePlan(pricedTier, subscription.status);
  const terminal = TERMINAL_STATUSES.has(subscription.status);

  const update: Record<string, unknown> = {
    plan_tier: plan,
    status: subscription.status,
    quota_analyses_limit: PLAN_QUOTA[plan],
    cancel_at_period_end: subscription.cancel_at_period_end === true,
    current_period_end: periodEndIso(subscription),
  };
  if (terminal) {
    Object.assign(update, {
      stripe_subscription_id: null,
      stripe_price_id: null,
      status: 'active',
      cancel_at_period_end: false,
      current_period_end: null,
      quota_analyses_used: 0,
      quota_period_start: new Date().toISOString(),
    });
  } else {
    Object.assign(update, { stripe_subscription_id: subscription.id, stripe_price_id: priceId });
  }

  const { data: updated, error } = await admin
    .from('subscriptions')
    .update(update)
    .eq('user_id', userId)
    .select('user_id');
  if (error) throw new Error(`subscriptions update failed (${error.code})`);
  if (!updated || updated.length === 0) {
    // No row yet (Clerk webhook not processed): create it.
    const { error: insertError } = await admin.from('subscriptions').insert({ user_id: userId, ...update });
    if (insertError) throw new Error(`subscriptions insert failed (${insertError.code})`);
  }

  await logEvent('info', 'billing.synced', {
    userId,
    detail: { subscriptionId: subscription.id, status: subscription.status, plan },
  });
}

/** Starts a new quota period for a paid renewal. */
export async function resetPaidQuotaPeriod(subscriptionId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('subscriptions')
    .update({ quota_analyses_used: 0, quota_period_start: new Date().toISOString() })
    .eq('stripe_subscription_id', subscriptionId);
  if (error) throw new Error(`quota period reset failed (${error.code})`);
}

export interface PlanPrice {
  plan: PaidPlanTier;
  display: string | null; // e.g. "$19/mo"; null when not configured
  unitAmount: number | null; // smallest currency unit
  currency: string | null;
  interval: string | null; // 'month' | 'year' | ...
}

let priceCache: { at: number; prices: PlanPrice[] } | null = null;
const PRICE_CACHE_MS = 10 * 60 * 1000;

function formatPrice(price: Stripe.Price): string | null {
  if (price.unit_amount === null) return null;
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currency.toUpperCase(),
    minimumFractionDigits: price.unit_amount % 100 === 0 ? 0 : 2,
  }).format(price.unit_amount / 100);
  const interval = price.recurring?.interval;
  const suffix = interval === 'year' ? '/yr' : interval === 'month' ? '/mo' : interval ? `/${interval}` : '';
  return `${amount}${suffix}`;
}

/**
 * Display prices for the paid plans, read from Stripe (never hardcoded, so
 * the page always shows what checkout will charge). Never throws: a plan
 * whose price cannot be read shows no price and its buttons stay usable.
 */
export async function getPlanPrices(): Promise<PlanPrice[]> {
  if (priceCache && Date.now() - priceCache.at < PRICE_CACHE_MS) return priceCache.prices;
  const ids = planPriceIds();
  const empty = (plan: PaidPlanTier): PlanPrice => ({ plan, display: null, unitAmount: null, currency: null, interval: null });
  if (!process.env.STRIPE_SECRET_KEY) return PAID_PLANS.map(empty);

  const stripe = getStripe();
  const prices = await Promise.all(
    PAID_PLANS.map(async (plan): Promise<PlanPrice> => {
      if (!ids[plan]) return empty(plan);
      try {
        const price = await stripe.prices.retrieve(ids[plan]);
        return {
          plan,
          display: formatPrice(price),
          unitAmount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring?.interval ?? null,
        };
      } catch (err) {
        await logEvent('warn', 'billing.price_lookup_failed', { detail: { plan }, error: err });
        return empty(plan);
      }
    })
  );
  priceCache = { at: Date.now(), prices };
  return prices;
}
