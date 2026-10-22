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

// ── helpers ───────────────────────────────────────────────────────────────────

function makeReport<T>(
  overrides: Partial<AuditReportRow<T>> & { source_type: AuditReportRow['source_type']; analysis: T }
): AuditReportRow<T> {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: '2024-05-15T00:00:00.000Z',
    ...overrides,
  };
}

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 4, assessment: 'Fast' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Decent opener' },
  retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Add a pattern interrupt in the first 2s'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 88, notes: 'Strong niche focus' },
  view_to_follower_ratio: { value: 0.3, assessment: 'Healthy' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'Consistent' },
  theme_correction: [],
  view_maximization_tactics: ['Use trending audio'],
  posting_blindspots: ['Missing weekend posts', 'No Friday evening slot'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'Blurry first frame' },
  audio_balance: { score: 75, notes: 'Slight music overdrive' },
  text_overlay_pacing: { assessment: 'Text appears too fast' },
  b_roll_recommendations: ['Add a reaction shot'],
  retention_boosters: ['End with a cliffhanger'],
  frames_analyzed: 6,
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['AI tools'],
  missing_topics: ['Budget cooking', 'Home hacks'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['fast recipes', 'microwave meals'],
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'best productivity tools 2024',
  sites: [],
  outlier: { url: 'https://example.com', reasoning: 'Unique angle on async work' },
  summary: 'Top tools found',
};

// ── digestReport ──────────────────────────────────────────────────────────────

describe('digestReport – url (ViralGapAnalysis)', () => {
  const report = makeReport<ViralGapAnalysis>({ source_type: 'url', analysis: viralAnalysis });

  it('contains "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('72/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Decent opener');
  });

  it('includes 3s retention percentage', () => {
    expect(digestReport(report)).toContain('3s=65%');
  });

  it('includes 30s retention percentage', () => {
    expect(digestReport(report)).toContain('30s=42%');
  });

  it('includes the formatted date', () => {
    expect(digestReport(report)).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });
});

describe('digestReport – account (GrowthBlueprint)', () => {
  const report = makeReport<GrowthBlueprint>({ source_type: 'account', analysis: growthAnalysis });

  it('contains "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('88/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Strong niche focus');
  });

  it('lists posting blindspots separated by semicolons', () => {
    const out = digestReport(report);
    expect(out).toContain('Missing weekend posts');
    expect(out).toContain('No Friday evening slot');
  });
});

describe('digestReport – account with empty blindspots', () => {
  const report = makeReport<GrowthBlueprint>({
    source_type: 'account',
    analysis: { ...growthAnalysis, posting_blindspots: [] },
  });

  it('shows "none noted" when posting_blindspots is empty', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport – upload (UploadDiagnosis)', () => {
  const report = makeReport<UploadDiagnosis>({ source_type: 'upload', analysis: uploadAnalysis });

  it('contains "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('60/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('75/100');
  });

  it('includes audio notes', () => {
    expect(digestReport(report)).toContain('Slight music overdrive');
  });

  it('includes text overlay assessment', () => {
    expect(digestReport(report)).toContain('Text appears too fast');
  });
});

describe('digestReport – discovery (SiteDiscoveryResult)', () => {
  const report = makeReport<SiteDiscoveryResult>({
    source_type: 'discovery',
    analysis: discoveryAnalysis,
  });

  it('contains "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query string', () => {
    expect(digestReport(report)).toContain('best productivity tools 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Unique angle on async work');
  });
});

describe('digestReport – competitors (CompetitorGapAnalysis)', () => {
  const report = makeReport<CompetitorGapAnalysis>({
    source_type: 'competitors',
    analysis: competitorAnalysis,
  });

  it('contains "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('lists missing topics', () => {
    const out = digestReport(report);
    expect(out).toContain('Budget cooking');
    expect(out).toContain('Home hacks');
  });

  it('lists untapped keyword clusters', () => {
    const out = digestReport(report);
    expect(out).toContain('fast recipes');
    expect(out).toContain('microwave meals');
  });
});

describe('digestReport – competitors with empty arrays', () => {
  const report = makeReport<CompetitorGapAnalysis>({
    source_type: 'competitors',
    analysis: { ...competitorAnalysis, missing_topics: [], untapped_keyword_clusters: [] },
  });

  it('shows "none noted" for empty missing_topics', () => {
    expect(digestReport(report)).toMatch(/missing topics: none noted/);
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    expect(digestReport(report)).toMatch(/untapped keyword clusters: none noted/);
  });
});

// ── digestScript ──────────────────────────────────────────────────────────────

const scriptRow: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'Morning Routine Secrets',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'Wake up at 5am and watch your life change',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Alarm going off',
        dialogue_or_vo: 'It starts the moment you decide.',
        audio_sfx_cue: 'Alarm sound',
        retention_loop_note: 'Open loop: why does 5am matter?',
      },
      {
        scene_number: 2,
        visual_action: 'Cold shower montage',
        dialogue_or_vo: 'Step two: cold shower.',
        audio_sfx_cue: 'Water sounds',
        retention_loop_note: 'Payoff of waking early',
      },
    ],
    cta: 'Comment your wake-up time below!',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'youtube_shorts',
  created_at: '2024-09-12T12:00:00.000Z',
};

describe('digestScript', () => {
  it('includes the script title', () => {
    expect(digestScript(scriptRow)).toContain('Morning Routine Secrets');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(scriptRow)).toContain('Wake up at 5am and watch your life change');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(scriptRow)).toContain('Open loop: why does 5am matter?');
  });

  it('includes the scene count', () => {
    expect(digestScript(scriptRow)).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    expect(digestScript(scriptRow)).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });
});

describe('digestScript – single scene (edge case)', () => {
  const singleScene: ScriptRow = {
    ...scriptRow,
    storyboard: {
      ...scriptRow.storyboard,
      scenes: [scriptRow.storyboard.scenes[0]],
    },
  };

  it('reports 1 scene total', () => {
    expect(digestScript(singleScene)).toContain('1 scenes total');
  });
});

describe('digestScript – no scenes (edge case)', () => {
  const noScenes: ScriptRow = {
    ...scriptRow,
    storyboard: {
      ...scriptRow.storyboard,
      scenes: [],
    },
  };

  it('shows (none) when there are no scenes', () => {
    expect(digestScript(noScenes)).toContain('(none)');
  });

  it('reports 0 scenes total', () => {
    expect(digestScript(noScenes)).toContain('0 scenes total');
  });
});
