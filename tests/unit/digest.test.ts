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

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function baseReport(overrides: Partial<AuditReportRow>): AuditReportRow {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: '2024-03-15T12:00:00Z',
    // overrides must include source_type and analysis
    ...overrides,
  } as AuditReportRow;
}

// ---------------------------------------------------------------------------
// digestReport – source_type: 'url' (ViralGapAnalysis)
// ---------------------------------------------------------------------------
describe('digestReport() – url source', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'Fast' },
    hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Decent opener' },
    retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
    action_plan: ['Improve hook', 'Add CTA'],
    source_metrics: {},
  };

  const report = baseReport({ source_type: 'url', analysis });

  it('includes "Viral Gap Analyzer" label', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('72/100');
  });

  it('includes the hook notes', () => {
    expect(digestReport(report)).toContain('Decent opener');
  });

  it('includes 3s retention figure', () => {
    expect(digestReport(report)).toContain('3s=65%');
  });

  it('includes 30s retention figure', () => {
    expect(digestReport(report)).toContain('30s=42%');
  });

  it('includes a formatted date from created_at', () => {
    const result = digestReport(report);
    // Should include something date-like (locale varies but year will be there)
    expect(result).toMatch(/2024/);
  });

  it('returns a non-empty string', () => {
    expect(digestReport(report).length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// digestReport – source_type: 'account' (GrowthBlueprint)
// ---------------------------------------------------------------------------
describe('digestReport() – account source', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 85, notes: 'Very consistent' },
    view_to_follower_ratio: { value: 1.5, assessment: 'Good' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'Regular' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: ['Weekend mornings', 'Holiday slots'],
    per_platform_notes: {},
  };

  const report = baseReport({ source_type: 'account', analysis });

  it('includes "Account Deep-Dive" label', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('85/100');
  });

  it('includes thematic notes', () => {
    expect(digestReport(report)).toContain('Very consistent');
  });

  it('includes posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Weekend mornings');
    expect(result).toContain('Holiday slots');
  });

  it('shows "none noted" when blindspots array is empty', () => {
    const noBlindspots: GrowthBlueprint = { ...analysis, posting_blindspots: [] };
    const r = baseReport({ source_type: 'account', analysis: noBlindspots });
    expect(digestReport(r)).toContain('none noted');
  });
});

// ---------------------------------------------------------------------------
// digestReport – source_type: 'upload' (UploadDiagnosis)
// ---------------------------------------------------------------------------
describe('digestReport() – upload source', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 60, verdict: 'weak', notes: 'Too slow' },
    audio_balance: { score: 78, notes: 'Balanced mix' },
    text_overlay_pacing: { assessment: 'Slightly too fast' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
  };

  const report = baseReport({ source_type: 'upload', analysis });

  it('includes "Upload Diagnostic" label', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('weak');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('60/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('78/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Balanced mix');
  });

  it('includes text overlay assessment', () => {
    expect(digestReport(report)).toContain('Slightly too fast');
  });
});

// ---------------------------------------------------------------------------
// digestReport – source_type: 'discovery' (SiteDiscoveryResult)
// ---------------------------------------------------------------------------
describe('digestReport() – discovery source', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'best cooking hacks 2024',
    sites: [],
    outlier: { url: 'https://example.com/outlier', reasoning: 'Uses uncommon format' },
    summary: 'Found 10 sites',
  };

  const report = baseReport({ source_type: 'discovery', analysis });

  it('includes "Site Discovery" label', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query', () => {
    expect(digestReport(report)).toContain('best cooking hacks 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/outlier');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Uses uncommon format');
  });
});

// ---------------------------------------------------------------------------
// digestReport – source_type: 'competitors' (CompetitorGapAnalysis)
// ---------------------------------------------------------------------------
describe('digestReport() – competitors source (default branch)', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: ['Shorts tutorials', 'Behind the scenes'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['viral hooks', 'trending audio'],
  };

  const report = baseReport({ source_type: 'competitors', analysis });

  it('includes "Competitor Espionage" label', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('Shorts tutorials');
    expect(result).toContain('Behind the scenes');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('viral hooks');
    expect(result).toContain('trending audio');
  });

  it('shows "none noted" for empty missing_topics', () => {
    const empty = { ...analysis, missing_topics: [] };
    const r = baseReport({ source_type: 'competitors', analysis: empty });
    expect(digestReport(r)).toContain('none noted');
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    const empty = { ...analysis, untapped_keyword_clusters: [] };
    const r = baseReport({ source_type: 'competitors', analysis: empty });
    // Should have "none noted" for the clusters section
    expect(digestReport(r)).toContain('none noted');
  });
});

// ---------------------------------------------------------------------------
// digestScript
// ---------------------------------------------------------------------------
describe('digestScript()', () => {
  const script: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Viral Hook',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'You will NOT believe this…',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of product',
          dialogue_or_vo: 'Here is the trick',
          audio_sfx_cue: 'Whoosh',
          retention_loop_note: 'Open loop: what is the trick?',
        },
        {
          scene_number: 2,
          visual_action: 'Wide shot',
          dialogue_or_vo: 'The answer is simple',
          audio_sfx_cue: 'Bell',
          retention_loop_note: 'Close loop',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-06-01T09:00:00Z',
  };

  it('includes the script title', () => {
    expect(digestScript(script)).toContain('My Viral Hook');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(script)).toContain('You will NOT believe this…');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(script)).toContain('Open loop: what is the trick?');
  });

  it('includes the total scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('includes a date fragment', () => {
    // Date is locale-formatted but should include the year
    expect(digestScript(script)).toMatch(/2024/);
  });

  it('outputs empty string quotes when first scene retention_loop_note is empty string', () => {
    const modified: ScriptRow = {
      ...script,
      storyboard: {
        ...script.storyboard,
        scenes: [
          { ...script.storyboard.scenes[0], retention_loop_note: '' },
          script.storyboard.scenes[1],
        ],
      },
    };
    // ?? is nullish coalescing: empty string '' is NOT null/undefined, so it stays as ''
    const result = digestScript(modified);
    expect(result).toContain('first scene retention loop: ""');
    expect(result).not.toContain('(none)');
  });

  it('returns "(none)" when scenes array is empty', () => {
    const empty: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    expect(digestScript(empty)).toContain('(none)');
    expect(digestScript(empty)).toContain('0 scenes total');
  });

  it('is a non-empty string', () => {
    expect(digestScript(script).length).toBeGreaterThan(10);
  });
});
