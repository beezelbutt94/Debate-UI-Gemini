import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ensureAccount } from '@/lib/account';
import { PageShell } from '@/components/PageShell';
import { ErrorNotice } from '@/components/ErrorNotice';
import { PLAN_INFO, type PlanTier } from '@/lib/plans';
import { formatDateTime, REPORT_KINDS } from '@/lib/report-meta';

export const dynamic = 'force-dynamic';

const TOOLS = [
  { href: '/dashboard/analyze', title: 'Viral Gap Analyzer', body: 'Score any TikTok, Short or Reel link against viral benchmarks.' },
  { href: '/dashboard/deep-dive', title: 'Account Deep-Dive', body: 'A growth blueprint for your whole account.' },
  { href: '/dashboard/upload', title: 'Upload Diagnostic', body: 'Check a draft video before you post it.' },
  { href: '/dashboard/script', title: 'Script Generator', body: 'Scene-by-scene storyboards in your voice.' },
  { href: '/dashboard/competitors', title: 'Competitor Espionage', body: 'Find the gaps your competitors leave open.' },
  { href: '/dashboard/discover', title: 'Web Discovery', body: 'Sites and tools that fit what you need.' },
  { href: '/dashboard/tools', title: 'Tool Suite Hub', body: 'Next steps drawn from your own reports.' },
  { href: '/dashboard/schedule', title: 'Schedule', body: 'Plan the week and auto-publish to your accounts.' },
];

export default async function DashboardHome() {
  const { userId } = await auth();
  const admin = createSupabaseAdminClient();
  const sub = await ensureAccount(userId!);

  const count = (table: string) =>
    admin.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId!);

  const [reports, scripts, connections, scheduled, recent] = await Promise.all([
    count('audit_reports'),
    count('scripts'),
    count('platform_connections'),
    admin
      .from('scheduled_posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId!)
      .in('status', ['scheduled', 'published']),
    admin
      .from('audit_reports')
      .select('id, source_type, source_url, viral_score, created_at')
      .eq('user_id', userId!)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const steps = [
    { done: (reports.count ?? 0) > 0, label: 'Analyze a video', href: '/dashboard/analyze' },
    { done: (scripts.count ?? 0) > 0, label: 'Generate a script', href: '/dashboard/script' },
    { done: (connections.count ?? 0) > 0, label: 'Connect a publishing account', href: '/dashboard/settings/connections' },
    { done: (scheduled.count ?? 0) > 0, label: 'Schedule your first post', href: '/dashboard/schedule' },
  ];
  const remaining = steps.filter((s) => !s.done).length;
  const plan = (sub?.plan_tier ?? 'free') as PlanTier;

  return (
    <PageShell
      eyebrow="Dashboard"
      title="Welcome back"
      aside={
        sub && (
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 px-3 py-2 text-xs font-mono text-neutral-300 hover:border-neutral-600"
          >
            <span className="uppercase text-amber-400">{PLAN_INFO[plan].name}</span>
            {sub.quota_analyses_used}/{sub.quota_analyses_limit} used
          </Link>
        )
      }
    >
      {!sub && <ErrorNotice message="We couldn't finish setting up your account. Please refresh; if this persists, contact support." />}

      {remaining > 0 && (
        <section aria-labelledby="getting-started" className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3">
          <h2 id="getting-started" className="text-sm font-bold">
            Getting started <span className="text-neutral-500 font-normal">· {steps.length - remaining} of {steps.length} done</span>
          </h2>
          <ol className="grid gap-2 sm:grid-cols-2">
            {steps.map((s) => (
              <li key={s.label}>
                <Link
                  href={s.href}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-neutral-900"
                >
                  {s.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-label="Done" />
                  ) : (
                    <Circle className="w-4 h-4 text-neutral-600 shrink-0" aria-label="Not done" />
                  )}
                  <span className={s.done ? 'text-neutral-500 line-through' : 'text-neutral-200'}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="tools" className="space-y-3">
        <h2 id="tools" className="text-xs font-mono uppercase tracking-widest text-neutral-500">
          Tools
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hover:border-neutral-600 transition-colors"
            >
              <p className="font-bold text-sm flex items-center justify-between">
                {t.title}
                <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-amber-400" aria-hidden />
              </p>
              <p className="text-xs text-neutral-400 mt-1">{t.body}</p>
            </Link>
          ))}
        </div>
      </section>

      {(recent.data?.length ?? 0) > 0 && (
        <section aria-labelledby="recent" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="recent" className="text-xs font-mono uppercase tracking-widest text-neutral-500">
              Recent reports
            </h2>
            <Link href="/dashboard/history" className="inline-flex items-center min-h-[36px] px-1 text-xs text-amber-400 hover:text-amber-300">
              View all
            </Link>
          </div>
          <ul className="space-y-2">
            {recent.data!.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/dashboard/reports/${r.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 hover:border-neutral-600"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-neutral-200 truncate">{r.source_url ?? REPORT_KINDS[r.source_type]?.label}</p>
                    <p className="text-[11px] text-neutral-500">
                      {REPORT_KINDS[r.source_type]?.label ?? 'Report'} · {formatDateTime(r.created_at)}
                    </p>
                  </div>
                  {r.viral_score !== null && (
                    <span className="font-mono text-sm text-amber-400">{Math.round(Number(r.viral_score))}/100</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}
