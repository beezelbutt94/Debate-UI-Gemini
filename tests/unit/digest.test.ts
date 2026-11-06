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
  created_at = '2024-06-15T10:00:00.000Z'
): AuditReportRow<T> {
  return {
    id: 'r-1',
    user_id: 'u-1',
    creator_profile_id: null,
    source_type,
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at,
  };
}

// ── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport – url (ViralGapAnalysis)', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
    hook_evaluation: { score: 78, verdict: 'moderate', notes: 'could be stronger' },
    retention_prediction: { at_3s_percent: 72, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
    action_plan: ['add text overlay at 2s'],
    source_metrics: {},
  };

  const report = makeReport<ViralGapAnalysis>('url', analysis);
  const result = digestReport(report);

  it('contains "Viral Gap Analyzer"', () => {
    expect(result).toContain('Viral Gap Analyzer');
  });

  it('contains the hook verdict', () => {
    expect(result).toContain('moderate');
  });

  it('contains the hook score', () => {
    expect(result).toContain('78/100');
  });

  it('contains the hook notes', () => {
    expect(result).toContain('could be stronger');
  });

  it('contains 3-second retention figure', () => {
    expect(result).toContain('3s=72%');
  });

  it('contains 30-second retention figure', () => {
    expect(result).toContain('30s=45%');
  });

  it('includes a formatted date', () => {
    // toLocaleDateString varies by locale; just check a year appears
    expect(result).toMatch(/202[0-9]/);
  });
});

describe('digestReport – account (GrowthBlueprint)', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 85, notes: 'very consistent' },
    view_to_follower_ratio: { value: 0.42, assessment: 'healthy' },
    posting_cadence: { avg_days_between_posts: 2.5, assessment: 'frequent' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: ['weekends', 'mornings'],
    per_platform_notes: {},
  };

  const report = makeReport<GrowthBlueprint>('account', analysis);
  const result = digestReport(report);

  it('contains "Account Deep-Dive"', () => {
    expect(result).toContain('Account Deep-Dive');
  });

  it('contains thematic consistency score', () => {
    expect(result).toContain('85/100');
  });

  it('contains thematic consistency notes', () => {
    expect(result).toContain('very consistent');
  });

  it('contains posting blindspots', () => {
    expect(result).toContain('weekends');
    expect(result).toContain('mornings');
  });
});

describe('digestReport – account with no posting blindspots', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 90, notes: 'solid' },
    view_to_follower_ratio: { value: null, assessment: 'unknown' },
    posting_cadence: { avg_days_between_posts: null, assessment: 'irregular' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: [],
    per_platform_notes: {},
  };

  it('shows "none noted" when blindspots is empty', () => {
    const result = digestReport(makeReport<GrowthBlueprint>('account', analysis));
    expect(result).toContain('none noted');
  });
});

describe('digestReport – upload (UploadDiagnosis)', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 65, verdict: 'weak', notes: 'face not visible' },
    audio_balance: { score: 80, notes: 'good mix' },
    text_overlay_pacing: { assessment: 'too fast to read' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 42,
  };

  const report = makeReport<UploadDiagnosis>('upload', analysis);
  const result = digestReport(report);

  it('contains "Upload Diagnostic"', () => {
    expect(result).toContain('Upload Diagnostic');
  });

  it('contains visual hook verdict', () => {
    expect(result).toContain('weak');
  });

  it('contains visual hook score', () => {
    expect(result).toContain('65/100');
  });

  it('contains audio balance score', () => {
    expect(result).toContain('80/100');
  });

  it('contains audio balance notes', () => {
    expect(result).toContain('good mix');
  });

  it('contains text overlay assessment', () => {
    expect(result).toContain('too fast to read');
  });
});

describe('digestReport – discovery (SiteDiscoveryResult)', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'best fitness YouTube channels 2024',
    sites: [],
    outlier: { url: 'https://example.com/outlier', reasoning: 'uses data-driven thumbnails uniquely' },
    summary: 'Found 10 fitness channels.',
  };

  const report = makeReport<SiteDiscoveryResult>('discovery', analysis);
  const result = digestReport(report);

  it('contains "Site Discovery"', () => {
    expect(result).toContain('Site Discovery');
  });

  it('contains the query', () => {
    expect(result).toContain('best fitness YouTube channels 2024');
  });

  it('contains the outlier URL', () => {
    expect(result).toContain('https://example.com/outlier');
  });

  it('contains the outlier reasoning', () => {
    expect(result).toContain('data-driven thumbnails');
  });
});

describe('digestReport – competitors (CompetitorGapAnalysis, fallthrough branch)', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: ['gym transformation'],
    missing_topics: ['meal prep', 'recovery'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['beginner workout', 'home gym setup'],
  };

  const report = makeReport<CompetitorGapAnalysis>('competitors', analysis);
  const result = digestReport(report);

  it('contains "Competitor Espionage"', () => {
    expect(result).toContain('Competitor Espionage');
  });

  it('contains missing topics', () => {
    expect(result).toContain('meal prep');
    expect(result).toContain('recovery');
  });

  it('contains untapped keyword clusters', () => {
    expect(result).toContain('beginner workout');
    expect(result).toContain('home gym setup');
  });
});

describe('digestReport – competitors with empty arrays', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: [],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: [],
  };

  it('shows "none noted" for empty missing_topics', () => {
    const result = digestReport(makeReport<CompetitorGapAnalysis>('competitors', analysis));
    expect(result).toMatch(/missing topics: none noted/);
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    const result = digestReport(makeReport<CompetitorGapAnalysis>('competitors', analysis));
    expect(result).toMatch(/untapped keyword clusters: none noted/);
  });
});

// ── digestScript ─────────────────────────────────────────────────────────────

describe('digestScript', () => {
  const baseScript: ScriptRow = {
    id: 's-1',
    user_id: 'u-1',
    creator_profile_id: null,
    title: 'My Workout Video',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'You will never believe what happens next',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'close-up of face',
          dialogue_or_vo: 'Opening line',
          audio_sfx_cue: 'upbeat music',
          retention_loop_note: 'Cut to workout montage',
        },
        {
          scene_number: 2,
          visual_action: 'outdoor run',
          dialogue_or_vo: 'Body copy',
          audio_sfx_cue: 'ambient',
          retention_loop_note: 'Tease result',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-12T08:00:00.000Z',
  };

  const result = digestScript(baseScript);

  it('contains the script title', () => {
    expect(result).toContain('My Workout Video');
  });

  it('contains the spoken hook', () => {
    expect(result).toContain('You will never believe what happens next');
  });

  it('contains the first scene retention loop note', () => {
    expect(result).toContain('Cut to workout montage');
  });

  it('contains the total number of scenes', () => {
    expect(result).toContain('2 scenes total');
  });

  it('includes a formatted date', () => {
    expect(result).toMatch(/202[0-9]/);
  });

  it('handles a storyboard with zero scenes (no crash)', () => {
    const noScenes: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    const r = digestScript(noScenes);
    expect(r).toContain('(none)');
    expect(r).toContain('0 scenes total');
  });
});
