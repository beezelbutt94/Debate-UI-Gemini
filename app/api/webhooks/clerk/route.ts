import { headers } from 'next/headers';
import { Webhook } from 'svix';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/events';
import { getStripe } from '@/lib/stripe';
import { PLAN_QUOTA } from '@/lib/plans';

interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

interface ClerkUserData {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserData;
}

function getPrimaryEmail(data: ClerkUserData): string | null {
  const addresses = data.email_addresses ?? [];
  const primary = addresses.find((address) => address.id === data.primary_email_address_id);
  return primary?.email_address ?? addresses[0]?.email_address ?? null;
}

/**
 * Verifies the incoming request really came from Clerk (svix signature over
 * the raw body) and returns the parsed event. Throws on any failure — the
 * caller must never process an unverified payload.
 */
async function verifyClerkWebhook(req: Request): Promise<ClerkWebhookEvent> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('CLERK_WEBHOOK_SECRET is not configured.');
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error('Missing svix headers.');
  }

  const body = await req.text();
  const wh = new Webhook(webhookSecret);

  return wh.verify(body, {
    'svix-id': svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': svixSignature,
  }) as ClerkWebhookEvent;
}

export async function POST(req: Request) {
  let event: ClerkWebhookEvent;
  try {
    event = await verifyClerkWebhook(req);
  } catch (err) {
    await logEvent('warn', 'clerk.webhook_bad_signature', { error: err });
    return new Response('Invalid signature', { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  switch (event.type) {
    case 'user.created': {
      const { id } = event.data;
      const email = getPrimaryEmail(event.data);
      if (!email) {
        console.error(`Clerk user.created for ${id} has no email address.`);
        return new Response('Missing email address', { status: 400 });
      }

      // Upserts that ignore existing rows: the account may already have been
      // created on first use (lib/account.ts), and Clerk retries webhooks.
      const { error: userError } = await supabase
        .from('users')
        .upsert({ id, email }, { onConflict: 'id', ignoreDuplicates: true });
      if (userError) {
        await logEvent('error', 'clerk.user_insert_failed', { userId: id, detail: { code: userError.code } });
        return new Response('Database error inserting user', { status: 500 });
      }

      // A working free plan so a brand-new user can use the product before
      // ever touching Stripe.
      const { error: subError } = await supabase
        .from('subscriptions')
        .upsert(
          { user_id: id, plan_tier: 'free', status: 'active', quota_analyses_limit: PLAN_QUOTA.free },
          { onConflict: 'user_id', ignoreDuplicates: true }
        );
      if (subError) {
        await logEvent('error', 'clerk.subscription_insert_failed', { userId: id, detail: { code: subError.code } });
        return new Response('Database error inserting subscription', { status: 500 });
      }

      await logEvent('info', 'account.created', { userId: id });
      return new Response('OK', { status: 200 });
    }

    case 'user.updated': {
      const { id } = event.data;
      const email = getPrimaryEmail(event.data);
      if (!email) {
        console.error(`Clerk user.updated for ${id} has no email address.`);
        return new Response('Missing email address', { status: 400 });
      }

      const { error } = await supabase
        .from('users')
        .update({ email, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        await logEvent('error', 'clerk.user_update_failed', { userId: id, detail: { code: error.code } });
        return new Response('Database error updating user', { status: 500 });
      }

      return new Response('OK', { status: 200 });
    }

    case 'user.deleted': {
      const { id } = event.data;
      if (!id) {
        console.error('Clerk user.deleted event is missing a user id.');
        return new Response('Missing user id', { status: 400 });
      }

      // Stop billing before the records go: a deleted account must not keep
      // being charged. If Stripe is unreachable, fail so Clerk retries.
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('user_id', id)
        .maybeSingle();
      if (sub?.stripe_subscription_id) {
        try {
          await getStripe().subscriptions.cancel(sub.stripe_subscription_id);
          await logEvent('info', 'billing.canceled_on_account_delete', { userId: id });
        } catch (err) {
          const code = (err as { code?: string }).code;
          if (code !== 'resource_missing') {
            await logEvent('error', 'billing.cancel_on_delete_failed', { userId: id, error: err });
            return new Response('Could not cancel subscription', { status: 500 });
          }
        }
      }

      // subscriptions (and anything else FK'd to users.id) cascades via the
      // existing foreign keys — no manual child-row cleanup here.
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) {
        await logEvent('error', 'clerk.user_delete_failed', { userId: id, detail: { code: error.code } });
        return new Response('Database error deleting user', { status: 500 });
      }

      return new Response('OK', { status: 200 });
    }

    default:
      // Unhandled event types are acknowledged so Clerk doesn't retry them.
      return new Response('OK', { status: 200 });
  }
}
