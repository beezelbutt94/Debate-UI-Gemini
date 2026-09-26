import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { consumeQuotaOrRespond, refundQuota } from '@/lib/quota';
import { logEvent } from '@/lib/events';
import { errorStatus, publicErrorMessage } from '@/lib/errors';
import { searchTopics, TavilyRateLimitError } from '@/lib/tavily';
import { generateWeeklyCalendar } from '@/lib/anthropic';
import { digestReport } from '@/lib/digest';
import type { AuditReportRow, CalendarSlot, ScheduledPostRow } from '@/lib/types';

const DAY_INDEX: Record<CalendarSlot['day_of_week'], number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Next occurrence of a weekday + "HH:MM" within the coming 7 days
 * (today counts if the time hasn't passed yet). No per-user timezone is
 * stored in this schema yet, so this resolves against the server's own
 * clock (UTC in a typical deployment) -- a real limitation, not hidden:
 * see docs/VIRAL_TRENDING_ROADMAP.md.
 */
function nextOccurrence(dayOfWeek: CalendarSlot['day_of_week'], timeLocal: string): Date {
  const [hours, minutes] = timeLocal.split(':').map(Number);
  const now = new Date();
  const targetDay = DAY_INDEX[dayOfWeek];

  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hours || 0, minutes || 0, 0, 0);
    if (candidate.getDay() === targetDay && candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }
  // Fallback: shouldn't happen (a full week is checked above), but never
  // return an invalid date.
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

// Quota-gated, unlike the rest of /api/schedule: this is the one endpoint
// that calls Tavily + Claude to synthesize new suggestions, not plain CRUD.
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  const quotaDenied = await consumeQuotaOrRespond(admin, userId, 'schedule_generate');
  if (quotaDenied) return quotaDenied;

  try {
    let searchDigest = '(no search results)';
    try {
      const results = await searchTopics('best time to post TikTok YouTube Shorts Instagram Reels 2026 engagement data');
      searchDigest = results.map((r) => `"${r.title}": ${r.content.slice(0, 300)}`).join('\n');
    } catch (searchErr) {
      // Search is supplementary context: carry on without it, but record why.
      await logEvent('warn', 'schedule_generate.search_unavailable', { userId, error: searchErr });
      searchDigest = '(web search unavailable for this run)';
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
      await refundQuota(admin, userId, 'schedule_generate');
      return NextResponse.json({ error: 'Could not save the generated calendar.' }, { status: 500 });
    }

    return NextResponse.json({ posts: inserted as ScheduledPostRow[] }, { status: 200 });
  } catch (err) {
    await refundQuota(admin, userId, 'schedule_generate');

    if (err instanceof TavilyRateLimitError) {
      return NextResponse.json(
        { error: 'The search service is rate-limited right now. Please try again shortly.' },
        {
          status: 429,
          headers: err.retryAfterSeconds ? { 'Retry-After': String(err.retryAfterSeconds) } : undefined,
        }
      );
    }

    await logEvent('error', 'schedule_generate.failed', { userId, error: err });
    return NextResponse.json(
      { error: publicErrorMessage(err, 'Calendar generation failed. It did not count against your plan; please try again.') },
      { status: errorStatus(err) }
    );
  }
}
