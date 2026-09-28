import { currentUser } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/events';
import { PLAN_QUOTA } from '@/lib/plans';
import type { SubscriptionRow } from '@/lib/types';

/**
 * Makes sure the signed-in user has a `users` row and a free `subscriptions`
 * row. The Clerk `user.created` webhook normally creates both, but if that
 * webhook is not configured, was delayed, or failed, every feature would
 * otherwise fail with a misleading "quota exceeded". Idempotent: both writes
 * are insert-if-missing, so concurrent calls and the webhook cannot
 * duplicate or overwrite anything.
 */
export async function ensureAccount(userId: string): Promise<SubscriptionRow | null> {
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
  if (existing) return existing as SubscriptionRow;

  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    null;
  if (!clerkUser || clerkUser.id !== userId || !email) {
    await logEvent('error', 'account.bootstrap_missing_identity', { userId });
    return null;
  }

  const { error: userError } = await admin
    .from('users')
    .upsert({ id: userId, email }, { onConflict: 'id', ignoreDuplicates: true });
  if (userError) {
    await logEvent('error', 'account.bootstrap_user_failed', { userId, detail: { code: userError.code } });
    return null;
  }

  const { error: subError } = await admin
    .from('subscriptions')
    .upsert(
      { user_id: userId, plan_tier: 'free', status: 'active', quota_analyses_limit: PLAN_QUOTA.free },
      { onConflict: 'user_id', ignoreDuplicates: true }
    );
  if (subError) {
    await logEvent('error', 'account.bootstrap_subscription_failed', { userId, detail: { code: subError.code } });
    return null;
  }

  await logEvent('info', 'account.bootstrapped', { userId });
  const { data: created } = await admin.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
  return (created as SubscriptionRow | null) ?? null;
}
