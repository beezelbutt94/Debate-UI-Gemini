import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SiteDiscoveryForm } from '@/components/SiteDiscoveryForm';
import { DashboardNav } from '@/components/DashboardNav';
import type { AuditReportRow, SiteDiscoveryResult, SubscriptionRow } from '@/lib/types';

export default async function DiscoverPage() {
  const { userId } = await auth();
  const admin = createSupabaseAdminClient();

  const [{ data: subscription }, { data: reports }] = await Promise.all([
    admin.from('subscriptions').select('*').eq('user_id', userId!).single(),
    admin
      .from('audit_reports')
      .select('*')
      .eq('user_id', userId!)
      .eq('source_type', 'discovery')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const sub = subscription as SubscriptionRow | null;
  const pastReports = (reports ?? []) as AuditReportRow<SiteDiscoveryResult>[];

  return (
    <div className="max-w-4xl mx-auto p-8 text-neutral-100 min-h-screen space-y-8">
      <DashboardNav />
      <div className="border-b border-neutral-800 pb-6 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest">
            Web Discovery
          </span>
          <h1 className="text-2xl font-black mt-1">Tell it what you need. It scans the web for you.</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Real search results, ranked to a top 10, with the one that stands out from the rest called
            out and explained.
          </p>
        </div>
        {sub && (
          <span className="text-xs font-mono text-neutral-500">
            {sub.quota_analyses_used}/{sub.quota_analyses_limit} analyses used this period ·{' '}
            <span className="uppercase text-amber-500">{sub.plan_tier}</span>
          </span>
        )}
      </div>

      <SiteDiscoveryForm />

      {pastReports.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-widest text-neutral-500">
            Past searches
          </h2>
          <ul className="space-y-2">
            {pastReports.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs"
              >
                <span className="text-neutral-300">&quot;{r.analysis.query}&quot;</span>
                <span className="font-mono text-neutral-500">{new Date(r.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
