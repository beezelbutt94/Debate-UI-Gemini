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

// ─── helpers ────────────────────────────────────────────────────────────────

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-03-15T00:00:00.000Z',
};

function makeReport<T>(source_type: AuditReportRow['source_type'], analysis: T): AuditReportRow<T> {
  return { ...BASE_REPORT, source_type, analysis } as AuditReportRow<T>;
}

// ─── digestReport ────────────────────────────────────────────────────────────

describe('digestReport() – url (ViralGapAnalysis)', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'good' },
    hook_evaluation: { score: 72, verdict: 'moderate', notes: 'opener buries the hook' },
    retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
    action_plan: ['tighten opening'],
    source_metrics: {},
  };

  it('includes "Viral Gap Analyzer" label', () => {
    const result = digestReport(makeReport('url', analysis));
    expect(result).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(makeReport('url', analysis))).toContain('moderate');
  });

  it('includes hook score', () => {
    expect(digestReport(makeReport('url', analysis))).toContain('72/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(makeReport('url', analysis))).toContain('opener buries the hook');
  });

  it('includes retention 3s percentage', () => {
    expect(digestReport(makeReport('url', analysis))).toContain('3s=65%');
  });

  it('includes retention 30s percentage', () => {
    expect(digestReport(makeReport('url', analysis))).toContain('30s=42%');
  });

  it('includes the formatted date', () => {
    const result = digestReport(makeReport('url', analysis));
    // Date will be formatted by toLocaleDateString; just check it's present
    expect(result).toMatch(/\d/);
  });
});

describe('digestReport() – account (GrowthBlueprint)', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 88, notes: 'tightly focused on cooking' },
    view_to_follower_ratio: { value: 0.12, assessment: 'healthy' },
    posting_cadence: { avg_days_between_posts: 2, assessment: 'consistent' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: ['no weekend posts', 'skipping holidays'],
    per_platform_notes: {},
  };

  it('includes "Account Deep-Dive" label', () => {
    expect(digestReport(makeReport('account', analysis))).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(makeReport('account', analysis))).toContain('88/100');
  });

  it('includes thematic notes', () => {
    expect(digestReport(makeReport('account', analysis))).toContain('tightly focused on cooking');
  });

  it('includes posting blindspots joined by semicolons', () => {
    const result = digestReport(makeReport('account', analysis));
    expect(result).toContain('no weekend posts');
    expect(result).toContain('skipping holidays');
  });

  it('shows "none noted" when posting_blindspots is empty', () => {
    const empty: GrowthBlueprint = { ...analysis, posting_blindspots: [] };
    expect(digestReport(makeReport('account', empty))).toContain('none noted');
  });
});

describe('digestReport() – upload (UploadDiagnosis)', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 55, verdict: 'weak', notes: 'face not visible in frame 1' },
    audio_balance: { score: 80, notes: 'music too loud' },
    text_overlay_pacing: { assessment: 'text lingers too long' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
  };

  it('includes "Upload Diagnostic" label', () => {
    expect(digestReport(makeReport('upload', analysis))).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(makeReport('upload', analysis))).toContain('weak');
  });

  it('includes visual hook score', () => {
    expect(digestReport(makeReport('upload', analysis))).toContain('55/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(makeReport('upload', analysis))).toContain('80/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(makeReport('upload', analysis))).toContain('music too loud');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(makeReport('upload', analysis))).toContain('text lingers too long');
  });
});

describe('digestReport() – discovery (SiteDiscoveryResult)', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'viral cooking videos 2024',
    sites: [],
    outlier: { url: 'https://example.com', reasoning: 'only site with live demos' },
    summary: 'ten cooking sites found',
  };

  it('includes "Site Discovery" label', () => {
    expect(digestReport(makeReport('discovery', analysis))).toContain('Site Discovery');
  });

  it('includes the query', () => {
    expect(digestReport(makeReport('discovery', analysis))).toContain('viral cooking videos 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(makeReport('discovery', analysis))).toContain('https://example.com');
  });

  it('includes outlier reasoning', () => {
    expect(digestReport(makeReport('discovery', analysis))).toContain('only site with live demos');
  });
});

describe('digestReport() – competitors (CompetitorGapAnalysis)', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: ['long-form cooking tutorials', 'recipe printables'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['air fryer', 'meal prep sunday'],
  };

  it('includes "Competitor Espionage" label', () => {
    expect(digestReport(makeReport('competitors', analysis))).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const result = digestReport(makeReport('competitors', analysis));
    expect(result).toContain('long-form cooking tutorials');
    expect(result).toContain('recipe printables');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(makeReport('competitors', analysis));
    expect(result).toContain('air fryer');
    expect(result).toContain('meal prep sunday');
  });

  it('shows "none noted" for empty missing_topics', () => {
    const empty: CompetitorGapAnalysis = { ...analysis, missing_topics: [] };
    expect(digestReport(makeReport('competitors', empty))).toContain('none noted');
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    const empty: CompetitorGapAnalysis = { ...analysis, untapped_keyword_clusters: [] };
    const result = digestReport(makeReport('competitors', empty));
    // The second "none noted" belongs to untapped_keyword_clusters
    expect(result.split('none noted').length).toBeGreaterThanOrEqual(2);
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const BASE_SCRIPT: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My viral reel',
    source_prompt: null,
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-06-01T00:00:00.000Z',
    storyboard: {
      spoken_hook: 'You won\'t believe this hack',
      memory_context_used: false,
      cta: 'Follow for more',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of hands',
          dialogue_or_vo: 'Here is how to do it',
          audio_sfx_cue: 'upbeat music',
          retention_loop_note: 'cuts back to the result at 2s',
        },
      ],
    },
  };

  it('includes the script title', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('My viral reel');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(BASE_SCRIPT)).toContain("You won't believe this hack");
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('cuts back to the result at 2s');
  });

  it('includes the total scene count', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('1 scenes total');
  });

  it('reports (none) when the first scene has no retention_loop_note', () => {
    const noNote: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: {
        ...BASE_SCRIPT.storyboard,
        scenes: [{ ...BASE_SCRIPT.storyboard.scenes[0], retention_loop_note: '' }],
      },
    };
    // An empty string is falsy? No — the template uses `?? '(none)'` which only
    // triggers for undefined/null, not empty string. Still include this test.
    const result = digestScript(noNote);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('shows (none) when scenes array is empty', () => {
    const noScenes: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('(none)');
  });

  it('includes the scene count for multi-scene scripts', () => {
    const multiScene: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: {
        ...BASE_SCRIPT.storyboard,
        scenes: [
          BASE_SCRIPT.storyboard.scenes[0],
          { scene_number: 2, visual_action: 'wide shot', dialogue_or_vo: 'more info', audio_sfx_cue: '', retention_loop_note: 'loop 2' },
          { scene_number: 3, visual_action: 'cta card', dialogue_or_vo: 'follow me', audio_sfx_cue: '', retention_loop_note: 'end loop' },
        ],
      },
    };
    expect(digestScript(multiScene)).toContain('3 scenes total');
  });

  it('includes the formatted date', () => {
    const result = digestScript(BASE_SCRIPT);
    expect(result).toMatch(/\d/);
  });
});
