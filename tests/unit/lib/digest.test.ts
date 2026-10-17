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

const BASE_DATE = '2024-03-15T10:00:00.000Z';

function makeReport<T>(source_type: AuditReportRow['source_type'], analysis: T): AuditReportRow {
  return {
    id: 'test-id',
    user_id: 'user-1',
    creator_profile_id: null,
    source_type,
    source_url: null,
    platform: null,
    viral_score: null,
    analysis: analysis as AuditReportRow['analysis'],
    timeline_recommendations: [],
    created_at: BASE_DATE,
  };
}

// Minimal valid ViralGapAnalysis
const urlAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'good' },
  hook_evaluation: { score: 82, verdict: 'strong', notes: 'Great hook' },
  retention_prediction: {
    at_3s_percent: 75,
    at_30s_percent: 45,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Improve CTA'],
  source_metrics: {},
};

const accountAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 70, notes: 'Mostly consistent' },
  view_to_follower_ratio: { value: 2.5, assessment: 'good' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'regular' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['Weekends', 'Late night'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 65, verdict: 'moderate', notes: 'Decent hook' },
  audio_balance: { score: 78, notes: 'Clear audio' },
  text_overlay_pacing: { assessment: 'Good pacing' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 120,
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'viral content strategy',
  sites: [
    {
      url: 'https://example.com/article',
      domain: 'example.com',
      title: 'Example Article',
      snippet: 'A great article',
      relevance_reason: 'Top result',
    },
  ],
  outlier: {
    url: 'https://example.com/article',
    reasoning: 'Unique angle compared to others',
  },
  summary: 'Good selection of sites',
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['Travel hacks', 'Budget tips'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['cheap travel', 'budget destinations'],
};

describe('digestReport()', () => {
  describe('source_type = url', () => {
    it('includes hook verdict and score', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toContain('strong');
      expect(result).toContain('82/100');
    });

    it('includes 3s and 30s retention percentages', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toContain('3s=75%');
      expect(result).toContain('30s=45%');
    });

    it('includes Viral Gap Analyzer label', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toContain('Viral Gap Analyzer');
    });

    it('includes formatted date', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toMatch(/\d+\/\d+\/\d+/);
    });

    it('includes hook notes', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toContain('Great hook');
    });
  });

  describe('source_type = account', () => {
    it('includes thematic consistency score', () => {
      const result = digestReport(makeReport('account', accountAnalysis));
      expect(result).toContain('70/100');
    });

    it('includes Account Deep-Dive label', () => {
      const result = digestReport(makeReport('account', accountAnalysis));
      expect(result).toContain('Account Deep-Dive');
    });

    it('lists posting blindspots', () => {
      const result = digestReport(makeReport('account', accountAnalysis));
      expect(result).toContain('Weekends');
      expect(result).toContain('Late night');
    });

    it('shows "none noted" when posting_blindspots is empty', () => {
      const noBlindspots: GrowthBlueprint = { ...accountAnalysis, posting_blindspots: [] };
      const result = digestReport(makeReport('account', noBlindspots));
      expect(result).toContain('none noted');
    });
  });

  describe('source_type = upload', () => {
    it('includes visual hook verdict and score', () => {
      const result = digestReport(makeReport('upload', uploadAnalysis));
      expect(result).toContain('moderate');
      expect(result).toContain('65/100');
    });

    it('includes audio balance score', () => {
      const result = digestReport(makeReport('upload', uploadAnalysis));
      expect(result).toContain('78/100');
    });

    it('includes text overlay assessment', () => {
      const result = digestReport(makeReport('upload', uploadAnalysis));
      expect(result).toContain('Good pacing');
    });

    it('includes Upload Diagnostic label', () => {
      const result = digestReport(makeReport('upload', uploadAnalysis));
      expect(result).toContain('Upload Diagnostic');
    });
  });

  describe('source_type = discovery', () => {
    it('includes the search query', () => {
      const result = digestReport(makeReport('discovery', discoveryAnalysis));
      expect(result).toContain('viral content strategy');
    });

    it('includes the outlier URL', () => {
      const result = digestReport(makeReport('discovery', discoveryAnalysis));
      expect(result).toContain('https://example.com/article');
    });

    it('includes outlier reasoning', () => {
      const result = digestReport(makeReport('discovery', discoveryAnalysis));
      expect(result).toContain('Unique angle compared to others');
    });

    it('includes Site Discovery label', () => {
      const result = digestReport(makeReport('discovery', discoveryAnalysis));
      expect(result).toContain('Site Discovery');
    });
  });

  describe('source_type = competitors (default branch)', () => {
    it('lists missing topics', () => {
      const result = digestReport(makeReport('competitors', competitorAnalysis));
      expect(result).toContain('Travel hacks');
      expect(result).toContain('Budget tips');
    });

    it('lists untapped keyword clusters', () => {
      const result = digestReport(makeReport('competitors', competitorAnalysis));
      expect(result).toContain('cheap travel');
      expect(result).toContain('budget destinations');
    });

    it('includes Competitor Espionage label', () => {
      const result = digestReport(makeReport('competitors', competitorAnalysis));
      expect(result).toContain('Competitor Espionage');
    });

    it('shows "none noted" when missing_topics is empty', () => {
      const empty: CompetitorGapAnalysis = { ...competitorAnalysis, missing_topics: [] };
      const result = digestReport(makeReport('competitors', empty));
      expect(result).toContain('none noted');
    });

    it('shows "none noted" when untapped_keyword_clusters is empty', () => {
      const empty: CompetitorGapAnalysis = { ...competitorAnalysis, untapped_keyword_clusters: [] };
      const result = digestReport(makeReport('competitors', empty));
      // First "none noted" is for missing_topics (not empty here), second for clusters
      expect(result).toContain('none noted');
    });
  });

  it('returns a non-empty string for all source types', () => {
    const types: Array<{ type: AuditReportRow['source_type']; analysis: unknown }> = [
      { type: 'url', analysis: urlAnalysis },
      { type: 'account', analysis: accountAnalysis },
      { type: 'upload', analysis: uploadAnalysis },
      { type: 'discovery', analysis: discoveryAnalysis },
      { type: 'competitors', analysis: competitorAnalysis },
    ];
    for (const { type, analysis } of types) {
      expect(digestReport(makeReport(type, analysis)).length).toBeGreaterThan(0);
    }
  });
});

describe('digestScript()', () => {
  const baseScript: ScriptRow = {
    id: 'script-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'My Viral Hook',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Stop scrolling right now!',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Creator on camera',
          dialogue_or_vo: 'Stop scrolling right now!',
          audio_sfx_cue: 'upbeat music',
          retention_loop_note: 'Cut to shocking stat',
        },
        {
          scene_number: 2,
          visual_action: 'B-roll footage',
          dialogue_or_vo: 'Did you know...',
          audio_sfx_cue: 'none',
          retention_loop_note: 'Cliffhanger',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: BASE_DATE,
  };

  it('includes the script title', () => {
    const result = digestScript(baseScript);
    expect(result).toContain('My Viral Hook');
  });

  it('includes the spoken hook', () => {
    const result = digestScript(baseScript);
    expect(result).toContain('Stop scrolling right now!');
  });

  it('includes the first scene retention loop note', () => {
    const result = digestScript(baseScript);
    expect(result).toContain('Cut to shocking stat');
  });

  it('includes total scene count', () => {
    const result = digestScript(baseScript);
    expect(result).toContain('2 scenes total');
  });

  it('includes formatted date', () => {
    const result = digestScript(baseScript);
    expect(result).toMatch(/\d+\/\d+\/\d+/);
  });

  it('shows (none) for retention_loop_note when scenes array is empty', () => {
    const noScenes: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    const result = digestScript(noScenes);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('shows first scene retention loop note, not second', () => {
    const result = digestScript(baseScript);
    expect(result).toContain('Cut to shocking stat');
    expect(result).not.toContain('Cliffhanger');
  });

  it('returns a non-empty string', () => {
    expect(digestScript(baseScript).length).toBeGreaterThan(0);
  });
});
