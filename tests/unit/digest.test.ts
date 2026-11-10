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

// ── Shared fixtures ──────────────────────────────────────────────────────────

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-01-15T00:00:00.000Z',
};

const VIRAL_ANALYSIS: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 4, assessment: 'Fast cuts' },
  hook_evaluation: { score: 85, verdict: 'strong', notes: 'Grabs immediately' },
  retention_prediction: {
    at_3s_percent: 72,
    at_30s_percent: 45,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Add captions'],
  source_metrics: {},
};

const GROWTH_ANALYSIS: GrowthBlueprint = {
  thematic_consistency: { score: 70, notes: 'Mostly on-brand' },
  view_to_follower_ratio: { value: 1.5, assessment: 'Good' },
  posting_cadence: { avg_days_between_posts: 2, assessment: 'Consistent' },
  theme_correction: ['Stay in niche'],
  view_maximization_tactics: ['Use trending audio'],
  posting_blindspots: ['Weekends are underused', 'No morning posts'],
  per_platform_notes: {},
};

const UPLOAD_ANALYSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'Hook is mid' },
  audio_balance: { score: 75, notes: 'Music slightly loud' },
  text_overlay_pacing: { assessment: 'Text stays on too long' },
  b_roll_recommendations: ['Add more cuts'],
  retention_boosters: ['Pattern interrupt at 10s'],
  frames_analyzed: 120,
};

const COMPETITOR_ANALYSIS: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['Finance hacks'],
  missing_topics: ['Budgeting for beginners', 'Investing basics'],
  audience_sentiment_gaps: ['Users want more practical tips'],
  untapped_keyword_clusters: ['side hustle 2024', 'passive income tips'],
};

const DISCOVERY_ANALYSIS: SiteDiscoveryResult = {
  query: 'best finance blogs',
  sites: [],
  outlier: { url: 'https://oddsite.com', reasoning: 'Completely different angle' },
  summary: 'Mixed results',
};

// ── digestReport() ───────────────────────────────────────────────────────────

describe('digestReport() — url (ViralGapAnalysis)', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'url',
    analysis: VIRAL_ANALYSIS,
  };

  it('mentions "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('85/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Grabs immediately');
  });

  it('includes 3s retention', () => {
    expect(digestReport(report)).toContain('72%');
  });

  it('includes 30s retention', () => {
    expect(digestReport(report)).toContain('45%');
  });

  it('includes a formatted date', () => {
    // date is derived from created_at, exact format is locale-dependent
    expect(digestReport(report)).toMatch(/\d/);
  });
});

describe('digestReport() — account (GrowthBlueprint)', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'account',
    analysis: GROWTH_ANALYSIS,
  };

  it('mentions "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('70/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Mostly on-brand');
  });

  it('includes posting blindspots', () => {
    expect(digestReport(report)).toContain('Weekends are underused');
  });

  it('joins multiple blindspots with "; "', () => {
    expect(digestReport(report)).toContain('Weekends are underused; No morning posts');
  });

  it('shows "none noted" when no blindspots', () => {
    const noBlind: AuditReportRow = {
      ...report,
      analysis: { ...GROWTH_ANALYSIS, posting_blindspots: [] },
    };
    expect(digestReport(noBlind)).toContain('none noted');
  });
});

describe('digestReport() — upload (UploadDiagnosis)', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'upload',
    analysis: UPLOAD_ANALYSIS,
  };

  it('mentions "Upload Diagnostic"', () => {
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

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Music slightly loud');
  });

  it('includes text-overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Text stays on too long');
  });
});

describe('digestReport() — competitors (CompetitorGapAnalysis)', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'competitors',
    analysis: COMPETITOR_ANALYSIS,
  };

  it('mentions "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing_topics', () => {
    expect(digestReport(report)).toContain('Budgeting for beginners');
  });

  it('joins multiple missing_topics with "; "', () => {
    expect(digestReport(report)).toContain('Budgeting for beginners; Investing basics');
  });

  it('includes untapped_keyword_clusters', () => {
    expect(digestReport(report)).toContain('side hustle 2024');
  });

  it('shows "none noted" for empty missing_topics', () => {
    const r: AuditReportRow = { ...report, analysis: { ...COMPETITOR_ANALYSIS, missing_topics: [] } };
    expect(digestReport(r)).toContain('none noted');
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    const r: AuditReportRow = { ...report, analysis: { ...COMPETITOR_ANALYSIS, untapped_keyword_clusters: [] } };
    expect(digestReport(r)).toContain('none noted');
  });
});

describe('digestReport() — discovery (SiteDiscoveryResult)', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'discovery',
    analysis: DISCOVERY_ANALYSIS,
  };

  it('mentions "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query', () => {
    expect(digestReport(report)).toContain('best finance blogs');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://oddsite.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Completely different angle');
  });
});

// ── digestScript() ────────────────────────────────────────────────────────────

const SCRIPT_ROW: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'How to Go Viral',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'Stop scrolling right now.',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Zoom in on face',
        dialogue_or_vo: 'Stop scrolling.',
        audio_sfx_cue: '',
        retention_loop_note: 'The cliffhanger at the end keeps viewers watching.',
      },
      {
        scene_number: 2,
        visual_action: 'Cut to stats',
        dialogue_or_vo: '90% of creators fail.',
        audio_sfx_cue: '',
        retention_loop_note: '',
      },
    ],
    cta: 'Follow for more.',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-03-10T00:00:00.000Z',
};

describe('digestScript()', () => {
  it('includes the script title', () => {
    expect(digestScript(SCRIPT_ROW)).toContain('How to Go Viral');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(SCRIPT_ROW)).toContain('Stop scrolling right now.');
  });

  it('includes first scene retention_loop_note', () => {
    expect(digestScript(SCRIPT_ROW)).toContain('The cliffhanger at the end keeps viewers watching.');
  });

  it('includes scene count', () => {
    expect(digestScript(SCRIPT_ROW)).toContain('2 scenes total');
  });

  it('outputs an empty retention_loop_note as empty string (not "(none)")', () => {
    const noNote: ScriptRow = {
      ...SCRIPT_ROW,
      storyboard: {
        ...SCRIPT_ROW.storyboard,
        scenes: [
          { ...SCRIPT_ROW.storyboard.scenes[0], retention_loop_note: '' },
        ],
      },
    };
    // ?? only substitutes null/undefined, not empty string
    const result = digestScript(noNote);
    expect(result).toContain('first scene retention loop: ""');
    expect(result).not.toContain('(none)');
  });

  it('shows "(none)" when there are no scenes', () => {
    const noScenes: ScriptRow = {
      ...SCRIPT_ROW,
      storyboard: { ...SCRIPT_ROW.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('(none)');
  });

  it('includes a formatted date', () => {
    expect(digestScript(SCRIPT_ROW)).toMatch(/\d/);
  });
});
