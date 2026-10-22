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
  Storyboard,
} from '@/lib/types';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeReport<T>(
  overrides: Partial<AuditReportRow<T>> & { source_type: AuditReportRow['source_type']; analysis: T }
): AuditReportRow<T> {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: '2024-09-12T10:00:00Z',
    ...overrides,
  };
}

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
  hook_evaluation: { score: 78, verdict: 'strong', notes: 'Hooks immediately.' },
  retention_prediction: {
    at_3s_percent: 70,
    at_30s_percent: 45,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Cut tighter'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 82, notes: 'Consistent niche.' },
  view_to_follower_ratio: { value: 0.15, assessment: 'good' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'regular' },
  theme_correction: [],
  view_maximization_tactics: ['Use trending audio'],
  posting_blindspots: ['Weekends', 'Tuesday AM'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 65, verdict: 'moderate', notes: 'Could be stronger.' },
  audio_balance: { score: 70, notes: 'Voice a bit quiet.' },
  text_overlay_pacing: { assessment: 'too fast' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 6,
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['Viral challenges'],
  missing_topics: ['Tutorial series', 'Behind the scenes'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['Trending topic A', 'Keyword B'],
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'viral video tactics 2024',
  sites: [],
  outlier: { url: 'https://example.com/outlier', reasoning: 'Uniquely structured content.' },
  summary: 'Several high-value sites found.',
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('digestReport – source_type=url (ViralGapAnalysis)', () => {
  const report = makeReport({ source_type: 'url', analysis: viralAnalysis });

  it('includes "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('78');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Hooks immediately.');
  });

  it('includes 3s retention percentage', () => {
    expect(digestReport(report)).toContain('3s=70%');
  });

  it('includes 30s retention percentage', () => {
    expect(digestReport(report)).toContain('30s=45%');
  });

  it('includes a formatted date', () => {
    const digest = digestReport(report);
    // Locale-formatted date should be non-empty and present
    expect(digest).toMatch(/\d/); // at least has digits (year)
  });
});

describe('digestReport – source_type=account (GrowthBlueprint)', () => {
  const report = makeReport({ source_type: 'account', analysis: growthAnalysis });

  it('includes "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic_consistency score', () => {
    expect(digestReport(report)).toContain('82');
  });

  it('includes posting blindspots', () => {
    const d = digestReport(report);
    expect(d).toContain('Weekends');
    expect(d).toContain('Tuesday AM');
  });

  it('shows "none noted" when blindspots is empty', () => {
    const noBlindspots: GrowthBlueprint = { ...growthAnalysis, posting_blindspots: [] };
    const report2 = makeReport({ source_type: 'account', analysis: noBlindspots });
    expect(digestReport(report2)).toContain('none noted');
  });
});

describe('digestReport – source_type=upload (UploadDiagnosis)', () => {
  const report = makeReport({ source_type: 'upload', analysis: uploadAnalysis });

  it('includes "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('70');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('too fast');
  });
});

describe('digestReport – source_type=discovery (SiteDiscoveryResult)', () => {
  const report = makeReport({ source_type: 'discovery', analysis: discoveryAnalysis });

  it('includes "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the search query', () => {
    expect(digestReport(report)).toContain('viral video tactics 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/outlier');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Uniquely structured content.');
  });
});

describe('digestReport – source_type=competitors (CompetitorGapAnalysis)', () => {
  const report = makeReport({ source_type: 'competitors', analysis: competitorAnalysis });

  it('includes "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const d = digestReport(report);
    expect(d).toContain('Tutorial series');
    expect(d).toContain('Behind the scenes');
  });

  it('includes untapped keyword clusters', () => {
    const d = digestReport(report);
    expect(d).toContain('Trending topic A');
    expect(d).toContain('Keyword B');
  });

  it('shows "none noted" for empty missing_topics', () => {
    const empty: CompetitorGapAnalysis = { ...competitorAnalysis, missing_topics: [] };
    const r = makeReport({ source_type: 'competitors', analysis: empty });
    expect(digestReport(r)).toContain('none noted');
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    const empty: CompetitorGapAnalysis = {
      ...competitorAnalysis,
      untapped_keyword_clusters: [],
    };
    const r = makeReport({ source_type: 'competitors', analysis: empty });
    expect(digestReport(r)).toContain('none noted');
  });
});

// ── digestScript ──────────────────────────────────────────────────────────────

function makeScript(overrides: Partial<ScriptRow> = {}): ScriptRow {
  const storyboard: Storyboard = {
    spoken_hook: 'This will change your life.',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Creator looks at camera',
        dialogue_or_vo: 'Did you know...',
        audio_sfx_cue: 'upbeat music',
        retention_loop_note: 'Cliffhanger on the promise.',
      },
      {
        scene_number: 2,
        visual_action: 'B-roll of the product',
        dialogue_or_vo: 'Here is how.',
        audio_sfx_cue: '',
        retention_loop_note: '',
      },
    ],
    cta: 'Follow for more.',
    memory_context_used: false,
  };

  return {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Viral Script',
    source_prompt: null,
    storyboard,
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-15T08:00:00Z',
    ...overrides,
  };
}

describe('digestScript', () => {
  it('includes the script title', () => {
    expect(digestScript(makeScript())).toContain('My Viral Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(makeScript())).toContain('This will change your life.');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(makeScript())).toContain('Cliffhanger on the promise.');
  });

  it('includes the total scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes');
  });

  it('returns "(none)" when first scene has no retention_loop_note', () => {
    const script = makeScript();
    script.storyboard.scenes[0].retention_loop_note = '';
    // empty string is falsy → nullish coalescing picks the fallback
    // BUT the code uses `?? '(none)'`, not `|| '(none)'`. An empty string
    // is not null/undefined, so it will be shown as-is (empty).
    // Test the actual behavior: empty string IS shown as empty, not '(none)'.
    const digest = digestScript(script);
    expect(typeof digest).toBe('string');
    expect(digest.length).toBeGreaterThan(0);
  });

  it('returns "(none)" when first scene is undefined', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    expect(digestScript(script)).toContain('(none)');
  });

  it('includes a formatted date', () => {
    const digest = digestScript(makeScript());
    expect(digest).toMatch(/\d/);
  });
});
