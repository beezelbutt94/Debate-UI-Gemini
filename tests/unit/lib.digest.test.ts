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

// ─── Shared fixture helpers ───────────────────────────────────────────────────

function baseReport(overrides: Partial<AuditReportRow>): AuditReportRow {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: '2024-01-15T00:00:00Z',
    analysis: {},
    ...overrides,
  } as AuditReportRow;
}

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
  hook_evaluation: { score: 78, verdict: 'strong', notes: 'Great open' },
  retention_prediction: { at_3s_percent: 72, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Add B-roll'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 65, notes: 'Mixed niches' },
  view_to_follower_ratio: { value: 1.4, assessment: 'average' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['Weekends are underutilised', 'No morning posts'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 55, verdict: 'moderate', notes: 'Hook needs work' },
  audio_balance: { score: 80, notes: 'Well balanced' },
  text_overlay_pacing: { assessment: 'Too slow' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 120,
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['Behind the scenes', 'Q&A formats'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['morning routine', 'productivity tips'],
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'best productivity tools 2024',
  sites: [],
  outlier: { url: 'https://example.com', reasoning: 'Unique angle on AI tools' },
  summary: 'Found 10 sites',
};

// ─── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport() – url (Viral Gap Analyzer)', () => {
  const report = baseReport({ source_type: 'url', analysis: viralAnalysis });

  it('contains "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('contains the hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('contains the hook score', () => {
    expect(digestReport(report)).toContain('78');
  });

  it('contains the hook notes', () => {
    expect(digestReport(report)).toContain('Great open');
  });

  it('contains the 3s retention percentage', () => {
    expect(digestReport(report)).toContain('72');
  });

  it('contains the 30s retention percentage', () => {
    expect(digestReport(report)).toContain('45');
  });

  it('contains a formatted date string', () => {
    expect(digestReport(report)).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });
});

describe('digestReport() – account (Growth Blueprint)', () => {
  const report = baseReport({ source_type: 'account', analysis: growthAnalysis });

  it('contains "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('contains the thematic consistency score', () => {
    expect(digestReport(report)).toContain('65');
  });

  it('contains the thematic notes', () => {
    expect(digestReport(report)).toContain('Mixed niches');
  });

  it('contains the first posting blindspot', () => {
    expect(digestReport(report)).toContain('Weekends are underutilised');
  });

  it('contains the second posting blindspot', () => {
    expect(digestReport(report)).toContain('No morning posts');
  });
});

describe('digestReport() – account with no posting blindspots', () => {
  const report = baseReport({
    source_type: 'account',
    analysis: { ...growthAnalysis, posting_blindspots: [] },
  });

  it('shows "none noted" when posting_blindspots is empty', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport() – upload (Upload Diagnostic)', () => {
  const report = baseReport({ source_type: 'upload', analysis: uploadAnalysis });

  it('contains "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('contains the visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('contains the visual hook score', () => {
    expect(digestReport(report)).toContain('55');
  });

  it('contains the audio balance score', () => {
    expect(digestReport(report)).toContain('80');
  });

  it('contains the audio notes', () => {
    expect(digestReport(report)).toContain('Well balanced');
  });

  it('contains the text overlay assessment', () => {
    expect(digestReport(report)).toContain('Too slow');
  });
});

describe('digestReport() – competitors (Competitor Espionage)', () => {
  const report = baseReport({ source_type: 'competitors', analysis: competitorAnalysis });

  it('contains "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('contains a missing topic', () => {
    expect(digestReport(report)).toContain('Behind the scenes');
  });

  it('contains an untapped keyword cluster', () => {
    expect(digestReport(report)).toContain('morning routine');
  });
});

describe('digestReport() – competitors with empty arrays', () => {
  const report = baseReport({
    source_type: 'competitors',
    analysis: { ...competitorAnalysis, missing_topics: [], untapped_keyword_clusters: [] },
  });

  it('shows "none noted" for missing topics', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport() – discovery (Site Discovery)', () => {
  const report = baseReport({ source_type: 'discovery', analysis: discoveryAnalysis });

  it('contains "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('contains the query string', () => {
    expect(digestReport(report)).toContain('best productivity tools 2024');
  });

  it('contains the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com');
  });

  it('contains the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Unique angle on AI tools');
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

function makeScript(overrides: Partial<ScriptRow> = {}): ScriptRow {
  return {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'Test Script',
    source_prompt: null,
    target_platform: 'tiktok',
    tone_parameters: {},
    created_at: '2024-03-10T12:00:00Z',
    storyboard: {
      spoken_hook: 'Stop scrolling — this will change your morning.',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Wide shot of kitchen',
          dialogue_or_vo: 'Here is what 90% of people get wrong.',
          audio_sfx_cue: 'upbeat bgm',
          retention_loop_note: 'Opens with a curiosity gap',
        },
        {
          scene_number: 2,
          visual_action: 'Close-up on coffee',
          dialogue_or_vo: 'Skip this step and your whole day suffers.',
          audio_sfx_cue: 'whoosh',
          retention_loop_note: 'Consequence amplifier',
        },
      ],
      cta: 'Follow for more tips.',
      memory_context_used: false,
    },
    ...overrides,
  };
}

describe('digestScript()', () => {
  it('contains the script title', () => {
    expect(digestScript(makeScript())).toContain('Test Script');
  });

  it('contains the spoken hook', () => {
    expect(digestScript(makeScript())).toContain('Stop scrolling — this will change your morning.');
  });

  it('contains the first scene retention loop note', () => {
    expect(digestScript(makeScript())).toContain('Opens with a curiosity gap');
  });

  it('contains the total scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });

  it('shows an empty string (not "(none)") when retention_loop_note is empty string', () => {
    const script = makeScript();
    script.storyboard.scenes[0].retention_loop_note = '';
    // '' is not nullish, so ?? '(none)' does NOT trigger — the output has ""
    expect(digestScript(script)).toContain('first scene retention loop: ""');
  });

  it('shows (none) when scenes array is empty', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    expect(digestScript(script)).toContain('(none)');
  });

  it('shows "0 scenes total" when scenes array is empty', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    expect(digestScript(script)).toContain('0 scenes total');
  });

  it('contains a formatted date string', () => {
    expect(digestScript(makeScript())).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });
});
