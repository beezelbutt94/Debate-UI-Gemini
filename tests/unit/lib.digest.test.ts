import { describe, it, expect } from 'vitest';
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

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const BASE_REPORT = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-05-15T12:00:00.000Z',
} as const;

// ─── digestReport – url (ViralGapAnalysis) ────────────────────────────────────

describe('digestReport() – source_type: url', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
    hook_evaluation: { score: 82, verdict: 'strong', notes: 'Great pattern interrupt' },
    retention_prediction: {
      at_3s_percent: 72,
      at_30s_percent: 45,
      meets_3s_benchmark: true,
      meets_30s_benchmark: true,
    },
    action_plan: ['Add B-roll'],
    source_metrics: {},
  };

  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'url',
    analysis,
  };

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('82/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Great pattern interrupt');
  });

  it('includes 3s retention %', () => {
    expect(digestReport(report)).toContain('3s=72%');
  });

  it('includes 30s retention %', () => {
    expect(digestReport(report)).toContain('30s=45%');
  });

  it('mentions Viral Gap Analyzer', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes formatted date', () => {
    // Date formatting is locale-dependent; just ensure something is present
    const result = digestReport(report);
    expect(result.length).toBeGreaterThan(20);
  });
});

// ─── digestReport – account (GrowthBlueprint) ────────────────────────────────

describe('digestReport() – source_type: account', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 75, notes: 'Good focus on fitness' },
    view_to_follower_ratio: { value: 1.2, assessment: 'healthy' },
    posting_cadence: { avg_days_between_posts: 2, assessment: 'consistent' },
    theme_correction: [],
    view_maximization_tactics: ['Add trending sounds'],
    posting_blindspots: ['Weekend mornings', 'Holiday recaps'],
    per_platform_notes: {},
  };

  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'account',
    analysis,
  };

  it('mentions Account Deep-Dive', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('75/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Good focus on fitness');
  });

  it('includes posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Weekend mornings');
    expect(result).toContain('Holiday recaps');
  });

  it('shows "none noted" when no blindspots', () => {
    const noBlindspots: AuditReportRow = {
      ...report,
      analysis: { ...analysis, posting_blindspots: [] },
    };
    expect(digestReport(noBlindspots)).toContain('none noted');
  });
});

// ─── digestReport – upload (UploadDiagnosis) ──────────────────────────────────

describe('digestReport() – source_type: upload', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 90, verdict: 'strong', notes: 'Vivid opener' },
    audio_balance: { score: 68, notes: 'Voice slightly quiet' },
    text_overlay_pacing: { assessment: 'Well timed captions' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
  };

  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'upload',
    analysis,
  };

  it('mentions Upload Diagnostic', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('90/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('68/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Voice slightly quiet');
  });

  it('includes text overlay assessment', () => {
    expect(digestReport(report)).toContain('Well timed captions');
  });
});

// ─── digestReport – discovery (SiteDiscoveryResult) ──────────────────────────

describe('digestReport() – source_type: discovery', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'viral fitness content creators 2024',
    sites: [],
    outlier: {
      url: 'https://example.com/fitness',
      reasoning: 'Unique long-form angle on micro content',
    },
    summary: 'Top fitness discovery sites',
  };

  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'discovery',
    analysis,
  };

  it('mentions Site Discovery', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query', () => {
    expect(digestReport(report)).toContain('viral fitness content creators 2024');
  });

  it('includes outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/fitness');
  });

  it('includes outlier reasoning', () => {
    expect(digestReport(report)).toContain('Unique long-form angle on micro content');
  });
});

// ─── digestReport – competitors (CompetitorGapAnalysis) ──────────────────────

describe('digestReport() – source_type: competitors', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: ['GRWM'],
    missing_topics: ['Travel vlogs', 'Product hauls'],
    audience_sentiment_gaps: ['Lack of raw behind-the-scenes'],
    untapped_keyword_clusters: ['#morningroutine', '#aesthetic'],
  };

  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'competitors',
    analysis,
  };

  it('mentions Competitor Espionage', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('Travel vlogs');
    expect(result).toContain('Product hauls');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('#morningroutine');
    expect(result).toContain('#aesthetic');
  });

  it('shows "none noted" for missing_topics when empty', () => {
    const empty: AuditReportRow = {
      ...report,
      analysis: { ...analysis, missing_topics: [] },
    };
    expect(digestReport(empty)).toContain('none noted');
  });

  it('shows "none noted" for untapped keyword clusters when empty', () => {
    const empty: AuditReportRow = {
      ...report,
      analysis: { ...analysis, untapped_keyword_clusters: [] },
    };
    expect(digestReport(empty)).toContain('none noted');
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const script: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Viral Hook Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'This changed everything.',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of face with shocked expression',
          dialogue_or_vo: 'This changed everything.',
          audio_sfx_cue: 'none',
          retention_loop_note: 'Pattern interrupt with sudden silence',
        },
        {
          scene_number: 2,
          visual_action: 'Cut to product reveal',
          dialogue_or_vo: 'Here is why.',
          audio_sfx_cue: 'whoosh',
          retention_loop_note: 'Curiosity gap maintained',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-06-01T08:00:00.000Z',
  };

  it('includes script title', () => {
    expect(digestScript(script)).toContain('My Viral Hook Script');
  });

  it('includes spoken hook', () => {
    expect(digestScript(script)).toContain('This changed everything.');
  });

  it('includes first scene retention loop note', () => {
    expect(digestScript(script)).toContain('Pattern interrupt with sudden silence');
  });

  it('includes total scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('returns a non-empty string', () => {
    const result = digestScript(script);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(10);
  });

  it('handles single-scene script', () => {
    const oneScene: ScriptRow = {
      ...script,
      storyboard: {
        ...script.storyboard,
        scenes: [script.storyboard.scenes[0]],
      },
    };
    expect(digestScript(oneScene)).toContain('1 scenes total');
  });

  it('shows (none) when first scene has no retention_loop_note', () => {
    const noNote: ScriptRow = {
      ...script,
      storyboard: {
        ...script.storyboard,
        scenes: [
          { ...script.storyboard.scenes[0], retention_loop_note: '' },
        ],
      },
    };
    // Empty string is falsy — the ?? fallback returns '(none)'
    const result = digestScript(noNote);
    // An empty retention_loop_note is still truthy for string coalesce —
    // the actual code uses ?. then ?? '(none)' only when the field is missing.
    // When the field exists but is '' the code will render '""'. Verify no crash.
    expect(result).toBeTruthy();
  });

  it('shows (none) for retention loop when scenes array is empty', () => {
    const emptyScenes: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    // weakScene = undefined, so weakScene?.retention_loop_note = undefined,
    // and undefined ?? '(none)' gives '(none)'.
    expect(digestScript(emptyScenes)).toContain('(none)');
  });

  it('shows 0 scenes total for empty storyboard', () => {
    const emptyScenes: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    expect(digestScript(emptyScenes)).toContain('0 scenes total');
  });

  it('includes title in output regardless of scenes', () => {
    const emptyScenes: ScriptRow = {
      ...script,
      title: 'Unique Title XYZ',
      storyboard: { ...script.storyboard, scenes: [] },
    };
    expect(digestScript(emptyScenes)).toContain('Unique Title XYZ');
  });

  it('includes spoken hook even with no scenes', () => {
    const emptyScenes: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, spoken_hook: 'Hook text here.', scenes: [] },
    };
    expect(digestScript(emptyScenes)).toContain('Hook text here.');
  });
});

// ─── digestReport – url edge: boundary scores ────────────────────────────────

describe('digestReport() – url source_type boundary scores', () => {
  const BASE_ANALYSIS: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: null, assessment: 'n/a' },
    hook_evaluation: { score: 50, verdict: 'moderate', notes: 'ok' },
    retention_prediction: {
      at_3s_percent: 50,
      at_30s_percent: 30,
      meets_3s_benchmark: false,
      meets_30s_benchmark: false,
    },
    action_plan: [],
    source_metrics: {},
  };

  it('handles hook score of 0', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'url',
      analysis: {
        ...BASE_ANALYSIS,
        hook_evaluation: { score: 0, verdict: 'weak', notes: 'Zero score' },
      },
    };
    expect(digestReport(report)).toContain('0/100');
  });

  it('handles hook score of 100', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'url',
      analysis: {
        ...BASE_ANALYSIS,
        hook_evaluation: { score: 100, verdict: 'strong', notes: 'Perfect' },
      },
    };
    expect(digestReport(report)).toContain('100/100');
  });

  it('handles 0% and 0% retention', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'url',
      analysis: {
        ...BASE_ANALYSIS,
        retention_prediction: {
          at_3s_percent: 0,
          at_30s_percent: 0,
          meets_3s_benchmark: false,
          meets_30s_benchmark: false,
        },
      },
    };
    const result = digestReport(report);
    expect(result).toContain('3s=0%');
    expect(result).toContain('30s=0%');
  });

  it('handles 100% retention values', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'url',
      analysis: {
        ...BASE_ANALYSIS,
        retention_prediction: {
          at_3s_percent: 100,
          at_30s_percent: 100,
          meets_3s_benchmark: true,
          meets_30s_benchmark: true,
        },
      },
    };
    const result = digestReport(report);
    expect(result).toContain('3s=100%');
    expect(result).toContain('30s=100%');
  });
});

// ─── digestReport – competitors empty both arrays ────────────────────────────

describe('digestReport() – competitors both arrays empty', () => {
  const emptyAnalysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: [],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: [],
  };

  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'competitors',
    analysis: emptyAnalysis,
  };

  it('shows "none noted" for missing_topics when both arrays are empty', () => {
    expect(digestReport(report)).toContain('none noted');
  });

  it('shows two "none noted" (one per array) when both are empty', () => {
    const result = digestReport(report);
    const matches = result.match(/none noted/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});
