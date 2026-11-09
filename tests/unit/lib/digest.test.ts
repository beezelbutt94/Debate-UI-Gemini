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

// Fixed date so toLocaleDateString() output is predictable when we do
// pattern-matching on the returned strings.
const CREATED_AT = '2024-06-15T10:00:00.000Z';

function baseReport<T>(
  source_type: AuditReportRow['source_type'],
  analysis: T
): AuditReportRow<T> {
  return {
    id: 'rpt_1',
    user_id: 'user_1',
    creator_profile_id: null,
    source_type,
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at: CREATED_AT,
  };
}

// ── Viral Gap Analyzer (source_type === 'url') ────────────────────────────

describe("digestReport() — source_type 'url'", () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 4, assessment: 'good' },
    hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Hook grabs attention but loses it at 2s' },
    retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
    action_plan: ['Tighten opening 2 seconds'],
    source_metrics: {},
  };
  const report = baseReport('url', analysis);

  it('mentions Viral Gap Analyzer in the output', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('72');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Hook grabs attention but loses it at 2s');
  });

  it('includes 3-second retention percentage', () => {
    expect(digestReport(report)).toContain('65%');
  });

  it('includes 30-second retention percentage', () => {
    expect(digestReport(report)).toContain('42%');
  });

  it('contains a formatted date', () => {
    // The date string varies by locale but must be non-empty
    const result = digestReport(report);
    expect(result).toMatch(/\d/); // has digits (year/month/day)
  });

  it('snapshot: strong hook verdict', () => {
    const strong: ViralGapAnalysis = {
      ...analysis,
      hook_evaluation: { score: 92, verdict: 'strong', notes: 'Excellent pattern interrupt' },
    };
    const out = digestReport(baseReport('url', strong));
    expect(out).toContain('strong');
    expect(out).toContain('92');
    expect(out).toContain('Excellent pattern interrupt');
  });
});

// ── Account Deep-Dive (source_type === 'account') ─────────────────────────

describe("digestReport() — source_type 'account'", () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 68, notes: 'Too much genre-hopping' },
    view_to_follower_ratio: { value: 1.4, assessment: 'solid' },
    posting_cadence: { avg_days_between_posts: 3.2, assessment: 'consistent' },
    theme_correction: ['Narrow niche to cooking + travel'],
    view_maximization_tactics: ['Use trending audio'],
    posting_blindspots: ['Missing Sunday posts', 'No early-morning slots'],
    per_platform_notes: {},
  };
  const report = baseReport('account', analysis);

  it('mentions Account Deep-Dive in the output', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('68');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Too much genre-hopping');
  });

  it('lists posting blindspots joined by semicolons', () => {
    const out = digestReport(report);
    expect(out).toContain('Missing Sunday posts');
    expect(out).toContain('No early-morning slots');
  });

  it('shows "none noted" when posting blindspots array is empty', () => {
    const noBlindspots: GrowthBlueprint = { ...analysis, posting_blindspots: [] };
    expect(digestReport(baseReport('account', noBlindspots))).toContain('none noted');
  });
});

// ── Upload Diagnostic (source_type === 'upload') ──────────────────────────

describe("digestReport() — source_type 'upload'", () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 55, verdict: 'weak', notes: 'Opening frame is blurry' },
    audio_balance: { score: 80, notes: 'Music slightly too loud' },
    text_overlay_pacing: { assessment: 'Text disappears before viewer can read it' },
    b_roll_recommendations: ['Add B-roll at 10s'],
    retention_boosters: ['Pattern interrupt at 5s'],
    frames_analyzed: 24,
  };
  const report = baseReport('upload', analysis);

  it('mentions Upload Diagnostic in the output', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('weak');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('55');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('80');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Music slightly too loud');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Text disappears before viewer can read it');
  });
});

// ── Site Discovery (source_type === 'discovery') ──────────────────────────

describe("digestReport() — source_type 'discovery'", () => {
  const analysis: SiteDiscoveryResult = {
    query: 'best fitness YouTube channels 2024',
    sites: [],
    outlier: {
      url: 'https://example.com/outlier',
      reasoning: 'Only channel focusing on calisthenics for seniors',
    },
    summary: 'Found 10 relevant channels.',
  };
  const report = baseReport('discovery', analysis);

  it('mentions Site Discovery in the output', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the search query', () => {
    expect(digestReport(report)).toContain('best fitness YouTube channels 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/outlier');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Only channel focusing on calisthenics for seniors');
  });
});

// ── Competitor Espionage (source_type === 'competitors', the default) ─────

describe("digestReport() — source_type 'competitors' (default)", () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: ['day-in-the-life vlogs'],
    missing_topics: ['morning routines', 'budget meal prep'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['meal prep under $20', 'one-pan recipes'],
  };
  const report = baseReport('competitors', analysis);

  it('mentions Competitor Espionage in the output', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('lists missing topics joined by semicolons', () => {
    const out = digestReport(report);
    expect(out).toContain('morning routines');
    expect(out).toContain('budget meal prep');
  });

  it('lists untapped keyword clusters', () => {
    const out = digestReport(report);
    expect(out).toContain('meal prep under $20');
  });

  it('shows "none noted" for empty missing_topics', () => {
    const noMissing: CompetitorGapAnalysis = { ...analysis, missing_topics: [] };
    expect(digestReport(baseReport('competitors', noMissing))).toContain('none noted');
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    const noKeywords: CompetitorGapAnalysis = { ...analysis, untapped_keyword_clusters: [] };
    expect(digestReport(baseReport('competitors', noKeywords))).toContain('none noted');
  });
});

// ── digestScript() ────────────────────────────────────────────────────────

function makeScript(overrides: Partial<ScriptRow> = {}): ScriptRow {
  return {
    id: 'scr_1',
    user_id: 'user_1',
    creator_profile_id: null,
    title: 'Epic Hook Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know you can double your views in 7 days?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of phone showing view count',
          dialogue_or_vo: 'Your view count is about to skyrocket.',
          audio_sfx_cue: 'whoosh',
          retention_loop_note: 'Loop back to hook with counter',
        },
        {
          scene_number: 2,
          visual_action: 'B-roll street scene',
          dialogue_or_vo: 'Here is what most creators miss.',
          audio_sfx_cue: '',
          retention_loop_note: 'Tease scene 3 with cliffhanger',
        },
      ],
      cta: 'Follow for daily tips',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: null,
    created_at: CREATED_AT,
    ...overrides,
  };
}

describe('digestScript()', () => {
  it('includes the script title', () => {
    expect(digestScript(makeScript())).toContain('Epic Hook Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(makeScript())).toContain(
      'Did you know you can double your views in 7 days?'
    );
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(makeScript())).toContain('Loop back to hook with counter');
  });

  it('includes total scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });

  it('contains a formatted date', () => {
    expect(digestScript(makeScript())).toMatch(/\d/);
  });

  it('shows (none) for retention_loop_note when scenes array is empty', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    const out = digestScript(script);
    expect(out).toContain('(none)');
  });

  it('shows 0 scenes total when scenes array is empty', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    expect(digestScript(script)).toContain('0 scenes total');
  });

  it('uses the first scene retention_loop_note (not a later one)', () => {
    const script = makeScript();
    const out = digestScript(script);
    expect(out).toContain('Loop back to hook with counter');
    expect(out).not.toContain('Tease scene 3 with cliffhanger');
  });
});
