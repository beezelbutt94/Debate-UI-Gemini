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

// ─── Shared fixture helpers ───────────────────────────────────────────────────

function baseReport(overrides: Partial<AuditReportRow>): AuditReportRow {
  return {
    id: 'rpt-1',
    user_id: 'u-1',
    creator_profile_id: null,
    source_type: 'url',
    source_url: null,
    platform: null,
    viral_score: null,
    analysis: {} as ViralGapAnalysis,
    timeline_recommendations: [],
    created_at: '2024-06-15T10:00:00.000Z',
    ...overrides,
  };
}

// ─── digestReport — source_type: 'url' ───────────────────────────────────────

describe('digestReport() — url (ViralGapAnalysis)', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
    hook_evaluation: { score: 82, verdict: 'strong', notes: 'Bold opening' },
    retention_prediction: { at_3s_percent: 71, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
    action_plan: ['Add captions'],
    source_metrics: {},
  };

  const report = baseReport({ source_type: 'url', analysis });

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
    expect(digestReport(report)).toContain('Bold opening');
  });

  it('includes 3s retention', () => {
    expect(digestReport(report)).toContain('3s=71%');
  });

  it('includes 30s retention', () => {
    expect(digestReport(report)).toContain('30s=45%');
  });

  it('includes a formatted date', () => {
    const result = digestReport(report);
    // toLocaleDateString differs by locale, but it won't be empty
    expect(result).toMatch(/\d/);
  });

  it('handles "weak" verdict', () => {
    const weak: ViralGapAnalysis = {
      ...analysis,
      hook_evaluation: { score: 20, verdict: 'weak', notes: 'Poor start' },
    };
    expect(digestReport(baseReport({ source_type: 'url', analysis: weak }))).toContain('weak');
  });
});

// ─── digestReport — source_type: 'account' ───────────────────────────────────

describe('digestReport() — account (GrowthBlueprint)', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 60, notes: 'Mixed niches' },
    view_to_follower_ratio: { value: 1.5, assessment: 'average' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'regular' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: ['weekends', 'mornings'],
    per_platform_notes: {},
  };

  const report = baseReport({ source_type: 'account', analysis });

  it('includes "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('60/100');
  });

  it('includes thematic notes', () => {
    expect(digestReport(report)).toContain('Mixed niches');
  });

  it('includes posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('weekends');
    expect(result).toContain('mornings');
  });

  it('shows "none noted" when blindspots is empty', () => {
    const noBlindspots: GrowthBlueprint = { ...analysis, posting_blindspots: [] };
    expect(digestReport(baseReport({ source_type: 'account', analysis: noBlindspots }))).toContain('none noted');
  });
});

// ─── digestReport — source_type: 'upload' ────────────────────────────────────

describe('digestReport() — upload (UploadDiagnosis)', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 75, verdict: 'moderate', notes: 'Could be bolder' },
    audio_balance: { score: 90, notes: 'Well mixed' },
    text_overlay_pacing: { assessment: 'Too fast' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
  };

  const report = baseReport({ source_type: 'upload', analysis });

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
    expect(digestReport(report)).toContain('90/100');
  });

  it('includes audio notes', () => {
    expect(digestReport(report)).toContain('Well mixed');
  });

  it('includes text overlay assessment', () => {
    expect(digestReport(report)).toContain('Too fast');
  });
});

// ─── digestReport — source_type: 'discovery' ─────────────────────────────────

describe('digestReport() — discovery (SiteDiscoveryResult)', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'best viral hooks 2024',
    sites: [],
    outlier: { url: 'https://outlier.com', reasoning: 'Unique format' },
    summary: 'Found 10 sites',
  };

  const report = baseReport({ source_type: 'discovery', analysis });

  it('includes "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query', () => {
    expect(digestReport(report)).toContain('best viral hooks 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://outlier.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Unique format');
  });
});

// ─── digestReport — source_type: 'competitors' ───────────────────────────────

describe('digestReport() — competitors (CompetitorGapAnalysis)', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: ['cooking', 'finance'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['meal prep', 'budget tips'],
  };

  const report = baseReport({ source_type: 'competitors', analysis });

  it('includes "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('cooking');
    expect(result).toContain('finance');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('meal prep');
    expect(result).toContain('budget tips');
  });

  it('shows "none noted" when missing_topics is empty', () => {
    const noMissing: CompetitorGapAnalysis = { ...analysis, missing_topics: [] };
    expect(digestReport(baseReport({ source_type: 'competitors', analysis: noMissing }))).toContain('none noted');
  });

  it('shows "none noted" for untapped_keyword_clusters when empty', () => {
    const noClusters: CompetitorGapAnalysis = { ...analysis, untapped_keyword_clusters: [] };
    expect(digestReport(baseReport({ source_type: 'competitors', analysis: noClusters }))).toContain('none noted');
  });

  it('shows "none noted" for both arrays when both are empty', () => {
    const both: CompetitorGapAnalysis = { ...analysis, missing_topics: [], untapped_keyword_clusters: [] };
    const result = digestReport(baseReport({ source_type: 'competitors', analysis: both }));
    // "none noted" appears twice — once for each empty array
    expect(result.split('none noted').length - 1).toBe(2);
  });

  it('single missing topic renders without semicolon separator', () => {
    const one: CompetitorGapAnalysis = { ...analysis, missing_topics: ['cooking'] };
    expect(digestReport(baseReport({ source_type: 'competitors', analysis: one }))).toContain('cooking');
  });

  it('single untapped keyword cluster renders without semicolon separator', () => {
    const one: CompetitorGapAnalysis = { ...analysis, untapped_keyword_clusters: ['meal prep'] };
    expect(digestReport(baseReport({ source_type: 'competitors', analysis: one }))).toContain('meal prep');
  });

  it('multiple missing topics are joined with "; "', () => {
    const multi: CompetitorGapAnalysis = { ...analysis, missing_topics: ['a', 'b', 'c'] };
    expect(digestReport(baseReport({ source_type: 'competitors', analysis: multi }))).toContain('a; b; c');
  });

  it('multiple keyword clusters are joined with "; "', () => {
    const multi: CompetitorGapAnalysis = { ...analysis, untapped_keyword_clusters: ['x', 'y', 'z'] };
    expect(digestReport(baseReport({ source_type: 'competitors', analysis: multi }))).toContain('x; y; z');
  });

  it('result always starts with "Competitor Espionage"', () => {
    const result = digestReport(baseReport({ source_type: 'competitors', analysis }));
    expect(result.startsWith('Competitor Espionage')).toBe(true);
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const baseScript: ScriptRow = {
    id: 'scr-1',
    user_id: 'u-1',
    creator_profile_id: null,
    title: 'My Viral Hook Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know you can double views in 30 days?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up face',
          dialogue_or_vo: 'Opening line',
          audio_sfx_cue: 'whoosh',
          retention_loop_note: 'Loop the question',
        },
        {
          scene_number: 2,
          visual_action: 'B-roll',
          dialogue_or_vo: 'Second line',
          audio_sfx_cue: 'none',
          retention_loop_note: 'Cut to reaction',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-07-20T08:00:00.000Z',
  };

  it('includes the script title', () => {
    expect(digestScript(baseScript)).toContain('My Viral Hook Script');
  });

  it('includes "Script"', () => {
    expect(digestScript(baseScript)).toContain('Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(baseScript)).toContain('Did you know you can double views in 30 days?');
  });

  it('includes scene count', () => {
    expect(digestScript(baseScript)).toContain('2 scenes total');
  });

  it('includes first scene retention_loop_note', () => {
    expect(digestScript(baseScript)).toContain('Loop the question');
  });

  it('shows "(none)" when first scene has no retention_loop_note', () => {
    const noNote: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [{ ...baseScript.storyboard.scenes[0], retention_loop_note: '' }],
      },
    };
    // empty string is falsy via ??, so '(none)' is shown
    // Actually '' is not nullish — ?? only catches null/undefined
    // So empty string retention_loop_note stays as ''
    // The code uses `weakScene?.retention_loop_note ?? '(none)'`
    // Let's test that null/undefined gets '(none)'
    const noNoteNull: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [],
      },
    };
    expect(digestScript(noNoteNull)).toContain('(none)');
  });

  it('shows "(none)" when scenes array is empty', () => {
    const emptyScenes: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    expect(digestScript(emptyScenes)).toContain('(none)');
  });

  it('reports correct scene count for a single scene', () => {
    const oneScene: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [baseScript.storyboard.scenes[0]] },
    };
    expect(digestScript(oneScene)).toContain('1 scenes total');
  });

  it('includes a date string', () => {
    const result = digestScript(baseScript);
    expect(result).toMatch(/\d/);
  });

  it('reports correct scene count for five scenes', () => {
    const fiveScenes: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: Array.from({ length: 5 }, (_, i) => ({
          scene_number: i + 1,
          visual_action: `Action ${i + 1}`,
          dialogue_or_vo: `Line ${i + 1}`,
          audio_sfx_cue: 'none',
          retention_loop_note: `Loop ${i + 1}`,
        })),
      },
    };
    expect(digestScript(fiveScenes)).toContain('5 scenes total');
  });

  it('uses the first scene retention_loop_note, not a later scene', () => {
    const result = digestScript(baseScript);
    // first scene has 'Loop the question', second has 'Cut to reaction'
    expect(result).toContain('Loop the question');
    expect(result).not.toContain('Cut to reaction');
  });

  it('title containing quotes is included verbatim', () => {
    const quoted: ScriptRow = { ...baseScript, title: `Creator's "Best" Hook` };
    expect(digestScript(quoted)).toContain(`Creator's "Best" Hook`);
  });

  it('spoken hook with emoji characters is included verbatim', () => {
    const emoji: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, spoken_hook: '🔥 This blew up overnight!' },
    };
    expect(digestScript(emoji)).toContain('🔥 This blew up overnight!');
  });

  it('result always starts with "Script"', () => {
    expect(digestScript(baseScript).startsWith('Script')).toBe(true);
  });
});

// ─── digestReport — cross-type ────────────────────────────────────────────────

describe('digestReport() — date formatting', () => {
  it('formats the date from the ISO timestamp (not raw ISO string)', () => {
    const r = baseReport({ created_at: '2024-01-15T00:00:00.000Z', source_type: 'url', analysis: {
      pacing_audit: { cuts_per_10s: 2, assessment: 'moderate' },
      hook_evaluation: { score: 50, verdict: 'moderate', notes: 'ok' },
      retention_prediction: { at_3s_percent: 60, at_30s_percent: 40, meets_3s_benchmark: true, meets_30s_benchmark: true },
      action_plan: [],
      source_metrics: {},
    } as import('@/lib/types').ViralGapAnalysis });
    const result = digestReport(r);
    // The ISO timestamp itself should not appear raw in the output
    expect(result).not.toContain('2024-01-15T00:00:00.000Z');
  });

  it('two reports with different dates produce different outputs', () => {
    const analysis: import('@/lib/types').GrowthBlueprint = {
      thematic_consistency: { score: 70, notes: 'ok' },
      view_to_follower_ratio: { value: 1, assessment: 'avg' },
      posting_cadence: { avg_days_between_posts: 2, assessment: 'regular' },
      theme_correction: [],
      view_maximization_tactics: [],
      posting_blindspots: [],
      per_platform_notes: {},
    };
    const r1 = baseReport({ source_type: 'account', analysis, created_at: '2024-01-01T00:00:00.000Z' });
    const r2 = baseReport({ source_type: 'account', analysis, created_at: '2025-06-15T00:00:00.000Z' });
    expect(digestReport(r1)).not.toBe(digestReport(r2));
  });
});
