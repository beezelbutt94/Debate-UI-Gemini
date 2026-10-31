import { describe, it, expect } from 'vitest';
import { digestReport, digestScript } from '@/lib/digest';
import type {
  AuditReportRow,
  ViralGapAnalysis,
  GrowthBlueprint,
  UploadDiagnosis,
  CompetitorGapAnalysis,
  SiteDiscoveryResult,
  ScriptRow,
} from '@/lib/types';

// ── Shared fixtures ──────────────────────────────────────────────────────────
const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'rpt-1',
  user_id: 'user-1',
  creator_profile_id: null,
  source_url: 'https://tiktok.com/@x/video/1',
  platform: 'tiktok',
  viral_score: 72,
  timeline_recommendations: [],
  created_at: '2024-06-15T12:00:00.000Z',
};

// ── digestReport – url (ViralGapAnalysis) ────────────────────────────────────
describe('digestReport – source_type: url', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'good' },
    hook_evaluation: { score: 82, verdict: 'strong', notes: 'Great hook' },
    retention_prediction: {
      at_3s_percent: 65,
      at_30s_percent: 45,
      meets_3s_benchmark: true,
      meets_30s_benchmark: true,
    },
    action_plan: ['Do X', 'Do Y'],
    source_metrics: {},
  };

  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis };

  it('includes "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('82/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Great hook');
  });

  it('includes 3s retention percent', () => {
    expect(digestReport(report)).toContain('3s=65%');
  });

  it('includes 30s retention percent', () => {
    expect(digestReport(report)).toContain('30s=45%');
  });

  it('includes a formatted date derived from created_at', () => {
    // The exact locale format depends on env, but it must not be empty
    const result = digestReport(report);
    expect(result).toMatch(/\d/); // contains at least one digit (date)
  });
});

// ── digestReport – account (GrowthBlueprint) ─────────────────────────────────
describe('digestReport – source_type: account', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 74, notes: 'Needs more focus' },
    view_to_follower_ratio: { value: 0.12, assessment: 'low' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'good' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: ['Weekends', 'Evening slots'],
    per_platform_notes: {},
  };

  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis };

  it('includes "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('74/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Needs more focus');
  });

  it('includes posting blindspots joined by semicolons', () => {
    expect(digestReport(report)).toContain('Weekends; Evening slots');
  });

  it('says "none noted" when posting_blindspots is empty', () => {
    const emptyBlindspots: GrowthBlueprint = { ...analysis, posting_blindspots: [] };
    const r: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: emptyBlindspots };
    expect(digestReport(r)).toContain('none noted');
  });
});

// ── digestReport – upload (UploadDiagnosis) ───────────────────────────────────
describe('digestReport – source_type: upload', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 55, verdict: 'moderate', notes: 'Decent hook' },
    audio_balance: { score: 70, notes: 'A bit loud' },
    text_overlay_pacing: { assessment: 'too fast' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 90,
  };

  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis };

  it('includes "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('55/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('70/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('A bit loud');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('too fast');
  });
});

// ── digestReport – discovery (SiteDiscoveryResult) ────────────────────────────
describe('digestReport – source_type: discovery', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'best cooking channels',
    sites: [],
    outlier: { url: 'https://unusual.com', reasoning: 'Uses recipe videos differently' },
    summary: 'Some summary',
  };

  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'discovery', analysis };

  it('includes "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes query', () => {
    expect(digestReport(report)).toContain('best cooking channels');
  });

  it('includes outlier URL', () => {
    expect(digestReport(report)).toContain('https://unusual.com');
  });

  it('includes outlier reasoning', () => {
    expect(digestReport(report)).toContain('Uses recipe videos differently');
  });
});

// ── digestReport – competitors (CompetitorGapAnalysis) ─────────────────────────
describe('digestReport – source_type: competitors', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: ['Shorts format'],
    missing_topics: ['Behind the scenes', 'Q&A'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['vegan recipes', 'quick meals'],
  };

  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis };

  it('includes "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics joined by semicolons', () => {
    expect(digestReport(report)).toContain('Behind the scenes; Q&A');
  });

  it('includes untapped keyword clusters', () => {
    expect(digestReport(report)).toContain('vegan recipes; quick meals');
  });

  it('says "none noted" for empty missing_topics', () => {
    const empty: CompetitorGapAnalysis = { ...analysis, missing_topics: [] };
    const r: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: empty };
    expect(digestReport(r)).toContain('none noted');
  });

  it('says "none noted" for empty untapped_keyword_clusters', () => {
    const empty: CompetitorGapAnalysis = { ...analysis, untapped_keyword_clusters: [] };
    const r: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: empty };
    expect(digestReport(r)).toContain('none noted');
  });
});

// ── digestScript ──────────────────────────────────────────────────────────────
describe('digestScript', () => {
  const script: ScriptRow = {
    id: 'scr-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'My Viral Script',
    source_prompt: null,
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-01T10:00:00.000Z',
    storyboard: {
      spoken_hook: 'You won\'t believe this!',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'zoom in',
          dialogue_or_vo: 'Start here',
          audio_sfx_cue: 'thud',
          retention_loop_note: 'Tease the reveal',
        },
        {
          scene_number: 2,
          visual_action: 'cut away',
          dialogue_or_vo: 'Middle',
          audio_sfx_cue: 'music',
          retention_loop_note: 'Loop back',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
  };

  it('includes the script title', () => {
    expect(digestScript(script)).toContain('My Viral Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(script)).toContain("You won't believe this!");
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(script)).toContain('Tease the reveal');
  });

  it('includes the total scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('includes a date derived from created_at', () => {
    const result = digestScript(script);
    // Date must contain at least a year-like fragment
    expect(result).toMatch(/\d{4}/);
  });

  it('handles a script with a single scene', () => {
    const oneScene: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [script.storyboard.scenes[0]] },
    };
    const result = digestScript(oneScene);
    expect(result).toContain('1 scenes total');
  });

  it('shows "(none)" as retention_loop_note when scenes array is empty', () => {
    const noScenes: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('(none)');
  });
});
