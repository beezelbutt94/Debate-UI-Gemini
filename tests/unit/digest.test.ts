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

// ---------------------------------------------------------------------------
// Helpers — build minimal well-typed fixture objects
// ---------------------------------------------------------------------------

function makeBase(): Omit<AuditReportRow, 'source_type' | 'analysis'> {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: '2024-03-15T00:00:00.000Z',
  };
}

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Decent opener but slow build' },
  retention_prediction: {
    at_3s_percent: 65,
    at_30s_percent: 42,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Re-cut hook to 2 s', 'Add captions'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 88, notes: 'Mostly tech content' },
  view_to_follower_ratio: { value: 0.3, assessment: 'Above average' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'Regular' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['Weekday mornings', 'Shorts-only weeks'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 55, verdict: 'weak', notes: 'Hook text is too small' },
  audio_balance: { score: 80, notes: 'Good music/voice mix' },
  text_overlay_pacing: { assessment: 'Too many words per frame' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 42,
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'AI video tools 2024',
  sites: [],
  outlier: { url: 'https://example.com', reasoning: 'Unique methodology' },
  summary: 'Found 10 sites',
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['Long-form reviews', 'Behind the scenes'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['AI tools', 'video editing tips'],
};

// ---------------------------------------------------------------------------
// digestReport — url source_type
// ---------------------------------------------------------------------------

describe('digestReport() — url', () => {
  const report: AuditReportRow = { ...makeBase(), source_type: 'url', analysis: viralAnalysis };

  it('mentions "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('72/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Decent opener but slow build');
  });

  it('includes 3-second retention percentage', () => {
    expect(digestReport(report)).toContain('65%');
  });

  it('includes 30-second retention percentage', () => {
    expect(digestReport(report)).toContain('42%');
  });

  it('includes the formatted date', () => {
    // Date.toLocaleDateString format varies by locale, but the year should be present
    expect(digestReport(report)).toMatch(/2024/);
  });
});

// ---------------------------------------------------------------------------
// digestReport — account source_type
// ---------------------------------------------------------------------------

describe('digestReport() — account', () => {
  const report: AuditReportRow = { ...makeBase(), source_type: 'account', analysis: growthAnalysis };

  it('mentions "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes the thematic consistency score', () => {
    expect(digestReport(report)).toContain('88/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Mostly tech content');
  });

  it('includes posting blindspots', () => {
    expect(digestReport(report)).toContain('Weekday mornings');
    expect(digestReport(report)).toContain('Shorts-only weeks');
  });

  it('returns "none noted" when posting_blindspots is empty', () => {
    const noBlindspots: GrowthBlueprint = { ...growthAnalysis, posting_blindspots: [] };
    const r: AuditReportRow = { ...makeBase(), source_type: 'account', analysis: noBlindspots };
    expect(digestReport(r)).toContain('none noted');
  });
});

// ---------------------------------------------------------------------------
// digestReport — upload source_type
// ---------------------------------------------------------------------------

describe('digestReport() — upload', () => {
  const report: AuditReportRow = { ...makeBase(), source_type: 'upload', analysis: uploadAnalysis };

  it('mentions "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('weak');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('55/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('80/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Good music/voice mix');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Too many words per frame');
  });
});

// ---------------------------------------------------------------------------
// digestReport — discovery source_type
// ---------------------------------------------------------------------------

describe('digestReport() — discovery', () => {
  const report: AuditReportRow = { ...makeBase(), source_type: 'discovery', analysis: discoveryAnalysis };

  it('mentions "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the search query', () => {
    expect(digestReport(report)).toContain('AI video tools 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Unique methodology');
  });
});

// ---------------------------------------------------------------------------
// digestReport — competitors (default / fallback branch)
// ---------------------------------------------------------------------------

describe('digestReport() — competitors', () => {
  const report: AuditReportRow = { ...makeBase(), source_type: 'competitors', analysis: competitorAnalysis };

  it('mentions "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    expect(digestReport(report)).toContain('Long-form reviews');
    expect(digestReport(report)).toContain('Behind the scenes');
  });

  it('includes untapped keyword clusters', () => {
    expect(digestReport(report)).toContain('AI tools');
    expect(digestReport(report)).toContain('video editing tips');
  });

  it('returns "none noted" for missing_topics when empty', () => {
    const emptyMissing: CompetitorGapAnalysis = { ...competitorAnalysis, missing_topics: [] };
    const r: AuditReportRow = { ...makeBase(), source_type: 'competitors', analysis: emptyMissing };
    expect(digestReport(r)).toContain('none noted');
  });

  it('returns "none noted" for untapped_keyword_clusters when empty', () => {
    const emptyKeywords: CompetitorGapAnalysis = { ...competitorAnalysis, untapped_keyword_clusters: [] };
    const r: AuditReportRow = { ...makeBase(), source_type: 'competitors', analysis: emptyKeywords };
    expect(digestReport(r)).toContain('none noted');
  });
});

// ---------------------------------------------------------------------------
// digestScript
// ---------------------------------------------------------------------------

describe('digestScript()', () => {
  const script: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'How to Go Viral in 2024',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'This one trick will triple your views',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of phone screen',
          dialogue_or_vo: 'Open the app.',
          audio_sfx_cue: 'upbeat music',
          retention_loop_note: 'Pattern interrupt at 2s',
        },
        {
          scene_number: 2,
          visual_action: 'Screen recording',
          dialogue_or_vo: 'Tap here.',
          audio_sfx_cue: '',
          retention_loop_note: 'Re-hook mid-scene',
        },
      ],
      cta: 'Follow for more tips',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-06-01T12:00:00.000Z',
  };

  it('includes the script title', () => {
    expect(digestScript(script)).toContain('How to Go Viral in 2024');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(script)).toContain('This one trick will triple your views');
  });

  it('includes the first-scene retention loop note', () => {
    expect(digestScript(script)).toContain('Pattern interrupt at 2s');
  });

  it('includes the total scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    expect(digestScript(script)).toMatch(/2024/);
  });

  it('returns "(none)" for the retention note when scenes array is empty', () => {
    const empty: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    expect(digestScript(empty)).toContain('(none)');
  });
});
