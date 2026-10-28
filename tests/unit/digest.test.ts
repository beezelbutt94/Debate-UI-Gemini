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

// ── Helpers ───────────────────────────────────────────────────────────────

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis' | 'timeline_recommendations'> = {
  id: 'report-1',
  user_id: 'user-1',
  creator_profile_id: null,
  source_url: null,
  platform: 'tiktok',
  viral_score: 70,
  created_at: '2024-09-12T10:00:00.000Z',
};

// ── digestReport: url (ViralGapAnalysis) ──────────────────────────────────

describe('digestReport() — url (ViralGapAnalysis)', () => {
  const analysis: ViralGapAnalysis = {
    hook_evaluation: { score: 82, verdict: 'strong', notes: 'Punchy open question' },
    retention_prediction: { at_3s_percent: 75, at_30s_percent: 48, meets_3s_benchmark: true, meets_30s_benchmark: true },
    pacing_audit: { cuts_per_10s: 4, assessment: 'Fast' },
    action_plan: ['Add captions'],
    source_metrics: {},
  };

  const report: AuditReportRow<ViralGapAnalysis> = {
    ...BASE_REPORT,
    source_type: 'url',
    analysis,
    timeline_recommendations: [],
  };

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('82/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Punchy open question');
  });

  it('includes 3s retention percentage', () => {
    expect(digestReport(report)).toContain('3s=75%');
  });

  it('includes 30s retention percentage', () => {
    expect(digestReport(report)).toContain('30s=48%');
  });

  it('includes the formatted date', () => {
    const date = new Date('2024-09-12T10:00:00.000Z').toLocaleDateString();
    expect(digestReport(report)).toContain(date);
  });

  it('labels output as Viral Gap Analyzer', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });
});

// ── digestReport: account (GrowthBlueprint) ───────────────────────────────

describe('digestReport() — account (GrowthBlueprint)', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 65, notes: 'Topics drift across weeks' },
    view_to_follower_ratio: { value: 3.4, assessment: 'Good' },
    posting_cadence: { avg_days_between_posts: 2.5, assessment: 'Regular' },
    theme_correction: ['Stick to cooking'],
    view_maximization_tactics: ['Post at 7pm'],
    posting_blindspots: ['Weekend mornings', 'Monday evenings'],
    per_platform_notes: {},
  };

  const report: AuditReportRow<GrowthBlueprint> = {
    ...BASE_REPORT,
    source_type: 'account',
    analysis,
    timeline_recommendations: [],
  };

  it('labels output as Account Deep-Dive', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('65/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Topics drift across weeks');
  });

  it('includes posting blindspots', () => {
    expect(digestReport(report)).toContain('Weekend mornings');
    expect(digestReport(report)).toContain('Monday evenings');
  });

  it('shows "none noted" when blindspots array is empty', () => {
    const noBlindspots: AuditReportRow<GrowthBlueprint> = {
      ...report,
      analysis: { ...analysis, posting_blindspots: [] },
    };
    expect(digestReport(noBlindspots)).toContain('none noted');
  });
});

// ── digestReport: upload (UploadDiagnosis) ────────────────────────────────

describe('digestReport() — upload (UploadDiagnosis)', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 55, verdict: 'moderate', notes: 'Text appears too late' },
    audio_balance: { score: 70, notes: 'Background music slightly loud' },
    text_overlay_pacing: { assessment: 'Overlays change too quickly' },
    b_roll_recommendations: ['Add B-roll at 0:05'],
    retention_boosters: ['Add captions'],
    frames_analyzed: 30,
  };

  const report: AuditReportRow<UploadDiagnosis> = {
    ...BASE_REPORT,
    source_type: 'upload',
    analysis,
    timeline_recommendations: [],
  };

  it('labels output as Upload Diagnostic', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('55/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('70/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Background music slightly loud');
  });

  it('includes text overlay assessment', () => {
    expect(digestReport(report)).toContain('Overlays change too quickly');
  });
});

// ── digestReport: discovery (SiteDiscoveryResult) ─────────────────────────

describe('digestReport() — discovery (SiteDiscoveryResult)', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'best cooking channels 2024',
    sites: [],
    outlier: {
      url: 'https://example.com/unique',
      reasoning: 'Only channel focused on budget meals',
    },
    summary: 'Found 10 relevant cooking sites',
  };

  const report: AuditReportRow<SiteDiscoveryResult> = {
    ...BASE_REPORT,
    source_type: 'discovery',
    analysis,
    timeline_recommendations: [],
  };

  it('labels output as Site Discovery', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the search query', () => {
    expect(digestReport(report)).toContain('best cooking channels 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/unique');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Only channel focused on budget meals');
  });
});

// ── digestReport: competitors (CompetitorGapAnalysis) ────────────────────

describe('digestReport() — competitors (CompetitorGapAnalysis)', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: ['trending recipes'],
    missing_topics: ['budget meals', 'meal prep'],
    audience_sentiment_gaps: ['viewers want faster recipes'],
    untapped_keyword_clusters: ['quick dinner ideas', 'under 10 minute meals'],
  };

  const report: AuditReportRow<CompetitorGapAnalysis> = {
    ...BASE_REPORT,
    source_type: 'competitors',
    analysis,
    timeline_recommendations: [],
  };

  it('labels output as Competitor Espionage', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    expect(digestReport(report)).toContain('budget meals');
    expect(digestReport(report)).toContain('meal prep');
  });

  it('includes untapped keyword clusters', () => {
    expect(digestReport(report)).toContain('quick dinner ideas');
    expect(digestReport(report)).toContain('under 10 minute meals');
  });

  it('shows "none noted" when missing_topics is empty', () => {
    const noMissing: AuditReportRow<CompetitorGapAnalysis> = {
      ...report,
      analysis: { ...analysis, missing_topics: [] },
    };
    expect(digestReport(noMissing)).toContain('none noted');
  });

  it('shows "none noted" when untapped_keyword_clusters is empty', () => {
    const noClusters: AuditReportRow<CompetitorGapAnalysis> = {
      ...report,
      analysis: { ...analysis, untapped_keyword_clusters: [] },
    };
    expect(digestReport(noClusters)).toContain('none noted');
  });
});

// ── digestScript ──────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const script: ScriptRow = {
    id: 'script-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'My Viral Hook',
    source_prompt: 'cooking tips',
    storyboard: {
      spoken_hook: 'Did you know this ONE trick saves dinner?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'chef at stove',
          dialogue_or_vo: 'Start with this',
          audio_sfx_cue: 'sizzle',
          retention_loop_note: 'Loop back to the question',
        },
        {
          scene_number: 2,
          visual_action: 'ingredients close up',
          dialogue_or_vo: 'Here is the secret',
          audio_sfx_cue: 'none',
          retention_loop_note: 'Cliffhanger before reveal',
        },
      ],
      cta: 'Follow for more tips',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-12T10:00:00.000Z',
  };

  it('includes the script title', () => {
    expect(digestScript(script)).toContain('My Viral Hook');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(script)).toContain('Did you know this ONE trick saves dinner?');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(script)).toContain('Loop back to the question');
  });

  it('includes the total scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    const date = new Date('2024-09-12T10:00:00.000Z').toLocaleDateString();
    expect(digestScript(script)).toContain(date);
  });

  it('uses "(none)" when there are no scenes', () => {
    const noScenes: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('(none)');
  });
});
