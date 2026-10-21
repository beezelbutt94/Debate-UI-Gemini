import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { digestReport, digestScript } from '../../lib/digest.ts';
import type {
  AuditReportRow,
  ViralGapAnalysis,
  GrowthBlueprint,
  UploadDiagnosis,
  SiteDiscoveryResult,
  CompetitorGapAnalysis,
  ScriptRow,
} from '../../lib/types.ts';

// Shared base for all AuditReportRow fixtures
const BASE_REPORT = {
  id: 'rpt-1',
  user_id: 'user-1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-09-12T10:00:00.000Z',
} as const;

describe('digestReport – url (ViralGapAnalysis)', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'Good' },
    hook_evaluation: { score: 78, verdict: 'moderate', notes: 'Decent hook' },
    retention_prediction: {
      at_3s_percent: 65,
      at_30s_percent: 42,
      meets_3s_benchmark: true,
      meets_30s_benchmark: true,
    },
    action_plan: ['Improve hook'],
    source_metrics: {},
  };

  const report: AuditReportRow<ViralGapAnalysis> = {
    ...BASE_REPORT,
    source_type: 'url',
    analysis,
  };

  test('includes hook verdict', () => {
    assert.ok(digestReport(report).includes('moderate'));
  });

  test('includes hook score', () => {
    assert.ok(digestReport(report).includes('78'));
  });

  test('includes hook notes', () => {
    assert.ok(digestReport(report).includes('Decent hook'));
  });

  test('includes 3s retention percent', () => {
    assert.ok(digestReport(report).includes('65'));
  });

  test('includes 30s retention percent', () => {
    assert.ok(digestReport(report).includes('42'));
  });

  test('includes Viral Gap Analyzer label', () => {
    assert.ok(digestReport(report).includes('Viral Gap Analyzer'));
  });

  test('includes formatted date', () => {
    const result = digestReport(report);
    // The date will be formatted by toLocaleDateString() so just check it's non-empty
    assert.ok(result.length > 20);
  });
});

describe('digestReport – account (GrowthBlueprint)', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 85, notes: 'Very consistent' },
    view_to_follower_ratio: { value: 1.5, assessment: 'Good' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'Regular' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: ['Weekend content', 'Morning slots'],
    per_platform_notes: {},
  };

  const report: AuditReportRow<GrowthBlueprint> = {
    ...BASE_REPORT,
    source_type: 'account',
    analysis,
  };

  test('includes thematic consistency score', () => {
    assert.ok(digestReport(report).includes('85'));
  });

  test('includes thematic consistency notes', () => {
    assert.ok(digestReport(report).includes('Very consistent'));
  });

  test('includes posting blindspots', () => {
    const result = digestReport(report);
    assert.ok(result.includes('Weekend content'));
    assert.ok(result.includes('Morning slots'));
  });

  test('includes Account Deep-Dive label', () => {
    assert.ok(digestReport(report).includes('Account Deep-Dive'));
  });
});

describe('digestReport – account with no blindspots', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 90, notes: 'Great' },
    view_to_follower_ratio: { value: null, assessment: 'N/A' },
    posting_cadence: { avg_days_between_posts: null, assessment: 'Irregular' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: [],
    per_platform_notes: {},
  };

  const report: AuditReportRow<GrowthBlueprint> = {
    ...BASE_REPORT,
    source_type: 'account',
    analysis,
  };

  test('shows "none noted" when blindspots is empty', () => {
    assert.ok(digestReport(report).includes('none noted'));
  });
});

describe('digestReport – upload (UploadDiagnosis)', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 62, verdict: 'weak', notes: 'Hook unclear' },
    audio_balance: { score: 80, notes: 'Well mixed' },
    text_overlay_pacing: { assessment: 'Too fast' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
  };

  const report: AuditReportRow<UploadDiagnosis> = {
    ...BASE_REPORT,
    source_type: 'upload',
    analysis,
  };

  test('includes visual hook verdict', () => {
    assert.ok(digestReport(report).includes('weak'));
  });

  test('includes visual hook score', () => {
    assert.ok(digestReport(report).includes('62'));
  });

  test('includes audio balance score', () => {
    assert.ok(digestReport(report).includes('80'));
  });

  test('includes audio notes', () => {
    assert.ok(digestReport(report).includes('Well mixed'));
  });

  test('includes text overlay assessment', () => {
    assert.ok(digestReport(report).includes('Too fast'));
  });

  test('includes Upload Diagnostic label', () => {
    assert.ok(digestReport(report).includes('Upload Diagnostic'));
  });
});

describe('digestReport – discovery (SiteDiscoveryResult)', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'fitness creators 2024',
    sites: [],
    outlier: {
      url: 'https://example.com/outlier',
      reasoning: 'Unusually high engagement relative to follower count',
    },
    summary: 'Found 0 relevant sites',
  };

  const report: AuditReportRow<SiteDiscoveryResult> = {
    ...BASE_REPORT,
    source_type: 'discovery',
    analysis,
  };

  test('includes query text', () => {
    assert.ok(digestReport(report).includes('fitness creators 2024'));
  });

  test('includes outlier URL', () => {
    assert.ok(digestReport(report).includes('https://example.com/outlier'));
  });

  test('includes outlier reasoning', () => {
    assert.ok(digestReport(report).includes('Unusually high engagement'));
  });

  test('includes Site Discovery label', () => {
    assert.ok(digestReport(report).includes('Site Discovery'));
  });
});

describe('digestReport – competitors (CompetitorGapAnalysis)', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: ['Tutorials', 'Behind the scenes'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['DIY home gym', 'morning routine'],
  };

  const report: AuditReportRow<CompetitorGapAnalysis> = {
    ...BASE_REPORT,
    source_type: 'competitors',
    analysis,
  };

  test('includes missing topics', () => {
    const result = digestReport(report);
    assert.ok(result.includes('Tutorials'));
    assert.ok(result.includes('Behind the scenes'));
  });

  test('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    assert.ok(result.includes('DIY home gym'));
    assert.ok(result.includes('morning routine'));
  });

  test('includes Competitor Espionage label', () => {
    assert.ok(digestReport(report).includes('Competitor Espionage'));
  });
});

describe('digestReport – competitors with empty arrays', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: [],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: [],
  };

  const report: AuditReportRow<CompetitorGapAnalysis> = {
    ...BASE_REPORT,
    source_type: 'competitors',
    analysis,
  };

  test('shows "none noted" for empty missing topics', () => {
    assert.ok(digestReport(report).includes('none noted'));
  });
});

describe('digestScript', () => {
  const script: ScriptRow = {
    id: 'script-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'Morning Routine Hack',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'You\'re wasting your mornings',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of alarm clock',
          dialogue_or_vo: 'This is scene 1',
          audio_sfx_cue: 'Alarm sound',
          retention_loop_note: 'Open loop: what\'s the hack?',
        },
        {
          scene_number: 2,
          visual_action: 'B-roll coffee',
          dialogue_or_vo: 'Here\'s what most people miss',
          audio_sfx_cue: '',
          retention_loop_note: 'Build tension',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-12T10:00:00.000Z',
  };

  test('includes script title', () => {
    assert.ok(digestScript(script).includes('Morning Routine Hack'));
  });

  test('includes spoken hook', () => {
    assert.ok(digestScript(script).includes('You\'re wasting your mornings'));
  });

  test('includes first scene retention loop note', () => {
    assert.ok(digestScript(script).includes('Open loop: what\'s the hack?'));
  });

  test('includes scene count', () => {
    assert.ok(digestScript(script).includes('2 scenes total'));
  });

  test('returns a non-empty string', () => {
    assert.ok(digestScript(script).length > 10);
  });
});

describe('digestScript with single scene', () => {
  const script: ScriptRow = {
    id: 'script-2',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'One Scene Wonder',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Watch this',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Wide shot',
          dialogue_or_vo: 'Content here',
          audio_sfx_cue: '',
          retention_loop_note: 'Keep watching',
        },
      ],
      cta: 'Like and subscribe',
      memory_context_used: true,
    },
    tone_parameters: {},
    target_platform: 'youtube_shorts',
    created_at: '2024-10-01T08:00:00.000Z',
  };

  test('shows "1 scenes total" for one scene', () => {
    assert.ok(digestScript(script).includes('1 scenes total'));
  });
});

describe('digestScript with no scenes', () => {
  const script: ScriptRow = {
    id: 'script-3',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'Empty Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Hook here',
      scenes: [],
      cta: 'CTA',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: null,
    created_at: '2024-10-01T08:00:00.000Z',
  };

  test('handles empty scenes array gracefully with (none) fallback', () => {
    assert.ok(digestScript(script).includes('(none)'));
  });

  test('still includes title', () => {
    assert.ok(digestScript(script).includes('Empty Script'));
  });
});
