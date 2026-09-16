import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ScriptGeneratorForm } from '@/components/ScriptGeneratorForm';
import { DashboardNav } from '@/components/DashboardNav';
import type { ScriptRow, SubscriptionRow } from '@/lib/types';

export default async function ScriptGeneratorPage() {
  const { userId } = await auth();
  const admin = createSupabaseAdminClient();

  const [{ data: subscription }, { data: scripts }] = await Promise.all([
    admin.from('subscriptions').select('*').eq('user_id', userId!).single(),
    admin
      .from('scripts')
      .select('*')
      .eq('user_id', userId!)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const sub = subscription as SubscriptionRow | null;
  const pastScripts = (scripts ?? []) as ScriptRow[];

  return (
    <div className="max-w-4xl mx-auto p-8 text-neutral-100 min-h-screen space-y-8">
      <DashboardNav />
      <div className="border-b border-neutral-800 pb-6 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest">
            Script &amp; Storyboard Generator
          </span>
          <h1 className="text-2xl font-black mt-1">Turn a prompt into a scene-by-scene script</h1>
        </div>
        {sub && (
          <span className="text-xs font-mono text-neutral-500">
            {sub.quota_analyses_used}/{sub.quota_analyses_limit} analyses used this period ·{' '}
            <span className="uppercase text-amber-500">{sub.plan_tier}</span>
          </span>
        )}
      </div>

      <ScriptGeneratorForm />

      {pastScripts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-widest text-neutral-500">
            Past scripts
          </h2>
          <ul className="space-y-2">
            {pastScripts.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs"
              >
                <span className="text-neutral-300 truncate max-w-xs">{s.title}</span>
                <span className="font-mono text-neutral-500 uppercase">{s.target_platform ?? 'any'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
