import Link from 'next/link';
import { CheckCircle2, CircleAlert, CircleDashed } from 'lucide-react';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { configStatus } from '@/lib/config-status';
import { getPlanPrices } from '@/lib/billing';
import { isEntitledStatus, PLAN_INFO, type PlanTier } from '@/lib/plans';
import { formatDateTime } from '@/lib/report-meta';

export const metadata = { title: 'Admin' };

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
      {hint && <p className="text-[11px] text-neutral-500 mt-1">{hint}</p>}
    </div>
  );
}

async function loadOverview() {
  const admin = createSupabaseAdminClient();
  const since = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
  const head = { count: 'exact' as const, head: true };

  return Promise.all([
    admin.from('users').select('id', head),
    admin.from('users').select('id', head).gte('created_at', since(7)),
    admin.from('subscriptions').select('plan_tier, status, stripe_subscription_id, cancel_at_period_end'),
    admin.from('audit_reports').select('id', head).gte('created_at', since(7)),
    admin.from('scripts').select('id', head).gte('created_at', since(7)),
    admin.from('scheduled_posts').select('id', head).eq('status', 'published').gte('updated_at', since(7)),
    admin.from('scheduled_posts').select('id', head).eq('status', 'failed').gte('updated_at', since(7)),
    admin.from('app_events').select('id', head).eq('level', 'error').gte('created_at', since(1)),
    admin.from('app_events').select('created_at, event, user_id').eq('level', 'error').order('created_at', { ascending: false }).limit(8),
    getPlanPrices().catch(() => []),
  ]);
}

export default async function AdminOverview() {
  const [users, newUsers, subs, reports7, scripts7, published7, failed7, errors24, recentErrors, prices] = await loadOverview();

  // Subscription mix and an estimated MRR from Stripe list prices.
  const byPlan: Record<PlanTier, number> = { free: 0, creator: 0, pro: 0, studio: 0 };
  let pastDue = 0;
  let cancelling = 0;
  let mrrCents = 0;
  let mrrCurrency: string | null = null;
  for (const s of subs.data ?? []) {
    const tier = (s.plan_tier as PlanTier) ?? 'free';
    byPlan[tier] = (byPlan[tier] ?? 0) + 1;
    if (s.status === 'past_due') pastDue++;
    if (s.cancel_at_period_end) cancelling++;
    if (tier !== 'free' && s.stripe_subscription_id && isEntitledStatus(s.status)) {
      const price = prices.find((p) => p.plan === tier);
      if (price?.unitAmount != null) {
        mrrCents += price.interval === 'year' ? price.unitAmount / 12 : price.unitAmount;
        mrrCurrency = price.currency;
      }
    }
  }
  const mrr = mrrCurrency
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: mrrCurrency.toUpperCase() }).format(mrrCents / 100)
    : '—';

  const config = configStatus();
  const loadFailed = [users, subs, recentErrors].some((r) => r.error);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-black">Overview</h1>
        {loadFailed && (
          <p className="text-xs text-rose-300 mt-2">Some figures could not be loaded; check the database configuration below.</p>
        )}
      </header>

      <section aria-labelledby="kpis" className="space-y-3">
        <h2 id="kpis" className="text-xs font-mono uppercase tracking-widest text-neutral-500">
          Users and revenue
        </h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Stat label="Users" value={users.count ?? '—'} hint={`${newUsers.count ?? 0} new in 7 days`} />
          <Stat label="Paying" value={byPlan.creator + byPlan.pro + byPlan.studio} hint={`${cancelling} cancelling · ${pastDue} past due`} />
          <Stat label="Est. MRR" value={mrr} hint="From Stripe list prices; excludes discounts" />
          <Stat label="Errors (24h)" value={errors24.count ?? '—'} hint="See Activity & errors" />
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {(Object.keys(byPlan) as PlanTier[]).map((t) => (
            <Stat key={t} label={`${PLAN_INFO[t].name} plan`} value={byPlan[t]} />
          ))}
        </div>
      </section>

      <section aria-labelledby="usage" className="space-y-3">
        <h2 id="usage" className="text-xs font-mono uppercase tracking-widest text-neutral-500">
          Usage, last 7 days
        </h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Stat label="Reports" value={reports7.count ?? '—'} />
          <Stat label="Scripts" value={scripts7.count ?? '—'} />
          <Stat label="Posts published" value={published7.count ?? '—'} />
          <Stat label="Posts failed" value={failed7.count ?? '—'} />
        </div>
      </section>

      <section aria-labelledby="errors" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="errors" className="text-xs font-mono uppercase tracking-widest text-neutral-500">
            Latest errors
          </h2>
          <Link href="/admin/events?level=error" className="inline-flex items-center min-h-[36px] px-1 text-xs text-amber-400 hover:text-amber-300">
            View all
          </Link>
        </div>
        {(recentErrors.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-neutral-500">No errors recorded.</p>
        ) : (
          <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
            {recentErrors.data!.map((e, i) => (
              <li key={i} className="flex flex-col gap-1 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                <span className="font-mono text-rose-300 break-all">{e.event}</span>
                <span className="text-neutral-500">{formatDateTime(e.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="config" className="space-y-3">
        <h2 id="config" className="text-xs font-mono uppercase tracking-widest text-neutral-500">
          Configuration
        </h2>
        <p className="text-xs text-neutral-500">
          Shows only whether each setting is present in the deployment environment. Values are never displayed.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {config.map((g) => (
            <div key={g.title} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-2">
              <p className="font-bold text-sm">
                {g.title} <span className="font-normal text-neutral-500">· {g.purpose}</span>
              </p>
              <ul className="space-y-1">
                {g.items.map((item) => (
                  <li key={item.name} className="flex items-center gap-2 text-xs font-mono break-all">
                    {item.set ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-label="Set" />
                    ) : item.required ? (
                      <CircleAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-label="Missing (required)" />
                    ) : (
                      <CircleDashed className="w-3.5 h-3.5 text-neutral-600 shrink-0" aria-label="Not set (optional)" />
                    )}
                    <span className={item.set ? 'text-neutral-300' : item.required ? 'text-rose-300' : 'text-neutral-500'}>{item.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
