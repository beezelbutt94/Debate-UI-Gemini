import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { AnalyzerForm } from '@/components/AnalyzerForm';
import type { AuditReportRow, SubscriptionRow } from '@/lib/types';

export default async function AnalyzePage() {
  const { userId } = await auth();
  const admin = createSupabaseAdminClient();

  // Reads use the service-role client with an explicit user_id filter
  // rather than the RLS-scoped client in lib/supabase/server.ts: RLS here
  // depends on Clerk being wired up as a Supabase "Third Party Auth"
  // provider in the Supabase dashboard (a manual, one-time step — see
  // README), and this page needs to work correctly before that step is
  // done. The explicit .eq('user_id', userId) below is scoped from a
  // Clerk-verified server-side userId, so it's equivalently safe.
  const [{ data: subscription }, { data: reports }] = await Promise.all([
    admin.from('subscriptions').select('*').eq('user_id', userId!).single(),
    admin
      .from('audit_reports')
      .select('*')
      .eq('user_id', userId!)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const sub = subscription as SubscriptionRow | null;
  const pastReports = (reports ?? []) as AuditReportRow[];

  return (
    <div className="max-w-4xl mx-auto p-8 text-neutral-100 min-h-screen space-y-8">
      <div className="border-b border-neutral-800 pb-6 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest">
            Viral Gap Analyzer
          </span>
          <h1 className="text-2xl font-black mt-1">What&apos;s missing for virality?</h1>
        </div>
        {sub && (
          <span className="text-xs font-mono text-neutral-500">
            {sub.quota_analyses_used}/{sub.quota_analyses_limit} analyses used this period ·{' '}
            <span className="uppercase text-amber-500">{sub.plan_tier}</span>
          </span>
        )}
      </div>

      <AnalyzerForm />

      {pastReports.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-widest text-neutral-500">
            Past analyses
          </h2>
          <ul className="space-y-2">
            {pastReports.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs"
              >
                <span className="text-neutral-300 truncate max-w-xs">{r.source_url}</span>
                <span className="font-mono text-amber-400">{Math.round(r.viral_score ?? 0)}/100</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
