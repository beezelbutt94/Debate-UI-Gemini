import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getStripe, PLAN_PRICE_IDS, type PlanTier } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const VALID_PLANS: PlanTier[] = ['creator', 'pro', 'studio'];

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

  const plan = body.plan as PlanTier;
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: `"plan" must be one of ${VALID_PLANS.join(', ')}.` }, { status: 400 });
  }

  const priceId = PLAN_PRICE_IDS[plan];
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for the "${plan}" plan.` },
      { status: 500 }
    );
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not configured.' }, { status: 500 });
  }

  const stripe = getStripe();
  const admin = createSupabaseAdminClient();

  const { data: userRow } = await admin
    .from('users')
    .select('stripe_customer_id, email')
    .eq('id', userId)
    .single();

  let customerId = userRow?.stripe_customer_id ?? null;

  if (!customerId) {
    const user = await currentUser();
    const email = userRow?.email ?? user?.emailAddresses[0]?.emailAddress;

    const customer = await stripe.customers.create({
      email,
      metadata: { clerk_user_id: userId },
    });
    customerId = customer.id;

    const { error: updateError } = await admin
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to persist stripe_customer_id', updateError);
      return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/analyze?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/analyze?checkout=cancelled`,
    client_reference_id: userId,
    subscription_data: { metadata: { clerk_user_id: userId } },
  });

  if (!session.url) {
    return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 502 });
  }

  return NextResponse.json({ url: session.url }, { status: 200 });
}
