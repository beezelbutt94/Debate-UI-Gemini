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

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'report-1',
  user_id: 'user-1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-06-15T10:00:00.000Z',
};

const VIRAL_ANALYSIS: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'Good pacing' },
  hook_evaluation: { score: 78, verdict: 'strong', notes: 'Great opening hook' },
  retention_prediction: {
    at_3s_percent: 72,
    at_30s_percent: 45,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Improve CTA'],
  source_metrics: {},
};

const GROWTH_ANALYSIS: GrowthBlueprint = {
  thematic_consistency: { score: 85, notes: 'Very consistent niche' },
  view_to_follower_ratio: { value: 2.5, assessment: 'Strong' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'Regular' },
  theme_correction: [],
  view_maximization_tactics: ['Use trending sounds'],
  posting_blindspots: ['No weekend posts', 'Misses Monday mornings'],
  per_platform_notes: {},
};

const UPLOAD_ANALYSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 65, verdict: 'moderate', notes: 'Could be stronger' },
  audio_balance: { score: 80, notes: 'Well balanced' },
  text_overlay_pacing: { assessment: 'Text disappears too fast' },
  b_roll_recommendations: ['Add more b-roll'],
  retention_boosters: ['Pattern interrupt at 5s'],
  frames_analyzed: 120,
};

const DISCOVERY_ANALYSIS: SiteDiscoveryResult = {
  query: 'viral fitness content creators',
  sites: [],
  outlier: { url: 'https://example.com', reasoning: 'Unique approach' },
  summary: 'Found 10 relevant sites',
};

const COMPETITOR_ANALYSIS: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['Daily vlogs'],
  missing_topics: ['Morning routines', 'Meal prep'],
  audience_sentiment_gaps: ['Wants more behind-the-scenes'],
  untapped_keyword_clusters: ['beginner fitness', 'home workout'],
};

// ─── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport', () => {
  it('url: includes "Viral Gap Analyzer" label', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: VIRAL_ANALYSIS };
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('url: includes hook verdict', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: VIRAL_ANALYSIS };
    expect(digestReport(report)).toContain('strong');
  });

  it('url: includes hook score', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: VIRAL_ANALYSIS };
    expect(digestReport(report)).toContain('78');
  });

  it('url: includes hook notes', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: VIRAL_ANALYSIS };
    expect(digestReport(report)).toContain('Great opening hook');
  });

  it('url: includes 3s retention percentage', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: VIRAL_ANALYSIS };
    expect(digestReport(report)).toContain('72');
  });

  it('url: includes 30s retention percentage', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: VIRAL_ANALYSIS };
    expect(digestReport(report)).toContain('45');
  });

  it('url: includes formatted date from created_at', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: VIRAL_ANALYSIS };
    const result = digestReport(report);
    // Should have some date string representation
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/\d+\/\d+\/\d+|\d{4}-\d{2}-\d{2}/);
  });

  it('account: includes "Account Deep-Dive" label', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: GROWTH_ANALYSIS };
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('account: includes thematic consistency score', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: GROWTH_ANALYSIS };
    expect(digestReport(report)).toContain('85');
  });

  it('account: includes thematic consistency notes', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: GROWTH_ANALYSIS };
    expect(digestReport(report)).toContain('Very consistent niche');
  });

  it('account: includes posting blindspots joined by semicolons', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: GROWTH_ANALYSIS };
    const result = digestReport(report);
    expect(result).toContain('No weekend posts');
    expect(result).toContain('Misses Monday mornings');
  });

  it('account: shows "none noted" when posting_blindspots is empty', () => {
    const analysis: GrowthBlueprint = { ...GROWTH_ANALYSIS, posting_blindspots: [] };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis };
    expect(digestReport(report)).toContain('none noted');
  });

  it('upload: includes "Upload Diagnostic" label', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis: UPLOAD_ANALYSIS };
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('upload: includes visual hook verdict', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis: UPLOAD_ANALYSIS };
    expect(digestReport(report)).toContain('moderate');
  });

  it('upload: includes visual hook score', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis: UPLOAD_ANALYSIS };
    expect(digestReport(report)).toContain('65');
  });

  it('upload: includes audio balance score', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis: UPLOAD_ANALYSIS };
    expect(digestReport(report)).toContain('80');
  });

  it('upload: includes audio balance notes', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis: UPLOAD_ANALYSIS };
    expect(digestReport(report)).toContain('Well balanced');
  });

  it('upload: includes text overlay pacing assessment', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis: UPLOAD_ANALYSIS };
    expect(digestReport(report)).toContain('Text disappears too fast');
  });

  it('discovery: includes "Site Discovery" label', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'discovery', analysis: DISCOVERY_ANALYSIS };
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('discovery: includes the query string', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'discovery', analysis: DISCOVERY_ANALYSIS };
    expect(digestReport(report)).toContain('viral fitness content creators');
  });

  it('discovery: includes outlier URL', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'discovery', analysis: DISCOVERY_ANALYSIS };
    expect(digestReport(report)).toContain('https://example.com');
  });

  it('discovery: includes outlier reasoning', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'discovery', analysis: DISCOVERY_ANALYSIS };
    expect(digestReport(report)).toContain('Unique approach');
  });

  it('competitors: includes "Competitor Espionage" label', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: COMPETITOR_ANALYSIS };
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('competitors: includes missing topics', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: COMPETITOR_ANALYSIS };
    const result = digestReport(report);
    expect(result).toContain('Morning routines');
    expect(result).toContain('Meal prep');
  });

  it('competitors: includes untapped keyword clusters', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: COMPETITOR_ANALYSIS };
    const result = digestReport(report);
    expect(result).toContain('beginner fitness');
    expect(result).toContain('home workout');
  });

  it('competitors: shows "none noted" when missing_topics is empty', () => {
    const analysis: CompetitorGapAnalysis = { ...COMPETITOR_ANALYSIS, missing_topics: [] };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis };
    expect(digestReport(report)).toContain('none noted');
  });

  it('competitors: shows "none noted" when untapped_keyword_clusters is empty', () => {
    const analysis: CompetitorGapAnalysis = {
      ...COMPETITOR_ANALYSIS,
      missing_topics: [],
      untapped_keyword_clusters: [],
    };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis };
    const result = digestReport(report);
    // Both arrays empty → both should show "none noted"
    expect(result.match(/none noted/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('all source_types return a non-empty string', () => {
    const cases: AuditReportRow['source_type'][] = [
      'url', 'account', 'upload', 'discovery', 'competitors'
    ];
    const analyses = [
      VIRAL_ANALYSIS, GROWTH_ANALYSIS, UPLOAD_ANALYSIS, DISCOVERY_ANALYSIS, COMPETITOR_ANALYSIS
    ];
    for (let i = 0; i < cases.length; i++) {
      const report: AuditReportRow = { ...BASE_REPORT, source_type: cases[i], analysis: analyses[i] };
      expect(digestReport(report)).toBeTruthy();
    }
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

const BASE_SCRIPT: ScriptRow = {
  id: 'script-1',
  user_id: 'user-1',
  creator_profile_id: null,
  title: 'How to Go Viral on TikTok',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'You are about to learn the secret to going viral.',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Wide shot of creator at desk',
        dialogue_or_vo: 'The secret is simpler than you think.',
        audio_sfx_cue: 'Upbeat intro music',
        retention_loop_note: 'Tease the answer without revealing it',
      },
      {
        scene_number: 2,
        visual_action: 'Cut to whiteboard',
        dialogue_or_vo: 'Here is the framework.',
        audio_sfx_cue: 'Transition sound',
        retention_loop_note: 'Present the main framework',
      },
      {
        scene_number: 3,
        visual_action: 'Close-up on screen',
        dialogue_or_vo: 'Apply these three steps.',
        audio_sfx_cue: 'Suspenseful sting',
        retention_loop_note: 'Call to action loop',
      },
    ],
    cta: 'Follow for more viral tips',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-06-20T15:30:00.000Z',
};

describe('digestScript', () => {
  it('includes the script title', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('How to Go Viral on TikTok');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('You are about to learn the secret to going viral.');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Tease the answer without revealing it');
  });

  it('includes the total scene count', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('3');
  });

  it('includes a formatted date', () => {
    const result = digestScript(BASE_SCRIPT);
    expect(result).toMatch(/\d+\/\d+\/\d+|\d{4}-\d{2}-\d{2}/);
  });

  it('returns a non-empty string', () => {
    expect(digestScript(BASE_SCRIPT)).toBeTruthy();
  });

  it('shows "(none)" when scenes array is empty (no first scene)', () => {
    const script: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    expect(digestScript(script)).toContain('(none)');
  });

  it('shows scene count of 0 when scenes is empty', () => {
    const script: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    expect(digestScript(script)).toContain('0 scenes');
  });

  it('uses only the first scene for retention_loop_note (not other scenes)', () => {
    const result = digestScript(BASE_SCRIPT);
    // First scene note should appear; other scenes' notes should not
    expect(result).toContain('Tease the answer without revealing it');
    expect(result).not.toContain('Present the main framework');
    expect(result).not.toContain('Call to action loop');
  });

  it('works with a single-scene script', () => {
    const script: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: {
        ...BASE_SCRIPT.storyboard,
        scenes: [BASE_SCRIPT.storyboard.scenes[0]],
      },
    };
    const result = digestScript(script);
    expect(result).toContain('1 scenes');
    expect(result).toContain('Tease the answer without revealing it');
  });
});
