import { auth } from '@clerk/nextjs/server';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { ManageBillingButton, UpgradeButton } from '@/components/BillingActions';
import { ErrorNotice } from '@/components/ErrorNotice';
import { ensureAccount } from '@/lib/account';
import { getPlanPrices, syncSubscription, type PlanPrice } from '@/lib/billing';
import { getStripe } from '@/lib/stripe';
import { logEvent } from '@/lib/events';
import { isEntitledStatus, PAID_PLANS, PLAN_INFO, PLAN_QUOTA, planRank, type PlanTier } from '@/lib/plans';
import type { SubscriptionRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function nextFreeReset(periodStart: string): string {
  const d = new Date(periodStart);
  d.setMonth(d.getMonth() + 1);
  return formatDate(d.toISOString())!;
}

/**
 * Returning from Checkout: confirm the session belongs to this user and sync
 * the subscription straight from Stripe, so the new plan shows immediately
 * even if the webhook has not arrived yet (or is misconfigured).
 */
async function syncFromCheckout(sessionId: string, userId: string): Promise<'synced' | 'pending' | 'error'> {
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id !== userId) return 'error';
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (!subscriptionId) return 'pending';
    await syncSubscription(subscriptionId, userId);
    return 'synced';
  } catch (err) {
    await logEvent('error', 'billing.checkout_return_sync_failed', { userId, error: err });
    return 'error';
  }
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const { userId } = await auth();
  const { checkout, session_id: sessionId } = await searchParams;

  let checkoutResult: 'synced' | 'pending' | 'error' | null = null;
  if (checkout === 'success' && sessionId && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    checkoutResult = await syncFromCheckout(sessionId, userId!);
  }

  const sub = (await ensureAccount(userId!)) as SubscriptionRow | null;

  let prices: PlanPrice[] = [];
  try {
    prices = await getPlanPrices();
  } catch (err) {
    await logEvent('error', 'billing.prices_failed', { userId, error: err });
  }
  const priceOf = (plan: PlanTier) => prices.find((p) => p.plan === plan)?.display ?? null;
  const billingAvailable = !!process.env.STRIPE_SECRET_KEY;

  if (!sub) {
    return (
      <PageShell eyebrow="Billing" title="Your plan">
        <ErrorNotice message="We couldn't load your account. Please refresh the page; if it keeps happening, contact support." />
      </PageShell>
    );
  }

  const plan = sub.plan_tier as PlanTier;
  const hasPaidSubscription = !!sub.stripe_subscription_id && isEntitledStatus(sub.status);
  const used = sub.quota_analyses_used;
  const limit = sub.quota_analyses_limit;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const renewal = plan === 'free' ? nextFreeReset(sub.quota_period_start) : formatDate(sub.current_period_end);

  return (
    <PageShell
      eyebrow="Billing"
      title="Your plan and usage"
      description="Every tool (analyses, deep-dives, diagnostics, scripts, competitor and discovery reports, calendar generation) uses one analysis from your plan. Failed runs are never counted."
    >
      {checkout === 'success' && checkoutResult !== 'error' && (
        <div role="status" className="flex items-start gap-2 p-4 rounded-xl border border-emerald-900 bg-emerald-950/40 text-emerald-200 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <p>
            {checkoutResult === 'synced'
              ? 'Payment received. Your new plan is active.'
              : 'Payment received. Your plan will update within a minute; refresh this page to see it.'}
          </p>
        </div>
      )}
      {checkout === 'success' && checkoutResult === 'error' && (
        <ErrorNotice message="We couldn't confirm that checkout yet. If you were charged, your plan will update within a few minutes; contact support if it doesn't." />
      )}
      {checkout === 'cancelled' && (
        <div role="status" className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 text-neutral-300 text-sm">
          Checkout was cancelled. You have not been charged.
        </div>
      )}

      <section aria-labelledby="current-plan" className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Current plan</p>
            <h2 id="current-plan" className="text-3xl font-black text-amber-400">
              {PLAN_INFO[plan].name}
            </h2>
            <p className="text-sm text-neutral-400 mt-1">{PLAN_INFO[plan].blurb}</p>
          </div>
          {hasPaidSubscription && billingAvailable && <ManageBillingButton />}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-300">
              {used} of {limit} analyses used
            </span>
            <span className="font-mono text-neutral-500">{Math.max(0, limit - used)} left</span>
          </div>
          <div className="h-2 rounded-full bg-neutral-800 overflow-hidden" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit} aria-label="Analyses used">
            <div className={`h-full ${pct >= 100 ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
          </div>
          {renewal && (
            <p className="text-xs text-neutral-500">
              {sub.cancel_at_period_end
                ? `Your ${PLAN_INFO[plan].name} plan ends on ${renewal}; you'll then move to Free.`
                : plan === 'free'
                  ? `Your free analyses renew on ${renewal}.`
                  : `Renews on ${renewal}, when your analyses reset.`}
            </p>
          )}
        </div>

        {sub.status === 'past_due' && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-900 bg-amber-950/40 text-amber-200 text-xs">
            <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <p>Your last payment failed. Update your card under Manage billing to keep your plan.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="plans" className="space-y-4">
        <h2 id="plans" className="text-xs font-mono uppercase tracking-widest text-neutral-500">
          Plans
        </h2>
        {!billingAvailable && (
          <p className="text-xs text-neutral-500">Paid plans aren&apos;t available yet. You can keep using the Free plan.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(['free', ...PAID_PLANS] as PlanTier[]).map((tier) => {
            const current = tier === plan;
            const price = tier === 'free' ? '$0' : priceOf(tier);
            return (
              <div
                key={tier}
                className={`rounded-2xl border p-5 flex flex-col gap-4 ${current ? 'border-amber-600 bg-amber-950/10' : 'border-neutral-800 bg-neutral-900/40'}`}
              >
                <div>
                  <h3 className="font-black text-lg">{PLAN_INFO[tier].name}</h3>
                  <p className="text-2xl font-black mt-1">{price ?? <span className="text-sm text-neutral-500">Price unavailable</span>}</p>
                  <p className="text-xs text-neutral-400 mt-2">{PLAN_INFO[tier].blurb}</p>
                </div>
                <p className="text-sm text-neutral-200">
                  <span className="font-bold">{PLAN_QUOTA[tier]}</span> analyses / {tier === 'free' ? 'month' : 'billing period'}
                </p>
                <div className="mt-auto">
                  {current ? (
                    <p className="text-xs font-mono text-amber-400 text-center py-2">Your current plan</p>
                  ) : tier === 'free' ? (
                    hasPaidSubscription ? (
                      <p className="text-xs text-neutral-500 text-center">Cancel under Manage billing to return to Free.</p>
                    ) : null
                  ) : hasPaidSubscription ? (
                    billingAvailable && (
                      <ManageBillingButton label={planRank(tier) > planRank(plan) ? 'Upgrade' : 'Switch plan'} />
                    )
                  ) : (
                    <UpgradeButton plan={tier} label={`Choose ${PLAN_INFO[tier].name}`} disabled={!billingAvailable || !price} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-neutral-500">
          Payments are handled by Stripe. You can change plans or cancel at any time from Manage billing; cancelling keeps your
          plan until the end of the period you&apos;ve paid for.
        </p>
      </section>
    </PageShell>
  );
}
