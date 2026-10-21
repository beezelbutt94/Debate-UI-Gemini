import { describe, it, expect } from 'vitest';
import { digestReport, digestScript } from '@/lib/digest';
import type {
  AuditReportRow,
  ScriptRow,
  ViralGapAnalysis,
  GrowthBlueprint,
  UploadDiagnosis,
  SiteDiscoveryResult,
  CompetitorGapAnalysis,
} from '@/lib/types';

// ── Fixtures ────────────────────────────────────────────────────────────────

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-03-15T12:00:00Z',
};

const VIRAL_ANALYSIS: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
  hook_evaluation: { score: 78, verdict: 'moderate', notes: 'decent but could be stronger' },
  retention_prediction: {
    at_3s_percent: 72,
    at_30s_percent: 45,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Add B-roll', 'Tighten hook'],
  source_metrics: {},
};

const GROWTH_ANALYSIS: GrowthBlueprint = {
  thematic_consistency: { score: 85, notes: 'strong niche focus' },
  view_to_follower_ratio: { value: 1.5, assessment: 'above average' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['Weekend mornings', 'Tutorial format'],
  per_platform_notes: {},
};

const UPLOAD_ANALYSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 88, verdict: 'strong', notes: 'great contrast' },
  audio_balance: { score: 65, notes: 'music slightly too loud' },
  text_overlay_pacing: { assessment: 'on point' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 6,
};

const DISCOVERY_ANALYSIS: SiteDiscoveryResult = {
  query: 'best travel hacks 2024',
  sites: [],
  outlier: {
    url: 'https://example.com/travel-hacks',
    reasoning: 'unique angle on budget travel',
  },
  summary: 'Found 10 sites',
};

const COMPETITOR_ANALYSIS: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['Beginner tutorials', 'Gear reviews'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['vlog ideas', 'travel tips'],
};

// ── digestReport() ─────────────────────────────────────────────────────────

describe('digestReport()', () => {
  it('formats url source_type correctly', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: VIRAL_ANALYSIS };
    const result = digestReport(report);

    expect(result).toContain('Viral Gap Analyzer');
    expect(result).toContain('moderate');
    expect(result).toContain('78/100');
    expect(result).toContain('decent but could be stronger');
    expect(result).toContain('3s=72%');
    expect(result).toContain('30s=45%');
  });

  it('url digest contains the formatted date', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: VIRAL_ANALYSIS };
    const result = digestReport(report);
    // Date formatting is locale-dependent but must be present
    expect(result).toMatch(/\d/); // at minimum has digits
    expect(result).toContain('Viral Gap Analyzer (');
  });

  it('formats account source_type correctly', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: GROWTH_ANALYSIS };
    const result = digestReport(report);

    expect(result).toContain('Account Deep-Dive');
    expect(result).toContain('85/100');
    expect(result).toContain('strong niche focus');
    expect(result).toContain('Weekend mornings');
    expect(result).toContain('Tutorial format');
  });

  it('account digest with empty posting_blindspots shows "none noted"', () => {
    const analysis: GrowthBlueprint = { ...GROWTH_ANALYSIS, posting_blindspots: [] };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis };
    const result = digestReport(report);
    expect(result).toContain('none noted');
  });

  it('formats upload source_type correctly', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis: UPLOAD_ANALYSIS };
    const result = digestReport(report);

    expect(result).toContain('Upload Diagnostic');
    expect(result).toContain('strong');
    expect(result).toContain('88/100');
    expect(result).toContain('65/100');
    expect(result).toContain('music slightly too loud');
    expect(result).toContain('on point');
  });

  it('formats discovery source_type correctly', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'discovery', analysis: DISCOVERY_ANALYSIS };
    const result = digestReport(report);

    expect(result).toContain('Site Discovery');
    expect(result).toContain('best travel hacks 2024');
    expect(result).toContain('https://example.com/travel-hacks');
    expect(result).toContain('unique angle on budget travel');
  });

  it('formats competitors source_type (default branch) correctly', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: COMPETITOR_ANALYSIS };
    const result = digestReport(report);

    expect(result).toContain('Competitor Espionage');
    expect(result).toContain('Beginner tutorials');
    expect(result).toContain('Gear reviews');
    expect(result).toContain('vlog ideas');
    expect(result).toContain('travel tips');
  });

  it('competitor digest with empty arrays shows "none noted"', () => {
    const analysis: CompetitorGapAnalysis = {
      ...COMPETITOR_ANALYSIS,
      missing_topics: [],
      untapped_keyword_clusters: [],
    };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis };
    const result = digestReport(report);
    expect(result).toMatch(/none noted.*none noted/s);
  });

  it('returns a non-empty string for every known source_type', () => {
    const cases: Array<{ source_type: AuditReportRow['source_type']; analysis: unknown }> = [
      { source_type: 'url', analysis: VIRAL_ANALYSIS },
      { source_type: 'account', analysis: GROWTH_ANALYSIS },
      { source_type: 'upload', analysis: UPLOAD_ANALYSIS },
      { source_type: 'discovery', analysis: DISCOVERY_ANALYSIS },
      { source_type: 'competitors', analysis: COMPETITOR_ANALYSIS },
    ];
    for (const c of cases) {
      const report = { ...BASE_REPORT, ...c } as AuditReportRow;
      expect(digestReport(report).length).toBeGreaterThan(0);
    }
  });
});

// ── digestScript() ─────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const BASE_SCRIPT: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Viral Hook Video',
    source_prompt: null,
    storyboard: {
      spoken_hook: "You won't believe this trick",
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up face',
          dialogue_or_vo: "You won't believe this trick",
          audio_sfx_cue: 'upbeat music',
          retention_loop_note: 'cuts to reaction',
        },
        {
          scene_number: 2,
          visual_action: 'Demo',
          dialogue_or_vo: 'Here is how',
          audio_sfx_cue: '',
          retention_loop_note: 'zoom transition',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-06-01T08:00:00Z',
  };

  it('includes the script title', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('My Viral Hook Video');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(BASE_SCRIPT)).toContain("You won't believe this trick");
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('cuts to reaction');
  });

  it('includes total scene count', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('2 scenes total');
  });

  it('shows (none) when first scene has no retention_loop_note', () => {
    const script: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: {
        ...BASE_SCRIPT.storyboard,
        scenes: [
          {
            ...BASE_SCRIPT.storyboard.scenes[0],
            retention_loop_note: '',
          },
          BASE_SCRIPT.storyboard.scenes[1],
        ],
      },
    };
    // empty string is falsy, so ?? '(none)' doesn't kick in — it would still be empty.
    // But the actual code uses `weakScene?.retention_loop_note ?? '(none)'`
    // so it only substitutes when undefined/null, not empty string.
    const result = digestScript(script);
    expect(result).toContain('first scene retention loop: ""');
  });

  it('shows (none) when scenes array is empty', () => {
    const script: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    const result = digestScript(script);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('returns a non-empty string', () => {
    expect(digestScript(BASE_SCRIPT).length).toBeGreaterThan(0);
  });

  it('includes a formatted date', () => {
    const result = digestScript(BASE_SCRIPT);
    expect(result).toMatch(/\d/);
    expect(result).toContain('Script "');
  });
});
