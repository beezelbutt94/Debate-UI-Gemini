import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, planFromPriceId, PLAN_QUOTA } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured.');
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Dedupe: Stripe retries any non-2xx response, and can also redeliver
  // an already-succeeded event. Insert first; a primary-key conflict
  // means this event already ran, so skip reprocessing but still 200.
  const { error: dedupeError } = await admin
    .from('stripe_webhook_events')
    .insert({ id: event.id });

  if (dedupeError) {
    if (dedupeError.code === '23505') {
      return NextResponse.json({ received: true, deduped: true }, { status: 200 });
    }
    console.error('stripe_webhook_events insert failed', dedupeError);
    return NextResponse.json({ error: 'Could not record webhook event.' }, { status: 500 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          await syncSubscription(admin, stripe, session.subscription as string, session.client_reference_id);
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(admin, stripe, subscription.id, null, subscription);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Stripe webhook handler failed for event ${event.id} (${event.type})`, err);
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function syncSubscription(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  stripe: Stripe,
  subscriptionId: string,
  clerkUserIdHint: string | null,
  preloaded?: Stripe.Subscription
) {
  const subscription = preloaded ?? (await stripe.subscriptions.retrieve(subscriptionId));

  const clerkUserId =
    clerkUserIdHint ??
    (subscription.metadata?.clerk_user_id as string | undefined) ??
    null;

  if (!clerkUserId) {
    console.error(`Subscription ${subscription.id} has no clerk_user_id metadata; cannot sync.`);
    return;
  }

  const priceId = subscription.items.data[0]?.price.id ?? null;
  const planTier = priceId ? planFromPriceId(priceId) : null;

  const { error } = await admin
    .from('subscriptions')
    .update({
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan_tier: planTier ?? 'creator',
      status: subscription.status,
      quota_analyses_limit: planTier ? PLAN_QUOTA[planTier] : undefined,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq('user_id', clerkUserId);

  if (error) {
    console.error(`Failed to sync subscription for user ${clerkUserId}`, error);
    throw error;
  }
}
