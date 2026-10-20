import { describe, it, expect } from 'vitest';
import { digestReport, digestScript } from '@/lib/digest';
import type {
  AuditReportRow,
  ScriptRow,
  ViralGapAnalysis,
  GrowthBlueprint,
  UploadDiagnosis,
  CompetitorGapAnalysis,
  SiteDiscoveryResult,
} from '@/lib/types';

// ── Shared date for deterministic output ─────────────────────────────────────
// Use a fixed ISO date so toLocaleDateString() produces the same string
// regardless of locale. Node's default locale is 'en-US'.
const ISO_DATE = '2024-09-12T10:00:00.000Z';
const LOCALIZED = new Date(ISO_DATE).toLocaleDateString();

// ── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport()', () => {
  it('formats a "url" (ViralGapAnalysis) report', () => {
    const report: AuditReportRow<ViralGapAnalysis> = {
      id: '1',
      user_id: 'u1',
      creator_profile_id: null,
      source_type: 'url',
      source_url: 'https://tiktok.com/@x/video/1',
      platform: 'tiktok',
      viral_score: 82,
      timeline_recommendations: [],
      created_at: ISO_DATE,
      analysis: {
        pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
        hook_evaluation: { score: 78, verdict: 'strong', notes: 'Great pattern interrupt' },
        retention_prediction: { at_3s_percent: 70, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
        action_plan: [],
        source_metrics: {},
      },
    };

    const result = digestReport(report);
    expect(result).toContain(`Viral Gap Analyzer (${LOCALIZED})`);
    expect(result).toContain('hook "strong"');
    expect(result).toContain('78/100');
    expect(result).toContain('Great pattern interrupt');
    expect(result).toContain('retention 3s=70%');
    expect(result).toContain('30s=45%');
  });

  it('formats an "account" (GrowthBlueprint) report', () => {
    const report: AuditReportRow<GrowthBlueprint> = {
      id: '2',
      user_id: 'u1',
      creator_profile_id: null,
      source_type: 'account',
      source_url: null,
      platform: null,
      viral_score: null,
      timeline_recommendations: [],
      created_at: ISO_DATE,
      analysis: {
        thematic_consistency: { score: 65, notes: 'Mixes unrelated niches' },
        view_to_follower_ratio: { value: 0.12, assessment: 'below average' },
        posting_cadence: { avg_days_between_posts: 5, assessment: 'inconsistent' },
        theme_correction: [],
        view_maximization_tactics: [],
        posting_blindspots: ['Saturday morning', 'Thursday evening'],
        per_platform_notes: {},
      },
    };

    const result = digestReport(report);
    expect(result).toContain(`Account Deep-Dive (${LOCALIZED})`);
    expect(result).toContain('65/100');
    expect(result).toContain('Mixes unrelated niches');
    expect(result).toContain('Saturday morning');
    expect(result).toContain('Thursday evening');
  });

  it('formats an "account" report with no posting blindspots', () => {
    const report: AuditReportRow<GrowthBlueprint> = {
      id: '3',
      user_id: 'u1',
      creator_profile_id: null,
      source_type: 'account',
      source_url: null,
      platform: null,
      viral_score: null,
      timeline_recommendations: [],
      created_at: ISO_DATE,
      analysis: {
        thematic_consistency: { score: 90, notes: 'Solid niche focus' },
        view_to_follower_ratio: { value: 0.5, assessment: 'good' },
        posting_cadence: { avg_days_between_posts: 2, assessment: 'consistent' },
        theme_correction: [],
        view_maximization_tactics: [],
        posting_blindspots: [],
        per_platform_notes: {},
      },
    };

    expect(digestReport(report)).toContain('none noted');
  });

  it('formats an "upload" (UploadDiagnosis) report', () => {
    const report: AuditReportRow<UploadDiagnosis> = {
      id: '4',
      user_id: 'u1',
      creator_profile_id: null,
      source_type: 'upload',
      source_url: null,
      platform: null,
      viral_score: null,
      timeline_recommendations: [],
      created_at: ISO_DATE,
      analysis: {
        visual_hook_clarity: { score: 55, verdict: 'moderate', notes: 'Too slow to open' },
        audio_balance: { score: 80, notes: 'Good mix' },
        text_overlay_pacing: { assessment: 'Captions appear too late' },
        b_roll_recommendations: [],
        retention_boosters: [],
        frames_analyzed: 120,
      },
    };

    const result = digestReport(report);
    expect(result).toContain(`Upload Diagnostic (${LOCALIZED})`);
    expect(result).toContain('visual hook "moderate"');
    expect(result).toContain('55/100');
    expect(result).toContain('audio balance 80/100');
    expect(result).toContain('Good mix');
    expect(result).toContain('Captions appear too late');
  });

  it('formats a "discovery" (SiteDiscoveryResult) report', () => {
    const report: AuditReportRow<SiteDiscoveryResult> = {
      id: '5',
      user_id: 'u1',
      creator_profile_id: null,
      source_type: 'discovery',
      source_url: null,
      platform: null,
      viral_score: null,
      timeline_recommendations: [],
      created_at: ISO_DATE,
      analysis: {
        query: 'viral fitness content sites',
        sites: [],
        outlier: {
          url: 'https://example.com',
          reasoning: 'Covers niche swimming workout angles no other site touches',
        },
        summary: 'Ten fitness discovery sites',
      },
    };

    const result = digestReport(report);
    expect(result).toContain(`Site Discovery (${LOCALIZED})`);
    expect(result).toContain('viral fitness content sites');
    expect(result).toContain('https://example.com');
    expect(result).toContain('niche swimming workout');
  });

  it('falls through to competitors (CompetitorGapAnalysis) for unknown source_type', () => {
    const report: AuditReportRow<CompetitorGapAnalysis> = {
      id: '6',
      user_id: 'u1',
      creator_profile_id: null,
      source_type: 'competitors',
      source_url: null,
      platform: null,
      viral_score: null,
      timeline_recommendations: [],
      created_at: ISO_DATE,
      analysis: {
        competitors: [],
        outlier_topics: [],
        missing_topics: ['Behind-the-scenes', 'Tutorials'],
        audience_sentiment_gaps: [],
        untapped_keyword_clusters: ['deep focus music', 'lo-fi study'],
      },
    };

    const result = digestReport(report);
    expect(result).toContain(`Competitor Espionage (${LOCALIZED})`);
    expect(result).toContain('Behind-the-scenes');
    expect(result).toContain('Tutorials');
    expect(result).toContain('deep focus music');
    expect(result).toContain('lo-fi study');
  });

  it('handles competitors report with empty missing_topics and clusters', () => {
    const report: AuditReportRow<CompetitorGapAnalysis> = {
      id: '7',
      user_id: 'u1',
      creator_profile_id: null,
      source_type: 'competitors',
      source_url: null,
      platform: null,
      viral_score: null,
      timeline_recommendations: [],
      created_at: ISO_DATE,
      analysis: {
        competitors: [],
        outlier_topics: [],
        missing_topics: [],
        audience_sentiment_gaps: [],
        untapped_keyword_clusters: [],
      },
    };

    const result = digestReport(report);
    expect(result.match(/none noted/g)?.length).toBe(2);
  });
});

// ── digestScript ─────────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const baseScript: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'The 3 Diet Secrets',
    source_prompt: 'fat loss tips',
    target_platform: 'tiktok',
    tone_parameters: {},
    created_at: ISO_DATE,
    storyboard: {
      spoken_hook: 'Stop eating breakfast.',
      memory_context_used: false,
      cta: 'Follow for more.',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of empty plate',
          dialogue_or_vo: 'Stop eating breakfast.',
          audio_sfx_cue: 'whoosh',
          retention_loop_note: 'Cliffhanger: why is breakfast bad?',
        },
        {
          scene_number: 2,
          visual_action: 'B-roll of healthy meal prep',
          dialogue_or_vo: 'Here is why.',
          audio_sfx_cue: 'none',
          retention_loop_note: 'Answer delivered',
        },
      ],
    },
  };

  it('includes the script title', () => {
    expect(digestScript(baseScript)).toContain('The 3 Diet Secrets');
  });

  it('includes the formatted date', () => {
    expect(digestScript(baseScript)).toContain(LOCALIZED);
  });

  it('includes the spoken hook', () => {
    expect(digestScript(baseScript)).toContain('Stop eating breakfast.');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(baseScript)).toContain('Cliffhanger: why is breakfast bad?');
  });

  it('includes the total scene count', () => {
    expect(digestScript(baseScript)).toContain('2 scenes total');
  });

  it('uses "(none)" when scenes array is empty', () => {
    const noScenes: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('(none)');
    expect(digestScript(noScenes)).toContain('0 scenes total');
  });

  it('does not throw when scene[0] has an empty retention_loop_note', () => {
    const emptyNote: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [{ ...baseScript.storyboard.scenes[0], retention_loop_note: '' }],
      },
    };
    // Empty string is valid — it should appear, not crash
    const result = digestScript(emptyNote);
    expect(result).toContain('Script "The 3 Diet Secrets"');
  });
});
