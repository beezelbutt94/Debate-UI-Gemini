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

// ---- fixtures ---------------------------------------------------------------

const BASE_DATE = '2024-09-12T10:00:00.000Z';
const FORMATTED = new Date(BASE_DATE).toLocaleDateString();

function baseReport(overrides: Partial<AuditReportRow>): AuditReportRow {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_type: 'url',
    source_url: null,
    platform: null,
    viral_score: null,
    analysis: {} as never,
    timeline_recommendations: [],
    created_at: BASE_DATE,
    ...overrides,
  };
}

const URL_ANALYSIS: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
  hook_evaluation: { score: 82, verdict: 'strong', notes: 'Opens with pattern interrupt' },
  retention_prediction: {
    at_3s_percent: 75,
    at_30s_percent: 45,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Cut dead air in first 3s'],
  source_metrics: {},
};

const ACCOUNT_ANALYSIS: GrowthBlueprint = {
  thematic_consistency: { score: 60, notes: 'Mixed niches hurting algorithm' },
  view_to_follower_ratio: { value: 1.2, assessment: 'average' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'good' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['Mondays before 10am', 'Saturdays'],
  per_platform_notes: {},
};

const UPLOAD_ANALYSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 71, verdict: 'moderate', notes: 'Hook visible but low contrast' },
  audio_balance: { score: 88, notes: 'Well balanced' },
  text_overlay_pacing: { assessment: 'slightly fast, reduce to 2s hold' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 120,
};

const COMPETITOR_ANALYSIS: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['product reviews', 'day-in-the-life vlogs'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['AI tools for creators', 'budget editing'],
};

const DISCOVERY_ANALYSIS: SiteDiscoveryResult = {
  query: 'short-form video editing tools',
  sites: [],
  outlier: {
    url: 'https://example.com/unusual-tool',
    reasoning: 'Unlike others, this tool targets audio-first creators',
  },
  summary: 'Ten relevant sites found',
};

// ---- digestReport -----------------------------------------------------------

describe('digestReport() — source_type: url', () => {
  const report = baseReport({ source_type: 'url', analysis: URL_ANALYSIS });

  it('includes the date', () => {
    expect(digestReport(report)).toContain(FORMATTED);
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('82');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Opens with pattern interrupt');
  });

  it('includes the 3s retention percent', () => {
    expect(digestReport(report)).toContain('75%');
  });

  it('includes the 30s retention percent', () => {
    expect(digestReport(report)).toContain('45%');
  });

  it('starts with "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toMatch(/^Viral Gap Analyzer/);
  });
});

describe('digestReport() — source_type: account', () => {
  const report = baseReport({ source_type: 'account', analysis: ACCOUNT_ANALYSIS });

  it('starts with "Account Deep-Dive"', () => {
    expect(digestReport(report)).toMatch(/^Account Deep-Dive/);
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('60');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Mixed niches hurting algorithm');
  });

  it('includes posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Mondays before 10am');
    expect(result).toContain('Saturdays');
  });

  it('includes the date', () => {
    expect(digestReport(report)).toContain(FORMATTED);
  });
});

describe('digestReport() — source_type: account with empty blindspots', () => {
  const noBlindspots: GrowthBlueprint = { ...ACCOUNT_ANALYSIS, posting_blindspots: [] };
  const report = baseReport({ source_type: 'account', analysis: noBlindspots });

  it('shows "none noted" for empty blindspots', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport() — source_type: upload', () => {
  const report = baseReport({ source_type: 'upload', analysis: UPLOAD_ANALYSIS });

  it('starts with "Upload Diagnostic"', () => {
    expect(digestReport(report)).toMatch(/^Upload Diagnostic/);
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('71');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('88');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Well balanced');
  });

  it('includes text-overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('slightly fast, reduce to 2s hold');
  });
});

describe('digestReport() — source_type: discovery', () => {
  const report = baseReport({ source_type: 'discovery', analysis: DISCOVERY_ANALYSIS });

  it('starts with "Site Discovery"', () => {
    expect(digestReport(report)).toMatch(/^Site Discovery/);
  });

  it('includes the query', () => {
    expect(digestReport(report)).toContain('short-form video editing tools');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/unusual-tool');
  });

  it('includes outlier reasoning', () => {
    expect(digestReport(report)).toContain('Unlike others, this tool targets audio-first creators');
  });
});

describe('digestReport() — source_type: competitors (default branch)', () => {
  const report = baseReport({ source_type: 'competitors', analysis: COMPETITOR_ANALYSIS });

  it('starts with "Competitor Espionage"', () => {
    expect(digestReport(report)).toMatch(/^Competitor Espionage/);
  });

  it('includes missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('product reviews');
    expect(result).toContain('day-in-the-life vlogs');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('AI tools for creators');
    expect(result).toContain('budget editing');
  });

  it('includes the date', () => {
    expect(digestReport(report)).toContain(FORMATTED);
  });
});

describe('digestReport() — competitors with empty arrays', () => {
  const empty: CompetitorGapAnalysis = {
    ...COMPETITOR_ANALYSIS,
    missing_topics: [],
    untapped_keyword_clusters: [],
  };
  const report = baseReport({ source_type: 'competitors', analysis: empty });

  it('shows "none noted" for missing_topics', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

// ---- digestScript -----------------------------------------------------------

const SCRIPT: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'My Viral Hook',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'Stop scrolling — you need to hear this',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Zoom into face',
        dialogue_or_vo: 'Here is the secret',
        audio_sfx_cue: 'swoosh',
        retention_loop_note: 'open loop',
      },
      {
        scene_number: 2,
        visual_action: 'B-roll of phone',
        dialogue_or_vo: 'Use this trick',
        audio_sfx_cue: 'none',
        retention_loop_note: '',
      },
    ],
    cta: 'Follow for more',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: BASE_DATE,
};

describe('digestScript()', () => {
  it('includes the script title', () => {
    expect(digestScript(SCRIPT)).toContain('My Viral Hook');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(SCRIPT)).toContain('Stop scrolling — you need to hear this');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(SCRIPT)).toContain('open loop');
  });

  it('includes total scene count', () => {
    expect(digestScript(SCRIPT)).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    expect(digestScript(SCRIPT)).toContain(FORMATTED);
  });

  it('handles a script with no scenes gracefully', () => {
    const noScenes: ScriptRow = {
      ...SCRIPT,
      storyboard: { ...SCRIPT.storyboard, scenes: [] },
    };
    const result = digestScript(noScenes);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });
});
