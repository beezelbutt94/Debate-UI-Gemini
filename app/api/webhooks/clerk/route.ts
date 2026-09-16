import { headers } from 'next/headers';
import { Webhook } from 'svix';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

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
    console.error('Clerk webhook verification failed:', err);
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

      const { error: userError } = await supabase.from('users').insert({
        id,
        email,
      });
      if (userError) {
        console.error(`Failed to insert users row for ${id}:`, userError);
        return new Response('Database error inserting user', { status: 500 });
      }

      // A working free default so a brand-new user can use the product
      // before ever touching Stripe.
      const { error: subError } = await supabase.from('subscriptions').insert({
        user_id: id,
        plan_tier: 'creator',
        status: 'active',
        quota_analyses_limit: 10,
      });
      if (subError) {
        console.error(`Failed to insert subscriptions row for ${id}:`, subError);
        return new Response('Database error inserting subscription', { status: 500 });
      }

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
        console.error(`Failed to update users row for ${id}:`, error);
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

      // subscriptions (and anything else FK'd to users.id) cascades via the
      // existing foreign keys — no manual child-row cleanup here.
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) {
        console.error(`Failed to delete users row for ${id}:`, error);
        return new Response('Database error deleting user', { status: 500 });
      }

      return new Response('OK', { status: 200 });
    }

    default:
      // Unhandled event types are acknowledged so Clerk doesn't retry them.
      return new Response('OK', { status: 200 });
  }
}
