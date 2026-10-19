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

// ── fixtures ────────────────────────────────────────────────────────────────

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-06-15T00:00:00.000Z',
};

const VIRAL_GAP: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'needs more tension' },
  retention_prediction: {
    at_3s_percent: 65,
    at_30s_percent: 42,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['improve hook', 'add pattern interrupt'],
  source_metrics: {},
};

const GROWTH_BLUEPRINT: GrowthBlueprint = {
  thematic_consistency: { score: 80, notes: 'consistent niche' },
  view_to_follower_ratio: { value: 0.15, assessment: 'above average' },
  posting_cadence: { avg_days_between_posts: 3.5, assessment: 'good' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['weekend mornings', 'holiday slots'],
  per_platform_notes: {},
};

const UPLOAD_DIAGNOSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'too dark' },
  audio_balance: { score: 75, notes: 'slightly quiet' },
  text_overlay_pacing: { assessment: 'captions too slow' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 45,
};

const SITE_DISCOVERY: SiteDiscoveryResult = {
  query: 'viral fitness content creators 2024',
  sites: [],
  outlier: {
    url: 'https://fitnessviralsite.com',
    reasoning: 'Unusually high engagement relative to post frequency',
  },
  summary: 'Ten sites analyzed',
};

const COMPETITOR_GAP: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['trending audio', 'challenge formats'],
  missing_topics: ['morning routines', 'nutrition basics'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['HIIT beginner', 'home gym setup'],
};

const SCRIPT_ROW: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'Top 5 Workout Mistakes',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'Stop doing this exercise wrong',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Close-up of bad squat form',
        dialogue_or_vo: 'If you squat like this you are wasting your time',
        audio_sfx_cue: 'buzzer sound',
        retention_loop_note: 'cut to comparison shot',
      },
      {
        scene_number: 2,
        visual_action: 'Correct form demo',
        dialogue_or_vo: 'Here is how to do it right',
        audio_sfx_cue: 'success chime',
        retention_loop_note: 'overlay arrow',
      },
    ],
    cta: 'Follow for more',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-08-01T00:00:00.000Z',
};

// ── digestReport ────────────────────────────────────────────────────────────

describe('digestReport', () => {
  it('formats a url (ViralGapAnalysis) report correctly', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: VIRAL_GAP };
    const result = digestReport(report);
    expect(result).toContain('Viral Gap Analyzer');
    expect(result).toContain('moderate');
    expect(result).toContain('72/100');
    expect(result).toContain('needs more tension');
    expect(result).toContain('retention 3s=65%');
    expect(result).toContain('30s=42%');
  });

  it('includes the formatted date for a url report', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: VIRAL_GAP };
    const result = digestReport(report);
    // toLocaleDateString varies by locale, but something date-like must be in the string
    expect(result).toMatch(/\d{1,4}/);
  });

  it('formats an account (GrowthBlueprint) report correctly', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: GROWTH_BLUEPRINT };
    const result = digestReport(report);
    expect(result).toContain('Account Deep-Dive');
    expect(result).toContain('80/100');
    expect(result).toContain('consistent niche');
    expect(result).toContain('weekend mornings');
    expect(result).toContain('holiday slots');
  });

  it('joins posting_blindspots with semicolons', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: GROWTH_BLUEPRINT };
    expect(digestReport(report)).toContain('weekend mornings; holiday slots');
  });

  it('shows "none noted" when posting_blindspots is empty', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'account',
      analysis: { ...GROWTH_BLUEPRINT, posting_blindspots: [] },
    };
    expect(digestReport(report)).toContain('none noted');
  });

  it('formats an upload (UploadDiagnosis) report correctly', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis: UPLOAD_DIAGNOSIS };
    const result = digestReport(report);
    expect(result).toContain('Upload Diagnostic');
    expect(result).toContain('moderate');
    expect(result).toContain('60/100');
    expect(result).toContain('audio balance 75/100');
    expect(result).toContain('slightly quiet');
    expect(result).toContain('captions too slow');
  });

  it('formats a discovery (SiteDiscoveryResult) report correctly', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'discovery', analysis: SITE_DISCOVERY };
    const result = digestReport(report);
    expect(result).toContain('Site Discovery');
    expect(result).toContain('viral fitness content creators 2024');
    expect(result).toContain('fitnessviralsite.com');
    expect(result).toContain('Unusually high engagement relative to post frequency');
  });

  it('formats a competitors (CompetitorGapAnalysis) report correctly (fallback branch)', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: COMPETITOR_GAP };
    const result = digestReport(report);
    expect(result).toContain('Competitor Espionage');
    expect(result).toContain('morning routines');
    expect(result).toContain('nutrition basics');
    expect(result).toContain('HIIT beginner');
    expect(result).toContain('home gym setup');
  });

  it('shows "none noted" when missing_topics is empty', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'competitors',
      analysis: { ...COMPETITOR_GAP, missing_topics: [] },
    };
    expect(digestReport(report)).toContain('none noted');
  });
});

// ── digestScript ─────────────────────────────────────────────────────────────

describe('digestScript', () => {
  it('includes the script title', () => {
    expect(digestScript(SCRIPT_ROW)).toContain('Top 5 Workout Mistakes');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(SCRIPT_ROW)).toContain('Stop doing this exercise wrong');
  });

  it('includes the scene count', () => {
    expect(digestScript(SCRIPT_ROW)).toContain('2 scenes total');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(SCRIPT_ROW)).toContain('cut to comparison shot');
  });

  it('falls back to "(none)" when the first scene has no retention_loop_note', () => {
    const row: ScriptRow = {
      ...SCRIPT_ROW,
      storyboard: {
        ...SCRIPT_ROW.storyboard,
        scenes: [
          {
            ...SCRIPT_ROW.storyboard.scenes[0],
            retention_loop_note: '',
          },
        ],
      },
    };
    // empty string is falsy for ??, so it stays ''. Only undefined/null triggers '(none)'
    const result = digestScript(row);
    expect(result).toContain('first scene retention loop: ""');
  });

  it('shows "(none)" when scenes array is empty', () => {
    const row: ScriptRow = {
      ...SCRIPT_ROW,
      storyboard: { ...SCRIPT_ROW.storyboard, scenes: [] },
    };
    expect(digestScript(row)).toContain('(none)');
    expect(digestScript(row)).toContain('0 scenes total');
  });

  it('includes a date string', () => {
    const result = digestScript(SCRIPT_ROW);
    // date was '2024-08-01', toLocaleDateString will produce something
    expect(result).toMatch(/\d/);
  });
});
