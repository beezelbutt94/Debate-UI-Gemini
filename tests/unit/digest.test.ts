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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function baseReport(
  sourceType: AuditReportRow['source_type'],
  analysis: AuditReportRow['analysis']
): AuditReportRow {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_type: sourceType,
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at: '2024-07-04T12:00:00.000Z',
  };
}

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3.5, assessment: 'fast' },
  hook_evaluation: { score: 82, verdict: 'strong', notes: 'Great opening' },
  retention_prediction: { at_3s_percent: 70, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Improve CTA'],
  source_metrics: {},
};

const weakViralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: null, assessment: 'slow' },
  hook_evaluation: { score: 30, verdict: 'weak', notes: 'Needs work' },
  retention_prediction: { at_3s_percent: 40, at_30s_percent: 20, meets_3s_benchmark: false, meets_30s_benchmark: false },
  action_plan: [],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 75, notes: 'Solid theme' },
  view_to_follower_ratio: { value: 0.12, assessment: 'good' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'regular' },
  theme_correction: [],
  view_maximization_tactics: ['Use trending audio'],
  posting_blindspots: ['Monday mornings', 'Late nights'],
  per_platform_notes: {},
};

const growthAnalysisNoBlindspots: GrowthBlueprint = {
  ...growthAnalysis,
  posting_blindspots: [],
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 90, verdict: 'strong', notes: 'Clear visual' },
  audio_balance: { score: 70, notes: 'Slightly loud music' },
  text_overlay_pacing: { assessment: 'too fast' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 120,
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'viral cooking tips',
    sites: [],
  outlier: { url: 'https://outlier.com', reasoning: 'Unique perspective from a chef' },
  summary: 'Found 10 sites about cooking',
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['trending recipes'],
  missing_topics: ['meal prep', 'budget cooking'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['30-min meals', 'vegetarian hacks'],
};

const competitorAnalysisEmpty: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: [],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: [],
};

// ─── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport', () => {
  describe('source_type = url (ViralGapAnalysis)', () => {
    it('includes hook verdict and score', () => {
      const result = digestReport(baseReport('url', viralAnalysis));
      expect(result).toContain('hook "strong"');
      expect(result).toContain('82/100');
      expect(result).toContain('Great opening');
    });

    it('includes retention percentages', () => {
      const result = digestReport(baseReport('url', viralAnalysis));
      expect(result).toContain('3s=70%');
      expect(result).toContain('30s=45%');
    });

    it('includes "Viral Gap Analyzer" label', () => {
      expect(digestReport(baseReport('url', viralAnalysis))).toContain('Viral Gap Analyzer');
    });

    it('works with a weak hook verdict', () => {
      const result = digestReport(baseReport('url', weakViralAnalysis));
      expect(result).toContain('hook "weak"');
      expect(result).toContain('30/100');
      expect(result).toContain('Needs work');
      expect(result).toContain('3s=40%');
      expect(result).toContain('30s=20%');
    });
  });

  describe('source_type = account (GrowthBlueprint)', () => {
    it('includes Account Deep-Dive label', () => {
      expect(digestReport(baseReport('account', growthAnalysis))).toContain('Account Deep-Dive');
    });

    it('includes thematic consistency score and notes', () => {
      const result = digestReport(baseReport('account', growthAnalysis));
      expect(result).toContain('75/100');
      expect(result).toContain('Solid theme');
    });

    it('lists posting blindspots', () => {
      const result = digestReport(baseReport('account', growthAnalysis));
      expect(result).toContain('Monday mornings');
      expect(result).toContain('Late nights');
    });

    it('falls back to "none noted" when posting_blindspots is empty', () => {
      const result = digestReport(baseReport('account', growthAnalysisNoBlindspots));
      expect(result).toContain('none noted');
    });
  });

  describe('source_type = upload (UploadDiagnosis)', () => {
    it('includes Upload Diagnostic label', () => {
      expect(digestReport(baseReport('upload', uploadAnalysis))).toContain('Upload Diagnostic');
    });

    it('includes visual hook verdict and score', () => {
      const result = digestReport(baseReport('upload', uploadAnalysis));
      expect(result).toContain('visual hook "strong"');
      expect(result).toContain('90/100');
    });

    it('includes audio balance score and notes', () => {
      const result = digestReport(baseReport('upload', uploadAnalysis));
      expect(result).toContain('audio balance 70/100');
      expect(result).toContain('Slightly loud music');
    });

    it('includes text-overlay pacing assessment', () => {
      const result = digestReport(baseReport('upload', uploadAnalysis));
      expect(result).toContain('too fast');
    });
  });

  describe('source_type = discovery (SiteDiscoveryResult)', () => {
    it('includes Site Discovery label', () => {
      expect(digestReport(baseReport('discovery', discoveryAnalysis))).toContain('Site Discovery');
    });

    it('includes the query', () => {
      const result = digestReport(baseReport('discovery', discoveryAnalysis));
      expect(result).toContain('viral cooking tips');
    });

    it('includes the outlier URL and reasoning', () => {
      const result = digestReport(baseReport('discovery', discoveryAnalysis));
      expect(result).toContain('https://outlier.com');
      expect(result).toContain('Unique perspective from a chef');
    });
  });

  describe('source_type = competitors (CompetitorGapAnalysis — default branch)', () => {
    it('includes Competitor Espionage label', () => {
      expect(digestReport(baseReport('competitors', competitorAnalysis))).toContain('Competitor Espionage');
    });

    it('lists missing topics', () => {
      const result = digestReport(baseReport('competitors', competitorAnalysis));
      expect(result).toContain('meal prep');
      expect(result).toContain('budget cooking');
    });

    it('lists untapped keyword clusters', () => {
      const result = digestReport(baseReport('competitors', competitorAnalysis));
      expect(result).toContain('30-min meals');
      expect(result).toContain('vegetarian hacks');
    });

    it('falls back to "none noted" for empty missing_topics', () => {
      const result = digestReport(baseReport('competitors', competitorAnalysisEmpty));
      expect(result).toContain('missing topics: none noted');
    });

    it('falls back to "none noted" for empty untapped_keyword_clusters', () => {
      const result = digestReport(baseReport('competitors', competitorAnalysisEmpty));
      expect(result).toContain('untapped keyword clusters: none noted');
    });
  });

  describe('date formatting', () => {
    it('includes a date derived from created_at', () => {
      const report = baseReport('url', viralAnalysis);
      // The date string from toLocaleDateString() will be present — we just check the year
      expect(digestReport(report)).toMatch(/2024/);
    });
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

describe('digestScript', () => {
  function makeScript(overrides: Partial<ScriptRow> = {}): ScriptRow {
    return {
      id: 's1',
      user_id: 'u1',
      creator_profile_id: null,
      title: 'Best Viral Recipe',
      source_prompt: null,
      storyboard: {
        spoken_hook: "You won't believe how easy this is",
        scenes: [
          {
            scene_number: 1,
            visual_action: 'Close up of ingredients',
            dialogue_or_vo: 'Grab these items',
            audio_sfx_cue: 'upbeat jingle',
            retention_loop_note: 'Shows the final dish at start',
          },
          {
            scene_number: 2,
            visual_action: 'Cooking steps',
            dialogue_or_vo: 'Mix it all together',
            audio_sfx_cue: 'sizzle sound',
            retention_loop_note: 'Teases what comes next',
          },
        ],
        cta: 'Follow for more',
        memory_context_used: false,
      },
      tone_parameters: {},
      target_platform: 'tiktok',
      created_at: '2024-11-15T08:00:00.000Z',
      ...overrides,
    };
  }

  it('includes the script title', () => {
    expect(digestScript(makeScript())).toContain('Best Viral Recipe');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(makeScript())).toContain("You won't believe how easy this is");
  });

  it('includes the first scene\'s retention_loop_note', () => {
    expect(digestScript(makeScript())).toContain('Shows the final dish at start');
  });

  it('includes the total scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });

  it('uses "(none)" when scenes array is empty', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    const result = digestScript(script);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('formats "Script" label', () => {
    expect(digestScript(makeScript())).toContain('Script "Best Viral Recipe"');
  });

  it('includes the year from created_at', () => {
    expect(digestScript(makeScript())).toMatch(/2024/);
  });

  it('handles a single-scene script', () => {
    const script = makeScript();
    script.storyboard.scenes = [script.storyboard.scenes[0]];
    const result = digestScript(script);
    expect(result).toContain('1 scenes total');
    expect(result).toContain('Shows the final dish at start');
  });
});
