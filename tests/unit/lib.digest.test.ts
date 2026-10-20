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

// ── fixtures ────────────────────────────────────────────────────────────────

const BASE = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-06-15T12:00:00.000Z',
} as const;

const viralGapReport: AuditReportRow<ViralGapAnalysis> = {
  ...BASE,
  source_type: 'url',
  analysis: {
    hook_evaluation: { score: 72, verdict: 'moderate', notes: 'opens mid-action' },
    retention_prediction: {
      at_3s_percent: 65,
      at_30s_percent: 42,
      meets_3s_benchmark: true,
      meets_30s_benchmark: true,
    },
    pacing_audit: { cuts_per_10s: 3, assessment: 'good' },
    action_plan: [],
    source_metrics: {},
  },
};

const growthReport: AuditReportRow<GrowthBlueprint> = {
  ...BASE,
  source_type: 'account',
  analysis: {
    thematic_consistency: { score: 55, notes: 'inconsistent niche mixing' },
    view_to_follower_ratio: { value: 0.3, assessment: 'below average' },
    posting_cadence: { avg_days_between_posts: 4.5, assessment: 'weekly is fine' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: ['Tuesday mornings', 'Thursday evenings'],
    per_platform_notes: {},
  },
};

const uploadReport: AuditReportRow<UploadDiagnosis> = {
  ...BASE,
  source_type: 'upload',
  analysis: {
    visual_hook_clarity: { score: 80, verdict: 'strong', notes: 'bold face-cam' },
    audio_balance: { score: 60, notes: 'music slightly too loud' },
    text_overlay_pacing: { assessment: 'well timed' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
  },
};

const competitorReport: AuditReportRow<CompetitorGapAnalysis> = {
  ...BASE,
  source_type: 'competitors',
  analysis: {
    competitors: [],
    outlier_topics: ['product hauls'],
    missing_topics: ['budget tips', 'thrift-flip'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['thrift store finds', 'frugal fashion'],
  },
};

const discoveryReport: AuditReportRow<SiteDiscoveryResult> = {
  ...BASE,
  source_type: 'discovery',
  analysis: {
    query: 'viral fitness content ideas 2024',
    sites: [],
    outlier: {
      url: 'https://unusual-fitness.com',
      reasoning: 'focuses on recovery instead of workouts',
    },
    summary: 'Top sites mostly cover HIIT',
  },
};

// ── digestReport() ──────────────────────────────────────────────────────────

describe('digestReport() — source_type: url (ViralGapAnalysis)', () => {
  it('includes the hook verdict', () => {
    expect(digestReport(viralGapReport)).toContain('moderate');
  });

  it('includes the hook score', () => {
    expect(digestReport(viralGapReport)).toContain('72');
  });

  it('includes hook notes', () => {
    expect(digestReport(viralGapReport)).toContain('opens mid-action');
  });

  it('includes 3-second retention percent', () => {
    expect(digestReport(viralGapReport)).toContain('65');
  });

  it('includes 30-second retention percent', () => {
    expect(digestReport(viralGapReport)).toContain('42');
  });

  it('includes the report date', () => {
    // toLocaleDateString output varies by locale but should contain "2024"
    expect(digestReport(viralGapReport)).toContain('2024');
  });

  it('starts with "Viral Gap Analyzer"', () => {
    expect(digestReport(viralGapReport)).toMatch(/^Viral Gap Analyzer/);
  });
});

describe('digestReport() — source_type: account (GrowthBlueprint)', () => {
  it('includes thematic consistency score', () => {
    expect(digestReport(growthReport)).toContain('55');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(growthReport)).toContain('inconsistent niche mixing');
  });

  it('lists posting blindspots', () => {
    const out = digestReport(growthReport);
    expect(out).toContain('Tuesday mornings');
    expect(out).toContain('Thursday evenings');
  });

  it('starts with "Account Deep-Dive"', () => {
    expect(digestReport(growthReport)).toMatch(/^Account Deep-Dive/);
  });
});

describe('digestReport() — source_type: account (GrowthBlueprint, empty blindspots)', () => {
  it('shows "none noted" when blindspots array is empty', () => {
    const noBlindspots: AuditReportRow<GrowthBlueprint> = {
      ...growthReport,
      analysis: { ...growthReport.analysis, posting_blindspots: [] },
    };
    expect(digestReport(noBlindspots)).toContain('none noted');
  });
});

describe('digestReport() — source_type: upload (UploadDiagnosis)', () => {
  it('includes visual hook verdict', () => {
    expect(digestReport(uploadReport)).toContain('strong');
  });

  it('includes visual hook score', () => {
    expect(digestReport(uploadReport)).toContain('80');
  });

  it('includes audio balance score', () => {
    expect(digestReport(uploadReport)).toContain('60');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(uploadReport)).toContain('music slightly too loud');
  });

  it('includes text-overlay pacing assessment', () => {
    expect(digestReport(uploadReport)).toContain('well timed');
  });

  it('starts with "Upload Diagnostic"', () => {
    expect(digestReport(uploadReport)).toMatch(/^Upload Diagnostic/);
  });
});

describe('digestReport() — source_type: competitors (CompetitorGapAnalysis)', () => {
  it('includes missing topics', () => {
    const out = digestReport(competitorReport);
    expect(out).toContain('budget tips');
    expect(out).toContain('thrift-flip');
  });

  it('includes untapped keyword clusters', () => {
    const out = digestReport(competitorReport);
    expect(out).toContain('thrift store finds');
    expect(out).toContain('frugal fashion');
  });

  it('starts with "Competitor Espionage"', () => {
    expect(digestReport(competitorReport)).toMatch(/^Competitor Espionage/);
  });
});

describe('digestReport() — source_type: competitors (empty arrays)', () => {
  it('shows "none noted" for missing_topics when empty', () => {
    const noMissing: AuditReportRow<CompetitorGapAnalysis> = {
      ...competitorReport,
      analysis: { ...competitorReport.analysis, missing_topics: [] },
    };
    expect(digestReport(noMissing)).toContain('none noted');
  });

  it('shows "none noted" for untapped_keyword_clusters when empty', () => {
    const noClusters: AuditReportRow<CompetitorGapAnalysis> = {
      ...competitorReport,
      analysis: { ...competitorReport.analysis, untapped_keyword_clusters: [] },
    };
    expect(digestReport(noClusters)).toContain('none noted');
  });
});

describe('digestReport() — source_type: discovery (SiteDiscoveryResult)', () => {
  it('includes the search query', () => {
    expect(digestReport(discoveryReport)).toContain('viral fitness content ideas 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(discoveryReport)).toContain('https://unusual-fitness.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(discoveryReport)).toContain('focuses on recovery instead of workouts');
  });

  it('starts with "Site Discovery"', () => {
    expect(digestReport(discoveryReport)).toMatch(/^Site Discovery/);
  });
});

// ── digestScript() ──────────────────────────────────────────────────────────

const sampleScript: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'Top 5 Budget Meals',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'What if you could eat healthy for under $3?',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'show empty fridge',
        dialogue_or_vo: 'Your fridge may be bare but...',
        audio_sfx_cue: 'ambient silence',
        retention_loop_note: 'viewer wonders what the trick is',
      },
      {
        scene_number: 2,
        visual_action: 'pan over ingredients',
        dialogue_or_vo: 'Here is meal number one',
        audio_sfx_cue: 'upbeat music',
        retention_loop_note: 'anticipation for reveal',
      },
    ],
    cta: 'Save this for your next grocery run',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-07-20T08:00:00.000Z',
};

describe('digestScript()', () => {
  it('includes the script title', () => {
    expect(digestScript(sampleScript)).toContain('Top 5 Budget Meals');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(sampleScript)).toContain('What if you could eat healthy for under $3?');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(sampleScript)).toContain('viewer wonders what the trick is');
  });

  it('includes the total scene count', () => {
    expect(digestScript(sampleScript)).toContain('2');
  });

  it('includes the date', () => {
    expect(digestScript(sampleScript)).toContain('2024');
  });

  it('starts with Script "', () => {
    expect(digestScript(sampleScript)).toMatch(/^Script "/);
  });

  it('shows (none) when scenes array is empty', () => {
    const noScenes: ScriptRow = {
      ...sampleScript,
      storyboard: { ...sampleScript.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('(none)');
  });
});
