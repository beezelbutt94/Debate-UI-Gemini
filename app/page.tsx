import { createSupabaseServerClient } from '@/lib/supabase/server';
import AuthGate from '@/components/AuthGate';
import Dashboard from '@/components/Dashboard';
import type { CampaignLog, UserRow } from '@/lib/types';

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const [{ data: userRow }, { data: campaigns }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase
      .from('campaign_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return (
    <Dashboard
      user={userRow as UserRow}
      campaigns={(campaigns ?? []) as CampaignLog[]}
    />
  );
}
