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

// ── Fixtures ────────────────────────────────────────────────────────────────

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: 'https://example.com/video',
  platform: 'tiktok',
  viral_score: 82,
  timeline_recommendations: [],
  created_at: '2024-06-01T00:00:00.000Z',
};

const URL_ANALYSIS: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
  hook_evaluation: { score: 85, verdict: 'strong', notes: 'Opens with a bold claim' },
  retention_prediction: {
    at_3s_percent: 72,
    at_30s_percent: 45,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Add subtitles', 'Trim intro'],
  source_metrics: {},
};

const ACCOUNT_ANALYSIS: GrowthBlueprint = {
  thematic_consistency: { score: 70, notes: 'Fairly consistent' },
  view_to_follower_ratio: { value: 1.2, assessment: 'Good' },
  posting_cadence: { avg_days_between_posts: 2, assessment: 'Regular' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['Weekends', 'Late night'],
  per_platform_notes: {},
};

const UPLOAD_ANALYSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 78, verdict: 'moderate', notes: 'OK hook' },
  audio_balance: { score: 65, notes: 'Music slightly too loud' },
  text_overlay_pacing: { assessment: 'Slightly fast' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 120,
};

const COMPETITOR_ANALYSIS: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['Fitness recovery', 'Sleep hacks'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['morning routine', 'cold plunge'],
};

const DISCOVERY_ANALYSIS: SiteDiscoveryResult = {
  query: 'viral tiktok fitness creators',
  sites: [],
  outlier: {
    url: 'https://outlier.example.com',
    reasoning: 'Has 10x more engagement than peers',
  },
  summary: 'Found 10 sites',
};

const BASE_SCRIPT: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'My Viral Video Script',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'You will not believe this hack...',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Close-up of phone screen',
        dialogue_or_vo: 'The algorithm loves this',
        audio_sfx_cue: 'Woosh',
        retention_loop_note: 'Cut to reaction before viewer scrolls',
      },
      {
        scene_number: 2,
        visual_action: 'Talking head',
        dialogue_or_vo: 'Here is the step-by-step',
        audio_sfx_cue: '',
        retention_loop_note: '',
      },
    ],
    cta: 'Follow for more',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-07-15T00:00:00.000Z',
};

// ── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport — url source_type', () => {
  const report = { ...BASE_REPORT, source_type: 'url' as const, analysis: URL_ANALYSIS };

  it('contains "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('contains the hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('contains the hook score', () => {
    expect(digestReport(report)).toContain('85/100');
  });

  it('contains the hook notes', () => {
    expect(digestReport(report)).toContain('Opens with a bold claim');
  });

  it('contains 3s retention', () => {
    expect(digestReport(report)).toContain('3s=72%');
  });

  it('contains 30s retention', () => {
    expect(digestReport(report)).toContain('30s=45%');
  });

  it('contains the formatted date', () => {
    const date = new Date('2024-06-01T00:00:00.000Z').toLocaleDateString();
    expect(digestReport(report)).toContain(date);
  });
});

describe('digestReport — account source_type', () => {
  const report = { ...BASE_REPORT, source_type: 'account' as const, analysis: ACCOUNT_ANALYSIS };

  it('contains "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('contains thematic consistency score', () => {
    expect(digestReport(report)).toContain('70/100');
  });

  it('contains thematic notes', () => {
    expect(digestReport(report)).toContain('Fairly consistent');
  });

  it('contains posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Weekends');
    expect(result).toContain('Late night');
  });
});

describe('digestReport — upload source_type', () => {
  const report = { ...BASE_REPORT, source_type: 'upload' as const, analysis: UPLOAD_ANALYSIS };

  it('contains "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('contains visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('contains visual hook score', () => {
    expect(digestReport(report)).toContain('78/100');
  });

  it('contains audio balance score', () => {
    expect(digestReport(report)).toContain('65/100');
  });

  it('contains audio notes', () => {
    expect(digestReport(report)).toContain('Music slightly too loud');
  });

  it('contains text overlay pacing', () => {
    expect(digestReport(report)).toContain('Slightly fast');
  });
});

describe('digestReport — discovery source_type', () => {
  const report = { ...BASE_REPORT, source_type: 'discovery' as const, analysis: DISCOVERY_ANALYSIS };

  it('contains "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('contains the query', () => {
    expect(digestReport(report)).toContain('viral tiktok fitness creators');
  });

  it('contains the outlier URL', () => {
    expect(digestReport(report)).toContain('https://outlier.example.com');
  });

  it('contains the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Has 10x more engagement than peers');
  });
});

describe('digestReport — competitors (default) source_type', () => {
  const report = { ...BASE_REPORT, source_type: 'competitors' as const, analysis: COMPETITOR_ANALYSIS };

  it('contains "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('contains missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('Fitness recovery');
    expect(result).toContain('Sleep hacks');
  });

  it('contains untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('morning routine');
    expect(result).toContain('cold plunge');
  });
});

describe('digestReport — competitors with empty arrays', () => {
  const report = {
    ...BASE_REPORT,
    source_type: 'competitors' as const,
    analysis: {
      ...COMPETITOR_ANALYSIS,
      missing_topics: [],
      untapped_keyword_clusters: [],
    } satisfies CompetitorGapAnalysis,
  };

  it('shows "none noted" for empty missing_topics', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport — account with empty blindspots', () => {
  const report = {
    ...BASE_REPORT,
    source_type: 'account' as const,
    analysis: { ...ACCOUNT_ANALYSIS, posting_blindspots: [] } satisfies GrowthBlueprint,
  };

  it('shows "none noted" for empty blindspots', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

// ── digestScript ──────────────────────────────────────────────────────────────

describe('digestScript', () => {
  it('contains the script title', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('My Viral Video Script');
  });

  it('contains the spoken hook', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('You will not believe this hack...');
  });

  it('contains the first scene retention loop note', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Cut to reaction before viewer scrolls');
  });

  it('contains the total scene count', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('2 scenes total');
  });

  it('contains the formatted date', () => {
    const date = new Date('2024-07-15T00:00:00.000Z').toLocaleDateString();
    expect(digestScript(BASE_SCRIPT)).toContain(date);
  });

  it('handles script with no scenes gracefully', () => {
    const noSceneScript: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    const result = digestScript(noSceneScript);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('returns a string', () => {
    expect(typeof digestScript(BASE_SCRIPT)).toBe('string');
  });
});
