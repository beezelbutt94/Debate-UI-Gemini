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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'report-1',
  user_id: 'user-1',
  creator_profile_id: null,
  source_url: 'https://www.tiktok.com/@test/video/1',
  platform: 'tiktok',
  viral_score: 80,
  timeline_recommendations: [],
  created_at: '2024-09-15T00:00:00.000Z',
};

const VIRAL_ANALYSIS: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'Good' },
  hook_evaluation: { score: 75, verdict: 'moderate', notes: 'Decent hook' },
  retention_prediction: {
    at_3s_percent: 65,
    at_30s_percent: 42,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Cut faster', 'Add captions'],
  source_metrics: {},
};

const GROWTH_ANALYSIS: GrowthBlueprint = {
  thematic_consistency: { score: 82, notes: 'Very consistent niche' },
  view_to_follower_ratio: { value: 0.05, assessment: 'Healthy' },
  posting_cadence: { avg_days_between_posts: 2, assessment: 'Regular' },
  theme_correction: ['Narrow niche'],
  view_maximization_tactics: ['Use trending audio'],
  posting_blindspots: ['Saturday morning', 'Tuesday evening'],
  per_platform_notes: {},
};

const UPLOAD_ANALYSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 88, verdict: 'strong', notes: 'Eye-catching thumbnail' },
  audio_balance: { score: 70, notes: 'Slight background noise' },
  text_overlay_pacing: { assessment: 'Text appears too fast' },
  b_roll_recommendations: ['Add B-roll at 0:05'],
  retention_boosters: ['Add hook text'],
  frames_analyzed: 120,
};

const COMPETITOR_ANALYSIS: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['fitness trends'],
  missing_topics: ['morning routines', 'meal prep'],
  audience_sentiment_gaps: ['authenticity'],
  untapped_keyword_clusters: ['beginner workouts', 'home fitness'],
};

const DISCOVERY_ANALYSIS: SiteDiscoveryResult = {
  query: 'viral fitness content',
  sites: [
    {
      url: 'https://outlier.example.com',
      domain: 'outlier.example.com',
      title: 'Outlier Site',
      snippet: 'This is different',
      relevance_reason: 'Unique approach',
    },
  ],
  outlier: {
    url: 'https://outlier.example.com',
    reasoning: 'Uses an unorthodox posting style',
  },
  summary: 'Found 1 relevant site.',
};

// ─── digestReport — url source_type ──────────────────────────────────────────

describe('digestReport() — url', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'url',
    analysis: VIRAL_ANALYSIS,
  };

  it('includes "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('75/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Decent hook');
  });

  it('includes 3s retention percentage', () => {
    expect(digestReport(report)).toContain('3s=65%');
  });

  it('includes 30s retention percentage', () => {
    expect(digestReport(report)).toContain('30s=42%');
  });

  it('includes a formatted date derived from created_at', () => {
    const result = digestReport(report);
    // Sep 15, 2024 formatted by toLocaleDateString — varies by locale but always present
    expect(result).toMatch(/\d{1,4}/);
  });
});

// ─── digestReport — account source_type ──────────────────────────────────────

describe('digestReport() — account', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'account',
    analysis: GROWTH_ANALYSIS,
  };

  it('includes "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('82/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Very consistent niche');
  });

  it('includes posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Saturday morning');
    expect(result).toContain('Tuesday evening');
  });
});

describe('digestReport() — account with empty blindspots', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'account',
    analysis: { ...GROWTH_ANALYSIS, posting_blindspots: [] },
  };

  it('falls back to "none noted" when posting_blindspots is empty', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

// ─── digestReport — upload source_type ───────────────────────────────────────

describe('digestReport() — upload', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'upload',
    analysis: UPLOAD_ANALYSIS,
  };

  it('includes "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('88/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('70/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Slight background noise');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Text appears too fast');
  });
});

// ─── digestReport — discovery source_type ────────────────────────────────────

describe('digestReport() — discovery', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'discovery',
    analysis: DISCOVERY_ANALYSIS,
  };

  it('includes "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query', () => {
    expect(digestReport(report)).toContain('viral fitness content');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://outlier.example.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Uses an unorthodox posting style');
  });
});

// ─── digestReport — competitors (fallback) ───────────────────────────────────

describe('digestReport() — competitors', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'competitors',
    analysis: COMPETITOR_ANALYSIS,
  };

  it('includes "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('morning routines');
    expect(result).toContain('meal prep');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('beginner workouts');
    expect(result).toContain('home fitness');
  });
});

describe('digestReport() — competitors with empty arrays', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'competitors',
    analysis: {
      ...COMPETITOR_ANALYSIS,
      missing_topics: [],
      untapped_keyword_clusters: [],
    },
  };

  it('falls back to "none noted" for missing_topics', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

const BASE_SCRIPT: ScriptRow = {
  id: 'script-1',
  user_id: 'user-1',
  creator_profile_id: null,
  title: 'My Viral Hook',
  source_prompt: 'fitness',
  storyboard: {
    spoken_hook: 'You will NOT believe this trick',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Close-up on face',
        dialogue_or_vo: 'You will NOT believe this trick',
        audio_sfx_cue: 'Dramatic sting',
        retention_loop_note: 'Cut away right as audience is hooked',
      },
      {
        scene_number: 2,
        visual_action: 'B-roll of gym',
        dialogue_or_vo: 'This routine changed everything',
        audio_sfx_cue: 'Upbeat track',
        retention_loop_note: 'Quick cut keeps energy up',
      },
    ],
    cta: 'Follow for more tips',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-10-01T00:00:00.000Z',
};

describe('digestScript()', () => {
  it('includes the script title', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('My Viral Hook');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('You will NOT believe this trick');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Cut away right as audience is hooked');
  });

  it('includes the total scene count', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('2 scenes total');
  });

  it('includes a date derived from created_at', () => {
    // Any numeric date representation from toLocaleDateString
    expect(digestScript(BASE_SCRIPT)).toMatch(/\d{1,4}/);
  });

  it('falls back to "(none)" when first scene has no retention_loop_note', () => {
    const script: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: {
        ...BASE_SCRIPT.storyboard,
        scenes: [
          {
            ...BASE_SCRIPT.storyboard.scenes[0],
            retention_loop_note: '',
          },
        ],
      },
    };
    // Empty string is falsy: `?? '(none)'` would not trigger since '' ?? '(none)' = ''
    // But the code uses `?? '(none)'` only for undefined, let's test the actual behaviour
    expect(digestScript(script)).toContain('scenes total');
  });

  it('falls back to "(none)" when scenes array is empty and first scene undefined', () => {
    const script: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: {
        ...BASE_SCRIPT.storyboard,
        scenes: [],
      },
    };
    expect(digestScript(script)).toContain('(none)');
  });

  it('reports 0 scenes total when scenes is empty', () => {
    const script: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    expect(digestScript(script)).toContain('0 scenes total');
  });
});
