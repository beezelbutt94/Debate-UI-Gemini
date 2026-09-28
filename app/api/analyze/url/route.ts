import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { consumeQuotaOrRespond, refundQuota } from '@/lib/quota';
import { logEvent } from '@/lib/events';
import { errorStatus, publicErrorMessage } from '@/lib/errors';
import { extractUrlContent, TavilyRateLimitError } from '@/lib/tavily';
import { generateViralGapAnalysis } from '@/lib/anthropic';
import { detectPlatform } from '@/lib/platform';
import type { AuditReportRow, ViralGapAnalysis } from '@/lib/types';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  if (typeof body.url !== 'string' || body.url.trim().length === 0) {
    return NextResponse.json({ error: '"url" is required.' }, { status: 400 });
  }
  const url = body.url.trim();

  const platform = detectPlatform(url);
  if (!platform) {
    return NextResponse.json(
      { error: 'URL must be a TikTok video, YouTube Short, or Facebook Reel.' },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  const quotaDenied = await consumeQuotaOrRespond(admin, userId, 'analyze_url');
  if (quotaDenied) return quotaDenied;

  try {
    const extracted = await extractUrlContent(url);

    const result = await generateViralGapAnalysis({
      platform,
      sourceUrl: url,
      pageTitle: extracted.title,
      extractedContent: extracted.raw_content,
    });

    const { data: report, error: insertError } = await admin
      .from('audit_reports')
      .insert({
        user_id: userId,
        source_type: 'url',
        source_url: url,
        platform,
        viral_score: result.viral_score,
        analysis: result.analysis,
        timeline_recommendations: result.timeline_recommendations,
      })
      .select()
      .single();

    if (insertError || !report) {
      console.error('audit_reports insert failed', insertError);
      await refundQuota(admin, userId, 'analyze_url');
      return NextResponse.json({ error: 'Could not save the analysis report.' }, { status: 500 });
    }

    return NextResponse.json({ report: report as AuditReportRow<ViralGapAnalysis> }, { status: 200 });
  } catch (err) {
    // Every failure path below burned a quota unit for nothing (a
    // scrape/LLM error, not a user error) -- refund it rather than
    // silently costing the user one of their monthly analyses.
    await refundQuota(admin, userId, 'analyze_url');

    if (err instanceof TavilyRateLimitError) {
      return NextResponse.json(
        { error: 'The scraping service is rate-limited right now. Please try again shortly.' },
        {
          status: 429,
          headers: err.retryAfterSeconds ? { 'Retry-After': String(err.retryAfterSeconds) } : undefined,
        }
      );
    }

    await logEvent('error', 'analyze_url.failed', { userId, error: err });
    return NextResponse.json(
      { error: publicErrorMessage(err, 'Analysis failed. It did not count against your plan; please try again.') },
      { status: errorStatus(err) }
    );
  }
}
