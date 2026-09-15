import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { detectPlatform, getDistributionClient } from '@/lib/distribution';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === 'string' ? body.url : null;
  const credits = Number(body?.credits);

  if (!url || !Number.isFinite(credits) || credits <= 0) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  let platform: 'tiktok' | 'youtube';
  try {
    platform = detectPlatform(url);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
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
    return NextResponse.json({ error: 'campaign_creation_failed' }, { status: 500 });
  }

  // Best-effort: hand off to the compliant distribution gateway. This is
  // expected to throw until real ad-platform credentials are configured;
  // the campaign row stays 'pending' rather than failing the request, so
  // credits already charged are reflected and visible to the user.
  try {
    const client = getDistributionClient(platform);
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
      console.error('campaign status write failed:', statusError.message);
    }
  } catch (err) {
    console.error('distribution gateway not yet configured:', (err as Error).message);
  }

  return NextResponse.json({ campaign }, { status: 201 });
}
