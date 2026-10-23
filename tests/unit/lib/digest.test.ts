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

// ── helpers ───────────────────────────────────────────────────────────────────

function baseReport<T>(
  overrides: Partial<AuditReportRow<T>> & { analysis: T; source_type: AuditReportRow['source_type'] }
): AuditReportRow<T> {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: '2024-09-12T00:00:00.000Z',
    ...overrides,
  };
}

const VIRAL: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'ok' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'slow start' },
  retention_prediction: {
    at_3s_percent: 65,
    at_30s_percent: 42,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Add pattern interrupt at 2s'],
  source_metrics: {},
};

const GROWTH: GrowthBlueprint = {
  thematic_consistency: { score: 80, notes: 'finance niche' },
  view_to_follower_ratio: { value: 2.5, assessment: 'above average' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
  theme_correction: [],
  view_maximization_tactics: ['Hook rewrite'],
  posting_blindspots: ['Weekend posting', 'Evening slots'],
  per_platform_notes: {},
};

const UPLOAD: UploadDiagnosis = {
  visual_hook_clarity: { score: 55, verdict: 'weak', notes: 'cluttered frame' },
  audio_balance: { score: 70, notes: 'slightly loud music' },
  text_overlay_pacing: { assessment: 'fast' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 48,
};

const COMPETITOR: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['trending audio', 'duets'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['morning routine', 'productivity'],
};

const DISCOVERY: SiteDiscoveryResult = {
  query: 'best editing tools 2024',
  sites: [],
  outlier: { url: 'https://example.com', reasoning: 'unique angle' },
  summary: 'found 10 sites',
};

// ── digestReport ──────────────────────────────────────────────────────────────

describe('digestReport – url', () => {
  const report = baseReport<ViralGapAnalysis>({ source_type: 'url', analysis: VIRAL });

  it('includes "Viral Gap Analyzer" label', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('72/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('slow start');
  });

  it('includes 3s retention %', () => {
    expect(digestReport(report)).toContain('3s=65%');
  });

  it('includes 30s retention %', () => {
    expect(digestReport(report)).toContain('30s=42%');
  });
});

describe('digestReport – account', () => {
  it('includes thematic consistency score and notes', () => {
    const r = digestReport(baseReport<GrowthBlueprint>({ source_type: 'account', analysis: GROWTH }));
    expect(r).toContain('Account Deep-Dive');
    expect(r).toContain('80/100');
    expect(r).toContain('finance niche');
  });

  it('joins multiple blindspots with semicolons', () => {
    const r = digestReport(baseReport<GrowthBlueprint>({ source_type: 'account', analysis: GROWTH }));
    expect(r).toContain('Weekend posting');
    expect(r).toContain('Evening slots');
  });

  it('shows "none noted" when posting_blindspots is empty', () => {
    const noBlindspots = { ...GROWTH, posting_blindspots: [] };
    const r = digestReport(baseReport<GrowthBlueprint>({ source_type: 'account', analysis: noBlindspots }));
    expect(r).toContain('none noted');
  });
});

describe('digestReport – upload', () => {
  const report = baseReport<UploadDiagnosis>({ source_type: 'upload', analysis: UPLOAD });

  it('includes "Upload Diagnostic" label', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict and score', () => {
    const r = digestReport(report);
    expect(r).toContain('weak');
    expect(r).toContain('55/100');
  });

  it('includes audio balance score and notes', () => {
    const r = digestReport(report);
    expect(r).toContain('70/100');
    expect(r).toContain('slightly loud music');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('fast');
  });
});

describe('digestReport – discovery', () => {
  const report = baseReport<SiteDiscoveryResult>({ source_type: 'discovery', analysis: DISCOVERY });

  it('includes "Site Discovery" label', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query string', () => {
    expect(digestReport(report)).toContain('best editing tools 2024');
  });

  it('includes outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com');
  });

  it('includes outlier reasoning', () => {
    expect(digestReport(report)).toContain('unique angle');
  });
});

describe('digestReport – competitors', () => {
  it('includes "Competitor Espionage" label', () => {
    const r = digestReport(baseReport<CompetitorGapAnalysis>({ source_type: 'competitors', analysis: COMPETITOR }));
    expect(r).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const r = digestReport(baseReport<CompetitorGapAnalysis>({ source_type: 'competitors', analysis: COMPETITOR }));
    expect(r).toContain('trending audio');
    expect(r).toContain('duets');
  });

  it('includes untapped keyword clusters', () => {
    const r = digestReport(baseReport<CompetitorGapAnalysis>({ source_type: 'competitors', analysis: COMPETITOR }));
    expect(r).toContain('morning routine');
    expect(r).toContain('productivity');
  });

  it('shows "none noted" when missing_topics is empty', () => {
    const noGaps = { ...COMPETITOR, missing_topics: [] };
    const r = digestReport(baseReport<CompetitorGapAnalysis>({ source_type: 'competitors', analysis: noGaps }));
    expect(r).toContain('none noted');
  });

  it('shows "none noted" when untapped_keyword_clusters is empty', () => {
    const noKeywords = { ...COMPETITOR, untapped_keyword_clusters: [] };
    const r = digestReport(baseReport<CompetitorGapAnalysis>({ source_type: 'competitors', analysis: noKeywords }));
    expect(r).toContain('none noted');
  });
});

// ── digestScript ──────────────────────────────────────────────────────────────

const SCENE_WITH_NOTE = {
  scene_number: 1,
  visual_action: 'zoom on clock',
  dialogue_or_vo: 'wake up',
  audio_sfx_cue: 'alarm',
  retention_loop_note: 'cliffhanger',
};

const SCENE_WITHOUT_NOTE = {
  ...SCENE_WITH_NOTE,
  scene_number: 2,
  retention_loop_note: '',
};

const BASE_SCRIPT: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'Morning Routine',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'Most people waste their morning...',
    scenes: [SCENE_WITH_NOTE, { ...SCENE_WITHOUT_NOTE }],
    cta: 'Follow for more',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-09-12T00:00:00.000Z',
};

describe('digestScript', () => {
  it('includes the script title', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Morning Routine');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Most people waste their morning...');
  });

  it('includes the first scene retention_loop_note when present', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('cliffhanger');
  });

  it('includes total scene count', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('2 scenes total');
  });

  it('includes a formatted date', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Script "Morning Routine" (');
  });

  it('shows empty string in output when first scene retention_loop_note is ""', () => {
    // ?? '(none)' only activates for null/undefined, not empty string
    const emptyNoteScript: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [{ ...SCENE_WITH_NOTE, retention_loop_note: '' }] },
    };
    const r = digestScript(emptyNoteScript);
    // The template literal produces `""`  (two double-quotes with nothing between)
    expect(r).toContain('""');
  });

  it('shows (none) when storyboard has no scenes', () => {
    const noScenes: ScriptRow = { ...BASE_SCRIPT, storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] } };
    expect(digestScript(noScenes)).toContain('(none)');
  });

  it('shows "0 scenes total" when storyboard has no scenes', () => {
    const noScenes: ScriptRow = { ...BASE_SCRIPT, storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] } };
    expect(digestScript(noScenes)).toContain('0 scenes total');
  });

  it('uses first scene even when there are many scenes', () => {
    const manyScenes: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: {
        ...BASE_SCRIPT.storyboard,
        scenes: [
          { ...SCENE_WITH_NOTE, retention_loop_note: 'first-hook' },
          { ...SCENE_WITH_NOTE, scene_number: 2, retention_loop_note: 'second-hook' },
          { ...SCENE_WITH_NOTE, scene_number: 3, retention_loop_note: 'third-hook' },
        ],
      },
    };
    const r = digestScript(manyScenes);
    expect(r).toContain('first-hook');
    expect(r).not.toContain('second-hook');
    expect(r).toContain('3 scenes total');
  });
});
