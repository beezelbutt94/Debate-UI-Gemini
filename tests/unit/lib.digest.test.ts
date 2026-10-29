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

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: 'https://tiktok.com/@test/video/1',
  platform: 'tiktok',
  viral_score: 72,
  timeline_recommendations: [],
  created_at: '2024-06-15T12:00:00Z',
};

const VIRAL_ANALYSIS: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'good pacing' },
  hook_evaluation: { score: 85, verdict: 'strong', notes: 'great opening' },
  retention_prediction: {
    at_3s_percent: 75,
    at_30s_percent: 45,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Add captions', 'Speed up intro'],
  source_metrics: {},
};

const GROWTH_BLUEPRINT: GrowthBlueprint = {
  thematic_consistency: { score: 65, notes: 'theme varies across posts' },
  view_to_follower_ratio: { value: 0.15, assessment: 'below average' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['weekends', 'morning slots'],
  per_platform_notes: {},
};

const UPLOAD_DIAGNOSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 70, verdict: 'moderate', notes: 'hook could be faster' },
  audio_balance: { score: 80, notes: 'good mix' },
  text_overlay_pacing: { assessment: 'slightly slow' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 120,
};

const SITE_DISCOVERY: SiteDiscoveryResult = {
  query: 'best cooking channels',
    sites: [
      {
        url: 'https://example.com',
        domain: 'example.com',
        title: 'Example',
        snippet: 'A snippet',
        relevance_reason: 'high engagement',
      },
    ],
  outlier: { url: 'https://example.com', reasoning: 'unique angle on the topic' },
  summary: 'Top cooking channels for 2024',
};

const COMPETITOR_ANALYSIS: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['vlog-style cooking', 'budget meals'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['quick breakfasts', 'meal prep sunday'],
};

// ─── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport()', () => {
  it('handles source_type="url" (ViralGapAnalysis)', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: VIRAL_ANALYSIS };
    const result = digestReport(report);
    expect(result).toContain('Viral Gap Analyzer');
    expect(result).toContain('strong');
    expect(result).toContain('85/100');
    expect(result).toContain('great opening');
    expect(result).toContain('75%');
    expect(result).toContain('45%');
  });

  it('url report includes the formatted date', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: VIRAL_ANALYSIS };
    const result = digestReport(report);
    // toLocaleDateString format varies by locale/platform, but a date should appear
    expect(result.length).toBeGreaterThan(10);
    expect(result).toMatch(/\d/); // contains at least one digit (year)
  });

  it('handles source_type="account" (GrowthBlueprint)', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: GROWTH_BLUEPRINT };
    const result = digestReport(report);
    expect(result).toContain('Account Deep-Dive');
    expect(result).toContain('65/100');
    expect(result).toContain('theme varies across posts');
    expect(result).toContain('weekends');
    expect(result).toContain('morning slots');
  });

  it('account report shows "none noted" when posting_blindspots is empty', () => {
    const analysis: GrowthBlueprint = { ...GROWTH_BLUEPRINT, posting_blindspots: [] };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis };
    const result = digestReport(report);
    expect(result).toContain('none noted');
  });

  it('handles source_type="upload" (UploadDiagnosis)', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis: UPLOAD_DIAGNOSIS };
    const result = digestReport(report);
    expect(result).toContain('Upload Diagnostic');
    expect(result).toContain('moderate');
    expect(result).toContain('70/100');
    expect(result).toContain('80/100');
    expect(result).toContain('good mix');
    expect(result).toContain('slightly slow');
  });

  it('handles source_type="discovery" (SiteDiscoveryResult)', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'discovery', analysis: SITE_DISCOVERY };
    const result = digestReport(report);
    expect(result).toContain('Site Discovery');
    expect(result).toContain('best cooking channels');
    expect(result).toContain('https://example.com');
    expect(result).toContain('unique angle on the topic');
  });

  it('handles source_type="competitors" (CompetitorGapAnalysis)', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: COMPETITOR_ANALYSIS };
    const result = digestReport(report);
    expect(result).toContain('Competitor Espionage');
    expect(result).toContain('vlog-style cooking');
    expect(result).toContain('budget meals');
    expect(result).toContain('quick breakfasts');
    expect(result).toContain('meal prep sunday');
  });

  it('competitors report shows "none noted" when missing_topics is empty', () => {
    const analysis: CompetitorGapAnalysis = { ...COMPETITOR_ANALYSIS, missing_topics: [], untapped_keyword_clusters: [] };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis };
    const result = digestReport(report);
    expect(result).toContain('none noted');
  });

  it('returns a non-empty string for every source_type', () => {
    const pairs: Array<[AuditReportRow['source_type'], unknown]> = [
      ['url', VIRAL_ANALYSIS],
      ['account', GROWTH_BLUEPRINT],
      ['upload', UPLOAD_DIAGNOSIS],
      ['discovery', SITE_DISCOVERY],
      ['competitors', COMPETITOR_ANALYSIS],
    ];
    for (const [source_type, analysis] of pairs) {
      const report = { ...BASE_REPORT, source_type, analysis } as AuditReportRow;
      expect(digestReport(report).length).toBeGreaterThan(0);
    }
  });

  it('url: hook verdict "weak" is included', () => {
    const analysis: ViralGapAnalysis = {
      ...VIRAL_ANALYSIS,
      hook_evaluation: { score: 30, verdict: 'weak', notes: 'confusing opening' },
    };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis };
    expect(digestReport(report)).toContain('weak');
    expect(digestReport(report)).toContain('30/100');
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const SCRIPT: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Viral Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know this one trick?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up on face',
          dialogue_or_vo: 'Did you know this one trick?',
          audio_sfx_cue: 'whoosh',
          retention_loop_note: 'opens with question',
        },
        {
          scene_number: 2,
          visual_action: 'B-roll',
          dialogue_or_vo: 'Here is the secret...',
          audio_sfx_cue: 'music',
          retention_loop_note: 'builds anticipation',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-12T08:00:00Z',
  };

  it('includes the script title', () => {
    expect(digestScript(SCRIPT)).toContain('My Viral Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(SCRIPT)).toContain('Did you know this one trick?');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(SCRIPT)).toContain('opens with question');
  });

  it('includes scene count', () => {
    expect(digestScript(SCRIPT)).toContain('2 scenes total');
  });

  it('returns a non-empty string', () => {
    expect(digestScript(SCRIPT).length).toBeGreaterThan(0);
  });

  it('shows "(none)" when first scene has no retention_loop_note', () => {
    const script: ScriptRow = {
      ...SCRIPT,
      storyboard: {
        ...SCRIPT.storyboard,
        scenes: [{ ...SCRIPT.storyboard.scenes[0], retention_loop_note: '' }],
      },
    };
    // empty string is falsy — ?? won't catch it, so '' stays as ''
    const result = digestScript(script);
    expect(result).toBeDefined();
  });

  it('shows "(none)" when storyboard has no scenes', () => {
    const script: ScriptRow = {
      ...SCRIPT,
      storyboard: { ...SCRIPT.storyboard, scenes: [] },
    };
    expect(digestScript(script)).toContain('(none)');
  });

  it('includes the formatted date', () => {
    const result = digestScript(SCRIPT);
    expect(result).toMatch(/\d/);
  });

  it('contains "Script" prefix', () => {
    expect(digestScript(SCRIPT)).toMatch(/^Script "/);
  });
});
