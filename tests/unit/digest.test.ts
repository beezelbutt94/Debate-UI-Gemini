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

function makeReport(overrides: Partial<AuditReportRow>): AuditReportRow {
  return {
    id: 'rpt-1',
    user_id: 'user-1',
    creator_profile_id: null,
    source_type: 'url',
    source_url: 'https://www.tiktok.com/@creator/video/1',
    platform: 'tiktok',
    viral_score: 72,
    analysis: {} as ViralGapAnalysis,
    timeline_recommendations: [],
    created_at: '2026-01-15T10:00:00.000Z',
    ...overrides,
  };
}

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
  hook_evaluation: { score: 80, verdict: 'strong', notes: 'Great opening' },
  retention_prediction: { at_3s_percent: 70, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Improve CTA'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 60, notes: 'Mixed niches' },
  view_to_follower_ratio: { value: 2.5, assessment: 'healthy' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
  theme_correction: ['Focus on cooking content'],
  view_maximization_tactics: ['Add trending audio'],
  posting_blindspots: ['Missing weekend posts', 'No Thursday content'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 65, verdict: 'moderate', notes: 'Hook visible but slow' },
  audio_balance: { score: 55, notes: 'Music too loud' },
  text_overlay_pacing: { assessment: 'Text disappears too fast' },
  b_roll_recommendations: ['Add B-roll cutaways'],
  retention_boosters: ['Use jump cuts'],
  frames_analyzed: 120,
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['trending sound usage'],
  missing_topics: ['recipes', 'meal prep'],
  audience_sentiment_gaps: ['younger audience prefers humor'],
  untapped_keyword_clusters: ['quick meals', 'budget cooking'],
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'cooking tutorials 2026',
    sites: [
    {
      url: 'https://www.allrecipes.com',
      domain: 'allrecipes.com',
      title: 'All Recipes',
      snippet: 'Top recipe site',
      relevance_reason: 'highly relevant',
    },
  ],
  outlier: {
    url: 'https://www.allrecipes.com',
    reasoning: 'Stands out for user-generated recipe variety',
  },
  summary: 'Found top cooking tutorial sites',
};

// ─── digestReport — url (ViralGapAnalysis) ────────────────────────────────────

describe('digestReport — url source_type', () => {
  it('includes "Viral Gap Analyzer" label', () => {
    const report = makeReport({ source_type: 'url', analysis: viralAnalysis });
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    const report = makeReport({ source_type: 'url', analysis: viralAnalysis });
    expect(digestReport(report)).toContain('strong');
  });

  it('includes hook score', () => {
    const report = makeReport({ source_type: 'url', analysis: viralAnalysis });
    expect(digestReport(report)).toContain('80');
  });

  it('includes hook notes', () => {
    const report = makeReport({ source_type: 'url', analysis: viralAnalysis });
    expect(digestReport(report)).toContain('Great opening');
  });

  it('includes 3s retention', () => {
    const report = makeReport({ source_type: 'url', analysis: viralAnalysis });
    expect(digestReport(report)).toContain('3s=70%');
  });

  it('includes 30s retention', () => {
    const report = makeReport({ source_type: 'url', analysis: viralAnalysis });
    expect(digestReport(report)).toContain('30s=45%');
  });

  it('includes formatted date', () => {
    const report = makeReport({ source_type: 'url', analysis: viralAnalysis });
    const result = digestReport(report);
    // Should include the year at minimum
    expect(result).toContain('2026');
  });

  it('handles weak verdict', () => {
    const weakAnalysis: ViralGapAnalysis = {
      ...viralAnalysis,
      hook_evaluation: { score: 20, verdict: 'weak', notes: 'No hook' },
    };
    const report = makeReport({ source_type: 'url', analysis: weakAnalysis });
    expect(digestReport(report)).toContain('weak');
  });
});

// ─── digestReport — account (GrowthBlueprint) ────────────────────────────────

describe('digestReport — account source_type', () => {
  it('includes "Account Deep-Dive" label', () => {
    const report = makeReport({ source_type: 'account', analysis: growthAnalysis });
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    const report = makeReport({ source_type: 'account', analysis: growthAnalysis });
    expect(digestReport(report)).toContain('60');
  });

  it('includes thematic consistency notes', () => {
    const report = makeReport({ source_type: 'account', analysis: growthAnalysis });
    expect(digestReport(report)).toContain('Mixed niches');
  });

  it('includes posting blindspots', () => {
    const report = makeReport({ source_type: 'account', analysis: growthAnalysis });
    const result = digestReport(report);
    expect(result).toContain('Missing weekend posts');
    expect(result).toContain('No Thursday content');
  });

  it('shows "none noted" when blindspots is empty', () => {
    const noBlindspots: GrowthBlueprint = { ...growthAnalysis, posting_blindspots: [] };
    const report = makeReport({ source_type: 'account', analysis: noBlindspots });
    expect(digestReport(report)).toContain('none noted');
  });
});

// ─── digestReport — upload (UploadDiagnosis) ─────────────────────────────────

describe('digestReport — upload source_type', () => {
  it('includes "Upload Diagnostic" label', () => {
    const report = makeReport({ source_type: 'upload', analysis: uploadAnalysis });
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    const report = makeReport({ source_type: 'upload', analysis: uploadAnalysis });
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    const report = makeReport({ source_type: 'upload', analysis: uploadAnalysis });
    expect(digestReport(report)).toContain('65');
  });

  it('includes audio balance score', () => {
    const report = makeReport({ source_type: 'upload', analysis: uploadAnalysis });
    expect(digestReport(report)).toContain('55');
  });

  it('includes audio balance notes', () => {
    const report = makeReport({ source_type: 'upload', analysis: uploadAnalysis });
    expect(digestReport(report)).toContain('Music too loud');
  });

  it('includes text overlay pacing assessment', () => {
    const report = makeReport({ source_type: 'upload', analysis: uploadAnalysis });
    expect(digestReport(report)).toContain('Text disappears too fast');
  });
});

// ─── digestReport — discovery (SiteDiscoveryResult) ──────────────────────────

describe('digestReport — discovery source_type', () => {
  it('includes "Site Discovery" label', () => {
    const report = makeReport({ source_type: 'discovery', analysis: discoveryAnalysis });
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes query string', () => {
    const report = makeReport({ source_type: 'discovery', analysis: discoveryAnalysis });
    expect(digestReport(report)).toContain('cooking tutorials 2026');
  });

  it('includes outlier URL', () => {
    const report = makeReport({ source_type: 'discovery', analysis: discoveryAnalysis });
    expect(digestReport(report)).toContain('https://www.allrecipes.com');
  });

  it('includes outlier reasoning', () => {
    const report = makeReport({ source_type: 'discovery', analysis: discoveryAnalysis });
    expect(digestReport(report)).toContain('Stands out for user-generated recipe variety');
  });
});

// ─── digestReport — competitors (CompetitorGapAnalysis) ──────────────────────

describe('digestReport — competitors source_type (default)', () => {
  it('includes "Competitor Espionage" label', () => {
    const report = makeReport({ source_type: 'competitors', analysis: competitorAnalysis });
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const report = makeReport({ source_type: 'competitors', analysis: competitorAnalysis });
    const result = digestReport(report);
    expect(result).toContain('recipes');
    expect(result).toContain('meal prep');
  });

  it('includes untapped keyword clusters', () => {
    const report = makeReport({ source_type: 'competitors', analysis: competitorAnalysis });
    const result = digestReport(report);
    expect(result).toContain('quick meals');
    expect(result).toContain('budget cooking');
  });

  it('shows "none noted" for empty missing_topics', () => {
    const noTopics: CompetitorGapAnalysis = { ...competitorAnalysis, missing_topics: [] };
    const report = makeReport({ source_type: 'competitors', analysis: noTopics });
    expect(digestReport(report)).toContain('none noted');
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    const noClusters: CompetitorGapAnalysis = { ...competitorAnalysis, untapped_keyword_clusters: [] };
    const report = makeReport({ source_type: 'competitors', analysis: noClusters });
    expect(digestReport(report)).toContain('none noted');
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

function makeScript(overrides: Partial<ScriptRow> = {}): ScriptRow {
  return {
    id: 'script-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'My Viral Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know you can double your views in 7 days?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of phone showing metrics',
          dialogue_or_vo: 'Your views are about to 2x',
          audio_sfx_cue: 'Upbeat music',
          retention_loop_note: 'Pattern interrupt at 2s',
        },
        {
          scene_number: 2,
          visual_action: 'Screen recording of editing',
          dialogue_or_vo: 'Here is the technique',
          audio_sfx_cue: 'Transition sound',
          retention_loop_note: 'Loop hint at end',
        },
      ],
      cta: 'Follow for more tips',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2026-03-10T12:00:00.000Z',
    ...overrides,
  };
}

describe('digestScript', () => {
  it('includes the script title', () => {
    expect(digestScript(makeScript())).toContain('My Viral Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(makeScript())).toContain('Did you know you can double your views in 7 days?');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(makeScript())).toContain('Pattern interrupt at 2s');
  });

  it('includes scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });

  it('includes the year from created_at', () => {
    expect(digestScript(makeScript())).toContain('2026');
  });

  it('shows (none) when no scenes', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    expect(digestScript(script)).toContain('(none)');
  });

  it('shows correct scene count with one scene', () => {
    const script = makeScript();
    script.storyboard.scenes = [script.storyboard.scenes[0]];
    expect(digestScript(script)).toContain('1 scenes total');
  });

  it('handles 5 scenes correctly', () => {
    const script = makeScript();
    for (let i = 3; i <= 5; i++) {
      script.storyboard.scenes.push({
        scene_number: i,
        visual_action: `action ${i}`,
        dialogue_or_vo: `dialogue ${i}`,
        audio_sfx_cue: `sfx ${i}`,
        retention_loop_note: `loop ${i}`,
      });
    }
    expect(digestScript(script)).toContain('5 scenes total');
  });

  it('uses the first scene loop note, not the last', () => {
    const script = makeScript();
    const result = digestScript(script);
    expect(result).toContain('Pattern interrupt at 2s');
    expect(result).not.toContain('Loop hint at end');
  });
});
