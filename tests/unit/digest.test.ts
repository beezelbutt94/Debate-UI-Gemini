import { describe, it, expect, beforeAll } from 'vitest';
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

// Fixed date to make toLocaleDateString deterministic across timezones.
// We only assert that the date string appears in the output; exact format
// differs by locale but the ISO input is always the same.
const CREATED_AT = '2024-06-15T10:00:00.000Z';

function base(source_type: AuditReportRow['source_type'], analysis: unknown): AuditReportRow {
  return {
    id: 'rpt-1',
    user_id: 'usr-1',
    creator_profile_id: null,
    source_type,
    source_url: null,
    platform: null,
    viral_score: null,
    analysis: analysis as AuditReportRow['analysis'],
    timeline_recommendations: [],
    created_at: CREATED_AT,
  };
}

// ── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport() — source_type: url', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
    hook_evaluation: { score: 85, verdict: 'strong', notes: 'Opens with tension' },
    retention_prediction: {
      at_3s_percent: 72,
      at_30s_percent: 48,
      meets_3s_benchmark: true,
      meets_30s_benchmark: true,
    },
    action_plan: ['Add captions'],
    source_metrics: {},
  };
  const report = base('url', analysis);

  it('mentions Viral Gap Analyzer', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('85/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Opens with tension');
  });

  it('includes 3s retention', () => {
    expect(digestReport(report)).toContain('3s=72%');
  });

  it('includes 30s retention', () => {
    expect(digestReport(report)).toContain('30s=48%');
  });

  it('is a non-empty string', () => {
    expect(digestReport(report).length).toBeGreaterThan(10);
  });
});

describe('digestReport() — source_type: account', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 70, notes: 'Niche drift detected' },
    view_to_follower_ratio: { value: 0.05, assessment: 'low' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
    theme_correction: ['Stay in niche'],
    view_maximization_tactics: [],
    posting_blindspots: ['Tuesday evenings', 'Sunday mornings'],
    per_platform_notes: {},
  };
  const report = base('account', analysis);

  it('mentions Account Deep-Dive', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('70/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Niche drift detected');
  });

  it('lists posting blindspots', () => {
    const out = digestReport(report);
    expect(out).toContain('Tuesday evenings');
    expect(out).toContain('Sunday mornings');
  });

  it('shows "none noted" when blindspots is empty', () => {
    const noBlindspots: GrowthBlueprint = { ...analysis, posting_blindspots: [] };
    expect(digestReport(base('account', noBlindspots))).toContain('none noted');
  });
});

describe('digestReport() — source_type: upload', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 90, verdict: 'strong', notes: 'Bold opening frame' },
    audio_balance: { score: 65, notes: 'Music slightly overpowers speech' },
    text_overlay_pacing: { assessment: 'Well timed' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
  };
  const report = base('upload', analysis);

  it('mentions Upload Diagnostic', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('90/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('65/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Music slightly overpowers speech');
  });

  it('includes text-overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Well timed');
  });
});

describe('digestReport() — source_type: discovery', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'best running shoes 2024',
    sites: [],
    outlier: {
      url: 'https://weirdsite.com/review',
      reasoning: 'Only site with video reviews instead of text',
    },
    summary: 'Found 10 sites.',
  };
  const report = base('discovery', analysis);

  it('mentions Site Discovery', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query string', () => {
    expect(digestReport(report)).toContain('best running shoes 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://weirdsite.com/review');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Only site with video reviews instead of text');
  });
});

describe('digestReport() — source_type: competitors (default branch)', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: ['shorts strategy', 'live streaming'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['beginner workout', 'home gym'],
  };
  const report = base('competitors', analysis);

  it('mentions Competitor Espionage', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const out = digestReport(report);
    expect(out).toContain('shorts strategy');
    expect(out).toContain('live streaming');
  });

  it('includes untapped keyword clusters', () => {
    const out = digestReport(report);
    expect(out).toContain('beginner workout');
    expect(out).toContain('home gym');
  });

  it('shows "none noted" when missing_topics is empty', () => {
    const noTopics: CompetitorGapAnalysis = { ...analysis, missing_topics: [] };
    expect(digestReport(base('competitors', noTopics))).toContain('none noted');
  });

  it('shows "none noted" when untapped_keyword_clusters is empty', () => {
    const noClusters: CompetitorGapAnalysis = { ...analysis, untapped_keyword_clusters: [] };
    expect(digestReport(base('competitors', noClusters))).toContain('none noted');
  });
});

// ── digestScript ──────────────────────────────────────────────────────────────

function makeScript(overrides?: Partial<ScriptRow>): ScriptRow {
  return {
    id: 'scr-1',
    user_id: 'usr-1',
    creator_profile_id: null,
    title: 'How to Grow on TikTok',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Stop scrolling – this will change your life',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up on face',
          dialogue_or_vo: 'Hook line here',
          audio_sfx_cue: 'upbeat music',
          retention_loop_note: 'Cut to pattern interrupt',
        },
        {
          scene_number: 2,
          visual_action: 'B-roll of phone screen',
          dialogue_or_vo: 'Point one...',
          audio_sfx_cue: '',
          retention_loop_note: 'Tease upcoming tip',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: CREATED_AT,
    ...overrides,
  };
}

describe('digestScript()', () => {
  it('includes the script title', () => {
    expect(digestScript(makeScript())).toContain('How to Grow on TikTok');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(makeScript())).toContain('Stop scrolling – this will change your life');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(makeScript())).toContain('Cut to pattern interrupt');
  });

  it('reports total scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });

  it('renders an empty string for retention_loop_note when set to ""', () => {
    // ?? only catches null/undefined — empty string passes through as-is
    const script = makeScript();
    script.storyboard.scenes[0].retention_loop_note = '';
    expect(digestScript(script)).toContain('first scene retention loop: ""');
  });

  it('shows (none) when storyboard has no scenes', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    expect(digestScript(script)).toContain('(none)');
  });

  it('shows 0 scenes total when storyboard has no scenes', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    expect(digestScript(script)).toContain('0 scenes total');
  });

  it('is a non-empty string', () => {
    expect(digestScript(makeScript()).length).toBeGreaterThan(10);
  });

  it('handles a single-scene storyboard', () => {
    const script = makeScript();
    script.storyboard.scenes = [script.storyboard.scenes[0]];
    const out = digestScript(script);
    expect(out).toContain('1 scenes total');
    expect(out).toContain('Cut to pattern interrupt');
  });
});
