import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-access';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/events';

/** Admin only: resets a user's usage counter for the current period. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId: adminId } = await auth();
  if (!adminId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  if (!(await isAdmin())) {
    await logEvent('warn', 'admin.forbidden', { userId: adminId, detail: { action: 'reset_usage' } });
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const { id } = await params;
  if (!/^user_[A-Za-z0-9]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid user id.' }, { status: 400 });
  }

  const { data, error } = await createSupabaseAdminClient()
    .from('subscriptions')
    .update({ quota_analyses_used: 0 })
    .eq('user_id', id)
    .select('user_id');

  if (error) {
    await logEvent('error', 'admin.reset_usage_failed', { userId: id, detail: { by: adminId, code: error.code } });
    return NextResponse.json({ error: 'Could not reset usage.' }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'User has no plan record.' }, { status: 404 });
  }

  await logEvent('info', 'admin.reset_usage', { userId: id, detail: { by: adminId } });
  return NextResponse.json({ reset: true }, { status: 200 });
}
