import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { ArrowLeft } from 'lucide-react';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { PageShell } from '@/components/PageShell';
import { StoryboardCard } from '@/components/ScriptGeneratorForm';
import { formatDateTime, UUID_RE } from '@/lib/report-meta';
import type { ScriptRow } from '@/lib/types';

export default async function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const { data } = await createSupabaseAdminClient()
    .from('scripts')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId!)
    .maybeSingle();
  if (!data) notFound();
  const script = data as ScriptRow;

  return (
    <PageShell
      eyebrow="Script"
      title={script.title}
      description={`Saved ${formatDateTime(script.created_at)}`}
      aside={
        <Link href="/dashboard/schedule" className="inline-flex items-center min-h-[36px] text-xs font-mono text-amber-400 hover:text-amber-300">
          Plan it on your calendar
        </Link>
      }
    >
      <Link href="/dashboard/history" className="inline-flex items-center gap-1 min-h-[36px] text-xs text-neutral-400 hover:text-neutral-200">
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> All history
      </Link>
      <StoryboardCard script={script} />
    </PageShell>
  );
}
