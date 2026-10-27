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

// ── fixtures ──────────────────────────────────────────────────────────────────

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: 'tiktok',
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-06-15T12:00:00.000Z',
};

const URL_ANALYSIS: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
  hook_evaluation: { score: 82, verdict: 'strong', notes: 'Opens with tension' },
  retention_prediction: { at_3s_percent: 71, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Add a text hook', 'Cut the intro'],
  source_metrics: {},
};

const ACCOUNT_ANALYSIS: GrowthBlueprint = {
  thematic_consistency: { score: 68, notes: 'Mix of topics dilutes brand' },
  view_to_follower_ratio: { value: 12.5, assessment: 'above average' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
  theme_correction: ['Narrow to finance niche'],
  view_maximization_tactics: ['Post at 7pm', 'Add captions'],
  posting_blindspots: ['Weekend mornings', 'Tuesday evenings'],
  per_platform_notes: {},
};

const ACCOUNT_ANALYSIS_NO_BLINDSPOTS: GrowthBlueprint = {
  ...ACCOUNT_ANALYSIS,
  posting_blindspots: [],
};

const UPLOAD_ANALYSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 74, verdict: 'moderate', notes: 'Face not visible in first frame' },
  audio_balance: { score: 60, notes: 'Music overpowers speech' },
  text_overlay_pacing: { assessment: 'Too fast to read' },
  b_roll_recommendations: ['Use close-up shots'],
  retention_boosters: ['Add pattern interrupt at 5s'],
  frames_analyzed: 120,
};

const DISCOVERY_ANALYSIS: SiteDiscoveryResult = {
  query: 'TikTok growth hacks 2024',
  sites: [
    { url: 'https://outlier.io', domain: 'outlier.io', title: 'Outlier', snippet: 'growth', relevance_reason: 'top result' },
  ],
  outlier: { url: 'https://outlier.io', reasoning: 'Only site with data-driven methodology' },
  summary: 'Found 1 site',
};

const COMPETITOR_ANALYSIS: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['productivity hacks'],
  missing_topics: ['morning routines', 'study tips'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['deep work', 'Pomodoro technique'],
};

const COMPETITOR_ANALYSIS_EMPTY: CompetitorGapAnalysis = {
  ...COMPETITOR_ANALYSIS,
  missing_topics: [],
  untapped_keyword_clusters: [],
};

// ── digestReport ──────────────────────────────────────────────────────────────

describe('digestReport – url source type', () => {
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: URL_ANALYSIS };

  it('includes "Viral Gap Analyzer" label', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes formatted date', () => {
    // created_at = 2024-06-15; toLocaleDateString() format varies by locale
    const output = digestReport(report);
    expect(output).toMatch(/2024/);
  });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('82');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Opens with tension');
  });

  it('includes 3s retention percent', () => {
    expect(digestReport(report)).toContain('71');
  });

  it('includes 30s retention percent', () => {
    expect(digestReport(report)).toContain('45');
  });

  it('returns a non-empty string', () => {
    expect(digestReport(report).length).toBeGreaterThan(20);
  });
});

describe('digestReport – account source type', () => {
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: ACCOUNT_ANALYSIS };

  it('includes "Account Deep-Dive" label', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('68');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Mix of topics dilutes brand');
  });

  it('includes posting blindspots', () => {
    const out = digestReport(report);
    expect(out).toContain('Weekend mornings');
    expect(out).toContain('Tuesday evenings');
  });

  it('shows "none noted" when posting_blindspots is empty', () => {
    const empty: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: ACCOUNT_ANALYSIS_NO_BLINDSPOTS };
    expect(digestReport(empty)).toContain('none noted');
  });
});

describe('digestReport – upload source type', () => {
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis: UPLOAD_ANALYSIS };

  it('includes "Upload Diagnostic" label', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('74');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('60');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Music overpowers speech');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Too fast to read');
  });
});

describe('digestReport – discovery source type', () => {
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'discovery', analysis: DISCOVERY_ANALYSIS };

  it('includes "Site Discovery" label', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes query', () => {
    expect(digestReport(report)).toContain('TikTok growth hacks 2024');
  });

  it('includes outlier URL', () => {
    expect(digestReport(report)).toContain('https://outlier.io');
  });

  it('includes outlier reasoning', () => {
    expect(digestReport(report)).toContain('Only site with data-driven methodology');
  });
});

describe('digestReport – competitors source type (fallthrough)', () => {
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: COMPETITOR_ANALYSIS };

  it('includes "Competitor Espionage" label', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const out = digestReport(report);
    expect(out).toContain('morning routines');
    expect(out).toContain('study tips');
  });

  it('includes untapped keyword clusters', () => {
    const out = digestReport(report);
    expect(out).toContain('deep work');
    expect(out).toContain('Pomodoro technique');
  });

  it('shows "none noted" for empty missing_topics', () => {
    const empty: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: COMPETITOR_ANALYSIS_EMPTY };
    expect(digestReport(empty)).toContain('none noted');
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    const empty: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: COMPETITOR_ANALYSIS_EMPTY };
    expect(digestReport(empty)).toContain('none noted');
  });
});

// ── digestScript ──────────────────────────────────────────────────────────────

const SCRIPT: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'My Viral Hook Script',
  source_prompt: null,
  target_platform: 'tiktok',
  tone_parameters: {},
  created_at: '2024-09-12T08:00:00.000Z',
  storyboard: {
    spoken_hook: 'Stop scrolling — this changes everything.',
    memory_context_used: false,
    cta: 'Follow for more.',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Close-up face',
        dialogue_or_vo: 'Stop scrolling — this changes everything.',
        audio_sfx_cue: 'none',
        retention_loop_note: 'Creates curiosity gap in first 2 seconds',
      },
      {
        scene_number: 2,
        visual_action: 'B-roll product shot',
        dialogue_or_vo: 'Here is why...',
        audio_sfx_cue: 'whoosh',
        retention_loop_note: 'Visual reveal to maintain watch time',
      },
    ],
  },
};

const SCRIPT_NO_SCENES: ScriptRow = {
  ...SCRIPT,
  storyboard: { ...SCRIPT.storyboard, scenes: [] },
};

describe('digestScript', () => {
  it('includes script title', () => {
    expect(digestScript(SCRIPT)).toContain('My Viral Hook Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(SCRIPT)).toContain('Stop scrolling — this changes everything.');
  });

  it('includes first scene retention loop note', () => {
    expect(digestScript(SCRIPT)).toContain('Creates curiosity gap in first 2 seconds');
  });

  it('includes total scene count', () => {
    expect(digestScript(SCRIPT)).toContain('2');
  });

  it('includes year from created_at', () => {
    expect(digestScript(SCRIPT)).toMatch(/2024/);
  });

  it('returns a non-empty string', () => {
    expect(digestScript(SCRIPT).length).toBeGreaterThan(20);
  });

  it('handles empty scenes array gracefully (shows "(none)")', () => {
    const out = digestScript(SCRIPT_NO_SCENES);
    expect(out).toContain('(none)');
  });

  it('scene count is 0 for no-scenes script', () => {
    expect(digestScript(SCRIPT_NO_SCENES)).toContain('0 scenes total');
  });
});
