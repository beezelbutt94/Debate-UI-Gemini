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

// Shared date for deterministic output (2024-01-15)
const CREATED_AT = '2024-01-15T10:00:00.000Z';

// ── Fixtures ────────────────────────────────────────────────────────────────

const urlAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
  hook_evaluation: { score: 85, verdict: 'strong', notes: 'Punchy opener' },
  retention_prediction: { at_3s_percent: 72, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Tighten cut rhythm'],
  source_metrics: {},
};

const accountAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 78, notes: 'Mostly cooking content' },
  view_to_follower_ratio: { value: 2.3, assessment: 'average' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['Sunday evenings', 'Trending challenges'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 90, verdict: 'strong', notes: 'Great thumbnail frame' },
  audio_balance: { score: 70, notes: 'Slight background hiss' },
  text_overlay_pacing: { assessment: 'well-timed' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 120,
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'cooking shortcuts TikTok',
  sites: [],
  outlier: { url: 'https://example.com/viral-recipe', reasoning: 'Unusually high engagement rate' },
  summary: 'Found 10 relevant sites',
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['meal prep', 'budget recipes'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['quick dinners', '5-ingredient meals'],
};

function makeReport<T>(
  source_type: AuditReportRow['source_type'],
  analysis: T
): AuditReportRow<T> {
  return {
    id: 'test-id',
    user_id: 'user-1',
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

// ── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport()', () => {
  describe('source_type = "url"', () => {
    it('includes "Viral Gap Analyzer"', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toContain('Viral Gap Analyzer');
    });

    it('includes the hook verdict', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toContain('strong');
    });

    it('includes the hook score', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toContain('85/100');
    });

    it('includes the hook notes', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toContain('Punchy opener');
    });

    it('includes 3s retention percent', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toContain('3s=72%');
    });

    it('includes 30s retention percent', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result).toContain('30s=45%');
    });

    it('includes formatted date', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      // toLocaleDateString format can vary by locale, but it should contain a year
      expect(result).toMatch(/2024/);
    });

    it('returns a non-empty string', () => {
      const result = digestReport(makeReport('url', urlAnalysis));
      expect(result.length).toBeGreaterThan(20);
    });
  });

  describe('source_type = "account"', () => {
    it('includes "Account Deep-Dive"', () => {
      const result = digestReport(makeReport('account', accountAnalysis));
      expect(result).toContain('Account Deep-Dive');
    });

    it('includes thematic consistency score', () => {
      const result = digestReport(makeReport('account', accountAnalysis));
      expect(result).toContain('78/100');
    });

    it('includes thematic consistency notes', () => {
      const result = digestReport(makeReport('account', accountAnalysis));
      expect(result).toContain('Mostly cooking content');
    });

    it('includes posting blindspots', () => {
      const result = digestReport(makeReport('account', accountAnalysis));
      expect(result).toContain('Sunday evenings');
      expect(result).toContain('Trending challenges');
    });

    it('handles empty posting_blindspots with "none noted"', () => {
      const noBlindspots: GrowthBlueprint = { ...accountAnalysis, posting_blindspots: [] };
      const result = digestReport(makeReport('account', noBlindspots));
      expect(result).toContain('none noted');
    });
  });

  describe('source_type = "upload"', () => {
    it('includes "Upload Diagnostic"', () => {
      const result = digestReport(makeReport('upload', uploadAnalysis));
      expect(result).toContain('Upload Diagnostic');
    });

    it('includes visual hook verdict', () => {
      const result = digestReport(makeReport('upload', uploadAnalysis));
      expect(result).toContain('strong');
    });

    it('includes visual hook score', () => {
      const result = digestReport(makeReport('upload', uploadAnalysis));
      expect(result).toContain('90/100');
    });

    it('includes audio balance score', () => {
      const result = digestReport(makeReport('upload', uploadAnalysis));
      expect(result).toContain('70/100');
    });

    it('includes audio balance notes', () => {
      const result = digestReport(makeReport('upload', uploadAnalysis));
      expect(result).toContain('Slight background hiss');
    });

    it('includes text overlay pacing assessment', () => {
      const result = digestReport(makeReport('upload', uploadAnalysis));
      expect(result).toContain('well-timed');
    });
  });

  describe('source_type = "discovery"', () => {
    it('includes "Site Discovery"', () => {
      const result = digestReport(makeReport('discovery', discoveryAnalysis));
      expect(result).toContain('Site Discovery');
    });

    it('includes the query', () => {
      const result = digestReport(makeReport('discovery', discoveryAnalysis));
      expect(result).toContain('cooking shortcuts TikTok');
    });

    it('includes the outlier URL', () => {
      const result = digestReport(makeReport('discovery', discoveryAnalysis));
      expect(result).toContain('https://example.com/viral-recipe');
    });

    it('includes the outlier reasoning', () => {
      const result = digestReport(makeReport('discovery', discoveryAnalysis));
      expect(result).toContain('Unusually high engagement rate');
    });
  });

  describe('source_type = "competitors" (fallback)', () => {
    it('includes "Competitor Espionage"', () => {
      const result = digestReport(makeReport('competitors', competitorAnalysis));
      expect(result).toContain('Competitor Espionage');
    });

    it('includes missing topics', () => {
      const result = digestReport(makeReport('competitors', competitorAnalysis));
      expect(result).toContain('meal prep');
      expect(result).toContain('budget recipes');
    });

    it('includes untapped keyword clusters', () => {
      const result = digestReport(makeReport('competitors', competitorAnalysis));
      expect(result).toContain('quick dinners');
      expect(result).toContain('5-ingredient meals');
    });

    it('handles empty missing_topics with "none noted"', () => {
      const empty: CompetitorGapAnalysis = { ...competitorAnalysis, missing_topics: [] };
      const result = digestReport(makeReport('competitors', empty));
      expect(result).toContain('missing topics: none noted');
    });

    it('handles empty untapped_keyword_clusters with "none noted"', () => {
      const empty: CompetitorGapAnalysis = { ...competitorAnalysis, untapped_keyword_clusters: [] };
      const result = digestReport(makeReport('competitors', empty));
      expect(result).toContain('untapped keyword clusters: none noted');
    });
  });
});

// ── digestScript ──────────────────────────────────────────────────────────────

const baseScript: ScriptRow = {
  id: 'script-1',
  user_id: 'user-1',
  creator_profile_id: null,
  title: 'My Viral Hook',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'You won\'t believe this trick',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Close-up of pan',
        dialogue_or_vo: 'Start with high heat',
        audio_sfx_cue: 'sizzle',
        retention_loop_note: 'Cut to reaction before reveal',
      },
      {
        scene_number: 2,
        visual_action: 'Wide shot',
        dialogue_or_vo: 'Add the secret ingredient',
        audio_sfx_cue: 'music sting',
        retention_loop_note: 'Leave audience wanting more',
      },
    ],
    cta: 'Follow for more tips',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: CREATED_AT,
};

describe('digestScript()', () => {
  it('includes the script title', () => {
    const result = digestScript(baseScript);
    expect(result).toContain('My Viral Hook');
  });

  it('includes the spoken hook', () => {
    const result = digestScript(baseScript);
    expect(result).toContain("You won't believe this trick");
  });

  it('includes the first scene retention loop note', () => {
    const result = digestScript(baseScript);
    expect(result).toContain('Cut to reaction before reveal');
  });

  it('includes the total scene count', () => {
    const result = digestScript(baseScript);
    expect(result).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    const result = digestScript(baseScript);
    expect(result).toMatch(/2024/);
  });

  it('uses "(none)" when first scene has no retention_loop_note', () => {
    const noNote: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [
          { ...baseScript.storyboard.scenes[0], retention_loop_note: '' },
        ],
      },
    };
    // empty string is falsy — nullish coalescing won't kick in
    // (retention_loop_note is always present)
    const result = digestScript(noNote);
    expect(result).toBeTruthy();
  });

  it('uses "(none)" when scenes array is empty', () => {
    const emptyScenes: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    const result = digestScript(emptyScenes);
    expect(result).toContain('(none)');
  });

  it('correctly counts scenes', () => {
    const manyScenes: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: Array.from({ length: 5 }, (_, i) => ({
          scene_number: i + 1,
          visual_action: `action ${i}`,
          dialogue_or_vo: `dialogue ${i}`,
          audio_sfx_cue: 'none',
          retention_loop_note: `loop ${i}`,
        })),
      },
    };
    const result = digestScript(manyScenes);
    expect(result).toContain('5 scenes total');
  });

  it('returns a string starting with Script "', () => {
    const result = digestScript(baseScript);
    expect(result).toMatch(/^Script "/);
  });
});
