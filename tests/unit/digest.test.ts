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

// ── helpers ──────────────────────────────────────────────────────────────────

function makeReport<T>(
  source_type: AuditReportRow['source_type'],
  analysis: T,
  created_at = '2024-06-15T10:00:00.000Z',
): AuditReportRow {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_type,
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at,
  } as AuditReportRow;
}

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
  hook_evaluation: { score: 82, verdict: 'strong', notes: 'Grabs attention immediately' },
  retention_prediction: {
    at_3s_percent: 72,
    at_30s_percent: 45,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Add captions'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 68, notes: 'Needs tighter niche' },
  view_to_follower_ratio: { value: 0.05, assessment: 'below average' },
  posting_cadence: { avg_days_between_posts: 3.5, assessment: 'consistent' },
  theme_correction: ['Focus on cooking niche'],
  view_maximization_tactics: ['Use trending audio'],
  posting_blindspots: ['Tuesday evenings', 'Sunday mornings'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 75, verdict: 'moderate', notes: 'Hook visible but could be faster' },
  audio_balance: { score: 60, notes: 'Music too loud' },
  text_overlay_pacing: { assessment: 'Text stays on screen too long' },
  b_roll_recommendations: ['Add B-roll cutaways'],
  retention_boosters: ['Cliffhanger at 5s'],
  frames_analyzed: 240,
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'best cooking channels 2024',
    sites: [
    {
      url: 'https://example.com/cooking',
      domain: 'example.com',
      title: 'Top Cooking',
      snippet: 'Great recipes',
      relevance_reason: 'highly relevant',
    },
  ],
  outlier: { url: 'https://example.com/cooking', reasoning: 'Uses unusual format' },
  summary: 'Found 10 top cooking sites',
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['recipes'],
  missing_topics: ['budget meals', 'meal prep'],
  audience_sentiment_gaps: ['wants more variety'],
  untapped_keyword_clusters: ['quick dinners', 'one-pot meals'],
};

// ── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport – url (ViralGapAnalysis)', () => {
  const report = makeReport('url', viralAnalysis, '2024-06-15T10:00:00.000Z');

  it('includes "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('82/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Grabs attention immediately');
  });

  it('includes 3s retention', () => {
    expect(digestReport(report)).toContain('3s=72%');
  });

  it('includes 30s retention', () => {
    expect(digestReport(report)).toContain('30s=45%');
  });

  it('includes a formatted date', () => {
    const result = digestReport(report);
    // date string is locale-dependent but always contains some digits
    expect(result).toMatch(/\d/);
  });
});

describe('digestReport – account (GrowthBlueprint)', () => {
  const report = makeReport('account', growthAnalysis);

  it('includes "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('68/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Needs tighter niche');
  });

  it('includes posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Tuesday evenings');
    expect(result).toContain('Sunday mornings');
  });

  it('shows "none noted" when no blindspots', () => {
    const noBlindspots = makeReport('account', {
      ...growthAnalysis,
      posting_blindspots: [],
    } as GrowthBlueprint);
    expect(digestReport(noBlindspots)).toContain('none noted');
  });
});

describe('digestReport – upload (UploadDiagnosis)', () => {
  const report = makeReport('upload', uploadAnalysis);

  it('includes "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('75/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('60/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Music too loud');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Text stays on screen too long');
  });
});

describe('digestReport – discovery (SiteDiscoveryResult)', () => {
  const report = makeReport('discovery', discoveryAnalysis);

  it('includes "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query', () => {
    expect(digestReport(report)).toContain('best cooking channels 2024');
  });

  it('includes outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/cooking');
  });

  it('includes outlier reasoning', () => {
    expect(digestReport(report)).toContain('Uses unusual format');
  });
});

describe('digestReport – competitors (CompetitorGapAnalysis)', () => {
  const report = makeReport('competitors', competitorAnalysis);

  it('includes "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('budget meals');
    expect(result).toContain('meal prep');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('quick dinners');
    expect(result).toContain('one-pot meals');
  });

  it('shows "none noted" when missing_topics is empty', () => {
    const empty = makeReport('competitors', {
      ...competitorAnalysis,
      missing_topics: [],
    } as CompetitorGapAnalysis);
    expect(digestReport(empty)).toContain('none noted');
  });

  it('shows "none noted" when untapped_keyword_clusters is empty', () => {
    const empty = makeReport('competitors', {
      ...competitorAnalysis,
      untapped_keyword_clusters: [],
    } as CompetitorGapAnalysis);
    expect(digestReport(empty)).toContain('none noted');
  });
});

// ── digestScript ──────────────────────────────────────────────────────────────

describe('digestScript', () => {
  const script: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Viral Hook',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know you can cook pasta in 5 minutes?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Show pot of water',
          dialogue_or_vo: 'Fill the pot',
          audio_sfx_cue: 'sizzle',
          retention_loop_note: 'Cut before the water boils to tease the reveal',
        },
        {
          scene_number: 2,
          visual_action: 'Add pasta',
          dialogue_or_vo: 'Drop in the pasta',
          audio_sfx_cue: 'splash',
          retention_loop_note: 'Show the pasta going in mid-frame',
        },
      ],
      cta: 'Save this for dinner tonight',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-07-01T12:00:00.000Z',
  };

  it('includes the script title', () => {
    expect(digestScript(script)).toContain('My Viral Hook');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(script)).toContain('Did you know you can cook pasta in 5 minutes?');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(script)).toContain('Cut before the water boils to tease the reveal');
  });

  it('includes scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('includes a formatted date', () => {
    const result = digestScript(script);
    expect(result).toMatch(/\d/);
  });

  it('outputs empty string in template when retention_loop_note is ""', () => {
    const noNote: ScriptRow = {
      ...script,
      storyboard: {
        ...script.storyboard,
        scenes: [
          { ...script.storyboard.scenes[0], retention_loop_note: '' },
        ],
      },
    };
    // ?? only catches null/undefined, not ''; empty string passes through
    expect(digestScript(noNote)).toContain('first scene retention loop: ""');
  });

  it('shows "(none)" when there are no scenes', () => {
    const noScenes: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('(none)');
  });

  it('reports correct scene count for 0 scenes', () => {
    const noScenes: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('0 scenes total');
  });

  it('reports correct scene count for 1 scene', () => {
    const oneScene: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [script.storyboard.scenes[0]] },
    };
    expect(digestScript(oneScene)).toContain('1 scenes total');
  });
});
