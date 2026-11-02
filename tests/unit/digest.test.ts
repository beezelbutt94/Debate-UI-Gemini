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

// ---------------------------------------------------------------------------
// Shared factory helpers
// ---------------------------------------------------------------------------
const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: 'https://example.com',
  platform: 'tiktok',
  viral_score: 72,
  timeline_recommendations: [],
  created_at: '2024-09-12T10:00:00.000Z',
};

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
  hook_evaluation: { score: 85, verdict: 'strong', notes: 'Immediate visual' },
  retention_prediction: { at_3s_percent: 70, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Add B-roll'],
  source_metrics: {},
};

const growthBlueprint: GrowthBlueprint = {
  thematic_consistency: { score: 60, notes: 'Mixed niches' },
  view_to_follower_ratio: { value: 1.5, assessment: 'good' },
  posting_cadence: { avg_days_between_posts: 2, assessment: 'consistent' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['Weekday mornings', 'Tech niche'],
  per_platform_notes: {},
};

const uploadDiagnosis: UploadDiagnosis = {
  visual_hook_clarity: { score: 70, verdict: 'moderate', notes: 'Hook ok' },
  audio_balance: { score: 80, notes: 'Balanced mix' },
  text_overlay_pacing: { assessment: 'Fast enough' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 120,
};

const competitorGap: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['Cooking tips', 'Budget travel'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['vlog money', 'side hustle'],
};

const discoveryResult: SiteDiscoveryResult = {
  query: 'creator tools 2024',
  sites: [],
  outlier: { url: 'https://example.com/top', reasoning: 'Most backlinks in set' },
  summary: 'Found 10 sites',
};

// ---------------------------------------------------------------------------
// digestReport
// ---------------------------------------------------------------------------
describe('digestReport()', () => {
  describe('source_type=url (ViralGapAnalysis)', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: viralAnalysis };

    it('starts with "Viral Gap Analyzer"', () => {
      expect(digestReport(report)).toMatch(/^Viral Gap Analyzer/);
    });

    it('includes the hook verdict', () => {
      expect(digestReport(report)).toContain('strong');
    });

    it('includes the hook score', () => {
      expect(digestReport(report)).toContain('85/100');
    });

    it('includes retention at_3s_percent', () => {
      expect(digestReport(report)).toContain('3s=70%');
    });

    it('includes retention at_30s_percent', () => {
      expect(digestReport(report)).toContain('30s=45%');
    });

    it('includes hook notes', () => {
      expect(digestReport(report)).toContain('Immediate visual');
    });

    it('includes a formatted date string', () => {
      // Date is locale-dependent — just check some digits appear
      const result = digestReport(report);
      expect(result).toMatch(/\d/);
    });
  });

  describe('source_type=account (GrowthBlueprint)', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: growthBlueprint };

    it('starts with "Account Deep-Dive"', () => {
      expect(digestReport(report)).toMatch(/^Account Deep-Dive/);
    });

    it('includes thematic consistency score', () => {
      expect(digestReport(report)).toContain('60/100');
    });

    it('includes posting blindspots', () => {
      expect(digestReport(report)).toContain('Weekday mornings');
      expect(digestReport(report)).toContain('Tech niche');
    });

    it('lists blindspots with semicolon separator', () => {
      expect(digestReport(report)).toContain('Weekday mornings; Tech niche');
    });
  });

  describe('source_type=account with empty blindspots', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'account',
      analysis: { ...growthBlueprint, posting_blindspots: [] },
    };

    it('falls back to "none noted"', () => {
      expect(digestReport(report)).toContain('none noted');
    });
  });

  describe('source_type=upload (UploadDiagnosis)', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis: uploadDiagnosis };

    it('starts with "Upload Diagnostic"', () => {
      expect(digestReport(report)).toMatch(/^Upload Diagnostic/);
    });

    it('includes visual hook verdict', () => {
      expect(digestReport(report)).toContain('moderate');
    });

    it('includes visual hook score', () => {
      expect(digestReport(report)).toContain('70/100');
    });

    it('includes audio balance score', () => {
      expect(digestReport(report)).toContain('80/100');
    });

    it('includes audio balance notes', () => {
      expect(digestReport(report)).toContain('Balanced mix');
    });

    it('includes text overlay pacing assessment', () => {
      expect(digestReport(report)).toContain('Fast enough');
    });
  });

  describe('source_type=discovery (SiteDiscoveryResult)', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'discovery', analysis: discoveryResult };

    it('starts with "Site Discovery"', () => {
      expect(digestReport(report)).toMatch(/^Site Discovery/);
    });

    it('includes the query', () => {
      expect(digestReport(report)).toContain('creator tools 2024');
    });

    it('includes outlier URL', () => {
      expect(digestReport(report)).toContain('https://example.com/top');
    });

    it('includes outlier reasoning', () => {
      expect(digestReport(report)).toContain('Most backlinks in set');
    });
  });

  describe('source_type=competitors (CompetitorGapAnalysis)', () => {
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: competitorGap };

    it('starts with "Competitor Espionage"', () => {
      expect(digestReport(report)).toMatch(/^Competitor Espionage/);
    });

    it('includes missing topics', () => {
      expect(digestReport(report)).toContain('Cooking tips');
      expect(digestReport(report)).toContain('Budget travel');
    });

    it('includes untapped keyword clusters', () => {
      expect(digestReport(report)).toContain('vlog money');
      expect(digestReport(report)).toContain('side hustle');
    });
  });

  describe('source_type=competitors with empty arrays', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'competitors',
      analysis: { ...competitorGap, missing_topics: [], untapped_keyword_clusters: [] },
    };

    it('says "none noted" for missing topics', () => {
      expect(digestReport(report)).toContain('missing topics: none noted');
    });

    it('says "none noted" for untapped clusters', () => {
      expect(digestReport(report)).toContain('untapped keyword clusters: none noted');
    });
  });
});

// ---------------------------------------------------------------------------
// digestScript
// ---------------------------------------------------------------------------
describe('digestScript()', () => {
  const baseScript: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Viral Hook',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'You are wasting money every day.',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up on wallet',
          dialogue_or_vo: 'Start here.',
          audio_sfx_cue: 'None',
          retention_loop_note: 'Shocking opener',
        },
        {
          scene_number: 2,
          visual_action: 'Chart animation',
          dialogue_or_vo: 'Here is why.',
          audio_sfx_cue: 'Whoosh',
          retention_loop_note: 'Build tension',
        },
      ],
      cta: 'Follow for more tips',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-12T10:00:00.000Z',
  };

  it('includes the script title', () => {
    expect(digestScript(baseScript)).toContain('My Viral Hook');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(baseScript)).toContain('You are wasting money every day.');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(baseScript)).toContain('Shocking opener');
  });

  it('includes the scene count', () => {
    expect(digestScript(baseScript)).toContain('2 scenes total');
  });

  it('includes a date', () => {
    expect(digestScript(baseScript)).toMatch(/\d/);
  });

  it('handles a storyboard with no scenes gracefully', () => {
    const noScenes: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    const result = digestScript(noScenes);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('returns a string', () => {
    expect(typeof digestScript(baseScript)).toBe('string');
  });
});
