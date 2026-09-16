import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { generateToolRecommendations } from '@/lib/anthropic';
import { TOOL_INFO } from '@/lib/tool-suite';
import type {
  AuditReportRow,
  GrowthBlueprint,
  ScriptRow,
  ToolRecommendation,
  UploadDiagnosis,
  ViralGapAnalysis,
} from '@/lib/types';

function digestReport(report: AuditReportRow): string {
  const date = new Date(report.created_at).toLocaleDateString();

  if (report.source_type === 'url') {
    const a = report.analysis as ViralGapAnalysis;
    return (
      `Viral Gap Analyzer (${date}): hook "${a.hook_evaluation.verdict}" ` +
      `(${a.hook_evaluation.score}/100, "${a.hook_evaluation.notes}"); ` +
      `retention 3s=${a.retention_prediction.at_3s_percent}% 30s=${a.retention_prediction.at_30s_percent}%.`
    );
  }

  if (report.source_type === 'account') {
    const a = report.analysis as GrowthBlueprint;
    return (
      `Account Deep-Dive (${date}): thematic consistency ${a.thematic_consistency.score}/100 ` +
      `("${a.thematic_consistency.notes}"); posting blindspots: ${a.posting_blindspots.join('; ') || 'none noted'}.`
    );
  }

  const a = report.analysis as UploadDiagnosis;
  return (
    `Upload Diagnostic (${date}): visual hook "${a.visual_hook_clarity.verdict}" ` +
    `(${a.visual_hook_clarity.score}/100); audio balance ${a.audio_balance.score}/100 ` +
    `("${a.audio_balance.notes}"); text-overlay pacing: "${a.text_overlay_pacing.assessment}".`
  );
}

function digestScript(script: ScriptRow): string {
  const date = new Date(script.created_at).toLocaleDateString();
  const weakScene = script.storyboard.scenes[0];
  return (
    `Script "${script.title}" (${date}): hook "${script.storyboard.spoken_hook}"; ` +
    `first scene retention loop: "${weakScene?.retention_loop_note ?? '(none)'}"; ` +
    `${script.storyboard.scenes.length} scenes total.`
  );
}

const STARTER_RECOMMENDATIONS: ToolRecommendation[] = [
  {
    tool: 'canva',
    label: TOOL_INFO.canva.label,
    url: TOOL_INFO.canva.url,
    reason: "You don't have any ViralEngine reports yet, so this is a general starting point, not a personalized finding.",
    action: 'Build a thumbnail template for your niche before your first upload.',
    source: '(no prior reports)',
  },
];

// Deliberately not quota-gated like the other four features: this route
// doesn't analyze new external content, it synthesizes recommendations
// over reports/scripts the user already paid a quota unit to generate.
// Treating it as a free value-add layer over already-owned analyses,
// documented here rather than left implicit -- see docs/VIRALENGINE_ROADMAP.md.
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

    return NextResponse.json({ recommendations, personalized: true }, { status: 200 });
  } catch (err) {
    console.error('tools/recommendations failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not generate recommendations.' },
      { status: 502 }
    );
  }
}
