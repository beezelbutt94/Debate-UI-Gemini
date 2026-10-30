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

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-01-15T00:00:00.000Z',
};

const DATE_STR = new Date('2024-01-15T00:00:00.000Z').toLocaleDateString();

// ─────────────────────────────────────────────────────────────
// digestReport — source_type: 'url'
// ─────────────────────────────────────────────────────────────
describe('digestReport() with source_type=url', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
    hook_evaluation: { score: 85, verdict: 'strong', notes: 'Great opening line' },
    retention_prediction: { at_3s_percent: 72, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
    action_plan: ['add captions', 'trim intro'],
    source_metrics: {},
  };

  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis };

  it('includes "Viral Gap Analyzer" label', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the date', () => {
    expect(digestReport(report)).toContain(DATE_STR);
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('85');
  });

  it('includes the hook notes', () => {
    expect(digestReport(report)).toContain('Great opening line');
  });

  it('includes 3s retention percentage', () => {
    expect(digestReport(report)).toContain('72');
  });

  it('includes 30s retention percentage', () => {
    expect(digestReport(report)).toContain('45');
  });

  it('has the exact output format', () => {
    const result = digestReport(report);
    expect(result).toBe(
      `Viral Gap Analyzer (${DATE_STR}): hook "strong" (85/100, "Great opening line"); retention 3s=72% 30s=45%.`
    );
  });
});

// ─────────────────────────────────────────────────────────────
// digestReport — source_type: 'account'
// ─────────────────────────────────────────────────────────────
describe('digestReport() with source_type=account', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 70, notes: 'Needs more focus' },
    view_to_follower_ratio: { value: 2.5, assessment: 'average' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: ['Weekend mornings', 'Tuesday evenings'],
    per_platform_notes: {},
  };

  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis };

  it('includes "Account Deep-Dive" label', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('70');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Needs more focus');
  });

  it('includes posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Weekend mornings');
    expect(result).toContain('Tuesday evenings');
  });

  it('shows "none noted" when blindspots array is empty', () => {
    const emptyBlindspots: GrowthBlueprint = { ...analysis, posting_blindspots: [] };
    const r: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: emptyBlindspots };
    expect(digestReport(r)).toContain('none noted');
  });
});

// ─────────────────────────────────────────────────────────────
// digestReport — source_type: 'upload'
// ─────────────────────────────────────────────────────────────
describe('digestReport() with source_type=upload', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'Hook is ok' },
    audio_balance: { score: 80, notes: 'Good mix' },
    text_overlay_pacing: { assessment: 'Slightly too fast' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
  };

  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis };

  it('includes "Upload Diagnostic" label', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('60');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('80');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Good mix');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Slightly too fast');
  });

  it('has the exact output format', () => {
    expect(digestReport(report)).toBe(
      `Upload Diagnostic (${DATE_STR}): visual hook "moderate" (60/100); audio balance 80/100 ("Good mix"); text-overlay pacing: "Slightly too fast".`
    );
  });
});

// ─────────────────────────────────────────────────────────────
// digestReport — source_type: 'discovery'
// ─────────────────────────────────────────────────────────────
describe('digestReport() with source_type=discovery', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'best cooking channels 2024',
    sites: [],
    outlier: {
      url: 'https://example.com/outlier',
      reasoning: 'It covers molecular gastronomy while others do home cooking',
    },
    summary: 'Found 10 relevant sites',
  };

  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'discovery', analysis };

  it('includes "Site Discovery" label', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query', () => {
    expect(digestReport(report)).toContain('best cooking channels 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/outlier');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('molecular gastronomy');
  });

  it('has the exact output format', () => {
    expect(digestReport(report)).toBe(
      `Site Discovery (${DATE_STR}): query "best cooking channels 2024"; outlier "https://example.com/outlier" -- It covers molecular gastronomy while others do home cooking`
    );
  });
});

// ─────────────────────────────────────────────────────────────
// digestReport — source_type: 'competitors' (default branch)
// ─────────────────────────────────────────────────────────────
describe('digestReport() with source_type=competitors', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: ['Recipe shorts', 'Food science'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['air fryer recipes', 'one-pot meals'],
  };

  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis };

  it('includes "Competitor Espionage" label', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('Recipe shorts');
    expect(result).toContain('Food science');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('air fryer recipes');
    expect(result).toContain('one-pot meals');
  });

  it('shows "none noted" when missing_topics is empty', () => {
    const empty: CompetitorGapAnalysis = { ...analysis, missing_topics: [] };
    const r: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: empty };
    expect(digestReport(r)).toContain('none noted');
  });

  it('shows "none noted" when untapped_keyword_clusters is empty', () => {
    const empty: CompetitorGapAnalysis = { ...analysis, untapped_keyword_clusters: [] };
    const r: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: empty };
    expect(digestReport(r)).toContain('none noted');
  });
});

// ─────────────────────────────────────────────────────────────
// digestScript
// ─────────────────────────────────────────────────────────────
describe('digestScript()', () => {
  const BASE_SCRIPT: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Viral Hook Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'You will not believe what happened next...',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up on face',
          dialogue_or_vo: 'hook line here',
          audio_sfx_cue: 'none',
          retention_loop_note: 'Cut to reaction immediately',
        },
        {
          scene_number: 2,
          visual_action: 'Wide shot',
          dialogue_or_vo: 'main content',
          audio_sfx_cue: 'music up',
          retention_loop_note: 'End on cliffhanger',
        },
      ],
      cta: 'Follow for more!',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-01-15T00:00:00.000Z',
  };

  it('includes the script title', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('My Viral Hook Script');
  });

  it('includes the date', () => {
    expect(digestScript(BASE_SCRIPT)).toContain(DATE_STR);
  });

  it('includes the spoken hook', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('You will not believe what happened next...');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Cut to reaction immediately');
  });

  it('includes the total scene count', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('2 scenes total');
  });

  it('has the exact output format', () => {
    expect(digestScript(BASE_SCRIPT)).toBe(
      `Script "My Viral Hook Script" (${DATE_STR}): hook "You will not believe what happened next..."; first scene retention loop: "Cut to reaction immediately"; 2 scenes total.`
    );
  });

  it('shows "(none)" when scenes array is empty', () => {
    const empty: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    expect(digestScript(empty)).toContain('(none)');
  });

  it('uses scene[0] retention_loop_note even when there are many scenes', () => {
    const many: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: {
        ...BASE_SCRIPT.storyboard,
        scenes: [
          { scene_number: 1, visual_action: '', dialogue_or_vo: '', audio_sfx_cue: '', retention_loop_note: 'First note' },
          { scene_number: 2, visual_action: '', dialogue_or_vo: '', audio_sfx_cue: '', retention_loop_note: 'Second note' },
          { scene_number: 3, visual_action: '', dialogue_or_vo: '', audio_sfx_cue: '', retention_loop_note: 'Third note' },
        ],
      },
    };
    const result = digestScript(many);
    expect(result).toContain('First note');
    expect(result).not.toContain('Second note');
    expect(result).toContain('3 scenes total');
  });

  it('renders empty string as-is for retention_loop_note (nullish coalescing, not falsy)', () => {
    // The code uses `?? '(none)'` — empty string is NOT nullish, so it renders as ""
    const noNote: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: {
        ...BASE_SCRIPT.storyboard,
        scenes: [
          { scene_number: 1, visual_action: '', dialogue_or_vo: '', audio_sfx_cue: '', retention_loop_note: '' },
        ],
      },
    };
    const result = digestScript(noNote);
    expect(result).toContain('first scene retention loop: ""');
    expect(result).not.toContain('(none)');
  });
});
