import { describe, it, expect, beforeEach } from 'vitest';
import { digestReport, digestScript } from '@/lib/digest';
import type {
  AuditReportRow,
  ViralGapAnalysis,
  GrowthBlueprint,
  UploadDiagnosis,
  SiteDiscoveryResult,
  CompetitorGapAnalysis,
  ScriptRow,
} from '@/lib/types';

const BASE_DATE = '2024-06-15T12:00:00.000Z';

function makeReport<T>(
  overrides: Partial<AuditReportRow<T>> & { source_type: AuditReportRow['source_type']; analysis: T }
): AuditReportRow<T> {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: BASE_DATE,
    ...overrides,
  };
}

describe('digestReport – source_type: url (ViralGapAnalysis)', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'good pacing' },
    hook_evaluation: { score: 82, verdict: 'strong', notes: 'Attention-grabbing opener' },
    retention_prediction: {
      at_3s_percent: 72,
      at_30s_percent: 45,
      meets_3s_benchmark: true,
      meets_30s_benchmark: true,
    },
    action_plan: ['Add captions', 'Trim first 2s'],
    source_metrics: {},
  };

  const report = makeReport<ViralGapAnalysis>({ source_type: 'url', analysis });

  it('includes "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('82');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Attention-grabbing opener');
  });

  it('includes 3s retention percentage', () => {
    expect(digestReport(report)).toContain('3s=72%');
  });

  it('includes 30s retention percentage', () => {
    expect(digestReport(report)).toContain('30s=45%');
  });

  it('includes a formatted date', () => {
    const result = digestReport(report);
    // date is locale-formatted, just check it has a year
    expect(result).toMatch(/\d{4}/);
  });
});

describe('digestReport – source_type: account (GrowthBlueprint)', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 76, notes: 'Mostly cooking-focused' },
    view_to_follower_ratio: { value: 0.12, assessment: 'Healthy ratio' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'Consistent' },
    theme_correction: [],
    view_maximization_tactics: ['Use trending sounds'],
    posting_blindspots: ['Tuesday mornings', 'Seasonal holiday content'],
    per_platform_notes: {},
  };

  const report = makeReport<GrowthBlueprint>({ source_type: 'account', analysis });

  it('includes "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic_consistency score', () => {
    expect(digestReport(report)).toContain('76');
  });

  it('includes thematic_consistency notes', () => {
    expect(digestReport(report)).toContain('Mostly cooking-focused');
  });

  it('includes posting_blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Tuesday mornings');
    expect(result).toContain('Seasonal holiday content');
  });

  it('says "none noted" when posting_blindspots is empty', () => {
    const noBlindspots = makeReport<GrowthBlueprint>({
      source_type: 'account',
      analysis: { ...analysis, posting_blindspots: [] },
    });
    expect(digestReport(noBlindspots)).toContain('none noted');
  });
});

describe('digestReport – source_type: upload (UploadDiagnosis)', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 91, verdict: 'strong', notes: 'Bold text on dark bg' },
    audio_balance: { score: 78, notes: 'Music slightly loud vs VO' },
    text_overlay_pacing: { assessment: 'Words appear too quickly' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
  };

  const report = makeReport<UploadDiagnosis>({ source_type: 'upload', analysis });

  it('includes "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('91/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('78/100');
  });

  it('includes audio notes', () => {
    expect(digestReport(report)).toContain('Music slightly loud vs VO');
  });

  it('includes text overlay assessment', () => {
    expect(digestReport(report)).toContain('Words appear too quickly');
  });
});

describe('digestReport – source_type: discovery (SiteDiscoveryResult)', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'vegan meal prep ideas',
    sites: [],
    outlier: {
      url: 'https://example.com/outlier',
      reasoning: 'Unique listicle format vs the rest',
    },
    summary: 'Found 10 relevant sites',
  };

  const report = makeReport<SiteDiscoveryResult>({ source_type: 'discovery', analysis });

  it('includes "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the search query', () => {
    expect(digestReport(report)).toContain('vegan meal prep ideas');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/outlier');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Unique listicle format vs the rest');
  });
});

describe('digestReport – source_type: competitors (CompetitorGapAnalysis)', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: ['Trending sounds'],
    missing_topics: ['Morning routines', 'Budget meals'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['GRWM', 'quick tips'],
  };

  const report = makeReport<CompetitorGapAnalysis>({ source_type: 'competitors', analysis });

  it('includes "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing_topics', () => {
    const result = digestReport(report);
    expect(result).toContain('Morning routines');
    expect(result).toContain('Budget meals');
  });

  it('includes untapped_keyword_clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('GRWM');
    expect(result).toContain('quick tips');
  });

  it('says "none noted" when missing_topics is empty', () => {
    const noTopics = makeReport<CompetitorGapAnalysis>({
      source_type: 'competitors',
      analysis: { ...analysis, missing_topics: [] },
    });
    expect(digestReport(noTopics)).toContain('none noted');
  });

  it('says "none noted" when untapped_keyword_clusters is empty', () => {
    const noClusters = makeReport<CompetitorGapAnalysis>({
      source_type: 'competitors',
      analysis: { ...analysis, untapped_keyword_clusters: [] },
    });
    expect(digestReport(noClusters)).toContain('none noted');
  });
});

describe('digestScript', () => {
  const script: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'Easy Pasta in 60 Seconds',
    source_prompt: null,
    storyboard: {
      spoken_hook: "You've been cooking pasta wrong your whole life.",
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Show boiling pot',
          dialogue_or_vo: "You've been cooking pasta wrong your whole life.",
          audio_sfx_cue: 'Sizzle',
          retention_loop_note: 'Cut to reveal before explaining why',
        },
        {
          scene_number: 2,
          visual_action: 'Close-up of salt',
          dialogue_or_vo: 'This is the key...',
          audio_sfx_cue: '',
          retention_loop_note: 'Suspense cut',
        },
      ],
      cta: 'Save this for dinner tonight',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: BASE_DATE,
  };

  it('includes the script title', () => {
    expect(digestScript(script)).toContain('Easy Pasta in 60 Seconds');
  });

  it('includes the spoken_hook', () => {
    expect(digestScript(script)).toContain("You've been cooking pasta wrong your whole life.");
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(script)).toContain('Cut to reveal before explaining why');
  });

  it('includes the total scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('includes a formatted date', () => {
    const result = digestScript(script);
    expect(result).toMatch(/\d{4}/);
  });

  it('handles a script with no scenes – retention_loop_note shows (none)', () => {
    const emptyScenes: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    expect(digestScript(emptyScenes)).toContain('(none)');
  });

  it('shows 0 scenes total when scenes array is empty', () => {
    const emptyScenes: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    expect(digestScript(emptyScenes)).toContain('0 scenes total');
  });
});
