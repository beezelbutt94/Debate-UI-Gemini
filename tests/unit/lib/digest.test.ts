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

// Fixed date for deterministic output
const FIXED_DATE = '2024-05-15T10:00:00.000Z';

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
    created_at: FIXED_DATE,
  };
}

const urlAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 4, assessment: 'Fast pacing' },
  hook_evaluation: { score: 85, verdict: 'strong', notes: 'Compelling opener' },
  retention_prediction: { at_3s_percent: 72, at_30s_percent: 48, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Add captions'],
  source_metrics: {},
};

const accountAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 70, notes: 'Mostly on-brand' },
  view_to_follower_ratio: { value: 1.2, assessment: 'Good' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'Regular' },
  theme_correction: ['Be more focused'],
  view_maximization_tactics: ['Post at peak hours'],
  posting_blindspots: ['Tuesday evenings', 'Sunday mornings'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'Okay' },
  audio_balance: { score: 75, notes: 'Music too loud' },
  text_overlay_pacing: { assessment: 'Too fast' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 120,
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'short form video tools',
  sites: [
    { url: 'https://example.com', domain: 'example.com', title: 'Example', snippet: 'snippet', relevance_reason: 'reason' },
  ],
  outlier: { url: 'https://example.com', reasoning: 'unique approach' },
  summary: 'Found 10 sites.',
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['Viral hooks'],
  missing_topics: ['Behind the scenes', 'Q&A formats'],
  audience_sentiment_gaps: ['Negative comments on thumbnails'],
  untapped_keyword_clusters: ['morning routine', 'productivity tips'],
};

describe('digestReport', () => {
  describe('url source_type', () => {
    it('includes "Viral Gap Analyzer" label', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toContain('Viral Gap Analyzer');
    });

    it('includes hook verdict', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toContain('strong');
    });

    it('includes hook score', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toContain('85/100');
    });

    it('includes hook notes', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toContain('Compelling opener');
    });

    it('includes 3s retention', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toContain('3s=72%');
    });

    it('includes 30s retention', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toContain('30s=48%');
    });

    it('includes formatted date', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      // Date formatting is locale-dependent, but check it has a date-like string
      expect(result).toMatch(/\d+\/\d+\/\d+|\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('account source_type', () => {
    it('includes "Account Deep-Dive" label', () => {
      const result = digestReport(makeReport('account', accountAnalysis));
      expect(result).toContain('Account Deep-Dive');
    });

    it('includes thematic_consistency score', () => {
      const result = digestReport(makeReport('account', accountAnalysis));
      expect(result).toContain('70/100');
    });

    it('includes thematic_consistency notes', () => {
      const result = digestReport(makeReport('account', accountAnalysis));
      expect(result).toContain('Mostly on-brand');
    });

    it('includes posting blindspots', () => {
      const result = digestReport(makeReport('account', accountAnalysis));
      expect(result).toContain('Tuesday evenings');
      expect(result).toContain('Sunday mornings');
    });

    it('shows "none noted" when no blindspots', () => {
      const noBlindspots: GrowthBlueprint = { ...accountAnalysis, posting_blindspots: [] };
      const result = digestReport(makeReport('account', noBlindspots));
      expect(result).toContain('none noted');
    });
  });

  describe('upload source_type', () => {
    it('includes "Upload Diagnostic" label', () => {
      const result = digestReport(makeReport('upload', uploadAnalysis));
      expect(result).toContain('Upload Diagnostic');
    });

    it('includes visual hook verdict', () => {
      const result = digestReport(makeReport('upload', uploadAnalysis));
      expect(result).toContain('moderate');
    });

    it('includes visual hook score', () => {
      const result = digestReport(makeReport('upload', uploadAnalysis));
      expect(result).toContain('60/100');
    });

    it('includes audio balance score', () => {
      const result = digestReport(makeReport('upload', uploadAnalysis));
      expect(result).toContain('75/100');
    });

    it('includes audio balance notes', () => {
      const result = digestReport(makeReport('upload', uploadAnalysis));
      expect(result).toContain('Music too loud');
    });

    it('includes text overlay pacing assessment', () => {
      const result = digestReport(makeReport('upload', uploadAnalysis));
      expect(result).toContain('Too fast');
    });
  });

  describe('discovery source_type', () => {
    it('includes "Site Discovery" label', () => {
      const result = digestReport(makeReport('discovery', discoveryAnalysis));
      expect(result).toContain('Site Discovery');
    });

    it('includes the query', () => {
      const result = digestReport(makeReport('discovery', discoveryAnalysis));
      expect(result).toContain('short form video tools');
    });

    it('includes the outlier URL', () => {
      const result = digestReport(makeReport('discovery', discoveryAnalysis));
      expect(result).toContain('https://example.com');
    });

    it('includes the outlier reasoning', () => {
      const result = digestReport(makeReport('discovery', discoveryAnalysis));
      expect(result).toContain('unique approach');
    });
  });

  describe('competitors source_type (default branch)', () => {
    it('includes "Competitor Espionage" label', () => {
      const result = digestReport(makeReport('competitors', competitorAnalysis));
      expect(result).toContain('Competitor Espionage');
    });

    it('includes missing topics', () => {
      const result = digestReport(makeReport('competitors', competitorAnalysis));
      expect(result).toContain('Behind the scenes');
      expect(result).toContain('Q&A formats');
    });

    it('includes untapped keyword clusters', () => {
      const result = digestReport(makeReport('competitors', competitorAnalysis));
      expect(result).toContain('morning routine');
      expect(result).toContain('productivity tips');
    });

    it('shows "none noted" when missing_topics is empty', () => {
      const noTopics: CompetitorGapAnalysis = { ...competitorAnalysis, missing_topics: [] };
      const result = digestReport(makeReport('competitors', noTopics));
      expect(result).toContain('none noted');
    });

    it('shows "none noted" when untapped_keyword_clusters is empty', () => {
      const noClusters: CompetitorGapAnalysis = { ...competitorAnalysis, untapped_keyword_clusters: [] };
      const result = digestReport(makeReport('competitors', noClusters));
      expect(result).toContain('none noted');
    });
  });

  describe('return type', () => {
    it('always returns a string', () => {
      expect(typeof digestReport(makeReport('url', urlAnalysis))).toBe('string');
      expect(typeof digestReport(makeReport('account', accountAnalysis))).toBe('string');
      expect(typeof digestReport(makeReport('upload', uploadAnalysis))).toBe('string');
      expect(typeof digestReport(makeReport('discovery', discoveryAnalysis))).toBe('string');
      expect(typeof digestReport(makeReport('competitors', competitorAnalysis))).toBe('string');
    });

    it('returns a non-empty string for all source types', () => {
      for (const [st, an] of [
        ['url', urlAnalysis],
        ['account', accountAnalysis],
        ['upload', uploadAnalysis],
        ['discovery', discoveryAnalysis],
        ['competitors', competitorAnalysis],
      ] as const) {
        const result = digestReport(makeReport(st, an));
        expect(result.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('digestScript', () => {
  const baseScript: ScriptRow = {
    id: 'script-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'My Hook Video',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know you can double views?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up on face',
          dialogue_or_vo: 'Opening line',
          audio_sfx_cue: 'upbeat music',
          retention_loop_note: 'Cut to surprising stat',
        },
        {
          scene_number: 2,
          visual_action: 'B-roll montage',
          dialogue_or_vo: 'Explanation',
          audio_sfx_cue: 'ambient',
          retention_loop_note: 'Tease upcoming tip',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: FIXED_DATE,
  };

  it('includes the script title', () => {
    expect(digestScript(baseScript)).toContain('My Hook Video');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(baseScript)).toContain('Did you know you can double views?');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(baseScript)).toContain('Cut to surprising stat');
  });

  it('includes scene count', () => {
    expect(digestScript(baseScript)).toContain('2 scenes total');
  });

  it('returns a string', () => {
    expect(typeof digestScript(baseScript)).toBe('string');
  });

  it('shows (none) when scenes array is empty (weakScene is undefined)', () => {
    // ?? only triggers on null/undefined, not empty string
    // When scenes is empty, weakScene is undefined, so retention_loop_note ?? '(none)' = '(none)'
    const noScenes2: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes2)).toContain('(none)');
  });

  it('shows (none) when scenes array is empty', () => {
    const noScenes: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('(none)');
  });

  it('reports 0 scenes total when scenes array is empty', () => {
    const noScenes: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('0 scenes total');
  });

  it('includes a formatted date', () => {
    const result = digestScript(baseScript);
    expect(result).toMatch(/\d+\/\d+\/\d+|\d{4}-\d{2}-\d{2}/);
  });
});
