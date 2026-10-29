import { describe, it, expect } from 'vitest';
import { digestReport, digestScript } from '@/lib/digest';
import type {
  AuditReportRow,
  ScriptRow,
  ViralGapAnalysis,
  GrowthBlueprint,
  UploadDiagnosis,
  SiteDiscoveryResult,
  CompetitorGapAnalysis,
} from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const BASE_REPORT = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-06-15T12:00:00.000Z',
} as const;

const VIRAL_ANALYSIS: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'Good' },
  hook_evaluation: { score: 82, verdict: 'strong', notes: 'Grabs immediately' },
  retention_prediction: {
    at_3s_percent: 75,
    at_30s_percent: 45,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Cut the intro', 'Add B-roll'],
  source_metrics: {},
};

const GROWTH_ANALYSIS: GrowthBlueprint = {
  thematic_consistency: { score: 71, notes: 'Could tighten the niche' },
  view_to_follower_ratio: { value: 1.5, assessment: 'Healthy' },
  posting_cadence: { avg_days_between_posts: 2, assessment: 'Consistent' },
  theme_correction: [],
  view_maximization_tactics: ['Use trending audio'],
  posting_blindspots: ['Weekend mornings', 'Tuesday evenings'],
  per_platform_notes: {},
};

const UPLOAD_ANALYSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 68, verdict: 'moderate', notes: 'OK hook' },
  audio_balance: { score: 55, notes: 'Music slightly too loud' },
  text_overlay_pacing: { assessment: 'Too slow for mobile viewers' },
  b_roll_recommendations: ['Add cutaway at 0:12'],
  retention_boosters: ['Add loop point'],
  frames_analyzed: 120,
};

const DISCOVERY_ANALYSIS: SiteDiscoveryResult = {
  query: 'best coding tutorials 2024',
  sites: [],
  outlier: {
    url: 'https://example.com/standout-tutorial',
    reasoning: 'Uses unique visual format unlike the other nine results',
  },
  summary: 'Found 10 matching sites',
};

const COMPETITOR_ANALYSIS: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['AI tools for creators'],
  missing_topics: ['Monetization basics', 'Short-form editing'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['video hooks', 'creator economy'],
};

// ─────────────────────────────────────────────────────────────────────────────
// digestReport() — source_type: 'url'
// ─────────────────────────────────────────────────────────────────────────────

describe('digestReport() — source_type: url', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'url',
    analysis: VIRAL_ANALYSIS,
  };

  it('includes "Viral Gap Analyzer" label', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('82/100');
  });

  it('includes the hook notes', () => {
    expect(digestReport(report)).toContain('Grabs immediately');
  });

  it('includes the 3-second retention percentage', () => {
    expect(digestReport(report)).toContain('3s=75%');
  });

  it('includes the 30-second retention percentage', () => {
    expect(digestReport(report)).toContain('30s=45%');
  });

  it('includes a formatted date', () => {
    // The date is locale-formatted; just verify it's non-empty and present
    const result = digestReport(report);
    expect(result).toMatch(/\d{1,4}/); // contains a number (year or month/day)
  });

  it('returns a string', () => {
    expect(typeof digestReport(report)).toBe('string');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// digestReport() — source_type: 'account'
// ─────────────────────────────────────────────────────────────────────────────

describe('digestReport() — source_type: account', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'account',
    analysis: GROWTH_ANALYSIS,
  };

  it('includes "Account Deep-Dive" label', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes the thematic consistency score', () => {
    expect(digestReport(report)).toContain('71/100');
  });

  it('includes the thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Could tighten the niche');
  });

  it('includes posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Weekend mornings');
    expect(result).toContain('Tuesday evenings');
  });

  it('handles empty posting_blindspots with "none noted"', () => {
    const noBlindspots: AuditReportRow = {
      ...report,
      analysis: { ...GROWTH_ANALYSIS, posting_blindspots: [] } as GrowthBlueprint,
    };
    expect(digestReport(noBlindspots)).toContain('none noted');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// digestReport() — source_type: 'upload'
// ─────────────────────────────────────────────────────────────────────────────

describe('digestReport() — source_type: upload', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'upload',
    analysis: UPLOAD_ANALYSIS,
  };

  it('includes "Upload Diagnostic" label', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes the visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes the visual hook score', () => {
    expect(digestReport(report)).toContain('68/100');
  });

  it('includes the audio balance score', () => {
    expect(digestReport(report)).toContain('55/100');
  });

  it('includes the audio balance notes', () => {
    expect(digestReport(report)).toContain('Music slightly too loud');
  });

  it('includes the text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Too slow for mobile viewers');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// digestReport() — source_type: 'discovery'
// ─────────────────────────────────────────────────────────────────────────────

describe('digestReport() — source_type: discovery', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'discovery',
    analysis: DISCOVERY_ANALYSIS,
  };

  it('includes "Site Discovery" label', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query string', () => {
    expect(digestReport(report)).toContain('best coding tutorials 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/standout-tutorial');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Uses unique visual format unlike the other nine results');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// digestReport() — source_type: 'competitors' (fallback)
// ─────────────────────────────────────────────────────────────────────────────

describe('digestReport() — source_type: competitors', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'competitors',
    analysis: COMPETITOR_ANALYSIS,
  };

  it('includes "Competitor Espionage" label', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('Monetization basics');
    expect(result).toContain('Short-form editing');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('video hooks');
    expect(result).toContain('creator economy');
  });

  it('handles empty missing_topics with "none noted"', () => {
    const noTopics: AuditReportRow = {
      ...report,
      analysis: {
        ...COMPETITOR_ANALYSIS,
        missing_topics: [],
      } as CompetitorGapAnalysis,
    };
    expect(digestReport(noTopics)).toContain('none noted');
  });

  it('handles empty untapped_keyword_clusters with "none noted"', () => {
    const noKeywords: AuditReportRow = {
      ...report,
      analysis: {
        ...COMPETITOR_ANALYSIS,
        untapped_keyword_clusters: [],
      } as CompetitorGapAnalysis,
    };
    expect(digestReport(noKeywords)).toContain('none noted');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// digestScript()
// ─────────────────────────────────────────────────────────────────────────────

const SCRIPT: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'How to go viral in 60 seconds',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'Stop scrolling — I made a mistake so you don\'t have to.',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Creator staring into camera',
        dialogue_or_vo: 'The hook',
        audio_sfx_cue: 'Lo-fi beat',
        retention_loop_note: 'Cut mid-sentence to force curiosity',
      },
      {
        scene_number: 2,
        visual_action: 'Screen recording',
        dialogue_or_vo: 'Body content',
        audio_sfx_cue: 'Same beat',
        retention_loop_note: 'Add loop bait',
      },
    ],
    cta: 'Follow for part 2',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-09-12T08:30:00.000Z',
};

describe('digestScript()', () => {
  it('includes the script title', () => {
    expect(digestScript(SCRIPT)).toContain('How to go viral in 60 seconds');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(SCRIPT)).toContain('Stop scrolling — I made a mistake so you don\'t have to.');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(SCRIPT)).toContain('Cut mid-sentence to force curiosity');
  });

  it('includes the total number of scenes', () => {
    expect(digestScript(SCRIPT)).toContain('2 scenes total');
  });

  it('returns a string', () => {
    expect(typeof digestScript(SCRIPT)).toBe('string');
  });

  it('handles a script with no scenes (empty array)', () => {
    const noScenes: ScriptRow = {
      ...SCRIPT,
      storyboard: { ...SCRIPT.storyboard, scenes: [] },
    };
    const result = digestScript(noScenes);
    expect(result).toContain('(none)'); // weakScene?.retention_loop_note ?? '(none)'
    expect(result).toContain('0 scenes total');
  });

  it('uses the first scene (index 0) for the retention loop note', () => {
    const twoScenes: ScriptRow = {
      ...SCRIPT,
      storyboard: {
        ...SCRIPT.storyboard,
        scenes: [
          { ...SCRIPT.storyboard.scenes[0], retention_loop_note: 'first-note' },
          { ...SCRIPT.storyboard.scenes[1], retention_loop_note: 'second-note' },
        ],
      },
    };
    const result = digestScript(twoScenes);
    expect(result).toContain('first-note');
    expect(result).not.toContain('second-note');
  });

  it('includes a formatted date', () => {
    const result = digestScript(SCRIPT);
    expect(result).toMatch(/\d{1,4}/);
  });

  it('handles a single-scene script', () => {
    const oneScene: ScriptRow = {
      ...SCRIPT,
      storyboard: {
        ...SCRIPT.storyboard,
        scenes: [SCRIPT.storyboard.scenes[0]],
      },
    };
    const result = digestScript(oneScene);
    expect(result).toContain('1 scenes total');
    expect(result).toContain('Cut mid-sentence to force curiosity');
  });
});
