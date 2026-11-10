import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { searchTopics, TavilyRateLimitError } from '@/lib/tavily';
import { generateWeeklyCalendar } from '@/lib/anthropic';
import { digestReport } from '@/lib/digest';
import { nextOccurrence } from '@/lib/schedule-utils';
import type { AuditReportRow, ScheduledPostRow } from '@/lib/types';

// Quota-gated, unlike the rest of /api/schedule: this is the one endpoint
// that calls Tavily + Claude to synthesize new suggestions, not plain CRUD.
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

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
    let searchDigest = '(no search results)';
    try {
      const results = await searchTopics('best time to post TikTok YouTube Shorts Instagram Reels 2026 engagement data');
      searchDigest = results.map((r) => `"${r.title}": ${r.content.slice(0, 300)}`).join('\n');
    } catch (searchErr) {
      searchDigest = `(search unavailable: ${searchErr instanceof Error ? searchErr.message : 'unknown error'})`;
    }

    const { data: ownReports } = await admin
      .from('audit_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    const ownCadenceDigest = ((ownReports ?? []) as AuditReportRow[]).map(digestReport).join('\n');

    const slots = await generateWeeklyCalendar({ searchDigest, ownCadenceDigest });

    const rows = slots.map((slot) => ({
      user_id: userId,
      platform: slot.platform,
      publish_at: nextOccurrence(slot.day_of_week, slot.time_local).toISOString(),
      caption: `${slot.topic_suggestion}\n\n(${slot.reasoning})`,
      media_urls: [],
      status: 'draft' as const,
    }));

    const { data: inserted, error: insertError } = await admin
      .from('scheduled_posts')
      .insert(rows)
      .select();

    if (insertError || !inserted) {
      console.error('schedule/generate insert failed', insertError);
      await admin.rpc('refund_analysis_quota', { p_user_id: userId });
      return NextResponse.json({ error: 'Could not save the generated calendar.' }, { status: 500 });
    }

    return NextResponse.json({ posts: inserted as ScheduledPostRow[] }, { status: 200 });
  } catch (err) {
    await admin.rpc('refund_analysis_quota', { p_user_id: userId });

    if (err instanceof TavilyRateLimitError) {
      return NextResponse.json(
        { error: 'The search service is rate-limited right now. Please try again shortly.' },
        {
          status: 429,
          headers: err.retryAfterSeconds ? { 'Retry-After': String(err.retryAfterSeconds) } : undefined,
        }
      );
    }

    console.error('schedule/generate failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Calendar generation failed.' },
      { status: 502 }
    );
  }
}
