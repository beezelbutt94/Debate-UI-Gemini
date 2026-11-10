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
// Helpers: minimal valid fixture builders
// ---------------------------------------------------------------------------

function makeDate(isoString: string) {
  return new Date(isoString).toLocaleDateString();
}

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-06-15T12:00:00.000Z',
};

function urlReport(overrides?: Partial<ViralGapAnalysis>): AuditReportRow {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
    hook_evaluation: { score: 72, verdict: 'moderate', notes: 'could be stronger' },
    retention_prediction: {
      at_3s_percent: 65,
      at_30s_percent: 42,
      meets_3s_benchmark: true,
      meets_30s_benchmark: true,
    },
    action_plan: ['add B-roll', 'tighten hook'],
    source_metrics: {},
    ...overrides,
  };
  return { ...BASE_REPORT, source_type: 'url', analysis };
}

function accountReport(overrides?: Partial<GrowthBlueprint>): AuditReportRow {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 80, notes: 'mostly consistent' },
    view_to_follower_ratio: { value: 1.5, assessment: 'healthy' },
    posting_cadence: { avg_days_between_posts: 2, assessment: 'frequent' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: ['weekends', 'mornings'],
    per_platform_notes: {},
    ...overrides,
  };
  return { ...BASE_REPORT, source_type: 'account', analysis };
}

function uploadReport(overrides?: Partial<UploadDiagnosis>): AuditReportRow {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 60, verdict: 'weak', notes: 'blurry first frame' },
    audio_balance: { score: 75, notes: 'music slightly loud' },
    text_overlay_pacing: { assessment: 'too fast' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
    ...overrides,
  };
  return { ...BASE_REPORT, source_type: 'upload', analysis };
}

function competitorReport(overrides?: Partial<CompetitorGapAnalysis>): AuditReportRow {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: ['gaming'],
    missing_topics: ['tutorials', 'live streams'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['beginner tips', 'pro tricks'],
    ...overrides,
  };
  return { ...BASE_REPORT, source_type: 'competitors', analysis };
}

function discoveryReport(overrides?: Partial<SiteDiscoveryResult>): AuditReportRow {
  const analysis: SiteDiscoveryResult = {
    query: 'viral short-form tips',
    sites: [],
    outlier: { url: 'https://outlier.example.com', reasoning: 'unique methodology' },
    summary: 'found 10 great resources',
    ...overrides,
  };
  return { ...BASE_REPORT, source_type: 'discovery', analysis };
}

function makeScript(overrides?: Partial<ScriptRow>): ScriptRow {
  return {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'Epic Hook Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know you can double views?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'talking head',
          dialogue_or_vo: 'hook line here',
          audio_sfx_cue: 'upbeat music',
          retention_loop_note: 'reveal answer in next scene',
        },
        {
          scene_number: 2,
          visual_action: 'screen capture',
          dialogue_or_vo: 'here is how',
          audio_sfx_cue: '',
          retention_loop_note: 'keep them curious',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-06-15T12:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// digestReport — source_type: 'url'
// ---------------------------------------------------------------------------

describe('digestReport (url)', () => {
  it('includes "Viral Gap Analyzer" label', () => {
    expect(digestReport(urlReport())).toContain('Viral Gap Analyzer');
  });

  it('includes the formatted date', () => {
    expect(digestReport(urlReport())).toContain(makeDate('2024-06-15T12:00:00.000Z'));
  });

  it('includes hook verdict', () => {
    expect(digestReport(urlReport())).toContain('moderate');
  });

  it('includes hook score', () => {
    expect(digestReport(urlReport())).toContain('72');
  });

  it('includes hook notes', () => {
    expect(digestReport(urlReport())).toContain('could be stronger');
  });

  it('includes 3s retention percentage', () => {
    expect(digestReport(urlReport())).toContain('65');
  });

  it('includes 30s retention percentage', () => {
    expect(digestReport(urlReport())).toContain('42');
  });

  it('works for a "strong" verdict', () => {
    const result = digestReport(
      urlReport({ hook_evaluation: { score: 95, verdict: 'strong', notes: 'killer opener' } })
    );
    expect(result).toContain('strong');
    expect(result).toContain('95');
    expect(result).toContain('killer opener');
  });

  it('works for a "weak" verdict', () => {
    const result = digestReport(
      urlReport({ hook_evaluation: { score: 20, verdict: 'weak', notes: 'boring' } })
    );
    expect(result).toContain('weak');
  });

  it('works with 0% retention numbers', () => {
    const result = digestReport(
      urlReport({
        retention_prediction: {
          at_3s_percent: 0,
          at_30s_percent: 0,
          meets_3s_benchmark: false,
          meets_30s_benchmark: false,
        },
      })
    );
    expect(result).toContain('3s=0%');
    expect(result).toContain('30s=0%');
  });
});

// ---------------------------------------------------------------------------
// digestReport — source_type: 'account'
// ---------------------------------------------------------------------------

describe('digestReport (account)', () => {
  it('includes "Account Deep-Dive" label', () => {
    expect(digestReport(accountReport())).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(accountReport())).toContain('80');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(accountReport())).toContain('mostly consistent');
  });

  it('includes posting blindspots joined by semicolon', () => {
    const result = digestReport(accountReport());
    expect(result).toContain('weekends');
    expect(result).toContain('mornings');
  });

  it('shows "none noted" when blindspots is empty', () => {
    const result = digestReport(accountReport({ posting_blindspots: [] }));
    expect(result).toContain('none noted');
  });

  it('includes the date', () => {
    expect(digestReport(accountReport())).toContain(makeDate('2024-06-15T12:00:00.000Z'));
  });
});

// ---------------------------------------------------------------------------
// digestReport — source_type: 'upload'
// ---------------------------------------------------------------------------

describe('digestReport (upload)', () => {
  it('includes "Upload Diagnostic" label', () => {
    expect(digestReport(uploadReport())).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(uploadReport())).toContain('weak');
  });

  it('includes visual hook score', () => {
    expect(digestReport(uploadReport())).toContain('60');
  });

  it('includes audio balance score', () => {
    expect(digestReport(uploadReport())).toContain('75');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(uploadReport())).toContain('music slightly loud');
  });

  it('includes text overlay assessment', () => {
    expect(digestReport(uploadReport())).toContain('too fast');
  });

  it('includes the date', () => {
    expect(digestReport(uploadReport())).toContain(makeDate('2024-06-15T12:00:00.000Z'));
  });

  it('works for a "strong" visual hook', () => {
    const result = digestReport(
      uploadReport({ visual_hook_clarity: { score: 90, verdict: 'strong', notes: 'sharp' } })
    );
    expect(result).toContain('strong');
    expect(result).toContain('90');
  });
});

// ---------------------------------------------------------------------------
// digestReport — source_type: 'discovery'
// ---------------------------------------------------------------------------

describe('digestReport (discovery)', () => {
  it('includes "Site Discovery" label', () => {
    expect(digestReport(discoveryReport())).toContain('Site Discovery');
  });

  it('includes the query', () => {
    expect(digestReport(discoveryReport())).toContain('viral short-form tips');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(discoveryReport())).toContain('https://outlier.example.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(discoveryReport())).toContain('unique methodology');
  });

  it('includes the date', () => {
    expect(digestReport(discoveryReport())).toContain(makeDate('2024-06-15T12:00:00.000Z'));
  });

  it('works with different query values', () => {
    const result = digestReport(discoveryReport({ query: 'niche cooking hacks' }));
    expect(result).toContain('niche cooking hacks');
  });
});

// ---------------------------------------------------------------------------
// digestReport — source_type: 'competitors' (fallback branch)
// ---------------------------------------------------------------------------

describe('digestReport (competitors)', () => {
  it('includes "Competitor Espionage" label', () => {
    expect(digestReport(competitorReport())).toContain('Competitor Espionage');
  });

  it('includes missing topics joined by semicolon', () => {
    const result = digestReport(competitorReport());
    expect(result).toContain('tutorials');
    expect(result).toContain('live streams');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(competitorReport());
    expect(result).toContain('beginner tips');
    expect(result).toContain('pro tricks');
  });

  it('shows "none noted" for missing topics when empty', () => {
    const result = digestReport(competitorReport({ missing_topics: [] }));
    expect(result).toContain('none noted');
  });

  it('shows "none noted" for keyword clusters when empty', () => {
    const result = digestReport(competitorReport({ untapped_keyword_clusters: [] }));
    expect(result).toContain('none noted');
  });

  it('includes the date', () => {
    expect(digestReport(competitorReport())).toContain(makeDate('2024-06-15T12:00:00.000Z'));
  });
});

// ---------------------------------------------------------------------------
// digestScript
// ---------------------------------------------------------------------------

describe('digestScript', () => {
  it('includes the script title', () => {
    expect(digestScript(makeScript())).toContain('Epic Hook Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(makeScript())).toContain('Did you know you can double views?');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(makeScript())).toContain('reveal answer in next scene');
  });

  it('includes the total scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    expect(digestScript(makeScript())).toContain(makeDate('2024-06-15T12:00:00.000Z'));
  });

  it('shows "(none)" when there are no scenes', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    const result = digestScript(script);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('uses first scene note even when multiple scenes exist', () => {
    const result = digestScript(makeScript());
    expect(result).toContain('reveal answer in next scene');
    expect(result).not.toContain('keep them curious');
  });

  it('works with a single scene', () => {
    const script = makeScript();
    script.storyboard.scenes = [script.storyboard.scenes[0]];
    const result = digestScript(script);
    expect(result).toContain('1 scenes total');
    expect(result).toContain('reveal answer in next scene');
  });

  it('includes the script title even when it has special characters', () => {
    const result = digestScript(makeScript({ title: 'Script #1 — "Best Yet"' }));
    expect(result).toContain('Script #1 — "Best Yet"');
  });
});
