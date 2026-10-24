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

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseReport = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-09-15T12:00:00.000Z',
} as const;

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'Good pacing' },
  hook_evaluation: { score: 82, verdict: 'strong', notes: 'Opens with a question' },
  retention_prediction: { at_3s_percent: 70, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Add a hook', 'Cut more'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 75, notes: 'Mostly focused on cooking' },
  view_to_follower_ratio: { value: 1.2, assessment: 'Above average' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'Regular' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['Monday morning', 'Thursday evening'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 68, verdict: 'moderate', notes: 'Camera cuts too slowly' },
  audio_balance: { score: 80, notes: 'Good mix' },
  text_overlay_pacing: { assessment: 'Too many overlays' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 6,
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['recipe hacks'],
  missing_topics: ['budget meals', 'vegan cooking'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['easy recipes', 'quick meals'],
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'viral cooking shorts',
  sites: [],
  outlier: { url: 'https://example.com', reasoning: 'Unique angle on fermentation' },
  summary: 'Top cooking content creators',
};

// ── digestReport ───────────────────────────────────────────────────────────────

describe('digestReport() — source_type: url', () => {
  const report: AuditReportRow<ViralGapAnalysis> = {
    ...baseReport,
    source_type: 'url',
    analysis: viralAnalysis,
  };

  it('includes "Viral Gap Analyzer" label', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('82/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Opens with a question');
  });

  it('includes 3s retention percentage', () => {
    expect(digestReport(report)).toContain('70%');
  });

  it('includes 30s retention percentage', () => {
    expect(digestReport(report)).toContain('45%');
  });

  it('includes the formatted date', () => {
    const date = new Date(baseReport.created_at).toLocaleDateString();
    expect(digestReport(report)).toContain(date);
  });
});

describe('digestReport() — source_type: account', () => {
  const report: AuditReportRow<GrowthBlueprint> = {
    ...baseReport,
    source_type: 'account',
    analysis: growthAnalysis,
  };

  it('includes "Account Deep-Dive" label', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('75/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Mostly focused on cooking');
  });

  it('includes posting blindspots', () => {
    expect(digestReport(report)).toContain('Monday morning');
    expect(digestReport(report)).toContain('Thursday evening');
  });
});

describe('digestReport() — source_type: account with no blindspots', () => {
  const report: AuditReportRow<GrowthBlueprint> = {
    ...baseReport,
    source_type: 'account',
    analysis: { ...growthAnalysis, posting_blindspots: [] },
  };

  it('shows "none noted" when blindspots array is empty', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport() — source_type: upload', () => {
  const report: AuditReportRow<UploadDiagnosis> = {
    ...baseReport,
    source_type: 'upload',
    analysis: uploadAnalysis,
  };

  it('includes "Upload Diagnostic" label', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('68/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('80/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Good mix');
  });

  it('includes text overlay assessment', () => {
    expect(digestReport(report)).toContain('Too many overlays');
  });
});

describe('digestReport() — source_type: discovery', () => {
  const report: AuditReportRow<SiteDiscoveryResult> = {
    ...baseReport,
    source_type: 'discovery',
    analysis: discoveryAnalysis,
  };

  it('includes "Site Discovery" label', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query', () => {
    expect(digestReport(report)).toContain('viral cooking shorts');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Unique angle on fermentation');
  });
});

describe('digestReport() — source_type: competitors (default branch)', () => {
  const report: AuditReportRow<CompetitorGapAnalysis> = {
    ...baseReport,
    source_type: 'competitors',
    analysis: competitorAnalysis,
  };

  it('includes "Competitor Espionage" label', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    expect(digestReport(report)).toContain('budget meals');
    expect(digestReport(report)).toContain('vegan cooking');
  });

  it('includes untapped keyword clusters', () => {
    expect(digestReport(report)).toContain('easy recipes');
    expect(digestReport(report)).toContain('quick meals');
  });

  it('shows "none noted" when missing_topics is empty', () => {
    const emptyReport: AuditReportRow<CompetitorGapAnalysis> = {
      ...report,
      analysis: { ...competitorAnalysis, missing_topics: [] },
    };
    expect(digestReport(emptyReport)).toContain('none noted');
  });

  it('shows "none noted" when untapped_keyword_clusters is empty', () => {
    const emptyReport: AuditReportRow<CompetitorGapAnalysis> = {
      ...report,
      analysis: { ...competitorAnalysis, untapped_keyword_clusters: [] },
    };
    expect(digestReport(emptyReport)).toContain('none noted');
  });
});

// ── digestScript ───────────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const script: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My First Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know this hack?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up shot',
          dialogue_or_vo: 'The big reveal',
          audio_sfx_cue: 'none',
          retention_loop_note: 'Teases the result',
        },
        {
          scene_number: 2,
          visual_action: 'Wide shot',
          dialogue_or_vo: 'The explanation',
          audio_sfx_cue: 'none',
          retention_loop_note: 'Step 2',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-20T08:00:00.000Z',
  };

  it('includes the script title', () => {
    expect(digestScript(script)).toContain('My First Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(script)).toContain('Did you know this hack?');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(script)).toContain('Teases the result');
  });

  it('includes total scene count', () => {
    expect(digestScript(script)).toContain('2 scenes');
  });

  it('includes the formatted date', () => {
    const date = new Date(script.created_at).toLocaleDateString();
    expect(digestScript(script)).toContain(date);
  });

  it('handles missing first scene gracefully', () => {
    const noScenes: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    const result = digestScript(noScenes);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes');
  });
});
