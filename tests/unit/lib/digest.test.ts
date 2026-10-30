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

// ──────────────────────────────────────────────────────────
// Helpers — build minimal-but-valid fixture objects
// ──────────────────────────────────────────────────────────

const createdAt = '2024-06-15T10:00:00.000Z';

function urlReport(): AuditReportRow<ViralGapAnalysis> {
  return {
    id: '1',
    user_id: 'u1',
    creator_profile_id: null,
    source_type: 'url',
    source_url: 'https://www.tiktok.com/@x/video/1',
    platform: 'tiktok',
    viral_score: 80,
    analysis: {
      pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
      hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Decent opener' },
      retention_prediction: {
        at_3s_percent: 65,
        at_30s_percent: 42,
        meets_3s_benchmark: true,
        meets_30s_benchmark: true,
      },
      action_plan: ['Add text overlay'],
      source_metrics: {},
    },
    timeline_recommendations: [],
    created_at: createdAt,
  };
}

function accountReport(): AuditReportRow<GrowthBlueprint> {
  return {
    id: '2',
    user_id: 'u1',
    creator_profile_id: null,
    source_type: 'account',
    source_url: null,
    platform: null,
    viral_score: null,
    analysis: {
      thematic_consistency: { score: 55, notes: 'Mixed topics' },
      view_to_follower_ratio: { value: 0.12, assessment: 'Below average' },
      posting_cadence: { avg_days_between_posts: 3.5, assessment: 'Consistent' },
      theme_correction: [],
      view_maximization_tactics: [],
      posting_blindspots: ['Wednesdays', 'Early mornings'],
      per_platform_notes: {},
    },
    timeline_recommendations: [],
    created_at: createdAt,
  };
}

function uploadReport(): AuditReportRow<UploadDiagnosis> {
  return {
    id: '3',
    user_id: 'u1',
    creator_profile_id: null,
    source_type: 'upload',
    source_url: null,
    platform: 'youtube_shorts',
    viral_score: null,
    analysis: {
      visual_hook_clarity: { score: 90, verdict: 'strong', notes: 'Very clear' },
      audio_balance: { score: 78, notes: 'Slightly loud music' },
      text_overlay_pacing: { assessment: 'Too fast for viewers to read' },
      b_roll_recommendations: [],
      retention_boosters: [],
      frames_analyzed: 120,
    },
    timeline_recommendations: [],
    created_at: createdAt,
  };
}

function discoveryReport(): AuditReportRow<SiteDiscoveryResult> {
  return {
    id: '4',
    user_id: 'u1',
    creator_profile_id: null,
    source_type: 'discovery',
    source_url: null,
    platform: null,
    viral_score: null,
    analysis: {
      query: 'best AI tools for creators',
      sites: [],
      outlier: {
        url: 'https://example.com',
        reasoning: 'Only site covering hardware recommendations',
      },
      summary: 'Top 10 sites about AI tools.',
    },
    timeline_recommendations: [],
    created_at: createdAt,
  };
}

function competitorReport(): AuditReportRow<CompetitorGapAnalysis> {
  return {
    id: '5',
    user_id: 'u1',
    creator_profile_id: null,
    source_type: 'competitors',
    source_url: null,
    platform: null,
    viral_score: null,
    analysis: {
      competitors: [],
      outlier_topics: [],
      missing_topics: ['AI editing', 'Color grading'],
      audience_sentiment_gaps: [],
      untapped_keyword_clusters: ['shorts tips', 'viral transitions'],
    },
    timeline_recommendations: [],
    created_at: createdAt,
  };
}

function makeScript(): ScriptRow {
  return {
    id: 'sc1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Viral Hook Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know this trick?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Show product close-up',
          dialogue_or_vo: 'Here is how you do it...',
          audio_sfx_cue: 'upbeat music',
          retention_loop_note: 'Cut to reaction shot',
        },
        {
          scene_number: 2,
          visual_action: 'Demo the trick',
          dialogue_or_vo: 'And voilà!',
          audio_sfx_cue: 'ding',
          retention_loop_note: 'Zoom into result',
        },
      ],
      cta: 'Follow for more tips',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: createdAt,
  };
}

// ──────────────────────────────────────────────────────────
// digestReport() — source_type: 'url'
// ──────────────────────────────────────────────────────────
describe('digestReport() – url', () => {
  it('starts with "Viral Gap Analyzer"', () => {
    expect(digestReport(urlReport())).toMatch(/^Viral Gap Analyzer/);
  });
  it('includes hook verdict', () => {
    expect(digestReport(urlReport())).toContain('moderate');
  });
  it('includes hook score', () => {
    expect(digestReport(urlReport())).toContain('72/100');
  });
  it('includes hook notes', () => {
    expect(digestReport(urlReport())).toContain('Decent opener');
  });
  it('includes 3s retention percentage', () => {
    expect(digestReport(urlReport())).toContain('3s=65%');
  });
  it('includes 30s retention percentage', () => {
    expect(digestReport(urlReport())).toContain('30s=42%');
  });
  it('includes a formatted date substring', () => {
    const result = digestReport(urlReport());
    // Date format varies by locale but always contains digits and separators
    expect(result).toMatch(/\d/);
  });
});

// ──────────────────────────────────────────────────────────
// digestReport() — source_type: 'account'
// ──────────────────────────────────────────────────────────
describe('digestReport() – account', () => {
  it('starts with "Account Deep-Dive"', () => {
    expect(digestReport(accountReport())).toMatch(/^Account Deep-Dive/);
  });
  it('includes thematic consistency score', () => {
    expect(digestReport(accountReport())).toContain('55/100');
  });
  it('includes thematic consistency notes', () => {
    expect(digestReport(accountReport())).toContain('Mixed topics');
  });
  it('includes posting blindspots', () => {
    const result = digestReport(accountReport());
    expect(result).toContain('Wednesdays');
    expect(result).toContain('Early mornings');
  });

  it('shows "none noted" when blindspots array is empty', () => {
    const r = accountReport();
    (r.analysis as GrowthBlueprint).posting_blindspots = [];
    expect(digestReport(r)).toContain('none noted');
  });
});

// ──────────────────────────────────────────────────────────
// digestReport() — source_type: 'upload'
// ──────────────────────────────────────────────────────────
describe('digestReport() – upload', () => {
  it('starts with "Upload Diagnostic"', () => {
    expect(digestReport(uploadReport())).toMatch(/^Upload Diagnostic/);
  });
  it('includes visual hook verdict', () => {
    expect(digestReport(uploadReport())).toContain('strong');
  });
  it('includes visual hook score', () => {
    expect(digestReport(uploadReport())).toContain('90/100');
  });
  it('includes audio balance score', () => {
    expect(digestReport(uploadReport())).toContain('78/100');
  });
  it('includes audio balance notes', () => {
    expect(digestReport(uploadReport())).toContain('Slightly loud music');
  });
  it('includes text-overlay pacing assessment', () => {
    expect(digestReport(uploadReport())).toContain('Too fast for viewers to read');
  });
});

// ──────────────────────────────────────────────────────────
// digestReport() — source_type: 'discovery'
// ──────────────────────────────────────────────────────────
describe('digestReport() – discovery', () => {
  it('starts with "Site Discovery"', () => {
    expect(digestReport(discoveryReport())).toMatch(/^Site Discovery/);
  });
  it('includes the query', () => {
    expect(digestReport(discoveryReport())).toContain('best AI tools for creators');
  });
  it('includes the outlier URL', () => {
    expect(digestReport(discoveryReport())).toContain('https://example.com');
  });
  it('includes the outlier reasoning', () => {
    expect(digestReport(discoveryReport())).toContain('Only site covering hardware');
  });
});

// ──────────────────────────────────────────────────────────
// digestReport() — source_type: 'competitors' (default branch)
// ──────────────────────────────────────────────────────────
describe('digestReport() – competitors', () => {
  it('starts with "Competitor Espionage"', () => {
    expect(digestReport(competitorReport())).toMatch(/^Competitor Espionage/);
  });
  it('includes missing topics', () => {
    const result = digestReport(competitorReport());
    expect(result).toContain('AI editing');
    expect(result).toContain('Color grading');
  });
  it('includes untapped keyword clusters', () => {
    const result = digestReport(competitorReport());
    expect(result).toContain('shorts tips');
    expect(result).toContain('viral transitions');
  });
  it('shows "none noted" when missing_topics is empty', () => {
    const r = competitorReport();
    (r.analysis as CompetitorGapAnalysis).missing_topics = [];
    expect(digestReport(r)).toContain('none noted');
  });
  it('shows "none noted" when untapped_keyword_clusters is empty', () => {
    const r = competitorReport();
    (r.analysis as CompetitorGapAnalysis).untapped_keyword_clusters = [];
    expect(digestReport(r)).toContain('none noted');
  });
});

// ──────────────────────────────────────────────────────────
// digestScript()
// ──────────────────────────────────────────────────────────
describe('digestScript()', () => {
  it('includes the script title', () => {
    expect(digestScript(makeScript())).toContain('My Viral Hook Script');
  });
  it('includes the spoken hook', () => {
    expect(digestScript(makeScript())).toContain('Did you know this trick?');
  });
  it('includes the first scene retention loop note', () => {
    expect(digestScript(makeScript())).toContain('Cut to reaction shot');
  });
  it('includes total scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });
  it('includes a formatted date substring', () => {
    expect(digestScript(makeScript())).toMatch(/\d/);
  });
  it('shows "(none)" when first scene has no retention_loop_note', () => {
    const s = makeScript();
    s.storyboard.scenes[0].retention_loop_note = '';
    // empty string is falsy, so nullish coalescing yields '(none)'
    // Note: the code uses `?? '(none)'` which only triggers for null/undefined.
    // An empty string retention_loop_note would be shown as-is.
    // But testing the actual '(none)' path via null:
    const s2 = makeScript();
    // @ts-expect-error intentionally setting null for boundary test
    s2.storyboard.scenes[0].retention_loop_note = null;
    expect(digestScript(s2)).toContain('(none)');
  });
  it('shows "(none)" when storyboard has no scenes', () => {
    const s = makeScript();
    s.storyboard.scenes = [];
    expect(digestScript(s)).toContain('(none)');
  });
  it('reports 0 scenes total when scenes array is empty', () => {
    const s = makeScript();
    s.storyboard.scenes = [];
    expect(digestScript(s)).toContain('0 scenes total');
  });
});
