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
  Storyboard,
} from '@/lib/types';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeUrlReport(overrides: Partial<AuditReportRow> = {}): AuditReportRow<ViralGapAnalysis> {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'Fast paced' },
    hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Hook could be stronger' },
    retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
    action_plan: ['Add B-roll', 'Shorten intro'],
    source_metrics: {},
  };
  return {
    id: 'report-1',
    user_id: 'user-1',
    creator_profile_id: null,
    source_type: 'url',
    source_url: 'https://www.tiktok.com/@user/video/123',
    platform: 'tiktok',
    viral_score: 72,
    analysis,
    timeline_recommendations: [],
    created_at: '2024-06-15T10:00:00Z',
    ...overrides,
  };
}

function makeAccountReport(overrides: Partial<AuditReportRow> = {}): AuditReportRow<GrowthBlueprint> {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 80, notes: 'Mostly consistent niche' },
    view_to_follower_ratio: { value: 0.5, assessment: 'Average' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'Regular' },
    theme_correction: [],
    view_maximization_tactics: ['Post at peak hours'],
    posting_blindspots: ['Weekend evenings', 'Monday mornings'],
    per_platform_notes: {},
  };
  return {
    id: 'report-2',
    user_id: 'user-1',
    creator_profile_id: null,
    source_type: 'account',
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at: '2024-07-20T08:00:00Z',
    ...overrides,
  };
}

function makeUploadReport(overrides: Partial<AuditReportRow> = {}): AuditReportRow<UploadDiagnosis> {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 85, verdict: 'strong', notes: 'Clear and compelling' },
    audio_balance: { score: 78, notes: 'Good levels, minor background noise' },
    text_overlay_pacing: { assessment: 'Overlays appear at ideal moments' },
    b_roll_recommendations: ['Add city shots'],
    retention_boosters: ['Use pattern interrupt at 15s'],
    frames_analyzed: 300,
  };
  return {
    id: 'report-3',
    user_id: 'user-1',
    creator_profile_id: null,
    source_type: 'upload',
    source_url: null,
    platform: 'youtube_shorts',
    viral_score: 85,
    analysis,
    timeline_recommendations: [],
    created_at: '2024-08-01T12:00:00Z',
    ...overrides,
  };
}

function makeCompetitorReport(overrides: Partial<AuditReportRow> = {}): AuditReportRow<CompetitorGapAnalysis> {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: ['trending challenge'],
    missing_topics: ['behind-the-scenes', 'Q&A format'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['morning routine hacks', 'budget travel tips'],
  };
  return {
    id: 'report-4',
    user_id: 'user-1',
    creator_profile_id: null,
    source_type: 'competitors',
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at: '2024-09-10T09:00:00Z',
    ...overrides,
  };
}

function makeDiscoveryReport(overrides: Partial<AuditReportRow> = {}): AuditReportRow<SiteDiscoveryResult> {
  const analysis: SiteDiscoveryResult = {
    query: 'best travel gear 2024',
    sites: [],
    outlier: { url: 'https://example.com', reasoning: 'Far more user-generated content than peers' },
    summary: 'Top travel gear sites found.',
  };
  return {
    id: 'report-5',
    user_id: 'user-1',
    creator_profile_id: null,
    source_type: 'discovery',
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at: '2024-10-05T15:00:00Z',
    ...overrides,
  };
}

function makeScript(overrides: Partial<ScriptRow> = {}): ScriptRow {
  const storyboard: Storyboard = {
    spoken_hook: 'This one trick changed everything for me.',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Creator looks directly into camera',
        dialogue_or_vo: 'This one trick changed everything for me.',
        audio_sfx_cue: 'dramatic sting',
        retention_loop_note: 'Open loop: what is the trick?',
      },
      {
        scene_number: 2,
        visual_action: 'B-roll of product',
        dialogue_or_vo: 'Here it is...',
        audio_sfx_cue: 'upbeat music',
        retention_loop_note: 'Close loop + new open loop: does it work?',
      },
    ],
    cta: 'Follow for more tips!',
    memory_context_used: false,
  };
  return {
    id: 'script-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'My Viral Hook Script',
    source_prompt: null,
    storyboard,
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-25T11:00:00Z',
    ...overrides,
  };
}

// ── digestReport ──────────────────────────────────────────────────────────────

describe('digestReport – url (ViralGapAnalysis)', () => {
  it('returns a string', () => {
    expect(typeof digestReport(makeUrlReport())).toBe('string');
  });

  it('includes "Viral Gap Analyzer" prefix', () => {
    expect(digestReport(makeUrlReport())).toContain('Viral Gap Analyzer');
  });

  it('includes the hook verdict', () => {
    expect(digestReport(makeUrlReport())).toContain('moderate');
  });

  it('includes the hook score', () => {
    expect(digestReport(makeUrlReport())).toContain('72');
  });

  it('includes the hook notes', () => {
    expect(digestReport(makeUrlReport())).toContain('Hook could be stronger');
  });

  it('includes 3s retention percent', () => {
    expect(digestReport(makeUrlReport())).toContain('65%');
  });

  it('includes 30s retention percent', () => {
    expect(digestReport(makeUrlReport())).toContain('42%');
  });

  it('includes the formatted date derived from created_at', () => {
    const result = digestReport(makeUrlReport({ created_at: '2024-06-15T10:00:00Z' }));
    // toLocaleDateString() varies by locale; just verify it's a non-empty, date-like string
    expect(result).toMatch(/\d/);
  });

  it('handles strong hook verdict', () => {
    const report = makeUrlReport();
    (report.analysis as ViralGapAnalysis).hook_evaluation.verdict = 'strong';
    (report.analysis as ViralGapAnalysis).hook_evaluation.score = 95;
    expect(digestReport(report)).toContain('strong');
    expect(digestReport(report)).toContain('95');
  });

  it('handles weak hook verdict', () => {
    const report = makeUrlReport();
    (report.analysis as ViralGapAnalysis).hook_evaluation.verdict = 'weak';
    (report.analysis as ViralGapAnalysis).hook_evaluation.score = 30;
    expect(digestReport(report)).toContain('weak');
    expect(digestReport(report)).toContain('30');
  });

  it('includes 3s=0% and 30s=0% when retention is zero', () => {
    const report = makeUrlReport();
    (report.analysis as ViralGapAnalysis).retention_prediction.at_3s_percent = 0;
    (report.analysis as ViralGapAnalysis).retention_prediction.at_30s_percent = 0;
    const result = digestReport(report);
    expect(result).toContain('3s=0%');
    expect(result).toContain('30s=0%');
  });
});

describe('digestReport – account (GrowthBlueprint)', () => {
  it('returns a string', () => {
    expect(typeof digestReport(makeAccountReport())).toBe('string');
  });

  it('includes "Account Deep-Dive" prefix', () => {
    expect(digestReport(makeAccountReport())).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(makeAccountReport())).toContain('80');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(makeAccountReport())).toContain('Mostly consistent niche');
  });

  it('includes posting blindspots joined by semicolons', () => {
    const result = digestReport(makeAccountReport());
    expect(result).toContain('Weekend evenings');
    expect(result).toContain('Monday mornings');
  });

  it('shows "none noted" when posting_blindspots is empty', () => {
    const report = makeAccountReport();
    (report.analysis as GrowthBlueprint).posting_blindspots = [];
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport – upload (UploadDiagnosis)', () => {
  it('returns a string', () => {
    expect(typeof digestReport(makeUploadReport())).toBe('string');
  });

  it('includes "Upload Diagnostic" prefix', () => {
    expect(digestReport(makeUploadReport())).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(makeUploadReport())).toContain('strong');
  });

  it('includes visual hook score', () => {
    expect(digestReport(makeUploadReport())).toContain('85');
  });

  it('includes audio balance score', () => {
    expect(digestReport(makeUploadReport())).toContain('78');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(makeUploadReport())).toContain('Good levels, minor background noise');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(makeUploadReport())).toContain('Overlays appear at ideal moments');
  });
});

describe('digestReport – competitors (CompetitorGapAnalysis)', () => {
  it('returns a string', () => {
    expect(typeof digestReport(makeCompetitorReport())).toBe('string');
  });

  it('includes "Competitor Espionage" prefix', () => {
    expect(digestReport(makeCompetitorReport())).toContain('Competitor Espionage');
  });

  it('includes missing topics joined by semicolons', () => {
    const result = digestReport(makeCompetitorReport());
    expect(result).toContain('behind-the-scenes');
    expect(result).toContain('Q&A format');
  });

  it('shows "none noted" when missing_topics is empty', () => {
    const report = makeCompetitorReport();
    (report.analysis as CompetitorGapAnalysis).missing_topics = [];
    expect(digestReport(report)).toContain('none noted');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(makeCompetitorReport());
    expect(result).toContain('morning routine hacks');
    expect(result).toContain('budget travel tips');
  });

  it('shows "none noted" for untapped keyword clusters when empty', () => {
    const report = makeCompetitorReport();
    (report.analysis as CompetitorGapAnalysis).untapped_keyword_clusters = [];
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport – discovery (SiteDiscoveryResult)', () => {
  it('returns a string', () => {
    expect(typeof digestReport(makeDiscoveryReport())).toBe('string');
  });

  it('includes "Site Discovery" prefix', () => {
    expect(digestReport(makeDiscoveryReport())).toContain('Site Discovery');
  });

  it('includes the query', () => {
    expect(digestReport(makeDiscoveryReport())).toContain('best travel gear 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(makeDiscoveryReport())).toContain('https://example.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(makeDiscoveryReport())).toContain('Far more user-generated content than peers');
  });
});

// ── digestScript ──────────────────────────────────────────────────────────────

describe('digestScript', () => {
  it('returns a string', () => {
    expect(typeof digestScript(makeScript())).toBe('string');
  });

  it('includes the script title', () => {
    expect(digestScript(makeScript())).toContain('My Viral Hook Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(makeScript())).toContain('This one trick changed everything for me.');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(makeScript())).toContain('Open loop: what is the trick?');
  });

  it('includes the total scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });

  it('handles script with no scenes gracefully (retention note falls back to "(none)")', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    const result = digestScript(script);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('handles script with a single scene', () => {
    const script = makeScript();
    script.storyboard.scenes = [script.storyboard.scenes[0]!];
    const result = digestScript(script);
    expect(result).toContain('1 scenes total');
  });

  it('uses the first scene retention loop note even when there are many scenes', () => {
    const script = makeScript();
    script.storyboard.scenes = [
      { ...script.storyboard.scenes[0]!, retention_loop_note: 'First scene loop' },
      { ...script.storyboard.scenes[1]!, retention_loop_note: 'Second scene loop' },
      { scene_number: 3, visual_action: 'c', dialogue_or_vo: 'd', audio_sfx_cue: 'e', retention_loop_note: 'Third scene loop' },
    ];
    const result = digestScript(script);
    expect(result).toContain('First scene loop');
    expect(result).not.toContain('Second scene loop');
  });

  it('includes the title even when it is a long string', () => {
    const longTitle = 'A'.repeat(200);
    const script = makeScript({ title: longTitle });
    expect(digestScript(script)).toContain(longTitle);
  });

  it('includes the spoken hook verbatim', () => {
    const script = makeScript();
    script.storyboard.spoken_hook = 'Are you making this HUGE mistake?';
    expect(digestScript(script)).toContain('Are you making this HUGE mistake?');
  });
});
