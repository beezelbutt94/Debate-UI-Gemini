import { createSupabaseServerClient } from '@/lib/supabase/server';
import AuthGate from '@/components/AuthGate';
import Dashboard from '@/components/Dashboard';
import type { CampaignLog, PlatformConnection, UserRow } from '@/lib/types';

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const [{ data: userRow }, { data: campaigns }, { data: connections }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase
      .from('campaign_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('platform_connections').select('platform, external_account_id').eq('user_id', user.id),
  ]);

  return (
    <Dashboard
      user={userRow as UserRow}
      campaigns={(campaigns ?? []) as CampaignLog[]}
      connections={(connections ?? []) as PlatformConnection[]}
    />
  );
}
