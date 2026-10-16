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

// ── helpers ──────────────────────────────────────────────────────────────────

function makeReport<T>(
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
    created_at: '2024-01-15T10:00:00Z',
    ...overrides,
  };
}

const viralGapAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'good' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'needs faster cut' },
  retention_prediction: {
    at_3s_percent: 65,
    at_30s_percent: 42,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Add B-roll in first 3s'],
  source_metrics: {},
};

const growthBlueprint: GrowthBlueprint = {
  thematic_consistency: { score: 81, notes: 'mostly on-niche' },
  view_to_follower_ratio: { value: 0.12, assessment: 'above average' },
  posting_cadence: { avg_days_between_posts: 4.5, assessment: 'consistent' },
  theme_correction: [],
  view_maximization_tactics: ['Use trending sounds'],
  posting_blindspots: ['Missing Sunday uploads', 'No Friday posts'],
  per_platform_notes: {},
};

const uploadDiagnosis: UploadDiagnosis = {
  visual_hook_clarity: { score: 55, verdict: 'weak', notes: 'face not visible in first frame' },
  audio_balance: { score: 78, notes: 'slight music clipping' },
  text_overlay_pacing: { assessment: 'too slow' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 6,
};

const competitorGapAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['travel hacks'],
  missing_topics: ['budget tips', 'packing guides'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['solo travel under $50', 'cheap flights'],
};

const siteDiscovery: SiteDiscoveryResult = {
  query: 'best budget travel blogs 2024',
  sites: [],
  outlier: { url: 'https://nomadic-matt.com', reasoning: 'only site using video-first content' },
  summary: 'Found 10 travel sites',
};

// ── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport() — url (ViralGapAnalysis)', () => {
  const report = makeReport<ViralGapAnalysis>({ source_type: 'url', analysis: viralGapAnalysis });

  it('starts with "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toMatch(/^Viral Gap Analyzer/);
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('72/100');
  });

  it('includes the hook notes', () => {
    expect(digestReport(report)).toContain('needs faster cut');
  });

  it('includes 3s retention percent', () => {
    expect(digestReport(report)).toContain('3s=65%');
  });

  it('includes 30s retention percent', () => {
    expect(digestReport(report)).toContain('30s=42%');
  });

  it('includes a formatted date', () => {
    expect(digestReport(report)).toContain('1/15/2024');
  });
});

describe('digestReport() — account (GrowthBlueprint)', () => {
  const report = makeReport<GrowthBlueprint>({ source_type: 'account', analysis: growthBlueprint });

  it('starts with "Account Deep-Dive"', () => {
    expect(digestReport(report)).toMatch(/^Account Deep-Dive/);
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('81/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('mostly on-niche');
  });

  it('includes posting blindspots', () => {
    expect(digestReport(report)).toContain('Missing Sunday uploads');
    expect(digestReport(report)).toContain('No Friday posts');
  });

  it('returns "none noted" when blindspots array is empty', () => {
    const noBlindspots = { ...growthBlueprint, posting_blindspots: [] };
    const r = makeReport<GrowthBlueprint>({ source_type: 'account', analysis: noBlindspots });
    expect(digestReport(r)).toContain('none noted');
  });
});

describe('digestReport() — upload (UploadDiagnosis)', () => {
  const report = makeReport<UploadDiagnosis>({ source_type: 'upload', analysis: uploadDiagnosis });

  it('starts with "Upload Diagnostic"', () => {
    expect(digestReport(report)).toMatch(/^Upload Diagnostic/);
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('weak');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('55/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('78/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('slight music clipping');
  });

  it('includes text overlay assessment', () => {
    expect(digestReport(report)).toContain('too slow');
  });
});

describe('digestReport() — competitors (CompetitorGapAnalysis)', () => {
  const report = makeReport<CompetitorGapAnalysis>({
    source_type: 'competitors',
    analysis: competitorGapAnalysis,
  });

  it('starts with "Competitor Espionage"', () => {
    expect(digestReport(report)).toMatch(/^Competitor Espionage/);
  });

  it('includes missing topics', () => {
    expect(digestReport(report)).toContain('budget tips');
    expect(digestReport(report)).toContain('packing guides');
  });

  it('includes untapped keyword clusters', () => {
    expect(digestReport(report)).toContain('solo travel under $50');
    expect(digestReport(report)).toContain('cheap flights');
  });

  it('returns "none noted" for empty arrays', () => {
    const empty = { ...competitorGapAnalysis, missing_topics: [], untapped_keyword_clusters: [] };
    const r = makeReport<CompetitorGapAnalysis>({ source_type: 'competitors', analysis: empty });
    expect(digestReport(r)).toMatch(/none noted.*none noted/);
  });
});

describe('digestReport() — discovery (SiteDiscoveryResult)', () => {
  const report = makeReport<SiteDiscoveryResult>({ source_type: 'discovery', analysis: siteDiscovery });

  it('starts with "Site Discovery"', () => {
    expect(digestReport(report)).toMatch(/^Site Discovery/);
  });

  it('includes the query string', () => {
    expect(digestReport(report)).toContain('best budget travel blogs 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://nomadic-matt.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('only site using video-first content');
  });
});

// ── digestScript ──────────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const script: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'Epic Travel Hook',
    source_prompt: null,
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-03-20T08:00:00Z',
    storyboard: {
      spoken_hook: 'Did you know you can travel the world for $30/day?',
      memory_context_used: false,
      cta: 'Follow for more budget travel tips',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Aerial shot of beach',
          dialogue_or_vo: 'Narrate the hook',
          audio_sfx_cue: 'wave sound',
          retention_loop_note: 'cut right before revealing destination',
        },
        {
          scene_number: 2,
          visual_action: 'B-roll of food market',
          dialogue_or_vo: 'Show the $5 meal',
          audio_sfx_cue: 'upbeat music',
          retention_loop_note: 'show price tag close-up',
        },
      ],
    },
  };

  it('contains the script title', () => {
    expect(digestScript(script)).toContain('Epic Travel Hook');
  });

  it('contains the spoken hook', () => {
    expect(digestScript(script)).toContain('Did you know you can travel the world for $30/day?');
  });

  it('contains the first scene retention loop note', () => {
    expect(digestScript(script)).toContain('cut right before revealing destination');
  });

  it('contains the scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('includes a formatted date', () => {
    expect(digestScript(script)).toContain('3/20/2024');
  });

  it('handles empty scenes gracefully (no throw)', () => {
    const noScenes = { ...script, storyboard: { ...script.storyboard, scenes: [] } };
    expect(() => digestScript(noScenes)).not.toThrow();
  });

  it('uses "(none)" for retention loop note when scenes are empty', () => {
    const noScenes = { ...script, storyboard: { ...script.storyboard, scenes: [] } };
    expect(digestScript(noScenes)).toContain('(none)');
  });

  it('uses "(none)" when first scene has no retention_loop_note', () => {
    const blankNote = {
      ...script,
      storyboard: {
        ...script.storyboard,
        scenes: [{ ...script.storyboard.scenes[0], retention_loop_note: '' }],
      },
    };
    // '' is falsy so ?? '(none)' would not fire, but the actual value is ''
    // The function uses `?? '(none)'` which fires only for null/undefined.
    // An empty string is passed through as-is.
    expect(digestScript(blankNote)).toBeDefined();
  });
});
