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

// ── Shared fixture builder ──────────────────────────────────────────────────

function makeReport<T>(
  source_type: AuditReportRow['source_type'],
  analysis: T,
): AuditReportRow<T> {
  return {
    id: 'report-1',
    user_id: 'user-1',
    creator_profile_id: null,
    source_type,
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at: '2024-06-15T12:00:00.000Z',
  };
}

// ── digestReport() ──────────────────────────────────────────────────────────

describe('digestReport() — source_type: url (ViralGapAnalysis)', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'good' },
    hook_evaluation: { score: 72, verdict: 'moderate', notes: 'could be stronger' },
    retention_prediction: {
      at_3s_percent: 65,
      at_30s_percent: 42,
      meets_3s_benchmark: true,
      meets_30s_benchmark: true,
    },
    action_plan: ['Add B-roll'],
    source_metrics: {},
  };
  const report = makeReport('url', analysis);
  const result = digestReport(report);

  it('contains the label "Viral Gap Analyzer"', () => {
    expect(result).toContain('Viral Gap Analyzer');
  });

  it('contains the hook verdict', () => {
    expect(result).toContain('moderate');
  });

  it('contains the hook score', () => {
    expect(result).toContain('72');
  });

  it('contains hook notes', () => {
    expect(result).toContain('could be stronger');
  });

  it('contains 3s retention percentage', () => {
    expect(result).toContain('65%');
  });

  it('contains 30s retention percentage', () => {
    expect(result).toContain('42%');
  });

  it('contains the formatted date', () => {
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });
});

describe('digestReport() — source_type: account (GrowthBlueprint)', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 88, notes: 'very consistent' },
    view_to_follower_ratio: { value: 0.05, assessment: 'average' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'good' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: ['Morning slots', 'Weekend content'],
    per_platform_notes: {},
  };
  const report = makeReport('account', analysis);
  const result = digestReport(report);

  it('contains the label "Account Deep-Dive"', () => {
    expect(result).toContain('Account Deep-Dive');
  });

  it('contains thematic consistency score', () => {
    expect(result).toContain('88');
  });

  it('contains thematic notes', () => {
    expect(result).toContain('very consistent');
  });

  it('contains posting blindspot items', () => {
    expect(result).toContain('Morning slots');
    expect(result).toContain('Weekend content');
  });
});

describe('digestReport() — source_type: account with no blindspots', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 95, notes: 'perfect' },
    view_to_follower_ratio: { value: null, assessment: 'n/a' },
    posting_cadence: { avg_days_between_posts: null, assessment: 'unknown' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: [],
    per_platform_notes: {},
  };
  const report = makeReport('account', analysis);
  const result = digestReport(report);

  it('falls back to "none noted" when blindspots array is empty', () => {
    expect(result).toContain('none noted');
  });
});

describe('digestReport() — source_type: upload (UploadDiagnosis)', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 55, verdict: 'weak', notes: 'too dark' },
    audio_balance: { score: 80, notes: 'clean mix' },
    text_overlay_pacing: { assessment: 'too fast' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
  };
  const report = makeReport('upload', analysis);
  const result = digestReport(report);

  it('contains "Upload Diagnostic" label', () => {
    expect(result).toContain('Upload Diagnostic');
  });

  it('contains visual hook verdict', () => {
    expect(result).toContain('weak');
  });

  it('contains visual hook score', () => {
    expect(result).toContain('55');
  });

  it('contains audio balance score', () => {
    expect(result).toContain('80');
  });

  it('contains audio notes', () => {
    expect(result).toContain('clean mix');
  });

  it('contains text overlay assessment', () => {
    expect(result).toContain('too fast');
  });
});

describe('digestReport() — source_type: discovery (SiteDiscoveryResult)', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'viral cooking videos',
    sites: [],
    outlier: {
      url: 'https://example.com/outlier',
      reasoning: 'uniquely covers niche topics',
    },
    summary: 'A great set of results',
  };
  const report = makeReport('discovery', analysis);
  const result = digestReport(report);

  it('contains "Site Discovery" label', () => {
    expect(result).toContain('Site Discovery');
  });

  it('contains the query string', () => {
    expect(result).toContain('viral cooking videos');
  });

  it('contains outlier URL', () => {
    expect(result).toContain('https://example.com/outlier');
  });

  it('contains outlier reasoning', () => {
    expect(result).toContain('uniquely covers niche topics');
  });
});

describe('digestReport() — source_type: competitors (CompetitorGapAnalysis)', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: ['Cooking hacks', 'Budget meals'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['cheap eats', 'meal prep'],
  };
  const report = makeReport('competitors', analysis);
  const result = digestReport(report);

  it('contains "Competitor Espionage" label', () => {
    expect(result).toContain('Competitor Espionage');
  });

  it('contains missing_topics entries', () => {
    expect(result).toContain('Cooking hacks');
    expect(result).toContain('Budget meals');
  });

  it('contains untapped_keyword_clusters entries', () => {
    expect(result).toContain('cheap eats');
    expect(result).toContain('meal prep');
  });
});

describe('digestReport() — competitor with empty arrays falls back to "none noted"', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: [],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: [],
  };
  const report = makeReport('competitors', analysis);
  const result = digestReport(report);

  it('falls back to "none noted" for missing_topics', () => {
    expect(result).toContain('missing topics: none noted');
  });

  it('falls back to "none noted" for untapped_keyword_clusters', () => {
    expect(result).toContain('untapped keyword clusters: none noted');
  });
});

// ── digestScript() ──────────────────────────────────────────────────────────

function makeScript(overrides: Partial<ScriptRow> = {}): ScriptRow {
  return {
    id: 'script-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'My Viral Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Have you ever wondered why...',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of product',
          dialogue_or_vo: 'Hook text here',
          audio_sfx_cue: 'dramatic sting',
          retention_loop_note: 'open loop about benefits',
        },
        {
          scene_number: 2,
          visual_action: 'Wide shot',
          dialogue_or_vo: 'Main content',
          audio_sfx_cue: '',
          retention_loop_note: 'payoff',
        },
      ],
      cta: 'Follow for more!',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-08-20T09:00:00.000Z',
    ...overrides,
  };
}

describe('digestScript()', () => {
  const script = makeScript();
  const result = digestScript(script);

  it('contains the script title', () => {
    expect(result).toContain('My Viral Script');
  });

  it('contains the spoken hook', () => {
    expect(result).toContain('Have you ever wondered why...');
  });

  it('contains the first scene retention_loop_note', () => {
    expect(result).toContain('open loop about benefits');
  });

  it('contains the total scene count', () => {
    expect(result).toContain('2 scenes total');
  });

  it('contains a formatted date', () => {
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it('returns a non-empty string', () => {
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('digestScript() — first scene has empty retention_loop_note string', () => {
  const script = makeScript({
    storyboard: {
      spoken_hook: 'hook',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'shot',
          dialogue_or_vo: 'line',
          audio_sfx_cue: '',
          retention_loop_note: '',
        },
      ],
      cta: 'Follow',
      memory_context_used: false,
    },
  });

  it('renders empty string as-is — ?? does not catch empty string, only null/undefined', () => {
    // `weakScene?.retention_loop_note ?? '(none)'` — empty string is not null/undefined,
    // so the ?? branch does not fire and the empty string appears verbatim in the output.
    const result = digestScript(script);
    expect(result).toContain('first scene retention loop: ""');
    expect(result).toContain('1 scenes total');
  });
});

describe('digestScript() — no scenes at all', () => {
  const script = makeScript({
    storyboard: {
      spoken_hook: 'hook',
      scenes: [],
      cta: 'Follow',
      memory_context_used: true,
    },
  });

  it('handles empty scenes array gracefully — falls back to (none)', () => {
    const result = digestScript(script);
    expect(result).toContain('(none)');
  });

  it('reports 0 scenes total', () => {
    const result = digestScript(script);
    expect(result).toContain('0 scenes total');
  });
});
