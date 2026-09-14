import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe, planFromPriceId, PLAN_CREDITS } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');
  const payload = await req.text();

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `invalid_signature: ${(err as Error).message}` }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  switch (event.type) {
    case 'checkout.session.completed':
    case 'invoice.paid': {
      const priceId = await resolvePriceId(event);
      const customerId = await resolveCustomerId(event);
      if (!priceId || !customerId) break;

      const plan = planFromPriceId(priceId);
      if (!plan) break;

      const { data: userRow } = await supabase
        .from('users')
        .select('id, active_credits')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();

      if (!userRow) break;

      const grant = PLAN_CREDITS[plan];

      // Idempotent: credit_ledger.stripe_event_id is unique, so a
      // redelivered webhook is a no-op rather than a double top-up.
      const { error: ledgerError } = await supabase.from('credit_ledger').insert({
        user_id: userRow.id,
        delta: grant,
        reason: `stripe_${event.type}_${plan}`,
        stripe_event_id: event.id,
      });

      if (ledgerError) {
        // Unique violation on stripe_event_id means we've already
        // processed this event — treat as success, not an error.
        if (ledgerError.code !== '23505') {
          console.error('credit_ledger insert failed:', ledgerError.message);
          return NextResponse.json({ error: 'ledger_write_failed' }, { status: 500 });
        }
        break;
      }

      await supabase
        .from('users')
        .update({
          plan,
          active_credits: userRow.active_credits + grant,
          stripe_subscription_id: await resolveSubscriptionId(event),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userRow.id);

      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function resolvePriceId(event: Stripe.Event): Promise<string | null> {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    return lineItems.data[0]?.price?.id ?? null;
  }
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    return invoice.lines.data[0]?.price?.id ?? null;
  }
  return null;
}

async function resolveCustomerId(event: Stripe.Event): Promise<string | null> {
  const obj = event.data.object as { customer?: string | Stripe.Customer | null };
  const customer = obj.customer;
  return typeof customer === 'string' ? customer : customer?.id ?? null;
}

async function resolveSubscriptionId(event: Stripe.Event): Promise<string | null> {
  const obj = event.data.object as { subscription?: string | Stripe.Subscription | null };
  const sub = obj.subscription;
  return typeof sub === 'string' ? sub : sub?.id ?? null;
}
