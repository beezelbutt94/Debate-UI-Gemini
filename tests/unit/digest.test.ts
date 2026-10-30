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

// ── Fixtures ────────────────────────────────────────────────────────────────

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: 'tiktok',
  viral_score: 72,
  timeline_recommendations: [],
  created_at: '2024-09-12T10:00:00.000Z',
};

const URL_ANALYSIS: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3.5, assessment: 'good' },
  hook_evaluation: { score: 78, verdict: 'strong', notes: 'Direct question opens well' },
  retention_prediction: {
    at_3s_percent: 65,
    at_30s_percent: 42,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Add captions'],
  source_metrics: {},
};

const ACCOUNT_ANALYSIS: GrowthBlueprint = {
  thematic_consistency: { score: 55, notes: 'Mix of niches hurts growth' },
  view_to_follower_ratio: { value: 2.4, assessment: 'average' },
  posting_cadence: { avg_days_between_posts: 3.5, assessment: 'acceptable' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['Weekend mornings', 'Thursday evenings'],
  per_platform_notes: {},
};

const UPLOAD_ANALYSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 81, verdict: 'strong', notes: 'Face clearly lit' },
  audio_balance: { score: 70, notes: 'Music slightly loud' },
  text_overlay_pacing: { assessment: 'overlapping with speech' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 120,
};

const COMPETITOR_ANALYSIS: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['viral challenges'],
  missing_topics: ['cooking tutorials', 'day-in-life vlogs'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['vegan recipes', 'budget meals'],
};

const DISCOVERY_ANALYSIS: SiteDiscoveryResult = {
  query: 'best productivity tools 2024',
  sites: [],
  outlier: { url: 'https://example.com', reasoning: 'Unique visual format' },
  summary: 'Top productivity tools',
};

// ── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport', () => {
  it('formats url source_type correctly', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: URL_ANALYSIS };
    const result = digestReport(report);
    expect(result).toContain('Viral Gap Analyzer');
    expect(result).toContain('strong');
    expect(result).toContain('78/100');
    expect(result).toContain('Direct question opens well');
    expect(result).toContain('3s=65%');
    expect(result).toContain('30s=42%');
  });

  it('formats account source_type correctly', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: ACCOUNT_ANALYSIS };
    const result = digestReport(report);
    expect(result).toContain('Account Deep-Dive');
    expect(result).toContain('55/100');
    expect(result).toContain('Mix of niches hurts growth');
    expect(result).toContain('Weekend mornings');
    expect(result).toContain('Thursday evenings');
  });

  it('formats upload source_type correctly', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis: UPLOAD_ANALYSIS };
    const result = digestReport(report);
    expect(result).toContain('Upload Diagnostic');
    expect(result).toContain('strong');
    expect(result).toContain('81/100');
    expect(result).toContain('Music slightly loud');
    expect(result).toContain('overlapping with speech');
  });

  it('formats discovery source_type correctly', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'discovery', analysis: DISCOVERY_ANALYSIS };
    const result = digestReport(report);
    expect(result).toContain('Site Discovery');
    expect(result).toContain('best productivity tools 2024');
    expect(result).toContain('https://example.com');
    expect(result).toContain('Unique visual format');
  });

  it('formats competitors source_type correctly', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: COMPETITOR_ANALYSIS };
    const result = digestReport(report);
    expect(result).toContain('Competitor Espionage');
    expect(result).toContain('cooking tutorials');
    expect(result).toContain('day-in-life vlogs');
    expect(result).toContain('vegan recipes');
    expect(result).toContain('budget meals');
  });

  it('falls back to "none noted" when posting_blindspots is empty', () => {
    const analysis: GrowthBlueprint = { ...ACCOUNT_ANALYSIS, posting_blindspots: [] };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis };
    expect(digestReport(report)).toContain('none noted');
  });

  it('falls back to "none noted" when missing_topics is empty', () => {
    const analysis: CompetitorGapAnalysis = { ...COMPETITOR_ANALYSIS, missing_topics: [] };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis };
    expect(digestReport(report)).toContain('none noted');
  });

  it('falls back to "none noted" when untapped_keyword_clusters is empty', () => {
    const analysis: CompetitorGapAnalysis = { ...COMPETITOR_ANALYSIS, untapped_keyword_clusters: [] };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis };
    expect(digestReport(report)).toContain('none noted');
  });

  it('includes the formatted date', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: URL_ANALYSIS };
    const result = digestReport(report);
    // The date should appear somewhere (locale-specific but always present)
    expect(result.length).toBeGreaterThan(20);
    // Just check a fragment of the ISO date appears after parsing
    expect(result).toMatch(/\d+\/\d+\/\d+/);
  });
});

// ── digestScript ──────────────────────────────────────────────────────────────

const BASE_SCRIPT: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'How I Lost 20lbs in 30 Days',
  source_prompt: null,
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-09-15T08:00:00.000Z',
  storyboard: {
    spoken_hook: 'I tried something most people are too scared to do',
    memory_context_used: false,
    cta: 'Follow for part 2',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Close-up of scale',
        dialogue_or_vo: 'Before and after reveal',
        audio_sfx_cue: 'Whoosh',
        retention_loop_note: 'Viewer wants to see the result',
      },
      {
        scene_number: 2,
        visual_action: 'Kitchen montage',
        dialogue_or_vo: 'Meal prep details',
        audio_sfx_cue: 'Upbeat music',
        retention_loop_note: 'Curiosity about the specific meals',
      },
    ],
  },
};

describe('digestScript', () => {
  it('includes the script title', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('How I Lost 20lbs in 30 Days');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('I tried something most people are too scared to do');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Viewer wants to see the result');
  });

  it('includes the total scene count', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    expect(digestScript(BASE_SCRIPT)).toMatch(/\d+\/\d+\/\d+/);
  });

  it('handles missing first scene gracefully with (none)', () => {
    const noSceneScript: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    expect(digestScript(noSceneScript)).toContain('(none)');
    expect(digestScript(noSceneScript)).toContain('0 scenes total');
  });

  it('shows 1 scene total for single-scene script', () => {
    const oneScene: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [BASE_SCRIPT.storyboard.scenes[0]] },
    };
    expect(digestScript(oneScene)).toContain('1 scenes total');
  });
});
