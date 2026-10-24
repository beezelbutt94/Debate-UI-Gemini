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

// ── Helpers ─────────────────────────────────────────────────────────────────

function baseRow(overrides: Partial<AuditReportRow>): AuditReportRow {
  return {
    id: 'row-1',
    user_id: 'user-1',
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

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
  hook_evaluation: { score: 82, verdict: 'strong', notes: 'immediate pattern interrupt' },
  retention_prediction: {
    at_3s_percent: 78,
    at_30s_percent: 45,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['trim intro', 'add captions'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 71, notes: 'mostly on topic' },
  view_to_follower_ratio: { value: 1.8, assessment: 'above average' },
  posting_cadence: { avg_days_between_posts: 3.5, assessment: 'consistent' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['weekend mornings', 'Q&A format'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 65, verdict: 'moderate', notes: 'needs stronger opener' },
  audio_balance: { score: 88, notes: 'well balanced' },
  text_overlay_pacing: { assessment: 'slightly too fast' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 24,
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'viral TikTok hooks 2024',
  sites: [],
  outlier: { url: 'https://outlier.example.com', reasoning: 'unique angle not seen elsewhere' },
  summary: 'found 10 relevant sites',
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['trending audio'],
  missing_topics: ['behind-the-scenes', 'day-in-the-life'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['viral hooks', 'content batching'],
};

// ── digestReport – url source_type ──────────────────────────────────────────

describe('digestReport() – source_type="url"', () => {
  const row = baseRow({ source_type: 'url', analysis: viralAnalysis });

  it('starts with "Viral Gap Analyzer"', () => {
    expect(digestReport(row)).toMatch(/^Viral Gap Analyzer/);
  });

  it('includes the hook verdict', () => {
    expect(digestReport(row)).toContain('strong');
  });

  it('includes the hook score', () => {
    expect(digestReport(row)).toContain('82/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(row)).toContain('immediate pattern interrupt');
  });

  it('includes 3s retention', () => {
    expect(digestReport(row)).toContain('3s=78%');
  });

  it('includes 30s retention', () => {
    expect(digestReport(row)).toContain('30s=45%');
  });

  it('includes the formatted date', () => {
    const output = digestReport(row);
    // The date string will vary by locale, just check it includes parens with a date
    expect(output).toMatch(/\(\d{1,2}\/\d{1,2}\/\d{4}\)/);
  });
});

// ── digestReport – account source_type ──────────────────────────────────────

describe('digestReport() – source_type="account"', () => {
  const row = baseRow({ source_type: 'account', analysis: growthAnalysis });

  it('starts with "Account Deep-Dive"', () => {
    expect(digestReport(row)).toMatch(/^Account Deep-Dive/);
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(row)).toContain('71/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(row)).toContain('mostly on topic');
  });

  it('includes posting blindspots', () => {
    const out = digestReport(row);
    expect(out).toContain('weekend mornings');
    expect(out).toContain('Q&A format');
  });

  it('handles empty posting_blindspots gracefully', () => {
    const noBlindspots: GrowthBlueprint = { ...growthAnalysis, posting_blindspots: [] };
    const out = digestReport(baseRow({ source_type: 'account', analysis: noBlindspots }));
    expect(out).toContain('none noted');
  });
});

// ── digestReport – upload source_type ───────────────────────────────────────

describe('digestReport() – source_type="upload"', () => {
  const row = baseRow({ source_type: 'upload', analysis: uploadAnalysis });

  it('starts with "Upload Diagnostic"', () => {
    expect(digestReport(row)).toMatch(/^Upload Diagnostic/);
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(row)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(row)).toContain('65/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(row)).toContain('88/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(row)).toContain('well balanced');
  });

  it('includes text-overlay pacing assessment', () => {
    expect(digestReport(row)).toContain('slightly too fast');
  });
});

// ── digestReport – discovery source_type ────────────────────────────────────

describe('digestReport() – source_type="discovery"', () => {
  const row = baseRow({ source_type: 'discovery', analysis: discoveryAnalysis });

  it('starts with "Site Discovery"', () => {
    expect(digestReport(row)).toMatch(/^Site Discovery/);
  });

  it('includes the query', () => {
    expect(digestReport(row)).toContain('viral TikTok hooks 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(row)).toContain('https://outlier.example.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(row)).toContain('unique angle not seen elsewhere');
  });
});

// ── digestReport – competitors (fallthrough) ─────────────────────────────────

describe('digestReport() – source_type="competitors" (default branch)', () => {
  const row = baseRow({ source_type: 'competitors', analysis: competitorAnalysis });

  it('starts with "Competitor Espionage"', () => {
    expect(digestReport(row)).toMatch(/^Competitor Espionage/);
  });

  it('includes missing topics', () => {
    const out = digestReport(row);
    expect(out).toContain('behind-the-scenes');
    expect(out).toContain('day-in-the-life');
  });

  it('includes untapped keyword clusters', () => {
    const out = digestReport(row);
    expect(out).toContain('viral hooks');
    expect(out).toContain('content batching');
  });

  it('handles empty missing_topics gracefully', () => {
    const noTopics: CompetitorGapAnalysis = { ...competitorAnalysis, missing_topics: [] };
    const out = digestReport(baseRow({ source_type: 'competitors', analysis: noTopics }));
    expect(out).toContain('none noted');
  });

  it('handles empty untapped_keyword_clusters gracefully', () => {
    const noClusters: CompetitorGapAnalysis = { ...competitorAnalysis, untapped_keyword_clusters: [] };
    const out = digestReport(baseRow({ source_type: 'competitors', analysis: noClusters }));
    // Second 'none noted' for clusters
    expect((digestReport(baseRow({ source_type: 'competitors', analysis: noClusters }))).match(/none noted/g)?.length).toBeGreaterThanOrEqual(1);
  });
});

// ── digestScript ─────────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const script: ScriptRow = {
    id: 'script-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'My Viral Video',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Stop scrolling right now',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'zoom to face',
          dialogue_or_vo: 'Stop scrolling right now',
          audio_sfx_cue: 'whoosh',
          retention_loop_note: 'open loop: will reveal secret at end',
        },
        {
          scene_number: 2,
          visual_action: 'cut to product',
          dialogue_or_vo: 'Here is the secret...',
          audio_sfx_cue: '',
          retention_loop_note: 'close loop',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-12T08:00:00.000Z',
  };

  it('starts with the script title', () => {
    expect(digestScript(script)).toContain('My Viral Video');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(script)).toContain('Stop scrolling right now');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(script)).toContain('open loop: will reveal secret at end');
  });

  it('includes the total scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('includes the date', () => {
    expect(digestScript(script)).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it('handles a script with no scenes (empty storyboard)', () => {
    const empty: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    const out = digestScript(empty);
    expect(out).toContain('(none)');
    expect(out).toContain('0 scenes total');
  });

  it('handles single-scene storyboard', () => {
    const single: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [script.storyboard.scenes[0]] },
    };
    expect(digestScript(single)).toContain('1 scenes total');
  });
});
