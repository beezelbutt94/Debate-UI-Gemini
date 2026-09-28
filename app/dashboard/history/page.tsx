import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { FileText, ScrollText } from 'lucide-react';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { PageShell } from '@/components/PageShell';
import { ErrorNotice } from '@/components/ErrorNotice';
import { formatDateTime, REPORT_KINDS } from '@/lib/report-meta';

export const dynamic = 'force-dynamic';

interface Entry {
  href: string;
  kind: string;
  title: string;
  score: number | null;
  createdAt: string;
  script: boolean;
}

export default async function HistoryPage() {
  const { userId } = await auth();
  const admin = createSupabaseAdminClient();

  // Only the columns the list needs; the full reports load on their own pages.
  const [reports, scripts] = await Promise.all([
    admin
      .from('audit_reports')
      .select('id, source_type, source_url, viral_score, created_at')
      .eq('user_id', userId!)
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('scripts')
      .select('id, title, target_platform, created_at')
      .eq('user_id', userId!)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const failed = !!(reports.error || scripts.error);

  const entries: Entry[] = [
    ...(reports.data ?? []).map((r) => ({
      href: `/dashboard/reports/${r.id}`,
      kind: REPORT_KINDS[r.source_type]?.label ?? 'Report',
      title: r.source_url ?? REPORT_KINDS[r.source_type]?.label ?? 'Report',
      score: r.viral_score === null ? null : Math.round(Number(r.viral_score)),
      createdAt: r.created_at,
      script: false,
    })),
    ...(scripts.data ?? []).map((s) => ({
      href: `/dashboard/scripts/${s.id}`,
      kind: 'Script',
      title: s.title,
      score: null,
      createdAt: s.created_at,
      script: true,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <PageShell eyebrow="History" title="Everything you've created" description="Reports and scripts are saved automatically. Open any of them again here.">
      {failed && <ErrorNotice message="Some of your history couldn't be loaded. Please refresh the page." />}

      {entries.length === 0 && !failed ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-sm text-neutral-400">Nothing here yet.</p>
          <Link
            href="/dashboard/analyze"
            className="inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-neutral-950 hover:bg-amber-400"
          >
            Analyze your first video
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.href}>
              <Link
                href={e.href}
                className="flex items-center gap-3 p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 hover:border-neutral-600 transition-colors"
              >
                {e.script ? (
                  <ScrollText className="w-4 h-4 text-neutral-500 shrink-0" aria-hidden />
                ) : (
                  <FileText className="w-4 h-4 text-neutral-500 shrink-0" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-neutral-200 truncate">{e.title}</p>
                  <p className="text-[11px] text-neutral-500">
                    {e.kind} · {formatDateTime(e.createdAt)}
                  </p>
                </div>
                {e.score !== null && <span className="font-mono text-sm text-amber-400 shrink-0">{e.score}/100</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
