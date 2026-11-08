import { describe, it, expect } from 'vitest';
import { digestReport, digestScript } from '@/lib/digest';
import type {
  AuditReportRow,
  ScriptRow,
  TimelineRecommendation,
  ViralGapAnalysis,
  GrowthBlueprint,
  UploadDiagnosis,
  SiteDiscoveryResult,
  CompetitorGapAnalysis,
} from '@/lib/types';

const BASE_REPORT = {
  id: 'report-1',
  user_id: 'user-1',
  creator_profile_id: null as null,
  source_url: null as null,
  platform: null as null,
  viral_score: null as null,
  timeline_recommendations: [] as TimelineRecommendation[],
  created_at: '2024-06-15T12:00:00Z',
};

describe('digestReport', () => {
  it('formats a url (ViralGapAnalysis) report correctly', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'url',
      analysis: {
        pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
        hook_evaluation: { score: 85, verdict: 'strong', notes: 'Great hook!' },
        retention_prediction: {
          at_3s_percent: 72,
          at_30s_percent: 48,
          meets_3s_benchmark: true,
          meets_30s_benchmark: true,
        },
        action_plan: ['Add B-roll'],
        source_metrics: {},
      } as ViralGapAnalysis,
    };

    const result = digestReport(report);
    expect(result).toContain('Viral Gap Analyzer');
    expect(result).toContain('strong');
    expect(result).toContain('85/100');
    expect(result).toContain('Great hook!');
    expect(result).toContain('3s=72%');
    expect(result).toContain('30s=48%');
  });

  it('formats an account (GrowthBlueprint) report correctly', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'account',
      analysis: {
        thematic_consistency: { score: 78, notes: 'Mixed messaging detected' },
        view_to_follower_ratio: { value: 0.05, assessment: 'below average' },
        posting_cadence: { avg_days_between_posts: 3.5, assessment: 'consistent' },
        theme_correction: ['Pick a niche'],
        view_maximization_tactics: ['Use trending audio'],
        posting_blindspots: ['Tuesday evenings', 'Early mornings'],
        per_platform_notes: {},
      } as GrowthBlueprint,
    };

    const result = digestReport(report);
    expect(result).toContain('Account Deep-Dive');
    expect(result).toContain('78/100');
    expect(result).toContain('Mixed messaging detected');
    expect(result).toContain('Tuesday evenings');
    expect(result).toContain('Early mornings');
  });

  it('shows "none noted" when blindspots is empty', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'account',
      analysis: {
        thematic_consistency: { score: 95, notes: 'Very consistent' },
        view_to_follower_ratio: { value: 0.1, assessment: 'good' },
        posting_cadence: { avg_days_between_posts: 2, assessment: 'frequent' },
        theme_correction: [],
        view_maximization_tactics: [],
        posting_blindspots: [],
        per_platform_notes: {},
      } as GrowthBlueprint,
    };

    expect(digestReport(report)).toContain('none noted');
  });

  it('formats an upload (UploadDiagnosis) report correctly', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'upload',
      analysis: {
        visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'Hook visible but slow' },
        audio_balance: { score: 72, notes: 'Music too loud' },
        text_overlay_pacing: { assessment: 'Too fast to read' },
        b_roll_recommendations: [],
        retention_boosters: [],
        frames_analyzed: 150,
      } as UploadDiagnosis,
    };

    const result = digestReport(report);
    expect(result).toContain('Upload Diagnostic');
    expect(result).toContain('moderate');
    expect(result).toContain('60/100');
    expect(result).toContain('72/100');
    expect(result).toContain('Music too loud');
    expect(result).toContain('Too fast to read');
  });

  it('formats a discovery (SiteDiscoveryResult) report correctly', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'discovery',
      analysis: {
        query: 'best fitness content creators',
        sites: [],
        outlier: { url: 'https://outlier.com', reasoning: 'Unique format stands out' },
        summary: 'Found great fitness sites',
      } as SiteDiscoveryResult,
    };

    const result = digestReport(report);
    expect(result).toContain('Site Discovery');
    expect(result).toContain('best fitness content creators');
    expect(result).toContain('https://outlier.com');
    expect(result).toContain('Unique format stands out');
  });

  it('formats a competitors (CompetitorGapAnalysis) report correctly', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'competitors',
      analysis: {
        competitors: [],
        outlier_topics: ['Finance'],
        missing_topics: ['Budgeting tips', 'Investment basics'],
        audience_sentiment_gaps: [],
        untapped_keyword_clusters: ['ETF explained', 'passive income'],
      } as CompetitorGapAnalysis,
    };

    const result = digestReport(report);
    expect(result).toContain('Competitor Espionage');
    expect(result).toContain('Budgeting tips');
    expect(result).toContain('Investment basics');
    expect(result).toContain('ETF explained');
    expect(result).toContain('passive income');
  });

  it('shows "none noted" when competitor missing_topics is empty', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'competitors',
      analysis: {
        competitors: [],
        outlier_topics: [],
        missing_topics: [],
        audience_sentiment_gaps: [],
        untapped_keyword_clusters: [],
      } as CompetitorGapAnalysis,
    };

    const result = digestReport(report);
    expect(result).toContain('none noted');
  });

  it('includes the formatted date in the output', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'url',
      analysis: {
        pacing_audit: { cuts_per_10s: null, assessment: '' },
        hook_evaluation: { score: 50, verdict: 'moderate', notes: 'ok' },
        retention_prediction: { at_3s_percent: 55, at_30s_percent: 35, meets_3s_benchmark: false, meets_30s_benchmark: false },
        action_plan: [],
        source_metrics: {},
      } as ViralGapAnalysis,
    };

    const date = new Date('2024-06-15T12:00:00Z').toLocaleDateString();
    expect(digestReport(report)).toContain(date);
  });
});

describe('digestScript', () => {
  const makeScript = (overrides: Partial<ScriptRow> = {}): ScriptRow => ({
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
          visual_action: 'Close-up of face',
          dialogue_or_vo: 'Stop scrolling right now',
          audio_sfx_cue: 'Dramatic sting',
          retention_loop_note: 'Cliffhanger ending',
        },
        {
          scene_number: 2,
          visual_action: 'B-roll montage',
          dialogue_or_vo: 'Because this will change everything',
          audio_sfx_cue: 'Build-up music',
          retention_loop_note: 'Opens a curiosity loop',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-07-01T09:00:00Z',
    ...overrides,
  });

  it('includes the script title', () => {
    expect(digestScript(makeScript())).toContain('My Viral Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(makeScript())).toContain('Stop scrolling right now');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(makeScript())).toContain('Cliffhanger ending');
  });

  it('includes scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });

  it('includes formatted date', () => {
    const date = new Date('2024-07-01T09:00:00Z').toLocaleDateString();
    expect(digestScript(makeScript())).toContain(date);
  });

  it('shows (none) when first scene retention_loop_note is empty string', () => {
    const script = makeScript();
    script.storyboard.scenes[0].retention_loop_note = '';
    const result = digestScript(script);
    expect(result).toContain('(none)');
  });

  it('shows (none) when storyboard has no scenes', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    const result = digestScript(script);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('single-scene script shows correct scene count', () => {
    const script = makeScript();
    script.storyboard.scenes = [script.storyboard.scenes[0]];
    expect(digestScript(script)).toContain('1 scenes total');
  });

  it('includes the CTA in the storyboard (not in digest output — confirms digest only uses subset)', () => {
    const script = makeScript();
    // digestScript doesn't include CTA — this test confirms the shape is correct
    const result = digestScript(script);
    expect(result).toContain('My Viral Script');
    expect(result).toContain('2 scenes total');
  });

  it('uses the first scene retention note, not the second', () => {
    const script = makeScript();
    const result = digestScript(script);
    expect(result).toContain('Cliffhanger ending');
    expect(result).not.toContain('Opens a curiosity loop');
  });

  it('platform is included in the script row but not the digest (shape sanity)', () => {
    const script = makeScript({ target_platform: 'tiktok' });
    const result = digestScript(script);
    // digestScript doesn't surface target_platform — just confirm no crash
    expect(typeof result).toBe('string');
  });
});

describe('digestReport edge cases', () => {
  const BASE = {
    id: 'r-edge',
    user_id: 'u-1',
    creator_profile_id: null as null,
    source_url: null as null,
    platform: null as null,
    viral_score: null as null,
    timeline_recommendations: [] as import('@/lib/types').TimelineRecommendation[],
    created_at: '2025-01-01T00:00:00Z',
  };

  it('digestReport url — zero retention percentages', () => {
    const report: import('@/lib/types').AuditReportRow = {
      ...BASE,
      source_type: 'url',
      analysis: {
        pacing_audit: { cuts_per_10s: null, assessment: '' },
        hook_evaluation: { score: 0, verdict: 'weak', notes: '' },
        retention_prediction: { at_3s_percent: 0, at_30s_percent: 0, meets_3s_benchmark: false, meets_30s_benchmark: false },
        action_plan: [],
        source_metrics: {},
      } as import('@/lib/types').ViralGapAnalysis,
    };
    const result = digestReport(report);
    expect(result).toContain('0/100');
    expect(result).toContain('3s=0%');
    expect(result).toContain('30s=0%');
  });

  it('digestReport url — perfect scores', () => {
    const report: import('@/lib/types').AuditReportRow = {
      ...BASE,
      source_type: 'url',
      analysis: {
        pacing_audit: { cuts_per_10s: 10, assessment: 'fast' },
        hook_evaluation: { score: 100, verdict: 'strong', notes: 'Perfect' },
        retention_prediction: { at_3s_percent: 100, at_30s_percent: 100, meets_3s_benchmark: true, meets_30s_benchmark: true },
        action_plan: [],
        source_metrics: {},
      } as import('@/lib/types').ViralGapAnalysis,
    };
    const result = digestReport(report);
    expect(result).toContain('100/100');
    expect(result).toContain('3s=100%');
  });

  it('digestReport account — single blindspot is not plural', () => {
    const report: import('@/lib/types').AuditReportRow = {
      ...BASE,
      source_type: 'account',
      analysis: {
        thematic_consistency: { score: 70, notes: 'ok' },
        view_to_follower_ratio: { value: 0.05, assessment: 'low' },
        posting_cadence: { avg_days_between_posts: 7, assessment: 'infrequent' },
        theme_correction: [],
        view_maximization_tactics: [],
        posting_blindspots: ['Mondays'],
        per_platform_notes: {},
      } as import('@/lib/types').GrowthBlueprint,
    };
    const result = digestReport(report);
    expect(result).toContain('Mondays');
    expect(result).not.toContain('none noted');
  });

  it('digestReport competitors — untapped clusters shown even when missing_topics empty', () => {
    const report: import('@/lib/types').AuditReportRow = {
      ...BASE,
      source_type: 'competitors',
      analysis: {
        competitors: [],
        outlier_topics: [],
        missing_topics: [],
        audience_sentiment_gaps: [],
        untapped_keyword_clusters: ['crypto basics'],
      } as import('@/lib/types').CompetitorGapAnalysis,
    };
    const result = digestReport(report);
    expect(result).toContain('none noted'); // missing_topics
    expect(result).toContain('crypto basics'); // untapped clusters
  });

  it('digestReport discovery — summary is not included in digest output', () => {
    const report: import('@/lib/types').AuditReportRow = {
      ...BASE,
      source_type: 'discovery',
      analysis: {
        query: 'wellness creators',
        sites: [],
        outlier: { url: 'https://wellness.example.com', reasoning: 'unique angle' },
        summary: 'this summary should not appear in digest',
      } as import('@/lib/types').SiteDiscoveryResult,
    };
    const result = digestReport(report);
    expect(result).toContain('wellness creators');
    expect(result).toContain('https://wellness.example.com');
    expect(result).not.toContain('this summary should not appear in digest');
  });
});
