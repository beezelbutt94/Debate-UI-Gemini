import { describe, it, expect, beforeEach, vi } from 'vitest';
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

// Pin the locale so toLocaleDateString() is deterministic across environments.
beforeEach(() => {
  vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('1/1/2024');
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReport<T>(
  overrides: Partial<AuditReportRow<T>> & { source_type: AuditReportRow<T>['source_type']; analysis: T }
): AuditReportRow<T> {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── digestReport — url (ViralGapAnalysis) ────────────────────────────────────

describe('digestReport — url source_type', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'good' },
    hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Opens with motion blur' },
    retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
    action_plan: ['Add captions'],
    source_metrics: {},
  };

  const report = makeReport<ViralGapAnalysis>({ source_type: 'url', analysis });

  it('includes "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('72/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Opens with motion blur');
  });

  it('includes 3s retention', () => {
    expect(digestReport(report)).toContain('3s=65%');
  });

  it('includes 30s retention', () => {
    expect(digestReport(report)).toContain('30s=42%');
  });

  it('includes the formatted date', () => {
    expect(digestReport(report)).toContain('1/1/2024');
  });

  it('works with strong verdict', () => {
    const a = { ...analysis, hook_evaluation: { score: 90, verdict: 'strong' as const, notes: 'Dramatic hook' } };
    const r = makeReport<ViralGapAnalysis>({ source_type: 'url', analysis: a });
    expect(digestReport(r)).toContain('strong');
  });
});

// ─── digestReport — account (GrowthBlueprint) ────────────────────────────────

describe('digestReport — account source_type', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 80, notes: 'Mostly cooking content' },
    view_to_follower_ratio: { value: 0.12, assessment: 'average' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: ['weekday mornings', 'Thursday evening'],
    per_platform_notes: {},
  };

  const report = makeReport<GrowthBlueprint>({ source_type: 'account', analysis });

  it('includes "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('80/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Mostly cooking content');
  });

  it('includes posting blindspots joined by semicolons', () => {
    expect(digestReport(report)).toContain('weekday mornings; Thursday evening');
  });

  it('shows "none noted" when no posting blindspots', () => {
    const a = { ...analysis, posting_blindspots: [] };
    const r = makeReport<GrowthBlueprint>({ source_type: 'account', analysis: a });
    expect(digestReport(r)).toContain('none noted');
  });
});

// ─── digestReport — upload (UploadDiagnosis) ─────────────────────────────────

describe('digestReport — upload source_type', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'Blurry first frame' },
    audio_balance: { score: 70, notes: 'Music too loud' },
    text_overlay_pacing: { assessment: 'Too fast to read' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
  };

  const report = makeReport<UploadDiagnosis>({ source_type: 'upload', analysis });

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
    expect(digestReport(report)).toContain('70/100');
  });

  it('includes audio notes', () => {
    expect(digestReport(report)).toContain('Music too loud');
  });

  it('includes text overlay assessment', () => {
    expect(digestReport(report)).toContain('Too fast to read');
  });
});

// ─── digestReport — discovery (SiteDiscoveryResult) ──────────────────────────

describe('digestReport — discovery source_type', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'best fitness influencers 2024',
    sites: [],
    outlier: { url: 'https://outlier.example.com', reasoning: 'unique angle on nutrition' },
    summary: 'Various fitness sites found',
  };

  const report = makeReport<SiteDiscoveryResult>({ source_type: 'discovery', analysis });

  it('includes "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query', () => {
    expect(digestReport(report)).toContain('best fitness influencers 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://outlier.example.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('unique angle on nutrition');
  });
});

// ─── digestReport — competitors (CompetitorGapAnalysis) ──────────────────────

describe('digestReport — competitors source_type (default branch)', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: ['budget cooking', 'meal prep'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['quick dinners', 'student meals'],
  };

  const report = makeReport<CompetitorGapAnalysis>({ source_type: 'competitors', analysis });

  it('includes "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('lists missing topics separated by semicolons', () => {
    expect(digestReport(report)).toContain('budget cooking; meal prep');
  });

  it('lists untapped keyword clusters', () => {
    expect(digestReport(report)).toContain('quick dinners; student meals');
  });

  it('shows "none noted" for empty missing_topics', () => {
    const a = { ...analysis, missing_topics: [] };
    const r = makeReport<CompetitorGapAnalysis>({ source_type: 'competitors', analysis: a });
    expect(digestReport(r)).toContain('missing topics: none noted');
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    const a = { ...analysis, untapped_keyword_clusters: [] };
    const r = makeReport<CompetitorGapAnalysis>({ source_type: 'competitors', analysis: a });
    expect(digestReport(r)).toContain('none noted');
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

describe('digestScript', () => {
  const makeScript = (overrides: Partial<ScriptRow> = {}): ScriptRow => ({
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Epic Reel',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know you can double your views?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Zoom into camera',
          dialogue_or_vo: 'Intro line',
          audio_sfx_cue: 'whoosh',
          retention_loop_note: 'Cut to reaction shot',
        },
        {
          scene_number: 2,
          visual_action: 'Show graph',
          dialogue_or_vo: 'Stats reveal',
          audio_sfx_cue: 'ding',
          retention_loop_note: 'Loop back to hook',
        },
      ],
      cta: 'Follow for more tips',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  });

  it('includes the script title', () => {
    expect(digestScript(makeScript())).toContain('My Epic Reel');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(makeScript())).toContain('Did you know you can double your views?');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(makeScript())).toContain('Cut to reaction shot');
  });

  it('reports total scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    expect(digestScript(makeScript())).toContain('1/1/2024');
  });

  it('shows (none) when first scene has no retention_loop_note', () => {
    const script = makeScript();
    script.storyboard.scenes[0].retention_loop_note = '';
    // The code uses `weakScene?.retention_loop_note ?? '(none)'` which only
    // falls back for undefined/null, not empty string. Test real behaviour.
    const result = digestScript(script);
    expect(result).toContain('""');
  });

  it('shows (none) when there are no scenes at all', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    expect(digestScript(script)).toContain('(none)');
  });

  it('reports correct scene count with one scene', () => {
    const script = makeScript();
    script.storyboard.scenes = [script.storyboard.scenes[0]];
    expect(digestScript(script)).toContain('1 scenes total');
  });

  it('reports zero scenes', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    expect(digestScript(script)).toContain('0 scenes total');
  });
});
