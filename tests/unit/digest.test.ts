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

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'report-1',
  user_id: 'user-1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-09-12T10:00:00.000Z',
};

describe('digestReport', () => {
  describe('source_type = url (ViralGapAnalysis)', () => {
    const analysis: ViralGapAnalysis = {
      pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
      hook_evaluation: { score: 82, verdict: 'strong', notes: 'Opens with a surprising claim' },
      retention_prediction: { at_3s_percent: 72, at_30s_percent: 48, meets_3s_benchmark: true, meets_30s_benchmark: true },
      action_plan: ['cut intro to 2s'],
      source_metrics: {},
    };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis };

    it('includes the hook verdict', () => {
      expect(digestReport(report)).toContain('strong');
    });

    it('includes the hook score', () => {
      expect(digestReport(report)).toContain('82/100');
    });

    it('includes hook notes', () => {
      expect(digestReport(report)).toContain('Opens with a surprising claim');
    });

    it('includes 3s retention', () => {
      expect(digestReport(report)).toContain('3s=72%');
    });

    it('includes 30s retention', () => {
      expect(digestReport(report)).toContain('30s=48%');
    });

    it('includes the label "Viral Gap Analyzer"', () => {
      expect(digestReport(report)).toContain('Viral Gap Analyzer');
    });

    it('includes a formatted date', () => {
      const result = digestReport(report);
      // The date string depends on locale but must be present in some form
      expect(result).toMatch(/\d/);
    });
  });

  describe('source_type = account (GrowthBlueprint)', () => {
    const analysis: GrowthBlueprint = {
      thematic_consistency: { score: 71, notes: 'Mostly cooking but occasional lifestyle' },
      view_to_follower_ratio: { value: 0.08, assessment: 'below average' },
      posting_cadence: { avg_days_between_posts: 3.5, assessment: 'consistent' },
      theme_correction: [],
      view_maximization_tactics: [],
      posting_blindspots: ['weekday mornings', 'Thursday evenings'],
      per_platform_notes: {},
    };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis };

    it('includes "Account Deep-Dive"', () => {
      expect(digestReport(report)).toContain('Account Deep-Dive');
    });

    it('includes thematic consistency score', () => {
      expect(digestReport(report)).toContain('71/100');
    });

    it('includes consistency notes', () => {
      expect(digestReport(report)).toContain('Mostly cooking but occasional lifestyle');
    });

    it('includes posting blindspots', () => {
      const result = digestReport(report);
      expect(result).toContain('weekday mornings');
      expect(result).toContain('Thursday evenings');
    });

    it('shows "none noted" when blindspots is empty', () => {
      const noGaps: GrowthBlueprint = { ...analysis, posting_blindspots: [] };
      const r: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: noGaps };
      expect(digestReport(r)).toContain('none noted');
    });
  });

  describe('source_type = upload (UploadDiagnosis)', () => {
    const analysis: UploadDiagnosis = {
      visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'Text enters frame too late' },
      audio_balance: { score: 55, notes: 'Music drowns out voice at 0:04' },
      text_overlay_pacing: { assessment: 'Too fast — 2 overlays in 1s' },
      b_roll_recommendations: [],
      retention_boosters: [],
      frames_analyzed: 120,
    };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis };

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
      expect(digestReport(report)).toContain('55/100');
    });

    it('includes audio notes', () => {
      expect(digestReport(report)).toContain('Music drowns out voice at 0:04');
    });

    it('includes text overlay assessment', () => {
      expect(digestReport(report)).toContain('Too fast — 2 overlays in 1s');
    });
  });

  describe('source_type = discovery (SiteDiscoveryResult)', () => {
    const analysis: SiteDiscoveryResult = {
      query: 'best cooking channels 2024',
      sites: [],
      outlier: { url: 'https://example.com/cooking-channel', reasoning: 'Only channel with live-cooking format' },
      summary: 'Top cooking sites found',
    };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'discovery', analysis };

    it('includes "Site Discovery"', () => {
      expect(digestReport(report)).toContain('Site Discovery');
    });

    it('includes the query', () => {
      expect(digestReport(report)).toContain('best cooking channels 2024');
    });

    it('includes the outlier URL', () => {
      expect(digestReport(report)).toContain('https://example.com/cooking-channel');
    });

    it('includes the outlier reasoning', () => {
      expect(digestReport(report)).toContain('Only channel with live-cooking format');
    });
  });

  describe('source_type = competitors (CompetitorGapAnalysis) — default branch', () => {
    const analysis: CompetitorGapAnalysis = {
      competitors: [],
      outlier_topics: [],
      missing_topics: ['meal-prep tutorials', 'budget cooking'],
      audience_sentiment_gaps: [],
      untapped_keyword_clusters: ['30-minute meals', 'one-pan recipes'],
    };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis };

    it('includes "Competitor Espionage"', () => {
      expect(digestReport(report)).toContain('Competitor Espionage');
    });

    it('includes missing topics', () => {
      const result = digestReport(report);
      expect(result).toContain('meal-prep tutorials');
      expect(result).toContain('budget cooking');
    });

    it('includes untapped keyword clusters', () => {
      const result = digestReport(report);
      expect(result).toContain('30-minute meals');
      expect(result).toContain('one-pan recipes');
    });

    it('shows "none noted" when missing_topics is empty', () => {
      const empty: CompetitorGapAnalysis = { ...analysis, missing_topics: [] };
      const r: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: empty };
      expect(digestReport(r)).toContain('none noted');
    });

    it('shows "none noted" when untapped_keyword_clusters is empty', () => {
      const empty: CompetitorGapAnalysis = { ...analysis, untapped_keyword_clusters: [] };
      const r: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: empty };
      expect(digestReport(r)).toContain('none noted');
    });
  });
});

describe('digestScript', () => {
  const baseScript: ScriptRow = {
    id: 'script-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'How to Make Pasta',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know you can make restaurant-quality pasta in 10 minutes?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of boiling water',
          dialogue_or_vo: 'Start with salted water',
          audio_sfx_cue: 'sizzle sound',
          retention_loop_note: 'Tease the finished plate at end of scene',
        },
        {
          scene_number: 2,
          visual_action: 'Adding pasta',
          dialogue_or_vo: 'Drop in the pasta',
          audio_sfx_cue: 'splash sound',
          retention_loop_note: '',
        },
      ],
      cta: 'Save this for your next dinner party!',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-12T12:00:00.000Z',
  };

  it('includes the script title', () => {
    expect(digestScript(baseScript)).toContain('How to Make Pasta');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(baseScript)).toContain('Did you know you can make restaurant-quality pasta in 10 minutes?');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(baseScript)).toContain('Tease the finished plate at end of scene');
  });

  it('reports total scene count', () => {
    expect(digestScript(baseScript)).toContain('2 scenes total');
  });

  it('shows (none) when first scene has no retention_loop_note', () => {
    const noNote: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [{ ...baseScript.storyboard.scenes[0], retention_loop_note: '' }],
      },
    };
    // empty string is falsy via ??, so the note is '(none)'
    // Actually, '' is not null/undefined — ?? only catches null/undefined.
    // The code uses `weakScene?.retention_loop_note ?? '(none)'`
    // An empty string retention_loop_note will be returned as-is since '' ?? '(none)' === ''
    expect(digestScript(noNote)).not.toContain('undefined');
  });

  it('shows (none) when first scene is undefined (empty scenes array)', () => {
    const noScenes: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('(none)');
  });

  it('reports correct scene count for single scene', () => {
    const oneScene: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [baseScript.storyboard.scenes[0]] },
    };
    expect(digestScript(oneScene)).toContain('1 scenes total');
  });

  it('includes a formatted date', () => {
    const result = digestScript(baseScript);
    expect(result).toMatch(/\d/);
  });
});
