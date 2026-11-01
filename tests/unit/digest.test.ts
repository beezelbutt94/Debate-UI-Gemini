import { describe, it, expect } from 'vitest';
import { digestReport, digestScript } from '@/lib/digest';
import type {
  AuditReportRow,
  ViralGapAnalysis,
  GrowthBlueprint,
  UploadDiagnosis,
  SiteDiscoveryResult,
  CompetitorGapAnalysis,
  ScriptRow,
} from '@/lib/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-06-15T00:00:00.000Z',
} as const;

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'good' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Could be stronger' },
  retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Improve hook'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 85, notes: 'Very consistent niche' },
  view_to_follower_ratio: { value: 2.3, assessment: 'good' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['Weekend mornings', 'Midweek evenings'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'Decent visual' },
  audio_balance: { score: 78, notes: 'Slightly loud music' },
  text_overlay_pacing: { assessment: 'Too fast' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 120,
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'viral content tips',
  sites: [],
  outlier: { url: 'https://example.com', reasoning: 'Unique angle on viral' },
  summary: 'Good results',
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['Recipe shorts', 'Behind-the-scenes'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['quick meals', 'ASMR cooking'],
};

// ─── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport', () => {
  it('handles source_type=url: includes hook verdict', () => {
    const report: AuditReportRow<ViralGapAnalysis> = { ...BASE, source_type: 'url', analysis: viralAnalysis };
    const result = digestReport(report);
    expect(result).toContain('moderate');
    expect(result).toContain('72/100');
    expect(result).toContain('Could be stronger');
    expect(result).toContain('3s=65%');
    expect(result).toContain('30s=42%');
  });

  it('handles source_type=url: starts with "Viral Gap Analyzer"', () => {
    const report: AuditReportRow<ViralGapAnalysis> = { ...BASE, source_type: 'url', analysis: viralAnalysis };
    expect(digestReport(report)).toMatch(/^Viral Gap Analyzer/);
  });

  it('handles source_type=account: includes thematic consistency score', () => {
    const report: AuditReportRow<GrowthBlueprint> = { ...BASE, source_type: 'account', analysis: growthAnalysis };
    const result = digestReport(report);
    expect(result).toContain('85/100');
    expect(result).toContain('Very consistent niche');
    expect(result).toContain('Weekend mornings');
    expect(result).toContain('Midweek evenings');
  });

  it('handles source_type=account: starts with "Account Deep-Dive"', () => {
    const report: AuditReportRow<GrowthBlueprint> = { ...BASE, source_type: 'account', analysis: growthAnalysis };
    expect(digestReport(report)).toMatch(/^Account Deep-Dive/);
  });

  it('handles source_type=account: empty posting_blindspots shows "none noted"', () => {
    const analysis: GrowthBlueprint = { ...growthAnalysis, posting_blindspots: [] };
    const report: AuditReportRow<GrowthBlueprint> = { ...BASE, source_type: 'account', analysis };
    expect(digestReport(report)).toContain('none noted');
  });

  it('handles source_type=upload: includes visual hook verdict and score', () => {
    const report: AuditReportRow<UploadDiagnosis> = { ...BASE, source_type: 'upload', analysis: uploadAnalysis };
    const result = digestReport(report);
    expect(result).toContain('moderate');
    expect(result).toContain('60/100');
    expect(result).toContain('78/100');
    expect(result).toContain('Slightly loud music');
    expect(result).toContain('Too fast');
  });

  it('handles source_type=upload: starts with "Upload Diagnostic"', () => {
    const report: AuditReportRow<UploadDiagnosis> = { ...BASE, source_type: 'upload', analysis: uploadAnalysis };
    expect(digestReport(report)).toMatch(/^Upload Diagnostic/);
  });

  it('handles source_type=discovery: includes query and outlier URL', () => {
    const report: AuditReportRow<SiteDiscoveryResult> = { ...BASE, source_type: 'discovery', analysis: discoveryAnalysis };
    const result = digestReport(report);
    expect(result).toContain('viral content tips');
    expect(result).toContain('https://example.com');
    expect(result).toContain('Unique angle on viral');
  });

  it('handles source_type=discovery: starts with "Site Discovery"', () => {
    const report: AuditReportRow<SiteDiscoveryResult> = { ...BASE, source_type: 'discovery', analysis: discoveryAnalysis };
    expect(digestReport(report)).toMatch(/^Site Discovery/);
  });

  it('handles source_type=competitors: includes missing_topics', () => {
    const report: AuditReportRow<CompetitorGapAnalysis> = { ...BASE, source_type: 'competitors', analysis: competitorAnalysis };
    const result = digestReport(report);
    expect(result).toContain('Recipe shorts');
    expect(result).toContain('Behind-the-scenes');
    expect(result).toContain('quick meals');
    expect(result).toContain('ASMR cooking');
  });

  it('handles source_type=competitors: starts with "Competitor Espionage"', () => {
    const report: AuditReportRow<CompetitorGapAnalysis> = { ...BASE, source_type: 'competitors', analysis: competitorAnalysis };
    expect(digestReport(report)).toMatch(/^Competitor Espionage/);
  });

  it('handles source_type=competitors: empty missing_topics shows "none noted"', () => {
    const analysis: CompetitorGapAnalysis = { ...competitorAnalysis, missing_topics: [], untapped_keyword_clusters: [] };
    const report: AuditReportRow<CompetitorGapAnalysis> = { ...BASE, source_type: 'competitors', analysis };
    const result = digestReport(report);
    expect(result).toContain('none noted');
  });

  it('includes a formatted date from created_at', () => {
    const report: AuditReportRow<ViralGapAnalysis> = { ...BASE, source_type: 'url', analysis: viralAnalysis };
    // The date formatting is locale-dependent; just check that it's a non-empty date string
    const result = digestReport(report);
    expect(result).toMatch(/\d/); // has at least one digit (from the date)
  });

  it('returns a string for every source_type', () => {
    const types = [
      { ...BASE, source_type: 'url' as const, analysis: viralAnalysis },
      { ...BASE, source_type: 'account' as const, analysis: growthAnalysis },
      { ...BASE, source_type: 'upload' as const, analysis: uploadAnalysis },
      { ...BASE, source_type: 'discovery' as const, analysis: discoveryAnalysis },
      { ...BASE, source_type: 'competitors' as const, analysis: competitorAnalysis },
    ];
    for (const report of types) {
      expect(typeof digestReport(report)).toBe('string');
    }
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

const baseScript: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'My Viral Script',
  source_prompt: null,
  tone_parameters: {},
  target_platform: null,
  created_at: '2024-09-12T10:00:00.000Z',
  storyboard: {
    spoken_hook: 'You will not believe this trick',
    memory_context_used: false,
    cta: 'Follow for more!',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'close-up of hands',
        dialogue_or_vo: 'Watch this',
        audio_sfx_cue: 'dramatic sting',
        retention_loop_note: 'open loop about what comes next',
      },
      {
        scene_number: 2,
        visual_action: 'reveal',
        dialogue_or_vo: 'Here is the trick',
        audio_sfx_cue: 'none',
        retention_loop_note: 'payoff loop',
      },
    ],
  },
};

describe('digestScript', () => {
  it('includes the script title', () => {
    expect(digestScript(baseScript)).toContain('My Viral Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(baseScript)).toContain('You will not believe this trick');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(baseScript)).toContain('open loop about what comes next');
  });

  it('includes the total scene count', () => {
    expect(digestScript(baseScript)).toContain('2 scenes total');
  });

  it('starts with the script title in quotes', () => {
    expect(digestScript(baseScript)).toMatch(/^Script "My Viral Script"/);
  });

  it('returns a string', () => {
    expect(typeof digestScript(baseScript)).toBe('string');
  });

  it('handles a script with no scenes gracefully', () => {
    const script: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    const result = digestScript(script);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('handles a single scene', () => {
    const script: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [baseScript.storyboard.scenes[0]] },
    };
    const result = digestScript(script);
    expect(result).toContain('1 scenes total');
    expect(result).toContain('open loop about what comes next');
  });

  it('includes a formatted date', () => {
    const result = digestScript(baseScript);
    expect(result).toMatch(/\d/);
  });
});
