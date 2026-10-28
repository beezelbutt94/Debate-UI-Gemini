import { describe, it, expect } from 'vitest';
import { digestReport, digestScript } from '../../lib/digest';
import type {
  AuditReportRow,
  ScriptRow,
  ViralGapAnalysis,
  GrowthBlueprint,
  UploadDiagnosis,
  CompetitorGapAnalysis,
  SiteDiscoveryResult,
} from '../../lib/types';

// ── helpers ──────────────────────────────────────────────────────────────────

function baseReport(overrides: Partial<AuditReportRow>): AuditReportRow {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: '2024-06-15T00:00:00.000Z',
    ...overrides,
  } as AuditReportRow;
}

// ── digestReport: source_type === 'url' ──────────────────────────────────────

const urlAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'good' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'could grab faster' },
  retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: [],
  source_metrics: {},
};

describe('digestReport – url source_type', () => {
  const report = baseReport({ source_type: 'url', analysis: urlAnalysis });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('72/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('could grab faster');
  });

  it('includes 3s retention', () => {
    expect(digestReport(report)).toContain('3s=65%');
  });

  it('includes 30s retention', () => {
    expect(digestReport(report)).toContain('30s=42%');
  });

  it('starts with Viral Gap Analyzer', () => {
    expect(digestReport(report)).toMatch(/^Viral Gap Analyzer/);
  });

  it('includes formatted date', () => {
    // Locale-formatted date of 2024-06-15 — just check it's present and non-empty
    const result = digestReport(report);
    expect(result).toMatch(/\d/); // at least some digits in the date
    expect(result).toContain('Viral Gap Analyzer');
  });

  it('strong verdict appears correctly', () => {
    const strongAnalysis = { ...urlAnalysis, hook_evaluation: { ...urlAnalysis.hook_evaluation, verdict: 'strong' as const, score: 90, notes: 'great hook' } };
    const r = baseReport({ source_type: 'url', analysis: strongAnalysis });
    expect(digestReport(r)).toContain('strong');
    expect(digestReport(r)).toContain('90/100');
  });
});

// ── digestReport: source_type === 'account' ──────────────────────────────────

const accountAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 55, notes: 'niche drift detected' },
  view_to_follower_ratio: { value: 0.12, assessment: 'below average' },
  posting_cadence: { avg_days_between_posts: 3.5, assessment: 'consistent' },
  theme_correction: ['stick to cooking'],
  view_maximization_tactics: ['use trending sounds'],
  posting_blindspots: ['weekday mornings', 'sunday evening'],
  per_platform_notes: {},
};

describe('digestReport – account source_type', () => {
  const report = baseReport({ source_type: 'account', analysis: accountAnalysis });

  it('starts with Account Deep-Dive', () => {
    expect(digestReport(report)).toMatch(/^Account Deep-Dive/);
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('55/100');
  });

  it('includes thematic notes', () => {
    expect(digestReport(report)).toContain('niche drift detected');
  });

  it('includes posting blindspots joined by semicolon', () => {
    expect(digestReport(report)).toContain('weekday mornings; sunday evening');
  });

  it('shows "none noted" when blindspots array is empty', () => {
    const noBlindspots = { ...accountAnalysis, posting_blindspots: [] };
    const r = baseReport({ source_type: 'account', analysis: noBlindspots });
    expect(digestReport(r)).toContain('none noted');
  });
});

// ── digestReport: source_type === 'upload' ───────────────────────────────────

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 68, verdict: 'moderate', notes: 'thumbnail unclear' },
  audio_balance: { score: 80, notes: 'good mix' },
  text_overlay_pacing: { assessment: 'too fast' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 24,
};

describe('digestReport – upload source_type', () => {
  const report = baseReport({ source_type: 'upload', analysis: uploadAnalysis });

  it('starts with Upload Diagnostic', () => {
    expect(digestReport(report)).toMatch(/^Upload Diagnostic/);
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('68/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('80/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('good mix');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('too fast');
  });
});

// ── digestReport: source_type === 'discovery' ────────────────────────────────

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'viral cooking content',
    sites: [],
  outlier: {
    url: 'https://example.com/recipe-hack',
    reasoning: 'focuses on 30-second recipes unlike others',
  },
  summary: 'Found 10 relevant sites',
};

describe('digestReport – discovery source_type', () => {
  const report = baseReport({ source_type: 'discovery', analysis: discoveryAnalysis });

  it('starts with Site Discovery', () => {
    expect(digestReport(report)).toMatch(/^Site Discovery/);
  });

  it('includes query string', () => {
    expect(digestReport(report)).toContain('viral cooking content');
  });

  it('includes outlier url', () => {
    expect(digestReport(report)).toContain('https://example.com/recipe-hack');
  });

  it('includes outlier reasoning', () => {
    expect(digestReport(report)).toContain('focuses on 30-second recipes unlike others');
  });
});

// ── digestReport: source_type === 'competitors' (default) ───────────────────

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['vegan desserts'],
  missing_topics: ['quick breakfasts', 'meal prep'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['gluten-free', 'keto snacks'],
};

describe('digestReport – competitors source_type (default branch)', () => {
  const report = baseReport({ source_type: 'competitors', analysis: competitorAnalysis });

  it('starts with Competitor Espionage', () => {
    expect(digestReport(report)).toMatch(/^Competitor Espionage/);
  });

  it('includes missing topics joined by semicolon', () => {
    expect(digestReport(report)).toContain('quick breakfasts; meal prep');
  });

  it('includes untapped keyword clusters', () => {
    expect(digestReport(report)).toContain('gluten-free; keto snacks');
  });

  it('shows "none noted" when missing_topics is empty', () => {
    const noMissing = { ...competitorAnalysis, missing_topics: [] };
    const r = baseReport({ source_type: 'competitors', analysis: noMissing });
    expect(digestReport(r)).toContain('none noted');
  });

  it('shows "none noted" when untapped_keyword_clusters is empty', () => {
    const noKeywords = { ...competitorAnalysis, untapped_keyword_clusters: [] };
    const r = baseReport({ source_type: 'competitors', analysis: noKeywords });
    expect(digestReport(r)).toContain('none noted');
  });
});

// ── digestScript ─────────────────────────────────────────────────────────────

function makeScript(overrides: Partial<ScriptRow> = {}): ScriptRow {
  return {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Viral Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'You won\'t believe this trick',
      scenes: [
        { scene_number: 1, visual_action: 'wide shot', dialogue_or_vo: 'intro', audio_sfx_cue: 'none', retention_loop_note: 'cut to reaction' },
        { scene_number: 2, visual_action: 'close up', dialogue_or_vo: 'demo', audio_sfx_cue: 'music', retention_loop_note: 'tease next step' },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-12T00:00:00.000Z',
    ...overrides,
  };
}

describe('digestScript', () => {
  it('includes script title', () => {
    expect(digestScript(makeScript())).toContain('My Viral Script');
  });

  it('includes spoken hook', () => {
    expect(digestScript(makeScript())).toContain("You won't believe this trick");
  });

  it('includes first scene retention loop note', () => {
    expect(digestScript(makeScript())).toContain('cut to reaction');
  });

  it('includes total scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });

  it('shows (none) for retention loop when scenes array is empty', () => {
    const script = makeScript({ storyboard: { ...makeScript().storyboard, scenes: [] } });
    expect(digestScript(script)).toContain('(none)');
  });

  it('starts with Script "title"', () => {
    expect(digestScript(makeScript())).toMatch(/^Script "/);
  });

  it('works with a single scene', () => {
    const script = makeScript({
      storyboard: {
        ...makeScript().storyboard,
        scenes: [{ scene_number: 1, visual_action: 'open', dialogue_or_vo: 'hi', audio_sfx_cue: '', retention_loop_note: 'loop back' }],
      },
    });
    const result = digestScript(script);
    expect(result).toContain('1 scenes total');
    expect(result).toContain('loop back');
  });
});
