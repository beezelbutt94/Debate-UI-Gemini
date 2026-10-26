import { describe, it, expect } from 'vitest';
import { digestReport, digestScript } from '@/lib/digest';
import type {
  AuditReportRow,
  ViralGapAnalysis,
  GrowthBlueprint,
  UploadDiagnosis,
  SiteDiscoveryResult,
  CompetitorGapAnalysis,
  ScriptRow,
} from '@/lib/types';

// ---- helpers ----
function baseReport(overrides: Partial<AuditReportRow> = {}): AuditReportRow {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_type: 'url',
    source_url: null,
    platform: 'tiktok',
    viral_score: null,
    analysis: {} as ViralGapAnalysis,
    timeline_recommendations: [],
    created_at: '2024-03-15T10:00:00.000Z',
    ...overrides,
  };
}

// ---- digestReport ----
describe('digestReport — url (ViralGapAnalysis)', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
    hook_evaluation: { score: 75, verdict: 'strong', notes: 'Great opener' },
    retention_prediction: { at_3s_percent: 70, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
    action_plan: ['Do this', 'Do that'],
    source_metrics: {},
  };

  const report = baseReport({ source_type: 'url', analysis });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('75/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Great opener');
  });

  it('includes 3s retention', () => {
    expect(digestReport(report)).toContain('3s=70%');
  });

  it('includes 30s retention', () => {
    expect(digestReport(report)).toContain('30s=45%');
  });

  it('includes "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the formatted date', () => {
    const result = digestReport(report);
    // toLocaleDateString can vary by locale but must include some date part
    expect(result).toMatch(/\d{1,4}/);
  });
});

describe('digestReport — account (GrowthBlueprint)', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 82, notes: 'Very consistent' },
    view_to_follower_ratio: { value: 1.5, assessment: 'good' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'frequent' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: ['Weekends', 'Mornings'],
    per_platform_notes: {},
  };

  const report = baseReport({ source_type: 'account', analysis });

  it('includes "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('82/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Very consistent');
  });

  it('includes posting blindspots joined', () => {
    expect(digestReport(report)).toContain('Weekends');
    expect(digestReport(report)).toContain('Mornings');
  });
});

describe('digestReport — account with no blindspots', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 90, notes: 'Perfect' },
    view_to_follower_ratio: { value: 2, assessment: 'excellent' },
    posting_cadence: { avg_days_between_posts: 1, assessment: 'daily' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: [],
    per_platform_notes: {},
  };

  it('shows "none noted" when no blindspots', () => {
    const report = baseReport({ source_type: 'account', analysis });
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport — upload (UploadDiagnosis)', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'Okay opener' },
    audio_balance: { score: 88, notes: 'Crisp audio' },
    text_overlay_pacing: { assessment: 'Too slow' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 6,
  };

  const report = baseReport({ source_type: 'upload', analysis });

  it('includes "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('60/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('88/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Crisp audio');
  });

  it('includes text overlay pacing', () => {
    expect(digestReport(report)).toContain('Too slow');
  });
});

describe('digestReport — discovery (SiteDiscoveryResult)', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'fitness videos trending 2024',
    sites: [],
    outlier: { url: 'https://example.com', reasoning: 'Has unique angle' },
    summary: 'Summary text',
  };

  const report = baseReport({ source_type: 'discovery', analysis });

  it('includes "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes query', () => {
    expect(digestReport(report)).toContain('fitness videos trending 2024');
  });

  it('includes outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com');
  });

  it('includes outlier reasoning', () => {
    expect(digestReport(report)).toContain('Has unique angle');
  });
});

describe('digestReport — competitors (CompetitorGapAnalysis)', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: ['Nutrition', 'Recovery'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['HIIT', 'home gym'],
  };

  const report = baseReport({ source_type: 'competitors', analysis });

  it('includes "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    expect(digestReport(report)).toContain('Nutrition');
    expect(digestReport(report)).toContain('Recovery');
  });

  it('includes untapped keyword clusters', () => {
    expect(digestReport(report)).toContain('HIIT');
    expect(digestReport(report)).toContain('home gym');
  });
});

describe('digestReport — competitors with no topics', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: [],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: [],
  };

  it('shows "none noted" for both when empty', () => {
    const report = baseReport({ source_type: 'competitors', analysis });
    const result = digestReport(report);
    expect(result.match(/none noted/g)?.length).toBe(2);
  });
});

// ---- digestScript ----
describe('digestScript', () => {
  function makeScript(overrides: Partial<ScriptRow> = {}): ScriptRow {
    return {
      id: 's1',
      user_id: 'u1',
      creator_profile_id: null,
      title: 'My Viral Script',
      source_prompt: null,
      storyboard: {
        spoken_hook: 'Did you know this secret?',
        scenes: [
          {
            scene_number: 1,
            visual_action: 'Open on face',
            dialogue_or_vo: 'Did you know?',
            audio_sfx_cue: 'whoosh',
            retention_loop_note: 'Tension build',
          },
          {
            scene_number: 2,
            visual_action: 'Show product',
            dialogue_or_vo: 'Try this',
            audio_sfx_cue: '',
            retention_loop_note: 'CTA tease',
          },
        ],
        cta: 'Follow for more',
        memory_context_used: false,
      },
      tone_parameters: {},
      target_platform: 'tiktok',
      created_at: '2024-06-01T08:00:00.000Z',
      ...overrides,
    };
  }

  it('includes script title', () => {
    expect(digestScript(makeScript())).toContain('My Viral Script');
  });

  it('includes spoken hook', () => {
    expect(digestScript(makeScript())).toContain('Did you know this secret?');
  });

  it('includes first scene retention loop note', () => {
    expect(digestScript(makeScript())).toContain('Tension build');
  });

  it('includes scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });

  it('handles empty scenes array', () => {
    const script = makeScript({
      storyboard: {
        spoken_hook: 'hook',
        scenes: [],
        cta: 'cta',
        memory_context_used: false,
      },
    });
    const result = digestScript(script);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('includes the date', () => {
    const result = digestScript(makeScript());
    expect(result).toMatch(/\d{1,4}/);
  });
});
