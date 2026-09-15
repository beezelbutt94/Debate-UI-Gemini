import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  DistributionError,
  type DistributionFailureCode,
  detectPlatform,
  getDistributionClient,
} from '@/lib/distribution';

/**
 * How each distribution failure is reported.
 *
 * `not_connected` is the creator's to fix, so it's a 4xx. The rest are the
 * deployment's problem and must not look like the creator did something
 * wrong — they're 5xx, which also keeps them out of "user error" dashboards
 * and in front of whoever operates the service.
 */
const FAILURE_STATUS: Record<DistributionFailureCode, number> = {
  not_connected: 409,
  not_configured: 503,
  not_implemented: 501,
  upstream_error: 502,
};

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // Distinct from a well-formed body with bad fields, so a client sending
    // broken JSON doesn't go hunting through its field names.
    return NextResponse.json({ error: 'malformed_json' }, { status: 400 });
  }

  const payload = body as { url?: unknown; credits?: unknown } | null;
  const url = typeof payload?.url === 'string' ? payload.url : null;
  const credits = Number(payload?.credits);

  if (!url) {
    return NextResponse.json(
      { error: 'invalid_request', detail: 'url is required and must be a string.' },
      { status: 400 }
    );
  }
  if (!Number.isInteger(credits) || credits <= 0) {
    return NextResponse.json(
      { error: 'invalid_request', detail: 'credits must be a positive integer.' },
      { status: 400 }
    );
  }

  let platform: 'tiktok' | 'youtube';
  try {
    platform = detectPlatform(url);
  } catch (err) {
    return NextResponse.json(
      { error: 'unsupported_url', detail: (err as Error).message },
      { status: 400 }
    );
  }

  const client = getDistributionClient(platform);

  // Establish the campaign *can* be placed before taking anyone's credits.
  // Missing platform credentials and a creator who never connected their ad
  // account are both knowable now, and neither is worth a charge-then-refund
  // round trip.
  try {
    await client.preflight(user.id);
  } catch (err) {
    if (err instanceof DistributionError) {
      console.error(
        `campaign preflight rejected [${err.code}] platform=${platform} user=${user.id}: ${err.message}`
      );
      return NextResponse.json(
        { error: err.code, detail: err.message, remedy: err.remedy, charged: false },
        { status: FAILURE_STATUS[err.code] }
      );
    }
    console.error('campaign preflight threw an unexpected error:', err);
    return NextResponse.json(
      {
        error: 'preflight_failed',
        detail: (err as Error).message,
        charged: false,
      },
      { status: 500 }
    );
  }

  // Atomically checks active_credits and decrements it server-side (see
  // consume_credits() in supabase/migrations/0001_init.sql). Any shortfall
  // surfaces as a Postgres exception, which we translate to 402.
  const { data: campaign, error } = await supabase.rpc('consume_credits', {
    p_amount: credits,
    p_pasted_url: url,
    p_platform: platform,
  });

  if (error) {
    if (error.message.includes('insufficient_credits')) {
      return NextResponse.json({ error: 'insufficient_credits' }, { status: 402 });
    }
    console.error('consume_credits failed:', error.message);
    return NextResponse.json({ error: 'campaign_creation_failed' }, { status: 500 });
  }

  // Past this point the creator has been charged, so every exit has to
  // either place the campaign or give the credits back.
  try {
    const result = await client.amplify({
      userId: user.id,
      platform,
      contentUrl: url,
      budgetMicros: credits,
    });

    // Service-role write: campaign_logs has only a SELECT policy (see
    // 0001_init.sql), so the same update through the RLS-scoped client
    // matches zero rows and reports no error — the campaign would sit at
    // 'pending' forever even after a successful amplify().
    const { error: statusError } = await createSupabaseAdminClient()
      .from('campaign_logs')
      .update({ status: result.status, external_campaign_id: result.externalCampaignId })
      .eq('id', campaign.id);

    if (statusError) {
      // The ad is live and the creator was charged correctly; only our
      // bookkeeping is behind. Refunding would be wrong and returning an
      // error invites a retry that double-spends their ad budget, so this
      // reports success with the discrepancy named explicitly.
      console.error(
        `RECONCILE: campaign ${campaign.id} is live as ${result.externalCampaignId} but its ` +
          `status write failed: ${statusError.message}`
      );
      return NextResponse.json(
        {
          campaign,
          warning: 'status_write_failed',
          detail:
            'The campaign was placed successfully but its status could not be recorded. ' +
            'Do not resubmit — it is already running.',
          externalCampaignId: result.externalCampaignId,
        },
        { status: 201 }
      );
    }

    return NextResponse.json({ campaign: { ...campaign, ...result } }, { status: 201 });
  } catch (err) {
    const failure =
      err instanceof DistributionError
        ? err
        : new DistributionError({
            code: 'upstream_error',
            platform,
            message: (err as Error).message,
            remedy: 'Retry; if it persists, check the platform API status.',
          });

    console.error(
      `campaign ${campaign.id} amplification failed [${failure.code}]: ${failure.message}`
    );

    // Compensating transaction: marks the campaign failed, restores the
    // balance and writes the offsetting ledger entry in one statement (see
    // supabase/migrations/0003_campaign_refund.sql). Idempotent, so a retry
    // can't double-credit.
    const { error: refundError } = await createSupabaseAdminClient().rpc(
      'fail_campaign_and_refund',
      { p_campaign_id: campaign.id, p_reason: `${failure.code}: ${failure.message}` }
    );

    if (refundError) {
      // The only genuinely unrecoverable path: charged, not delivered, not
      // refunded. Loud enough to alert on, and the response tells the
      // creator exactly what to quote to support.
      console.error(
        `CREDIT LEAK: campaign ${campaign.id} charged ${credits} credits to user ${user.id}, ` +
          `amplification failed, and the refund also failed: ${refundError.message}`
      );
      return NextResponse.json(
        {
          error: 'refund_failed',
          detail:
            'The campaign could not be placed and the automatic credit refund failed. ' +
            'Your credits have not been lost — quote the campaign id to support.',
          campaignId: campaign.id,
          charged: true,
          refunded: false,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: failure.code,
        detail: failure.message,
        remedy: failure.remedy,
        campaignId: campaign.id,
        charged: true,
        refunded: true,
      },
      { status: FAILURE_STATUS[failure.code] }
    );
  }
}
