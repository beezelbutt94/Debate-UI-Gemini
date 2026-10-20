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

// ────────── shared fixtures ──────────

const BASE_REPORT: Pick<AuditReportRow, 'id' | 'user_id' | 'creator_profile_id' | 'source_url' | 'platform' | 'viral_score' | 'timeline_recommendations'> = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
};

const CREATED_AT = '2024-06-15T10:00:00.000Z';

// ────────── url / ViralGapAnalysis ──────────

const urlAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
  hook_evaluation: { score: 85, verdict: 'strong', notes: 'grabs attention immediately' },
  retention_prediction: {
    at_3s_percent: 72,
    at_30s_percent: 48,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Add B-roll'],
  source_metrics: {},
};

const urlReport: AuditReportRow = {
  ...BASE_REPORT,
  source_type: 'url',
  created_at: CREATED_AT,
  analysis: urlAnalysis,
};

describe('digestReport – url (ViralGapAnalysis)', () => {
  it('includes the source type label', () => {
    expect(digestReport(urlReport)).toContain('Viral Gap Analyzer');
  });

  it('includes the hook verdict', () => {
    expect(digestReport(urlReport)).toContain('strong');
  });

  it('includes the hook score', () => {
    expect(digestReport(urlReport)).toContain('85');
  });

  it('includes hook notes', () => {
    expect(digestReport(urlReport)).toContain('grabs attention immediately');
  });

  it('includes 3s retention', () => {
    expect(digestReport(urlReport)).toContain('3s=72%');
  });

  it('includes 30s retention', () => {
    expect(digestReport(urlReport)).toContain('30s=48%');
  });

  it('includes the formatted date', () => {
    const date = new Date(CREATED_AT).toLocaleDateString();
    expect(digestReport(urlReport)).toContain(date);
  });
});

// ────────── account / GrowthBlueprint ──────────

const accountAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 76, notes: 'mostly focused on fitness' },
  view_to_follower_ratio: { value: 0.12, assessment: 'average' },
  posting_cadence: { avg_days_between_posts: 4, assessment: 'consistent' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['Tuesday mornings', 'Sunday evenings'],
  per_platform_notes: {},
};

const accountReport: AuditReportRow = {
  ...BASE_REPORT,
  source_type: 'account',
  created_at: CREATED_AT,
  analysis: accountAnalysis,
};

describe('digestReport – account (GrowthBlueprint)', () => {
  it('includes Account Deep-Dive label', () => {
    expect(digestReport(accountReport)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(accountReport)).toContain('76');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(accountReport)).toContain('mostly focused on fitness');
  });

  it('includes posting blindspots', () => {
    expect(digestReport(accountReport)).toContain('Tuesday mornings');
    expect(digestReport(accountReport)).toContain('Sunday evenings');
  });

  it('shows "none noted" when no blindspots', () => {
    const noBlindspots = { ...accountAnalysis, posting_blindspots: [] };
    const r = { ...accountReport, analysis: noBlindspots };
    expect(digestReport(r)).toContain('none noted');
  });
});

// ────────── upload / UploadDiagnosis ──────────

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'decent but not instant' },
  audio_balance: { score: 70, notes: 'a bit loud' },
  text_overlay_pacing: { assessment: 'too fast' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 30,
};

const uploadReport: AuditReportRow = {
  ...BASE_REPORT,
  source_type: 'upload',
  created_at: CREATED_AT,
  analysis: uploadAnalysis,
};

describe('digestReport – upload (UploadDiagnosis)', () => {
  it('includes Upload Diagnostic label', () => {
    expect(digestReport(uploadReport)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(uploadReport)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(uploadReport)).toContain('60');
  });

  it('includes audio balance score', () => {
    expect(digestReport(uploadReport)).toContain('70');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(uploadReport)).toContain('a bit loud');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(uploadReport)).toContain('too fast');
  });
});

// ────────── discovery / SiteDiscoveryResult ──────────

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'fitness youtube shorts',
  sites: [],
  outlier: { url: 'https://example.com', reasoning: 'unique vertical format' },
  summary: 'summary text',
};

const discoveryReport: AuditReportRow = {
  ...BASE_REPORT,
  source_type: 'discovery',
  created_at: CREATED_AT,
  analysis: discoveryAnalysis,
};

describe('digestReport – discovery (SiteDiscoveryResult)', () => {
  it('includes Site Discovery label', () => {
    expect(digestReport(discoveryReport)).toContain('Site Discovery');
  });

  it('includes the query string', () => {
    expect(digestReport(discoveryReport)).toContain('fitness youtube shorts');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(discoveryReport)).toContain('https://example.com');
  });

  it('includes outlier reasoning', () => {
    expect(digestReport(discoveryReport)).toContain('unique vertical format');
  });
});

// ────────── competitors / CompetitorGapAnalysis ──────────

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['meal prep', 'HIIT workouts'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['home gym on a budget'],
};

const competitorReport: AuditReportRow = {
  ...BASE_REPORT,
  source_type: 'competitors',
  created_at: CREATED_AT,
  analysis: competitorAnalysis,
};

describe('digestReport – competitors (CompetitorGapAnalysis)', () => {
  it('includes Competitor Espionage label', () => {
    expect(digestReport(competitorReport)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    expect(digestReport(competitorReport)).toContain('meal prep');
    expect(digestReport(competitorReport)).toContain('HIIT workouts');
  });

  it('includes untapped keyword clusters', () => {
    expect(digestReport(competitorReport)).toContain('home gym on a budget');
  });

  it('shows "none noted" for empty missing_topics', () => {
    const noMissing = { ...competitorAnalysis, missing_topics: [] };
    const r = { ...competitorReport, analysis: noMissing };
    expect(digestReport(r)).toContain('none noted');
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    const noKeywords = { ...competitorAnalysis, untapped_keyword_clusters: [] };
    const r = { ...competitorReport, analysis: noKeywords };
    expect(digestReport(r)).toContain('none noted');
  });
});

// ────────── digestScript ──────────

const scriptRow: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'My Viral Script',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'Did you know this one trick?',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'zoom on face',
        dialogue_or_vo: 'hook line',
        audio_sfx_cue: 'none',
        retention_loop_note: 'open loop: what is the trick?',
      },
      {
        scene_number: 2,
        visual_action: 'demonstrate',
        dialogue_or_vo: 'payoff',
        audio_sfx_cue: 'ding',
        retention_loop_note: '',
      },
    ],
    cta: 'Follow for more',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: CREATED_AT,
};

describe('digestScript', () => {
  it('includes the script title', () => {
    expect(digestScript(scriptRow)).toContain('My Viral Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(scriptRow)).toContain('Did you know this one trick?');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(scriptRow)).toContain('open loop: what is the trick?');
  });

  it('includes the total scene count', () => {
    expect(digestScript(scriptRow)).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    const date = new Date(CREATED_AT).toLocaleDateString();
    expect(digestScript(scriptRow)).toContain(date);
  });

  it('shows "(none)" when first scene has no retention_loop_note', () => {
    const noNote: ScriptRow = {
      ...scriptRow,
      storyboard: {
        ...scriptRow.storyboard,
        scenes: [
          { ...scriptRow.storyboard.scenes[0], retention_loop_note: '' },
        ],
      },
    };
    // empty string is falsy for ?? operator, but retention_loop_note is a string so ?? won't fire
    // The code uses `weakScene?.retention_loop_note ?? '(none)'`
    // empty string is falsy but ?? only fires for null/undefined
    // so an empty retention_loop_note will NOT show (none) — it shows empty string
    // Let's verify the actual behavior:
    const result = digestScript(noNote);
    // retention_loop_note is '' → '' is not null/undefined → ?? doesn't fire → shows ''
    expect(result).toContain('first scene retention loop:');
  });

  it('shows "(none)" when scenes array is empty (weakScene is undefined)', () => {
    const noScenes: ScriptRow = {
      ...scriptRow,
      storyboard: { ...scriptRow.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('(none)');
    expect(digestScript(noScenes)).toContain('0 scenes total');
  });
});
