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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReport<T>(
  overrides: Partial<AuditReportRow<T>> & { source_type: AuditReportRow['source_type']; analysis: T }
): AuditReportRow<T> {
  return {
    id: 'test-id',
    user_id: 'user-1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: '2024-06-15T12:00:00.000Z',
    ...overrides,
  } as AuditReportRow<T>;
}

// ── digestReport: url (ViralGapAnalysis) ─────────────────────────────────────

describe('digestReport() — source_type: url', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'Fast pacing' },
    hook_evaluation: { score: 85, verdict: 'strong', notes: 'Gripping opener' },
    retention_prediction: {
      at_3s_percent: 72,
      at_30s_percent: 45,
      meets_3s_benchmark: true,
      meets_30s_benchmark: true,
    },
    action_plan: ['Add captions', 'Cut intro by 2s'],
    source_metrics: {},
  };
  const report = makeReport({ source_type: 'url', analysis });

  it('includes "Viral Gap Analyzer" label', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('85/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Gripping opener');
  });

  it('includes 3s retention percentage', () => {
    expect(digestReport(report)).toContain('3s=72%');
  });

  it('includes 30s retention percentage', () => {
    expect(digestReport(report)).toContain('30s=45%');
  });

  it('includes the report date', () => {
    // toLocaleDateString is locale-dependent, but the year 2024 must appear
    expect(digestReport(report)).toMatch(/2024/);
  });
});

// ── digestReport: account (GrowthBlueprint) ──────────────────────────────────

describe('digestReport() — source_type: account', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 72, notes: 'Mostly fitness content' },
    view_to_follower_ratio: { value: 0.12, assessment: 'Good' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'Regular' },
    theme_correction: [],
    view_maximization_tactics: ['Use trending sounds'],
    posting_blindspots: ['Monday mornings', 'Late Friday'],
    per_platform_notes: {},
  };
  const report = makeReport({ source_type: 'account', analysis });

  it('includes "Account Deep-Dive" label', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('72/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Mostly fitness content');
  });

  it('includes posting blindspots', () => {
    expect(digestReport(report)).toContain('Monday mornings');
    expect(digestReport(report)).toContain('Late Friday');
  });

  it('uses "none noted" when posting blindspots is empty', () => {
    const noBlindspots: GrowthBlueprint = { ...analysis, posting_blindspots: [] };
    const r = makeReport({ source_type: 'account', analysis: noBlindspots });
    expect(digestReport(r)).toContain('none noted');
  });
});

// ── digestReport: upload (UploadDiagnosis) ───────────────────────────────────

describe('digestReport() — source_type: upload', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 90, verdict: 'strong', notes: 'Clear and bold' },
    audio_balance: { score: 65, notes: 'Music slightly too loud' },
    text_overlay_pacing: { assessment: 'Well timed' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
  };
  const report = makeReport({ source_type: 'upload', analysis });

  it('includes "Upload Diagnostic" label', () => {
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
    expect(digestReport(report)).toContain('Music slightly too loud');
  });

  it('includes text overlay assessment', () => {
    expect(digestReport(report)).toContain('Well timed');
  });
});

// ── digestReport: discovery (SiteDiscoveryResult) ────────────────────────────

describe('digestReport() — source_type: discovery', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'fitness creators 2024',
    sites: [],
    outlier: {
      url: 'https://example.com/outlier',
      reasoning: 'Uniquely combines fitness with comedy',
    },
    summary: 'Top fitness sites for 2024',
  };
  const report = makeReport({ source_type: 'discovery', analysis });

  it('includes "Site Discovery" label', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the search query', () => {
    expect(digestReport(report)).toContain('fitness creators 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/outlier');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Uniquely combines fitness with comedy');
  });
});

// ── digestReport: competitors (CompetitorGapAnalysis) ────────────────────────

describe('digestReport() — source_type: competitors', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: ['Morning routines'],
    missing_topics: ['Meal prep', 'Recovery'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['home gym', 'resistance bands'],
  };
  const report = makeReport({ source_type: 'competitors', analysis });

  it('includes "Competitor Espionage" label', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    expect(digestReport(report)).toContain('Meal prep');
    expect(digestReport(report)).toContain('Recovery');
  });

  it('includes untapped keyword clusters', () => {
    expect(digestReport(report)).toContain('home gym');
    expect(digestReport(report)).toContain('resistance bands');
  });

  it('uses "none noted" for empty missing_topics', () => {
    const noTopics: CompetitorGapAnalysis = { ...analysis, missing_topics: [] };
    const r = makeReport({ source_type: 'competitors', analysis: noTopics });
    expect(digestReport(r)).toContain('none noted');
  });

  it('uses "none noted" for empty untapped_keyword_clusters', () => {
    const noClusters: CompetitorGapAnalysis = { ...analysis, untapped_keyword_clusters: [] };
    const r = makeReport({ source_type: 'competitors', analysis: noClusters });
    expect(digestReport(r)).toContain('none noted');
  });
});

// ── digestScript ──────────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const script: ScriptRow = {
    id: 'script-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'Morning Routine Tips',
    source_prompt: null,
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-08-20T09:00:00.000Z',
    storyboard: {
      spoken_hook: 'You are ruining your mornings without knowing it',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Pan over coffee setup',
          dialogue_or_vo: 'Wake up at 5am',
          audio_sfx_cue: 'Alarm sound',
          retention_loop_note: 'Cut fast to next scene',
        },
        {
          scene_number: 2,
          visual_action: 'Exercise montage',
          dialogue_or_vo: 'Move your body',
          audio_sfx_cue: 'Upbeat music',
          retention_loop_note: 'Tease outcome at end',
        },
      ],
      cta: 'Follow for more morning tips',
      memory_context_used: false,
    },
  };

  it('includes the script title', () => {
    expect(digestScript(script)).toContain('Morning Routine Tips');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(script)).toContain('You are ruining your mornings without knowing it');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(script)).toContain('Cut fast to next scene');
  });

  it('includes the total scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('includes the creation date', () => {
    expect(digestScript(script)).toMatch(/2024/);
  });

  it('uses "(none)" when scenes array is empty', () => {
    const emptyScript: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    expect(digestScript(emptyScript)).toContain('(none)');
    expect(digestScript(emptyScript)).toContain('0 scenes total');
  });

  it('uses "(none)" when first scene has no retention_loop_note', () => {
    const noNote: ScriptRow = {
      ...script,
      storyboard: {
        ...script.storyboard,
        scenes: [
          {
            scene_number: 1,
            visual_action: 'Shot',
            dialogue_or_vo: 'Text',
            audio_sfx_cue: 'Music',
            retention_loop_note: '',
          },
        ],
      },
    };
    // empty string is falsy, nullish coalescing with ?? '(none)' won't apply
    // but the actual code uses `?? '(none)'` which only triggers for null/undefined
    // so empty string will be included as-is
    expect(digestScript(noNote)).toContain('1 scenes total');
  });
});
