import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ensureAccount } from '@/lib/account';
import { logEvent } from '@/lib/events';
import { QUOTA_EXCEEDED_MESSAGE } from '@/lib/plans';

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Consumes one analysis from the user's quota (atomic, in SQL). On a refusal
 * it checks whether the account simply does not exist yet (Clerk webhook
 * missed) and, if so, creates it and retries once, so a new user is never
 * told their quota is used up before they have used anything.
 *
 * Returns null when a unit was consumed, or the error response to return.
 */
export async function consumeQuotaOrRespond(admin: Admin, userId: string, feature: string): Promise<NextResponse | null> {
  const attempt = async () => admin.rpc('consume_analysis_quota', { p_user_id: userId });

  let { data: ok, error } = await attempt();
  if (!error && !ok) {
    const { data: sub } = await admin.from('subscriptions').select('user_id').eq('user_id', userId).maybeSingle();
    if (!sub) {
      const created = await ensureAccount(userId);
      if (created) ({ data: ok, error } = await attempt());
    }
  }

  if (error) {
    await logEvent('error', 'quota.consume_failed', { userId, detail: { feature, code: error.code } });
    return NextResponse.json({ error: 'Could not check your usage allowance. Please try again.' }, { status: 503 });
  }
  if (!ok) {
    return NextResponse.json(
      {
        error: QUOTA_EXCEEDED_MESSAGE,
        code: 'quota_exceeded',
      },
      { status: 402 }
    );
  }
  return null;
}

/** Gives back a unit consumed by a request that then failed on our side. */
export async function refundQuota(admin: Admin, userId: string, feature: string): Promise<void> {
  const { error } = await admin.rpc('refund_analysis_quota', { p_user_id: userId });
  if (error) {
    await logEvent('error', 'quota.refund_failed', { userId, detail: { feature, code: error.code } });
  }
}
