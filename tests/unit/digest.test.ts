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
// Fixtures
// ---------------------------------------------------------------------------

const BASE_REPORT = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: 'https://example.com',
  platform: 'tiktok' as const,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-06-15T12:00:00.000Z',
};

const URL_ANALYSIS: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'good' },
  hook_evaluation: { score: 82, verdict: 'strong', notes: 'Immediately grabs attention' },
  retention_prediction: {
    at_3s_percent: 75,
    at_30s_percent: 45,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Add B-roll at 0:10'],
  source_metrics: {},
};

const ACCOUNT_ANALYSIS: GrowthBlueprint = {
  thematic_consistency: { score: 70, notes: 'Mostly consistent' },
  view_to_follower_ratio: { value: 2.5, assessment: 'healthy' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['Weekends', 'Evenings'],
  per_platform_notes: {},
};

const UPLOAD_ANALYSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 65, verdict: 'moderate', notes: 'Decent but could be sharper' },
  audio_balance: { score: 78, notes: 'Good mix' },
  text_overlay_pacing: { assessment: 'slightly fast' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 120,
};

const COMPETITORS_ANALYSIS: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['Fitness challenges', 'Morning routines'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['gym motivation', 'workout hacks'],
};

const DISCOVERY_ANALYSIS: SiteDiscoveryResult = {
  query: 'best fitness content creators 2024',
  sites: [],
  outlier: {
    url: 'https://outlier.com',
    reasoning: 'Uniquely focuses on data-driven workouts vs purely inspirational content',
  },
  summary: 'Top 10 fitness sites',
};

const BASE_SCRIPT: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'Top 5 Workout Tips',
  source_prompt: null,
  target_platform: 'tiktok',
  tone_parameters: {},
  created_at: '2024-09-01T08:00:00.000Z',
  storyboard: {
    spoken_hook: 'Stop scrolling if you want abs in 30 days',
    memory_context_used: false,
    cta: 'Follow for more',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Person doing plank',
        dialogue_or_vo: 'Day 1...',
        audio_sfx_cue: 'upbeat music',
        retention_loop_note: 'Pause with curiosity hook',
      },
      {
        scene_number: 2,
        visual_action: 'Person doing push-ups',
        dialogue_or_vo: 'Day 7...',
        audio_sfx_cue: 'bass drop',
        retention_loop_note: 'Pattern interrupt',
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// digestReport
// ---------------------------------------------------------------------------

describe('digestReport() — url source_type', () => {
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: URL_ANALYSIS };

  it('includes "Viral Gap Analyzer" label', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('82');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Immediately grabs attention');
  });

  it('includes 3s retention percent', () => {
    expect(digestReport(report)).toContain('75');
  });

  it('includes 30s retention percent', () => {
    expect(digestReport(report)).toContain('45');
  });

  it('includes a formatted date derived from created_at', () => {
    const result = digestReport(report);
    // The exact format is locale-dependent, but must include "2024" or "24"
    expect(result).toMatch(/2024|6\/15|Jun/i);
  });
});

describe('digestReport() — account source_type', () => {
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: ACCOUNT_ANALYSIS };

  it('includes "Account Deep-Dive" label', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('70');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Mostly consistent');
  });

  it('lists posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Weekends');
    expect(result).toContain('Evenings');
  });
});

describe('digestReport() — account source_type with empty blindspots', () => {
  const analysisNoBlindspots: GrowthBlueprint = { ...ACCOUNT_ANALYSIS, posting_blindspots: [] };
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: analysisNoBlindspots };

  it('shows "none noted" when posting_blindspots is empty', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport() — upload source_type', () => {
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis: UPLOAD_ANALYSIS };

  it('includes "Upload Diagnostic" label', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('65');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('78');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Good mix');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('slightly fast');
  });
});

describe('digestReport() — competitors source_type', () => {
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: COMPETITORS_ANALYSIS };

  it('includes "Competitor Espionage" label', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('lists missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('Fitness challenges');
    expect(result).toContain('Morning routines');
  });

  it('lists untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('gym motivation');
    expect(result).toContain('workout hacks');
  });
});

describe('digestReport() — competitors with empty arrays', () => {
  const emptyAnalysis: CompetitorGapAnalysis = {
    ...COMPETITORS_ANALYSIS,
    missing_topics: [],
    untapped_keyword_clusters: [],
  };
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: emptyAnalysis };

  it('shows "none noted" for missing_topics when empty', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport() — discovery source_type', () => {
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'discovery', analysis: DISCOVERY_ANALYSIS };

  it('includes "Site Discovery" label', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the search query', () => {
    expect(digestReport(report)).toContain('best fitness content creators 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://outlier.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('data-driven workouts');
  });
});

// ---------------------------------------------------------------------------
// digestScript
// ---------------------------------------------------------------------------

describe('digestScript()', () => {
  it('includes the script title', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Top 5 Workout Tips');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Stop scrolling if you want abs in 30 days');
  });

  it('includes the scene count', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('2');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Pause with curiosity hook');
  });

  it('includes a formatted date', () => {
    const result = digestScript(BASE_SCRIPT);
    expect(result).toMatch(/2024|9\/1|Sep/i);
  });

  it('handles a script with zero scenes without throwing', () => {
    const noScenes: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    expect(() => digestScript(noScenes)).not.toThrow();
  });

  it('shows (none) in retention_loop_note when there are no scenes', () => {
    const noScenes: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('(none)');
  });

  it('scene count is 0 when scenes array is empty', () => {
    const noScenes: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('0 scenes');
  });
});
