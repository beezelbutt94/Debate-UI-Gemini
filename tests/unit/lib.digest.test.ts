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

// Helper to build a minimal AuditReportRow for testing
function makeReport<T>(overrides: Partial<AuditReportRow<T>> & { analysis: T; source_type: AuditReportRow['source_type'] }): AuditReportRow<T> {
  return {
    id: 'test-id',
    user_id: 'user-1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: '2024-01-15T00:00:00.000Z',
    ...overrides,
  };
}

const urlAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
  hook_evaluation: { score: 82, verdict: 'strong', notes: 'Gripping opener' },
  retention_prediction: { at_3s_percent: 72, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Add captions', 'Speed up intro'],
  source_metrics: {},
};

const accountAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 78, notes: 'Mostly on-niche' },
  view_to_follower_ratio: { value: 0.15, assessment: 'above average' },
  posting_cadence: { avg_days_between_posts: 2.5, assessment: 'consistent' },
  theme_correction: ['Focus on finance'],
  view_maximization_tactics: ['Use trending sounds'],
  posting_blindspots: ['Tuesday mornings', 'Weekend evenings'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 70, verdict: 'moderate', notes: 'Could be clearer' },
  audio_balance: { score: 65, notes: 'Music too loud' },
  text_overlay_pacing: { assessment: 'captions lag behind speech' },
  b_roll_recommendations: ['Add product shot'],
  retention_boosters: ['Cut silence'],
  frames_analyzed: 120,
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'finance tips for millennials',
  sites: [],
  outlier: { url: 'https://example.com/viral-post', reasoning: 'Unexpectedly high engagement in niche' },
  summary: 'Found relevant finance content sites.',
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['Real estate investing'],
  missing_topics: ['Budgeting apps', 'Credit score hacks'],
  audience_sentiment_gaps: ['Desire for simplicity'],
  untapped_keyword_clusters: ['ETF basics', 'Roth IRA tips'],
};

describe('digestReport()', () => {
  describe('source_type: url', () => {
    it('includes hook verdict and score', () => {
      const report = makeReport({ source_type: 'url', analysis: urlAnalysis });
      const digest = digestReport(report);
      expect(digest).toContain('Viral Gap Analyzer');
      expect(digest).toContain('strong');
      expect(digest).toContain('82/100');
    });

    it('includes retention percentages', () => {
      const report = makeReport({ source_type: 'url', analysis: urlAnalysis });
      const digest = digestReport(report);
      expect(digest).toContain('3s=72%');
      expect(digest).toContain('30s=45%');
    });

    it('includes hook notes', () => {
      const report = makeReport({ source_type: 'url', analysis: urlAnalysis });
      const digest = digestReport(report);
      expect(digest).toContain('Gripping opener');
    });
  });

  describe('source_type: account', () => {
    it('includes thematic consistency score and notes', () => {
      const report = makeReport({ source_type: 'account', analysis: accountAnalysis });
      const digest = digestReport(report);
      expect(digest).toContain('Account Deep-Dive');
      expect(digest).toContain('78/100');
      expect(digest).toContain('Mostly on-niche');
    });

    it('includes posting blindspots', () => {
      const report = makeReport({ source_type: 'account', analysis: accountAnalysis });
      const digest = digestReport(report);
      expect(digest).toContain('Tuesday mornings');
      expect(digest).toContain('Weekend evenings');
    });

    it('says "none noted" when blindspots is empty', () => {
      const emptyBlindspots: GrowthBlueprint = { ...accountAnalysis, posting_blindspots: [] };
      const report = makeReport({ source_type: 'account', analysis: emptyBlindspots });
      const digest = digestReport(report);
      expect(digest).toContain('none noted');
    });
  });

  describe('source_type: upload', () => {
    it('includes visual hook verdict and score', () => {
      const report = makeReport({ source_type: 'upload', analysis: uploadAnalysis });
      const digest = digestReport(report);
      expect(digest).toContain('Upload Diagnostic');
      expect(digest).toContain('moderate');
      expect(digest).toContain('70/100');
    });

    it('includes audio balance score and notes', () => {
      const report = makeReport({ source_type: 'upload', analysis: uploadAnalysis });
      const digest = digestReport(report);
      expect(digest).toContain('65/100');
      expect(digest).toContain('Music too loud');
    });

    it('includes text overlay pacing assessment', () => {
      const report = makeReport({ source_type: 'upload', analysis: uploadAnalysis });
      const digest = digestReport(report);
      expect(digest).toContain('captions lag behind speech');
    });
  });

  describe('source_type: discovery', () => {
    it('includes query and outlier URL', () => {
      const report = makeReport({ source_type: 'discovery', analysis: discoveryAnalysis });
      const digest = digestReport(report);
      expect(digest).toContain('Site Discovery');
      expect(digest).toContain('finance tips for millennials');
      expect(digest).toContain('https://example.com/viral-post');
    });

    it('includes outlier reasoning', () => {
      const report = makeReport({ source_type: 'discovery', analysis: discoveryAnalysis });
      const digest = digestReport(report);
      expect(digest).toContain('Unexpectedly high engagement in niche');
    });
  });

  describe('source_type: competitors (fallback)', () => {
    it('includes missing topics', () => {
      const report = makeReport({ source_type: 'competitors', analysis: competitorAnalysis });
      const digest = digestReport(report);
      expect(digest).toContain('Competitor Espionage');
      expect(digest).toContain('Budgeting apps');
      expect(digest).toContain('Credit score hacks');
    });

    it('includes untapped keyword clusters', () => {
      const report = makeReport({ source_type: 'competitors', analysis: competitorAnalysis });
      const digest = digestReport(report);
      expect(digest).toContain('ETF basics');
      expect(digest).toContain('Roth IRA tips');
    });

    it('says "none noted" for empty missing_topics', () => {
      const empty: CompetitorGapAnalysis = { ...competitorAnalysis, missing_topics: [] };
      const report = makeReport({ source_type: 'competitors', analysis: empty });
      const digest = digestReport(report);
      expect(digest).toContain('none noted');
    });

    it('says "none noted" for empty untapped_keyword_clusters', () => {
      const empty: CompetitorGapAnalysis = { ...competitorAnalysis, untapped_keyword_clusters: [] };
      const report = makeReport({ source_type: 'competitors', analysis: empty });
      const digest = digestReport(report);
      expect(digest).toContain('none noted');
    });
  });

  it('includes a formatted date from created_at', () => {
    const report = makeReport({ source_type: 'url', analysis: urlAnalysis, created_at: '2024-03-21T12:00:00.000Z' });
    const digest = digestReport(report);
    // Date formatting varies by locale, but it should include year/month/day numbers
    expect(digest).toMatch(/202[0-9]/);
  });
});

describe('digestScript()', () => {
  const scriptRow: ScriptRow = {
    id: 'script-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'My Viral Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Stop scrolling right now',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up on face',
          dialogue_or_vo: 'Stop scrolling right now',
          audio_sfx_cue: 'none',
          retention_loop_note: 'Creates immediate curiosity',
        },
        {
          scene_number: 2,
          visual_action: 'B-roll product shot',
          dialogue_or_vo: 'Here is why...',
          audio_sfx_cue: 'swoosh',
          retention_loop_note: 'Teases payoff',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-05-10T00:00:00.000Z',
  };

  it('includes script title', () => {
    const digest = digestScript(scriptRow);
    expect(digest).toContain('My Viral Script');
  });

  it('includes spoken hook', () => {
    const digest = digestScript(scriptRow);
    expect(digest).toContain('Stop scrolling right now');
  });

  it('includes retention loop note of first scene', () => {
    const digest = digestScript(scriptRow);
    expect(digest).toContain('Creates immediate curiosity');
  });

  it('includes total scene count', () => {
    const digest = digestScript(scriptRow);
    expect(digest).toContain('2 scenes total');
  });

  it('uses empty string when retention_loop_note is "" (nullish coalescing, not falsy)', () => {
    const noNote: ScriptRow = {
      ...scriptRow,
      storyboard: {
        ...scriptRow.storyboard,
        scenes: [{ ...scriptRow.storyboard.scenes[0], retention_loop_note: '' }],
      },
    };
    const digest = digestScript(noNote);
    // ?? only triggers on null/undefined — empty string passes through as-is
    expect(digest).toContain('""');
  });

  it('handles empty scenes array gracefully', () => {
    const noScenes: ScriptRow = {
      ...scriptRow,
      storyboard: { ...scriptRow.storyboard, scenes: [] },
    };
    const digest = digestScript(noScenes);
    expect(digest).toContain('(none)');
    expect(digest).toContain('0 scenes total');
  });

  it('includes a formatted date', () => {
    const digest = digestScript(scriptRow);
    expect(digest).toMatch(/202[0-9]/);
  });
});
