import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { digestReport, digestScript } from '../../lib/digest.ts';
import type { AuditReportRow, ScriptRow } from '../../lib/types.ts';

// ── helpers ────────────────────────────────────────────────────────────────

function baseReport(overrides: Partial<AuditReportRow> = {}): AuditReportRow {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_type: 'url',
    source_url: 'https://tiktok.com/@x/video/1',
    platform: 'tiktok',
    viral_score: 75,
    analysis: {
      pacing_audit: { cuts_per_10s: 4, assessment: 'Good' },
      hook_evaluation: { score: 80, verdict: 'strong', notes: 'Excellent opener' },
      retention_prediction: {
        at_3s_percent: 65,
        at_30s_percent: 42,
        meets_3s_benchmark: true,
        meets_30s_benchmark: true,
      },
      action_plan: ['Cut faster'],
      source_metrics: {},
    },
    timeline_recommendations: [],
    created_at: '2024-09-12T10:00:00.000Z',
    ...overrides,
  } as unknown as AuditReportRow;
}

// ── digestReport ───────────────────────────────────────────────────────────

describe('digestReport() - source_type=url (ViralGapAnalysis)', () => {
  test('returns a non-empty string', () => {
    assert.ok(digestReport(baseReport()).length > 0);
  });

  test('includes "Viral Gap Analyzer" label', () => {
    assert.ok(digestReport(baseReport()).includes('Viral Gap Analyzer'));
  });

  test('includes hook verdict', () => {
    assert.ok(digestReport(baseReport()).includes('strong'));
  });

  test('includes hook score', () => {
    assert.ok(digestReport(baseReport()).includes('80'));
  });

  test('includes 3s retention percentage', () => {
    assert.ok(digestReport(baseReport()).includes('65'));
  });

  test('includes 30s retention percentage', () => {
    assert.ok(digestReport(baseReport()).includes('42'));
  });

  test('includes the formatted date', () => {
    const result = digestReport(baseReport());
    // The date comes from created_at → toLocaleDateString, format varies by locale
    assert.ok(result.match(/\d{1,4}.*\d{1,4}/), `Expected a date in: ${result}`);
  });
});

describe('digestReport() - source_type=account (GrowthBlueprint)', () => {
  const report = baseReport({
    source_type: 'account',
    analysis: {
      thematic_consistency: { score: 72, notes: 'Needs more variety' },
      view_to_follower_ratio: { value: 0.12, assessment: 'Good' },
      posting_cadence: { avg_days_between_posts: 3.5, assessment: 'Regular' },
      theme_correction: [],
      view_maximization_tactics: [],
      posting_blindspots: ['Weekends', 'Early morning'],
      per_platform_notes: {},
    },
  });

  test('includes "Account Deep-Dive" label', () => {
    assert.ok(digestReport(report).includes('Account Deep-Dive'));
  });

  test('includes thematic consistency score', () => {
    assert.ok(digestReport(report).includes('72'));
  });

  test('includes posting blindspots', () => {
    const result = digestReport(report);
    assert.ok(result.includes('Weekends'), result);
    assert.ok(result.includes('Early morning'), result);
  });

  test('shows "none noted" when posting_blindspots is empty', () => {
    const noBlindspots = baseReport({
      source_type: 'account',
      analysis: {
        thematic_consistency: { score: 90, notes: 'Great' },
        view_to_follower_ratio: { value: 0.15, assessment: 'Great' },
        posting_cadence: { avg_days_between_posts: 2, assessment: 'Great' },
        theme_correction: [],
        view_maximization_tactics: [],
        posting_blindspots: [],
        per_platform_notes: {},
      },
    });
    assert.ok(digestReport(noBlindspots).includes('none noted'));
  });
});

describe('digestReport() - source_type=upload (UploadDiagnosis)', () => {
  const report = baseReport({
    source_type: 'upload',
    analysis: {
      visual_hook_clarity: { score: 55, verdict: 'moderate', notes: 'Hook could be stronger' },
      audio_balance: { score: 78, notes: 'Good mix' },
      text_overlay_pacing: { assessment: 'Too fast' },
      b_roll_recommendations: [],
      retention_boosters: [],
      frames_analyzed: 6,
    },
  });

  test('includes "Upload Diagnostic" label', () => {
    assert.ok(digestReport(report).includes('Upload Diagnostic'));
  });

  test('includes visual hook verdict', () => {
    assert.ok(digestReport(report).includes('moderate'));
  });

  test('includes visual hook score', () => {
    assert.ok(digestReport(report).includes('55'));
  });

  test('includes audio balance score', () => {
    assert.ok(digestReport(report).includes('78'));
  });

  test('includes text-overlay assessment', () => {
    assert.ok(digestReport(report).includes('Too fast'));
  });
});

describe('digestReport() - source_type=discovery (SiteDiscoveryResult)', () => {
  const report = baseReport({
    source_type: 'discovery',
    platform: null,
    analysis: {
      query: 'viral fitness content ideas',
      sites: [],
      outlier: {
        url: 'https://example.com/outlier',
        reasoning: 'Unique angle combining HIIT with mindfulness',
      },
      summary: 'Top fitness sites',
    },
  });

  test('includes "Site Discovery" label', () => {
    assert.ok(digestReport(report).includes('Site Discovery'));
  });

  test('includes the query', () => {
    assert.ok(digestReport(report).includes('viral fitness content ideas'));
  });

  test('includes the outlier URL', () => {
    assert.ok(digestReport(report).includes('https://example.com/outlier'));
  });

  test('includes the outlier reasoning', () => {
    assert.ok(digestReport(report).includes('Unique angle combining HIIT with mindfulness'));
  });
});

describe('digestReport() - source_type=competitors (CompetitorGapAnalysis)', () => {
  const report = baseReport({
    source_type: 'competitors',
    platform: null,
    analysis: {
      competitors: [],
      outlier_topics: [],
      missing_topics: ['Morning routines', 'Meal prep'],
      audience_sentiment_gaps: [],
      untapped_keyword_clusters: ['fitness motivation', 'home workout'],
    },
  });

  test('includes "Competitor Espionage" label', () => {
    assert.ok(digestReport(report).includes('Competitor Espionage'));
  });

  test('includes missing topics', () => {
    const result = digestReport(report);
    assert.ok(result.includes('Morning routines'), result);
    assert.ok(result.includes('Meal prep'), result);
  });

  test('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    assert.ok(result.includes('fitness motivation'), result);
    assert.ok(result.includes('home workout'), result);
  });

  test('shows "none noted" for empty missing_topics', () => {
    const empty = baseReport({
      source_type: 'competitors',
      platform: null,
      analysis: {
        competitors: [],
        outlier_topics: [],
        missing_topics: [],
        audience_sentiment_gaps: [],
        untapped_keyword_clusters: [],
      },
    });
    const result = digestReport(empty);
    // Both missing_topics and untapped_keyword_clusters are empty → "none noted" appears twice
    assert.ok(result.includes('none noted'), result);
  });
});

// ── digestScript ───────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const script: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Viral Hook Script',
    source_prompt: 'Create a 60s fitness video',
    storyboard: {
      spoken_hook: 'You WONT believe this workout hack',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up on athlete',
          dialogue_or_vo: 'Three seconds that change everything...',
          audio_sfx_cue: 'Bass drop',
          retention_loop_note: 'Tease the punchline here',
        },
        {
          scene_number: 2,
          visual_action: 'Wide shot of gym',
          dialogue_or_vo: 'The secret is...',
          audio_sfx_cue: 'Suspense music',
          retention_loop_note: 'Cut before revealing',
        },
      ],
      cta: 'Follow for part 2',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-15T10:00:00.000Z',
  };

  test('returns a non-empty string', () => {
    assert.ok(digestScript(script).length > 0);
  });

  test('includes the script title', () => {
    assert.ok(digestScript(script).includes('My Viral Hook Script'));
  });

  test('includes the spoken hook', () => {
    assert.ok(digestScript(script).includes('You WONT believe this workout hack'));
  });

  test('includes the first scene retention loop note', () => {
    assert.ok(digestScript(script).includes('Tease the punchline here'));
  });

  test('includes total scene count', () => {
    assert.ok(digestScript(script).includes('2 scenes'), digestScript(script));
  });

  test('includes a formatted date from created_at', () => {
    const result = digestScript(script);
    assert.ok(result.match(/\d{1,4}/), `Expected a date in: ${result}`);
  });

  test('handles script with no scenes gracefully (retention_loop_note falls back to "(none)")', () => {
    const noScenes: ScriptRow = {
      ...script,
      storyboard: {
        ...script.storyboard,
        scenes: [],
      },
    };
    const result = digestScript(noScenes);
    assert.ok(result.includes('(none)'), result);
    assert.ok(result.includes('0 scenes'), result);
  });

  test('includes "0 scenes total" for empty scenes array', () => {
    const noScenes: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    assert.ok(digestScript(noScenes).includes('0 scenes total'));
  });
});
