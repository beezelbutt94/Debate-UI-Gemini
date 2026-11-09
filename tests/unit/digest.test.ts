import { describe, it, expect } from 'vitest';
import { digestReport, digestScript } from '@/lib/digest';
import type {
  AuditReportRow,
  CompetitorGapAnalysis,
  GrowthBlueprint,
  ScriptRow,
  SiteDiscoveryResult,
  UploadDiagnosis,
  ViralGapAnalysis,
} from '@/lib/types';

// ─── Shared fixture helpers ───────────────────────────────────────────────────

function makeBase(overrides: Partial<AuditReportRow> = {}): AuditReportRow {
  return {
    id: 'rpt-1',
    user_id: 'usr-1',
    creator_profile_id: null,
    source_type: 'url',
    source_url: 'https://www.tiktok.com/@creator/video/1',
    platform: 'tiktok',
    viral_score: 72,
    analysis: {} as ViralGapAnalysis,
    timeline_recommendations: [],
    created_at: '2024-06-15T12:00:00.000Z',
    ...overrides,
  };
}

// ─── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport() – source_type: url', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 4, assessment: 'Fast-paced' },
    hook_evaluation: { score: 85, verdict: 'strong', notes: 'Opens with a question' },
    retention_prediction: { at_3s_percent: 75, at_30s_percent: 50, meets_3s_benchmark: true, meets_30s_benchmark: true },
    action_plan: ['Add captions', 'Trim the ending'],
    source_metrics: {},
  };
  const report = makeBase({ source_type: 'url', analysis });

  it('includes "Viral Gap Analyzer" in the output', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('85/100');
  });

  it('includes the hook notes', () => {
    expect(digestReport(report)).toContain('Opens with a question');
  });

  it('includes 3s retention percentage', () => {
    expect(digestReport(report)).toContain('3s=75%');
  });

  it('includes 30s retention percentage', () => {
    expect(digestReport(report)).toContain('30s=50%');
  });

  it('includes the formatted date string', () => {
    const date = new Date('2024-06-15T12:00:00.000Z').toLocaleDateString();
    expect(digestReport(report)).toContain(date);
  });
});

describe('digestReport() – source_type: account', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 60, notes: 'Niche drift detected' },
    view_to_follower_ratio: { value: 1.5, assessment: 'Low' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'Consistent' },
    theme_correction: ['Focus on cooking content'],
    view_maximization_tactics: ['Post at peak hours'],
    posting_blindspots: ['Missing weekend slots', 'No Tuesday content'],
    per_platform_notes: {},
  };
  const report = makeBase({ source_type: 'account', analysis });

  it('includes "Account Deep-Dive" in the output', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes the thematic consistency score', () => {
    expect(digestReport(report)).toContain('60/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Niche drift detected');
  });

  it('joins posting blindspots with semicolons', () => {
    expect(digestReport(report)).toContain('Missing weekend slots; No Tuesday content');
  });

  it('shows "none noted" when blindspots array is empty', () => {
    const noBlindspots: GrowthBlueprint = { ...analysis, posting_blindspots: [] };
    const r = makeBase({ source_type: 'account', analysis: noBlindspots });
    expect(digestReport(r)).toContain('none noted');
  });
});

describe('digestReport() – source_type: upload', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 70, verdict: 'moderate', notes: 'Hook visible but slow' },
    audio_balance: { score: 55, notes: 'Music too loud' },
    text_overlay_pacing: { assessment: 'Text disappears too fast' },
    b_roll_recommendations: ['Add B-roll of product'],
    retention_boosters: ['Cut first 2s'],
    frames_analyzed: 120,
  };
  const report = makeBase({ source_type: 'upload', analysis });

  it('includes "Upload Diagnostic" in the output', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes the visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes the visual hook score', () => {
    expect(digestReport(report)).toContain('70/100');
  });

  it('includes the audio balance score', () => {
    expect(digestReport(report)).toContain('55/100');
  });

  it('includes the audio balance notes', () => {
    expect(digestReport(report)).toContain('Music too loud');
  });

  it('includes the text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Text disappears too fast');
  });
});

describe('digestReport() – source_type: discovery', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'best fitness YouTube channels 2024',
    sites: [
      { url: 'https://example.com', domain: 'example.com', title: 'Example', snippet: 'snippet', relevance_reason: 'top ranked' },
    ],
    outlier: { url: 'https://example.com', reasoning: 'Only one covering niche topics' },
    summary: 'Found 1 site',
  };
  const report = makeBase({ source_type: 'discovery', analysis });

  it('includes "Site Discovery" in the output', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query string', () => {
    expect(digestReport(report)).toContain('best fitness YouTube channels 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Only one covering niche topics');
  });
});

describe('digestReport() – source_type: competitors (default branch)', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: ['Viral challenge format'],
    missing_topics: ['Workout routines', 'Meal prep'],
    audience_sentiment_gaps: ['Lacks relatable humor'],
    untapped_keyword_clusters: ['morning routine', 'quick workout'],
  };
  const report = makeBase({ source_type: 'competitors', analysis });

  it('includes "Competitor Espionage" in the output', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('joins missing topics with semicolons', () => {
    expect(digestReport(report)).toContain('Workout routines; Meal prep');
  });

  it('joins untapped keyword clusters with semicolons', () => {
    expect(digestReport(report)).toContain('morning routine; quick workout');
  });

  it('shows "none noted" for empty missing_topics', () => {
    const noTopics: CompetitorGapAnalysis = { ...analysis, missing_topics: [] };
    const r = makeBase({ source_type: 'competitors', analysis: noTopics });
    expect(digestReport(r)).toContain('missing topics: none noted');
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    const noClusters: CompetitorGapAnalysis = { ...analysis, untapped_keyword_clusters: [] };
    const r = makeBase({ source_type: 'competitors', analysis: noClusters });
    expect(digestReport(r)).toContain('untapped keyword clusters: none noted');
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const baseScript: ScriptRow = {
    id: 'scr-1',
    user_id: 'usr-1',
    creator_profile_id: null,
    title: 'My Viral Hook Video',
    source_prompt: 'make a gym video',
    storyboard: {
      spoken_hook: 'Did you know you can get abs in 30 days?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of abs',
          dialogue_or_vo: 'Intro line',
          audio_sfx_cue: 'Upbeat music',
          retention_loop_note: 'Teaser payoff at end',
        },
        {
          scene_number: 2,
          visual_action: 'Exercise demo',
          dialogue_or_vo: 'Here is how',
          audio_sfx_cue: 'Transition sound',
          retention_loop_note: 'Cut back to hook',
        },
      ],
      cta: 'Follow for more tips!',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-07-20T08:00:00.000Z',
  };

  it('includes the script title', () => {
    expect(digestScript(baseScript)).toContain('My Viral Hook Video');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(baseScript)).toContain('Did you know you can get abs in 30 days?');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(baseScript)).toContain('Teaser payoff at end');
  });

  it('includes the total scene count', () => {
    expect(digestScript(baseScript)).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    const date = new Date('2024-07-20T08:00:00.000Z').toLocaleDateString();
    expect(digestScript(baseScript)).toContain(date);
  });

  it('shows "(none)" when the first scene has no retention_loop_note (undefined scene)', () => {
    const noScenes: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('(none)');
  });

  it('shows the correct scene count for a single scene', () => {
    const oneScene: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [baseScript.storyboard.scenes[0]] },
    };
    expect(digestScript(oneScene)).toContain('1 scenes total');
  });

  it('wraps the title in quotes', () => {
    expect(digestScript(baseScript)).toMatch(/"My Viral Hook Video"/);
  });

  it('wraps the spoken hook in quotes', () => {
    expect(digestScript(baseScript)).toMatch(/"Did you know you can get abs in 30 days\?"/);
  });
});
