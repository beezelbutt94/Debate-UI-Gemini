import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  PublishError,
  type PublishFailureCode,
  detectPlatform,
  getPublishingClient,
} from '@/lib/publishing';

/**
 * Submit a video to be published to the creator's own account.
 *
 * What a `campaign_logs` row means changed with the move off paid ads. The
 * table and its functions are unchanged -- only the meaning of a row is:
 *
 *   pasted_url          the source video
 *   platform            where it is being published
 *   credits_charged     the cost of the work, not an ad budget
 *   external_campaign_id  the platform's post id, once published
 *
 * Keeping the schema means consume_credits() and fail_campaign_and_refund()
 * keep working exactly as verified -- a rename would have bought nothing and
 * cost a migration plus a re-verification of the money path.
 */

/**
 * How each publishing failure is reported.
 *
 * `not_connected` is the creator's to fix, so it is a 4xx. The rest are the
 * deployment's problem and must not look like the creator did something
 * wrong. `not_reviewed` is 503 rather than 501: the code is fine and the
 * request may simply succeed later, once the platform grants the permission.
 */
const FAILURE_STATUS: Record<PublishFailureCode, number> = {
  not_connected: 409,
  not_configured: 503,
  not_reviewed: 503,
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
    return NextResponse.json({ error: 'malformed_json' }, { status: 400 });
  }

  const payload = body as { url?: unknown; credits?: unknown; caption?: unknown } | null;
  const url = typeof payload?.url === 'string' ? payload.url : null;
  const caption = typeof payload?.caption === 'string' ? payload.caption : '';
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

  const client = getPublishingClient(platform);

  // Establish the post *can* be made before taking anyone's credits. Missing
  // app credentials, a creator who never connected, and a platform
  // permission that has not been granted are all knowable now.
  try {
    await client.preflight(user.id);
  } catch (err) {
    if (err instanceof PublishError) {
      console.error(
        `publish preflight rejected [${err.code}] platform=${platform} user=${user.id}: ${err.message}`
      );
      return NextResponse.json(
        { error: err.code, detail: err.message, remedy: err.remedy, charged: false },
        { status: FAILURE_STATUS[err.code] }
      );
    }
    console.error('publish preflight threw an unexpected error:', err);
    return NextResponse.json(
      { error: 'preflight_failed', detail: (err as Error).message, charged: false },
      { status: 500 }
    );
  }

  // Atomically checks active_credits and decrements it server-side (see
  // consume_credits() in supabase/migrations/0001_init.sql). Any shortfall
  // surfaces as a Postgres exception, which we translate to 402.
  const { data: job, error } = await supabase.rpc('consume_credits', {
    p_amount: credits,
    p_pasted_url: url,
    p_platform: platform,
  });

  if (error) {
    if (error.message.includes('insufficient_credits')) {
      return NextResponse.json({ error: 'insufficient_credits' }, { status: 402 });
    }
    console.error('consume_credits failed:', error.message);
    return NextResponse.json({ error: 'job_creation_failed' }, { status: 500 });
  }

  // Past this point the creator has been charged, so every exit has to
  // either publish or give the credits back.
  try {
    const result = await client.publish({
      userId: user.id,
      platform,
      videoUrl: url,
      caption,
    });

    // Service-role write: campaign_logs has only a SELECT policy (see
    // 0001_init.sql), so the same update through the RLS-scoped client
    // matches zero rows and reports no error -- the row would sit at
    // 'pending' forever even after a successful publish.
    const { error: statusError } = await createSupabaseAdminClient()
      .from('campaign_logs')
      .update({ status: 'completed', external_campaign_id: result.externalPostId })
      .eq('id', job.id);

    if (statusError) {
      // The post is live and the charge was correct; only bookkeeping is
      // behind. Refunding would be wrong, and returning an error invites a
      // retry that double-posts to the creator's account.
      console.error(
        `RECONCILE: job ${job.id} published as ${result.externalPostId} but its status ` +
          `write failed: ${statusError.message}`
      );
      return NextResponse.json(
        {
          campaign: job,
          warning: 'status_write_failed',
          detail:
            'The video was published but its status could not be recorded. ' +
            'Do not resubmit — it is already live.',
          externalPostId: result.externalPostId,
          visibility: result.visibility,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { campaign: { ...job, status: 'completed', external_campaign_id: result.externalPostId },
        visibility: result.visibility },
      { status: 201 }
    );
  } catch (err) {
    const failure =
      err instanceof PublishError
        ? err
        : new PublishError({
            code: 'upstream_error',
            platform,
            message: (err as Error).message,
            remedy: 'Retry; if it persists, check the platform API status.',
          });

    console.error(`job ${job.id} publish failed [${failure.code}]: ${failure.message}`);

    // Compensating transaction: marks the job failed, restores the balance
    // and writes the offsetting ledger entry in one statement (see
    // supabase/migrations/0003_campaign_refund.sql). Idempotent, so a retry
    // cannot double-credit.
    const { error: refundError } = await createSupabaseAdminClient().rpc(
      'fail_campaign_and_refund',
      { p_campaign_id: job.id, p_reason: `${failure.code}: ${failure.message}` }
    );

    if (refundError) {
      // Charged, not delivered, not refunded -- the one unrecoverable path.
      console.error(
        `CREDIT LEAK: job ${job.id} charged ${credits} credits to user ${user.id}, ` +
          `publishing failed, and the refund also failed: ${refundError.message}`
      );
      return NextResponse.json(
        {
          error: 'refund_failed',
          detail:
            'The video could not be published and the automatic credit refund failed. ' +
            'Your credits have not been lost — quote the job id to support.',
          campaignId: job.id,
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
        campaignId: job.id,
        charged: true,
        refunded: true,
      },
      { status: FAILURE_STATUS[failure.code] }
    );
  }
}
