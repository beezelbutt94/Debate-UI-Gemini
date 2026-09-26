import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { UploadDiagnosticForm } from '@/components/UploadDiagnosticForm';
import { DashboardNav } from '@/components/DashboardNav';
import type { AuditReportRow, SubscriptionRow } from '@/lib/types';

export default async function UploadDiagnosticPage() {
  const { userId } = await auth();
  const admin = createSupabaseAdminClient();

  const [{ data: subscription }, { data: reports }] = await Promise.all([
    admin.from('subscriptions').select('*').eq('user_id', userId!).maybeSingle(),
    admin
      .from('audit_reports')
      .select('*')
      .eq('user_id', userId!)
      .eq('source_type', 'upload')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const sub = subscription as SubscriptionRow | null;
  const pastReports = (reports ?? []) as AuditReportRow[];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-8 text-neutral-100 min-h-screen space-y-8">
      <DashboardNav />
      <div className="border-b border-neutral-800 pb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest">
            Multimodal Video Upload Diagnostic
          </span>
          <h1 className="text-2xl font-black mt-1">What does your raw footage actually show?</h1>
        </div>
        {sub && (
          <span className="text-xs font-mono text-neutral-500">
            {sub.quota_analyses_used}/{sub.quota_analyses_limit} analyses used this period ·{' '}
            <span className="uppercase text-amber-500">{sub.plan_tier}</span>
          </span>
        )}
      </div>

      <UploadDiagnosticForm />

      {pastReports.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-widest text-neutral-500">
            Past diagnostics
          </h2>
          <ul className="space-y-2">
            {pastReports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/dashboard/reports/${r.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs gap-3 hover:border-neutral-600 transition-colors"
                >
                <span className="text-neutral-300 truncate max-w-xs">{r.source_url}</span>
                <span className="font-mono text-amber-400">{Math.round(r.viral_score ?? 0)}/100</span>
              </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
