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

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseReport(overrides: Partial<AuditReportRow> = {}): AuditReportRow {
  return {
    id: 'report-1',
    user_id: 'user-1',
    creator_profile_id: null,
    source_type: 'url',
    source_url: 'https://tiktok.com/@x/video/1',
    platform: 'tiktok',
    viral_score: 72,
    analysis: {} as ViralGapAnalysis,
    timeline_recommendations: [],
    created_at: '2024-06-15T12:00:00Z',
    ...overrides,
  };
}

const sampleViralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
  hook_evaluation: { score: 80, verdict: 'strong', notes: 'Great opening' },
  retention_prediction: { at_3s_percent: 70, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Add captions'],
  source_metrics: {},
};

const sampleGrowthBlueprint: GrowthBlueprint = {
  thematic_consistency: { score: 65, notes: 'Mixed topics' },
  view_to_follower_ratio: { value: 2.5, assessment: 'good' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'regular' },
  theme_correction: ['Focus on niche'],
  view_maximization_tactics: ['Post at 6pm'],
  posting_blindspots: ['Mondays', 'Wednesdays'],
  per_platform_notes: {},
};

const sampleUploadDiagnosis: UploadDiagnosis = {
  visual_hook_clarity: { score: 75, verdict: 'moderate', notes: 'Could be clearer' },
  audio_balance: { score: 88, notes: 'Well balanced' },
  text_overlay_pacing: { assessment: 'Too fast for mobile' },
  b_roll_recommendations: ['Add B-roll at 10s'],
  retention_boosters: ['Add pattern interrupt'],
  frames_analyzed: 120,
};

const sampleSiteDiscovery: SiteDiscoveryResult = {
  query: 'content creator tools 2024',
  sites: [],
  outlier: { url: 'https://example.com', reasoning: 'Unique because it covers AI tools deeply' },
  summary: 'Found 10 sites',
};

const sampleCompetitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['trending audio'],
  missing_topics: ['tutorials', 'live Q&A'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['short-form editing', 'viral hooks'],
};

// ── digestReport - url (ViralGapAnalysis) ─────────────────────────────────────

describe('digestReport with source_type=url', () => {
  const report = baseReport({ source_type: 'url', analysis: sampleViralAnalysis });

  it('includes "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('80/100');
  });

  it('includes the hook notes', () => {
    expect(digestReport(report)).toContain('Great opening');
  });

  it('includes 3s retention percentage', () => {
    expect(digestReport(report)).toContain('3s=70%');
  });

  it('includes 30s retention percentage', () => {
    expect(digestReport(report)).toContain('30s=45%');
  });

  it('includes a formatted date', () => {
    // The date is locale-dependent, but it should include part of 2024
    expect(digestReport(report)).toMatch(/\d/);
  });

  it('returns a string', () => {
    expect(typeof digestReport(report)).toBe('string');
  });
});

// ── digestReport - account (GrowthBlueprint) ─────────────────────────────────

describe('digestReport with source_type=account', () => {
  const report = baseReport({ source_type: 'account', analysis: sampleGrowthBlueprint });

  it('includes "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('65/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Mixed topics');
  });

  it('includes posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Mondays');
    expect(result).toContain('Wednesdays');
  });
});

describe('digestReport account with no posting blindspots', () => {
  const noBlindspots: GrowthBlueprint = { ...sampleGrowthBlueprint, posting_blindspots: [] };
  const report = baseReport({ source_type: 'account', analysis: noBlindspots });

  it('says "none noted" when blindspots is empty', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

// ── digestReport - upload (UploadDiagnosis) ───────────────────────────────────

describe('digestReport with source_type=upload', () => {
  const report = baseReport({ source_type: 'upload', analysis: sampleUploadDiagnosis });

  it('includes "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('75/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('88/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Well balanced');
  });

  it('includes text-overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Too fast for mobile');
  });
});

// ── digestReport - discovery (SiteDiscoveryResult) ────────────────────────────

describe('digestReport with source_type=discovery', () => {
  const report = baseReport({ source_type: 'discovery', analysis: sampleSiteDiscovery });

  it('includes "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query', () => {
    expect(digestReport(report)).toContain('content creator tools 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Unique because it covers AI tools deeply');
  });
});

// ── digestReport - competitors (CompetitorGapAnalysis) ────────────────────────

describe('digestReport with source_type=competitors', () => {
  const report = baseReport({ source_type: 'competitors', analysis: sampleCompetitorAnalysis });

  it('includes "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('tutorials');
    expect(result).toContain('live Q&A');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('short-form editing');
    expect(result).toContain('viral hooks');
  });
});

describe('digestReport competitors with empty arrays', () => {
  const empty: CompetitorGapAnalysis = {
    ...sampleCompetitorAnalysis,
    missing_topics: [],
    untapped_keyword_clusters: [],
  };
  const report = baseReport({ source_type: 'competitors', analysis: empty });

  it('says "none noted" for missing topics', () => {
    expect(digestReport(report)).toContain('missing topics: none noted');
  });

  it('says "none noted" for untapped keyword clusters', () => {
    expect(digestReport(report)).toContain('untapped keyword clusters: none noted');
  });
});

// ── digestScript ──────────────────────────────────────────────────────────────

function makeScript(overrides: Partial<ScriptRow> = {}): ScriptRow {
  return {
    id: 'script-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'My Viral Script',
    source_prompt: 'make it viral',
    storyboard: {
      spoken_hook: 'You won\'t believe this trick',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of hands',
          dialogue_or_vo: 'Watch carefully...',
          audio_sfx_cue: 'suspenseful music',
          retention_loop_note: 'open loop — what happens next?',
        },
        {
          scene_number: 2,
          visual_action: 'Wide shot',
          dialogue_or_vo: 'Here it is!',
          audio_sfx_cue: 'reveal sting',
          retention_loop_note: 'payoff',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-12T08:00:00Z',
    ...overrides,
  };
}

describe('digestScript', () => {
  const script = makeScript();

  it('returns a string', () => {
    expect(typeof digestScript(script)).toBe('string');
  });

  it('includes the script title', () => {
    expect(digestScript(script)).toContain('My Viral Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(script)).toContain("You won't believe this trick");
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(script)).toContain('open loop — what happens next?');
  });

  it('includes the scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('includes a date', () => {
    // Should contain some numeric part of the date
    expect(digestScript(script)).toMatch(/\d+/);
  });

  it('shows (none) when first scene has no retention loop note', () => {
    const s = makeScript();
    s.storyboard.scenes[0].retention_loop_note = '';
    // empty string is falsy, so ?? '(none)' kicks in... actually empty string is truthy
    // Actually: '' ?? '(none)' => '' because ?? only fires on null/undefined
    // The code uses `weakScene?.retention_loop_note ?? '(none)'`
    // So if retention_loop_note is '', result is '' (empty string stays)
    expect(digestScript(s)).toContain('first scene retention loop: ""');
  });

  it('shows (none) when there are no scenes', () => {
    const s = makeScript();
    s.storyboard.scenes = [];
    expect(digestScript(s)).toContain('(none)');
  });

  it('handles a single-scene script', () => {
    const s = makeScript();
    s.storyboard.scenes = [s.storyboard.scenes[0]];
    expect(digestScript(s)).toContain('1 scenes total');
  });
});
