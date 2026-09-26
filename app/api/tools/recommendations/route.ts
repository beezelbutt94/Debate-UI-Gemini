import { createHash } from 'node:crypto';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { generateToolRecommendations } from '@/lib/anthropic';
import { TOOL_INFO } from '@/lib/tool-suite';
import { digestReport, digestScript } from '@/lib/digest';
import type { AuditReportRow, ScriptRow, ToolRecommendation } from '@/lib/types';
import { logEvent } from '@/lib/events';
import { errorStatus, publicErrorMessage } from '@/lib/errors';

const REGENERATE_COOLDOWN_MS = 60 * 1000;

const STARTER_RECOMMENDATIONS: ToolRecommendation[] = [
  {
    tool: 'canva',
    label: TOOL_INFO.canva.label,
    url: TOOL_INFO.canva.url,
    reason: "You don't have any Viral Trending reports yet, so this is a general starting point, not a personalized finding.",
    action: 'Build a thumbnail template for your niche before your first upload.',
    source: '(no prior reports)',
  },
];

// Deliberately not quota-gated like the other four features: this route
// doesn't analyze new external content, it synthesizes recommendations
// over reports/scripts the user already paid a quota unit to generate.
// Treating it as a free value-add layer over already-owned analyses,
// documented here rather than left implicit -- see docs/VIRAL_TRENDING_ROADMAP.md.
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  const [{ data: reports }, { data: scripts }] = await Promise.all([
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

  const reportRows = (reports ?? []) as AuditReportRow[];
  const scriptRows = (scripts ?? []) as ScriptRow[];

  if (reportRows.length === 0 && scriptRows.length === 0) {
    // Nothing to ground a recommendation in yet -- don't spend a Claude
    // call manufacturing advice from nothing.
    return NextResponse.json({ recommendations: STARTER_RECOMMENDATIONS, personalized: false }, { status: 200 });
  }

  const digest = [...reportRows.map(digestReport), ...scriptRows.map(digestScript)].join('\n');
  const digestHash = createHash('sha256').update(digest).digest('hex');

  // Reuse the last answer while the user's reports and scripts are
  // unchanged. This route is free (no quota), so without the cache every
  // page view would be a paid Claude call.
  const { data: cached } = await admin
    .from('tool_recommendation_cache')
    .select('digest_hash, recommendations, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (cached && cached.digest_hash === digestHash) {
    return NextResponse.json({ recommendations: cached.recommendations, personalized: true, cached: true }, { status: 200 });
  }
  // Even when the inputs changed, regenerate at most once a minute.
  if (cached && Date.now() - new Date(cached.created_at).getTime() < REGENERATE_COOLDOWN_MS) {
    return NextResponse.json({ recommendations: cached.recommendations, personalized: true, cached: true }, { status: 200 });
  }

  try {
    const raw = await generateToolRecommendations(digest);

    const recommendations: ToolRecommendation[] = raw.map((r) => ({
      tool: r.tool,
      label: TOOL_INFO[r.tool].label,
      url: TOOL_INFO[r.tool].url,
      reason: r.reason,
      action: r.action,
      source: r.source,
    }));

    const { error: cacheError } = await admin
      .from('tool_recommendation_cache')
      .upsert(
        { user_id: userId, digest_hash: digestHash, recommendations, created_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    if (cacheError) {
      await logEvent('warn', 'tools.recommendations_cache_write_failed', { userId, detail: { code: cacheError.code } });
    }

    return NextResponse.json({ recommendations, personalized: true, cached: false }, { status: 200 });
  } catch (err) {
    await logEvent('error', 'tools.recommendations_failed', { userId, error: err });
    if (cached) {
      // Better a slightly stale answer than an error page.
      return NextResponse.json({ recommendations: cached.recommendations, personalized: true, cached: true }, { status: 200 });
    }
    return NextResponse.json(
      { error: publicErrorMessage(err, 'Could not generate recommendations right now. Please try again shortly.') },
      { status: errorStatus(err) }
    );
  }
}
