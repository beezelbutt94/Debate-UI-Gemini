import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/events';
import { errorStatus, publicErrorMessage } from '@/lib/errors';
import { appOrigin } from '@/lib/url';

/**
 * Opens the Stripe customer portal, where the user upgrades, downgrades,
 * cancels, updates their card and downloads invoices. Changes made there
 * come back through the Stripe webhook.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: userRow } = await admin.from('users').select('stripe_customer_id').eq('id', userId).maybeSingle();
  if (!userRow?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'You have no billing account yet. Choose a plan first.', code: 'no_customer' },
      { status: 400 }
    );
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: userRow.stripe_customer_id,
      return_url: `${appOrigin(request)}/dashboard/billing`,
    });
    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    await logEvent('error', 'billing.portal_failed', { userId, error: err });
    return NextResponse.json(
      {
        error: publicErrorMessage(
          err,
          'Could not open billing management. Please try again, or contact support if it keeps failing.'
        ),
      },
      { status: errorStatus(err) }
    );
  }
}
