import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { fetchYoutubeChannelSnapshot } from '@/lib/youtube';
import { extractUrlContent, TavilyRateLimitError } from '@/lib/tavily';
import { generateGrowthBlueprint } from '@/lib/anthropic';
import { buildAccountProfileUrl } from '@/lib/platform';
import type { AuditReportRow, CreatorHandles, CreatorProfileRow, GrowthBlueprint } from '@/lib/types';

interface DeepDiveRequestBody {
  niche?: string;
  handles?: CreatorHandles;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: DeepDiveRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const handles = body.handles ?? {};
  const handleEntries = (Object.entries(handles) as [keyof CreatorHandles, string | undefined][]).filter(
    ([, value]) => typeof value === 'string' && value.trim().length > 0
  ) as [keyof CreatorHandles, string][];

  if (handleEntries.length === 0) {
    return NextResponse.json(
      { error: 'At least one of handles.youtube, handles.tiktok, or handles.instagram is required.' },
      { status: 400 }
    );
  }

  const niche = typeof body.niche === 'string' && body.niche.trim().length > 0 ? body.niche.trim() : null;
  const admin = createSupabaseAdminClient();

  const { data: quotaOk, error: quotaError } = await admin.rpc('consume_analysis_quota', {
    p_user_id: userId,
  });
  if (quotaError) {
    console.error('consume_analysis_quota failed', quotaError);
    return NextResponse.json({ error: 'Could not check your analysis quota.' }, { status: 500 });
  }
  if (!quotaOk) {
    return NextResponse.json(
      { error: 'Monthly analysis quota exceeded. Upgrade your plan for more analyses.' },
      { status: 402 }
    );
  }

  try {
    const platformData: Record<string, unknown> = {};

    for (const [platform, handle] of handleEntries) {
      try {
        if (platform === 'youtube') {
          platformData.youtube = await fetchYoutubeChannelSnapshot(handle);
        } else {
          const profileUrl = buildAccountProfileUrl(platform, handle);
          const extracted = await extractUrlContent(profileUrl);
          platformData[platform] = {
            profileUrl,
            title: extracted.title,
            extractedContent: extracted.raw_content.slice(0, 8_000),
          };
        }
      } catch (platformErr) {
        // One platform failing (bad handle, rate limit) shouldn't sink a
        // multi-platform request -- record the failure as data so the LLM
        // (and the user) sees it was attempted and why it's missing.
        platformData[platform] = {
          error: platformErr instanceof Error ? platformErr.message : 'Fetch failed.',
        };
      }
    }

    const attemptedPlatforms = Object.keys(platformData);
    const allFailed = attemptedPlatforms.every(
      (p) => typeof platformData[p] === 'object' && platformData[p] !== null && 'error' in (platformData[p] as object)
    );
    if (allFailed) {
      throw new Error(
        `Could not fetch data for any of the given handles: ${JSON.stringify(platformData)}`
      );
    }

    const result = await generateGrowthBlueprint({ niche, platformData });

    // Upsert the creator's profile (one per user, matched by looking up
    // the most recent existing row rather than a DB-level unique
    // constraint, since a creator profile isn't required to be strictly
    // 1:1 with a user in this schema).
    const { data: existingProfile } = await admin
      .from('creators_profiles')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let profileId: string;
    if (existingProfile) {
      profileId = existingProfile.id;
      await admin
        .from('creators_profiles')
        .update({ niche, handles, connected_metrics: platformData })
        .eq('id', profileId);
    } else {
      const { data: inserted, error: insertProfileError } = await admin
        .from('creators_profiles')
        .insert({ user_id: userId, niche, handles, connected_metrics: platformData })
        .select('id')
        .single();
      if (insertProfileError || !inserted) {
        throw new Error(`Could not save creator profile: ${insertProfileError?.message}`);
      }
      profileId = inserted.id;
    }

    const primaryHandle = handleEntries[0];
    const primaryUrl = buildAccountProfileUrl(primaryHandle[0], primaryHandle[1]);

    const { data: report, error: insertError } = await admin
      .from('audit_reports')
      .insert({
        user_id: userId,
        creator_profile_id: profileId,
        source_type: 'account',
        source_url: primaryUrl,
        platform: null,
        viral_score: result.viral_score,
        analysis: result.analysis,
        timeline_recommendations: [],
      })
      .select()
      .single();

    if (insertError || !report) {
      console.error('audit_reports insert failed', insertError);
      await admin.rpc('refund_analysis_quota', { p_user_id: userId });
      return NextResponse.json({ error: 'Could not save the deep-dive report.' }, { status: 500 });
    }

    return NextResponse.json(
      {
        report: report as AuditReportRow<GrowthBlueprint>,
        profile: { id: profileId } satisfies Pick<CreatorProfileRow, 'id'>,
      },
      { status: 200 }
    );
  } catch (err) {
    await admin.rpc('refund_analysis_quota', { p_user_id: userId });

    if (err instanceof TavilyRateLimitError) {
      return NextResponse.json(
        { error: 'The scraping service is rate-limited right now. Please try again shortly.' },
        {
          status: 429,
          headers: err.retryAfterSeconds ? { 'Retry-After': String(err.retryAfterSeconds) } : undefined,
        }
      );
    }

    console.error('creators/deep-dive failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Deep-dive analysis failed.' },
      { status: 502 }
    );
  }
}
