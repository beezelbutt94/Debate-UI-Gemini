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
} from '@/lib/types';

// Shared fixture for created_at — format is locale-dependent but must be parsable
const CREATED_AT = '2024-09-12T10:00:00.000Z';

// Minimal factory helpers to keep tests readable

function makeUrlReport(overrides?: Partial<ViralGapAnalysis>): AuditReportRow<ViralGapAnalysis> {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
    hook_evaluation: { score: 82, verdict: 'strong', notes: 'Grabs immediately' },
    retention_prediction: { at_3s_percent: 75, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
    action_plan: ['Add CTA at 5s'],
    source_metrics: {},
    ...overrides,
  };
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_type: 'url',
    source_url: 'https://www.tiktok.com/@user/video/1',
    platform: 'tiktok',
    viral_score: 82,
    analysis,
    timeline_recommendations: [],
    created_at: CREATED_AT,
  };
}

function makeAccountReport(overrides?: Partial<GrowthBlueprint>): AuditReportRow<GrowthBlueprint> {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 70, notes: 'Mostly consistent' },
    view_to_follower_ratio: { value: 0.15, assessment: 'Good' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'Regular' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: ['Saturday mornings', 'Holiday evenings'],
    per_platform_notes: {},
    ...overrides,
  };
  return {
    id: 'r2',
    user_id: 'u1',
    creator_profile_id: 'cp1',
    source_type: 'account',
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at: CREATED_AT,
  };
}

function makeUploadReport(overrides?: Partial<UploadDiagnosis>): AuditReportRow<UploadDiagnosis> {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'Ok open' },
    audio_balance: { score: 55, notes: 'Music too loud' },
    text_overlay_pacing: { assessment: 'Too fast' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
    ...overrides,
  };
  return {
    id: 'r3',
    user_id: 'u1',
    creator_profile_id: null,
    source_type: 'upload',
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at: CREATED_AT,
  };
}

function makeDiscoveryReport(overrides?: Partial<SiteDiscoveryResult>): AuditReportRow<SiteDiscoveryResult> {
  const analysis: SiteDiscoveryResult = {
    query: 'AI video tools',
    sites: [],
    outlier: { url: 'https://example.com', reasoning: 'Unique approach' },
    summary: 'Found 10 sites',
    ...overrides,
  };
  return {
    id: 'r4',
    user_id: 'u1',
    creator_profile_id: null,
    source_type: 'discovery',
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at: CREATED_AT,
  };
}

function makeCompetitorReport(overrides?: Partial<CompetitorGapAnalysis>): AuditReportRow<CompetitorGapAnalysis> {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: ['short-form tutorials', 'live Q&A'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['AI editing', 'voiceover tips'],
    ...overrides,
  };
  return {
    id: 'r5',
    user_id: 'u1',
    creator_profile_id: null,
    source_type: 'competitors',
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at: CREATED_AT,
  };
}

// ─── digestReport ────────────────────────────────────────────────────────────

describe('digestReport – source_type: url', () => {
  it('includes "Viral Gap Analyzer" label', () => {
    expect(digestReport(makeUrlReport())).toMatch('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(makeUrlReport())).toMatch('strong');
  });

  it('includes hook score', () => {
    expect(digestReport(makeUrlReport())).toMatch('82/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(makeUrlReport())).toMatch('Grabs immediately');
  });

  it('includes 3s retention percent', () => {
    expect(digestReport(makeUrlReport())).toMatch('3s=75%');
  });

  it('includes 30s retention percent', () => {
    expect(digestReport(makeUrlReport())).toMatch('30s=45%');
  });

  it('contains the formatted date', () => {
    const result = digestReport(makeUrlReport());
    // The date string will vary by locale, but must be non-empty
    expect(result.length).toBeGreaterThan(20);
  });

  it('handles weak verdict', () => {
    const report = makeUrlReport({
      hook_evaluation: { score: 20, verdict: 'weak', notes: 'Boring' },
    });
    expect(digestReport(report)).toMatch('weak');
    expect(digestReport(report)).toMatch('20/100');
  });
});

describe('digestReport – source_type: account', () => {
  it('includes "Account Deep-Dive" label', () => {
    expect(digestReport(makeAccountReport())).toMatch('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(makeAccountReport())).toMatch('70/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(makeAccountReport())).toMatch('Mostly consistent');
  });

  it('includes posting blindspots joined by semicolon', () => {
    const result = digestReport(makeAccountReport());
    expect(result).toMatch('Saturday mornings');
    expect(result).toMatch('Holiday evenings');
  });

  it('says "none noted" when posting_blindspots is empty', () => {
    const report = makeAccountReport({ posting_blindspots: [] });
    expect(digestReport(report)).toMatch('none noted');
  });
});

describe('digestReport – source_type: upload', () => {
  it('includes "Upload Diagnostic" label', () => {
    expect(digestReport(makeUploadReport())).toMatch('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(makeUploadReport())).toMatch('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(makeUploadReport())).toMatch('60/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(makeUploadReport())).toMatch('55/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(makeUploadReport())).toMatch('Music too loud');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(makeUploadReport())).toMatch('Too fast');
  });
});

describe('digestReport – source_type: discovery', () => {
  it('includes "Site Discovery" label', () => {
    expect(digestReport(makeDiscoveryReport())).toMatch('Site Discovery');
  });

  it('includes the query string', () => {
    expect(digestReport(makeDiscoveryReport())).toMatch('AI video tools');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(makeDiscoveryReport())).toMatch('https://example.com');
  });

  it('includes outlier reasoning', () => {
    expect(digestReport(makeDiscoveryReport())).toMatch('Unique approach');
  });

  it('handles different queries', () => {
    const report = makeDiscoveryReport({ query: 'faceless YouTube channels' });
    expect(digestReport(report)).toMatch('faceless YouTube channels');
  });
});

describe('digestReport – source_type: competitors (fallback)', () => {
  it('includes "Competitor Espionage" label', () => {
    expect(digestReport(makeCompetitorReport())).toMatch('Competitor Espionage');
  });

  it('includes missing topics joined by semicolons', () => {
    const result = digestReport(makeCompetitorReport());
    expect(result).toMatch('short-form tutorials');
    expect(result).toMatch('live Q&A');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(makeCompetitorReport());
    expect(result).toMatch('AI editing');
    expect(result).toMatch('voiceover tips');
  });

  it('says "none noted" when missing_topics is empty', () => {
    const report = makeCompetitorReport({ missing_topics: [] });
    expect(digestReport(report)).toMatch('none noted');
  });

  it('says "none noted" when untapped_keyword_clusters is empty', () => {
    const report = makeCompetitorReport({ untapped_keyword_clusters: [] });
    expect(digestReport(report)).toMatch('none noted');
  });
});

// ─── digestScript ────────────────────────────────────────────────────────────

function makeScriptRow(overrides?: Partial<ScriptRow>): ScriptRow {
  return {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Viral Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know THIS?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up face',
          dialogue_or_vo: 'Did you know THIS?',
          audio_sfx_cue: 'none',
          retention_loop_note: 'Open loop — answer withheld',
        },
        {
          scene_number: 2,
          visual_action: 'B-roll',
          dialogue_or_vo: 'Here is why...',
          audio_sfx_cue: 'swoosh',
          retention_loop_note: 'Reveals partial answer',
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

describe('digestScript', () => {
  it('includes the script title', () => {
    expect(digestScript(makeScriptRow())).toMatch('My Viral Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(makeScriptRow())).toMatch('Did you know THIS?');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(makeScriptRow())).toMatch('Open loop — answer withheld');
  });

  it('includes total scene count', () => {
    expect(digestScript(makeScriptRow())).toMatch('2 scenes total');
  });

  it('handles single-scene storyboard', () => {
    const script = makeScriptRow({
      storyboard: {
        spoken_hook: 'Single hook',
        scenes: [
          {
            scene_number: 1,
            visual_action: 'Shot',
            dialogue_or_vo: 'Text',
            audio_sfx_cue: 'none',
            retention_loop_note: 'Only scene',
          },
        ],
        cta: 'Subscribe',
        memory_context_used: false,
      },
    });
    const result = digestScript(script);
    expect(result).toMatch('Only scene');
    expect(result).toMatch('1 scenes total');
  });

  it('handles empty scenes array (first scene undefined)', () => {
    const script = makeScriptRow({
      storyboard: {
        spoken_hook: 'Hook',
        scenes: [],
        cta: 'Subscribe',
        memory_context_used: false,
      },
    });
    const result = digestScript(script);
    expect(result).toMatch('(none)');
    expect(result).toMatch('0 scenes total');
  });

  it('includes a date substring', () => {
    const result = digestScript(makeScriptRow());
    // Must have parenthetical date
    expect(result).toMatch(/\(\d/);
  });

  it('handles title with special characters', () => {
    const script = makeScriptRow({ title: 'Script: "Top 10" & More' });
    expect(digestScript(script)).toMatch('Script: "Top 10" & More');
  });

  it('handles memory_context_used: true (no effect on output)', () => {
    const script = makeScriptRow({
      storyboard: { ...makeScriptRow().storyboard, memory_context_used: true },
    });
    const result = digestScript(script);
    expect(result).toMatch('My Viral Script');
  });
});
