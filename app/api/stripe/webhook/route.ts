import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { resetPaidQuotaPeriod, syncSubscription } from '@/lib/billing';
import { logEvent } from '@/lib/events';

/** Invoice reasons that start a new quota period. */
const NEW_PERIOD_REASONS = new Set<Stripe.Invoice.BillingReason>(['subscription_create', 'subscription_cycle']);

function subscriptionIdOf(value: string | Stripe.Subscription | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    await logEvent('error', 'stripe.webhook_not_configured');
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    await logEvent('warn', 'stripe.webhook_bad_signature', { error: err });
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Dedupe: Stripe retries any non-2xx response and can redeliver an event
  // that already succeeded. Insert first; a primary-key conflict means this
  // event already ran.
  const { error: dedupeError } = await admin.from('stripe_webhook_events').insert({ id: event.id });
  if (dedupeError) {
    if (dedupeError.code === '23505') {
      return NextResponse.json({ received: true, deduped: true }, { status: 200 });
    }
    await logEvent('error', 'stripe.webhook_dedupe_failed', { detail: { eventId: event.id, code: dedupeError.code } });
    return NextResponse.json({ error: 'Could not record webhook event.' }, { status: 500 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = subscriptionIdOf(session.subscription);
        if (session.mode === 'subscription' && subscriptionId) {
          await syncSubscription(subscriptionId, session.client_reference_id);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription.id);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = subscriptionIdOf(invoice.subscription);
        if (subscriptionId) {
          // Sync first so the row exists and holds this subscription id,
          // then start the new period.
          await syncSubscription(subscriptionId);
          if (invoice.billing_reason && NEW_PERIOD_REASONS.has(invoice.billing_reason)) {
            await resetPaidQuotaPeriod(subscriptionId);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = subscriptionIdOf(invoice.subscription);
        await logEvent('warn', 'billing.payment_failed', {
          detail: { invoiceId: invoice.id, subscriptionId, attempt: invoice.attempt_count },
        });
        if (subscriptionId) await syncSubscription(subscriptionId);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    // Forget the event so Stripe's retry actually reprocesses it; without
    // this the retry would be treated as a duplicate and silently dropped.
    await admin.from('stripe_webhook_events').delete().eq('id', event.id);
    await logEvent('error', 'stripe.webhook_handler_failed', {
      detail: { eventId: event.id, type: event.type },
      error: err,
    });
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
