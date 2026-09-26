import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { consumeQuotaOrRespond, refundQuota } from '@/lib/quota';
import { logEvent } from '@/lib/events';
import { errorStatus, publicErrorMessage } from '@/lib/errors';
import { fetchYoutubeChannelSnapshot } from '@/lib/youtube';
import { extractUrlContent, searchTopics, TavilyRateLimitError } from '@/lib/tavily';
import { buildAccountProfileUrl } from '@/lib/platform';
import { generateCompetitorGapAnalysis } from '@/lib/anthropic';
import { digestReport, digestScript } from '@/lib/digest';
import type {
  AccountPlatform,
  AuditReportRow,
  CompetitorGapAnalysis,
  CompetitorHandle,
  CompetitorSnapshot,
  ScriptRow,
} from '@/lib/types';

const VALID_PLATFORMS: AccountPlatform[] = ['youtube', 'tiktok', 'instagram'];
const MIN_COMPETITORS = 3;
const MAX_COMPETITORS = 5;

interface TrackRequestBody {
  handles?: CompetitorHandle[];
  niche?: string;
}

async function snapshotCompetitor(c: CompetitorHandle): Promise<CompetitorSnapshot> {
  try {
    if (c.platform === 'youtube') {
      const snap = await fetchYoutubeChannelSnapshot(c.handle);
      const avgViews = snap.recentVideos.length
        ? Math.round(snap.recentVideos.reduce((s, v) => s + v.viewCount, 0) / snap.recentVideos.length)
        : null;
      return {
        handle: c.handle,
        platform: c.platform,
        summary:
          `"${snap.title}", ${snap.subscriberCount ?? 'unknown'} subscribers, ` +
          `posts every ~${snap.avgDaysBetweenUploads?.toFixed(1) ?? 'unknown'} days, ` +
          `avg ${avgViews ?? 'unknown'} views/video recently. Recent titles: ` +
          snap.recentVideos.slice(0, 5).map((v) => `"${v.title}"`).join(', '),
        fetch_error: null,
      };
    }

    const profileUrl = buildAccountProfileUrl(c.platform, c.handle);
    const extracted = await extractUrlContent(profileUrl);
    return {
      handle: c.handle,
      platform: c.platform,
      summary: `${extracted.title ?? c.handle}: ${extracted.raw_content.slice(0, 2_000)}`,
      fetch_error: null,
    };
  } catch (err) {
    return {
      handle: c.handle,
      platform: c.platform,
      summary: '',
      fetch_error: publicErrorMessage(err, 'Could not fetch this account right now.'),
    };
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: TrackRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const handles = Array.isArray(body.handles) ? body.handles : [];
  if (handles.length < MIN_COMPETITORS || handles.length > MAX_COMPETITORS) {
    return NextResponse.json(
      { error: `"handles" must contain ${MIN_COMPETITORS}-${MAX_COMPETITORS} competitors.` },
      { status: 400 }
    );
  }
  for (const h of handles) {
    if (!VALID_PLATFORMS.includes(h.platform) || typeof h.handle !== 'string' || !h.handle.trim()) {
      return NextResponse.json(
        { error: `Each handle needs a platform (${VALID_PLATFORMS.join(', ')}) and a non-empty handle.` },
        { status: 400 }
      );
    }
  }

  const niche = typeof body.niche === 'string' && body.niche.trim().length > 0 ? body.niche.trim() : null;
  const admin = createSupabaseAdminClient();

  const quotaDenied = await consumeQuotaOrRespond(admin, userId, 'competitors');
  if (quotaDenied) return quotaDenied;

  try {
    const snapshots = await Promise.all(handles.map(snapshotCompetitor));

    if (snapshots.every((s) => s.fetch_error)) {
      throw new Error(`Could not fetch data for any tracked competitor: ${JSON.stringify(snapshots)}`);
    }

    const competitorDigest = snapshots
      .map((s) => (s.fetch_error ? `${s.handle} (${s.platform}): FETCH FAILED - ${s.fetch_error}` : `${s.handle} (${s.platform}): ${s.summary}`))
      .join('\n');

    let searchDigest = '(no search results)';
    try {
      const query = niche
        ? `trending short-form video topics and formats in ${niche} 2026`
        : 'trending short-form video content topics and formats 2026';
      const results = await searchTopics(query);
      searchDigest = results.map((r) => `"${r.title}": ${r.content.slice(0, 300)}`).join('\n');
    } catch (searchErr) {
      // Search is supplementary context: carry on without it, but record why.
      await logEvent('warn', 'competitors.search_unavailable', { userId, error: searchErr });
      searchDigest = '(web search unavailable for this run)';
    }

    const [{ data: ownReports }, { data: ownScripts }] = await Promise.all([
      admin
        .from('audit_reports')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      admin
        .from('scripts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3),
    ]);
    const ownWorkDigest = [
      ...((ownReports ?? []) as AuditReportRow[]).map(digestReport),
      ...((ownScripts ?? []) as ScriptRow[]).map(digestScript),
    ].join('\n');

    const gapResult = await generateCompetitorGapAnalysis({ competitorDigest, searchDigest, ownWorkDigest });

    const analysis: CompetitorGapAnalysis = { competitors: snapshots, ...gapResult };

    // Persist the tracked list so it can be prefilled/reused later,
    // mirroring Deep-Dive's creators_profiles upsert pattern.
    const { data: existingProfile } = await admin
      .from('creators_profiles')
      .select('id, connected_metrics')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let profileId: string;
    if (existingProfile) {
      profileId = existingProfile.id;
      const mergedMetrics = { ...(existingProfile.connected_metrics ?? {}), competitors: handles };
      await admin.from('creators_profiles').update({ connected_metrics: mergedMetrics }).eq('id', profileId);
    } else {
      const { data: inserted, error: insertProfileError } = await admin
        .from('creators_profiles')
        .insert({ user_id: userId, connected_metrics: { competitors: handles } })
        .select('id')
        .single();
      if (insertProfileError || !inserted) {
        throw new Error(`Could not save creator profile: ${insertProfileError?.message}`);
      }
      profileId = inserted.id;
    }

    const { data: report, error: insertError } = await admin
      .from('audit_reports')
      .insert({
        user_id: userId,
        creator_profile_id: profileId,
        source_type: 'competitors',
        source_url: null,
        platform: null,
        viral_score: null,
        analysis,
        timeline_recommendations: [],
      })
      .select()
      .single();

    if (insertError || !report) {
      console.error('audit_reports insert failed', insertError);
      await refundQuota(admin, userId, 'competitors');
      return NextResponse.json({ error: 'Could not save the competitor report.' }, { status: 500 });
    }

    return NextResponse.json({ report: report as AuditReportRow<CompetitorGapAnalysis> }, { status: 200 });
  } catch (err) {
    await refundQuota(admin, userId, 'competitors');

    if (err instanceof TavilyRateLimitError) {
      return NextResponse.json(
        { error: 'The scraping service is rate-limited right now. Please try again shortly.' },
        {
          status: 429,
          headers: err.retryAfterSeconds ? { 'Retry-After': String(err.retryAfterSeconds) } : undefined,
        }
      );
    }

    await logEvent('error', 'competitors.failed', { userId, error: err });
    return NextResponse.json(
      { error: publicErrorMessage(err, 'Competitor analysis failed. It did not count against your plan; please try again.') },
      { status: errorStatus(err) }
    );
  }
}
