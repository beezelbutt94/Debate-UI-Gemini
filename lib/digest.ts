import type {
  AuditReportRow,
  CompetitorGapAnalysis,
  GrowthBlueprint,
  ScriptRow,
  UploadDiagnosis,
  ViralGapAnalysis,
} from '@/lib/types';

/**
 * Turns one audit_reports row into a plain-text summary of its real weak
 * points/findings, keyed off source_type since each stores a differently
 * shaped `analysis` payload. Shared by every feature that grounds an LLM
 * call in a creator's past reports (Tool Suite Hub, Competitor Espionage)
 * so the shape-per-source_type logic exists in exactly one place.
 */
export function digestReport(report: AuditReportRow): string {
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

  if (report.source_type === 'upload') {
    const a = report.analysis as UploadDiagnosis;
    return (
      `Upload Diagnostic (${date}): visual hook "${a.visual_hook_clarity.verdict}" ` +
      `(${a.visual_hook_clarity.score}/100); audio balance ${a.audio_balance.score}/100 ` +
      `("${a.audio_balance.notes}"); text-overlay pacing: "${a.text_overlay_pacing.assessment}".`
    );
  }

  const a = report.analysis as CompetitorGapAnalysis;
  return (
    `Competitor Espionage (${date}): missing topics: ${a.missing_topics.join('; ') || 'none noted'}; ` +
    `untapped keyword clusters: ${a.untapped_keyword_clusters.join('; ') || 'none noted'}.`
  );
}

export function digestScript(script: ScriptRow): string {
  const date = new Date(script.created_at).toLocaleDateString();
  const weakScene = script.storyboard.scenes[0];
  return (
    `Script "${script.title}" (${date}): hook "${script.storyboard.spoken_hook}"; ` +
    `first scene retention loop: "${weakScene?.retention_loop_note ?? '(none)'}"; ` +
    `${script.storyboard.scenes.length} scenes total.`
  );
}
