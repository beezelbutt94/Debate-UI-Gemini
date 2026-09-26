import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getStripe, priceIdFor } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ensureAccount } from '@/lib/account';
import { logEvent } from '@/lib/events';
import { errorStatus, publicErrorMessage } from '@/lib/errors';
import { appOrigin } from '@/lib/url';
import { isEntitledStatus, isPaidPlan, PAID_PLANS } from '@/lib/plans';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: { plan?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const plan = body?.plan;
  if (typeof plan !== 'string' || !isPaidPlan(plan)) {
    return NextResponse.json({ error: `Choose a plan: ${PAID_PLANS.join(', ')}.` }, { status: 400 });
  }

  try {
    const priceId = priceIdFor(plan);
    const stripe = getStripe();
    const admin = createSupabaseAdminClient();

    const subscription = await ensureAccount(userId);
    if (!subscription) {
      return NextResponse.json({ error: 'Your account is still being set up. Please try again in a moment.' }, { status: 503 });
    }

    // One subscription per user: an existing paid plan changes through the
    // billing portal (upgrade, downgrade, cancel) instead of a second
    // checkout that would bill twice.
    if (subscription.stripe_subscription_id && isEntitledStatus(subscription.status)) {
      return NextResponse.json(
        { error: 'You already have a paid plan. Use "Manage billing" to change or cancel it.', code: 'has_subscription' },
        { status: 409 }
      );
    }

    const { data: userRow } = await admin
      .from('users')
      .select('stripe_customer_id, email')
      .eq('id', userId)
      .maybeSingle();

    let customerId = userRow?.stripe_customer_id ?? null;
    if (!customerId) {
      const user = await currentUser();
      const email = userRow?.email ?? user?.emailAddresses[0]?.emailAddress;
      // The idempotency key makes a double-clicked upgrade reuse one
      // customer instead of creating two.
      const customer = await stripe.customers.create(
        { email, metadata: { clerk_user_id: userId } },
        { idempotencyKey: `customer-create-${userId}` }
      );

      // Only set it if still empty; if a concurrent request won, use theirs.
      const { data: saved } = await admin
        .from('users')
        .update({ stripe_customer_id: customer.id })
        .eq('id', userId)
        .is('stripe_customer_id', null)
        .select('stripe_customer_id');
      if (saved && saved.length > 0) {
        customerId = customer.id;
      } else {
        const { data: again } = await admin.from('users').select('stripe_customer_id').eq('id', userId).maybeSingle();
        customerId = again?.stripe_customer_id ?? null;
      }
      if (!customerId) {
        await logEvent('error', 'billing.customer_persist_failed', { userId });
        return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
      }
    }

    const origin = appOrigin(request);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${origin}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/billing?checkout=cancelled`,
      client_reference_id: userId,
      subscription_data: { metadata: { clerk_user_id: userId } },
    });

    if (!session.url) {
      await logEvent('error', 'billing.checkout_no_url', { userId });
      return NextResponse.json({ error: 'Stripe did not return a checkout page. Please try again.' }, { status: 502 });
    }

    await logEvent('info', 'billing.checkout_started', { userId, detail: { plan } });
    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    await logEvent('error', 'billing.checkout_failed', { userId, detail: { plan }, error: err });
    return NextResponse.json(
      { error: publicErrorMessage(err, 'Could not start checkout. Please try again.') },
      { status: errorStatus(err) }
    );
  }
}
