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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReport<T>(
  source_type: AuditReportRow['source_type'],
  analysis: T,
  created_at = '2024-09-12T10:00:00Z'
): AuditReportRow<T> {
  return {
    id: 'report-1',
    user_id: 'user-1',
    creator_profile_id: null,
    source_type,
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at,
  };
}

// ---------------------------------------------------------------------------
// digestReport — source_type: 'url' (ViralGapAnalysis)
// ---------------------------------------------------------------------------

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'Fast' },
  hook_evaluation: { score: 82, verdict: 'strong', notes: 'Punchy opener' },
  retention_prediction: {
    at_3s_percent: 75,
    at_30s_percent: 45,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Improve CTA'],
  source_metrics: {},
};

describe('digestReport() — source_type: url', () => {
  const report = makeReport('url', viralAnalysis);

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('82/100');
  });

  it('includes the hook notes', () => {
    expect(digestReport(report)).toContain('Punchy opener');
  });

  it('includes 3s retention percentage', () => {
    expect(digestReport(report)).toContain('3s=75%');
  });

  it('includes 30s retention percentage', () => {
    expect(digestReport(report)).toContain('30s=45%');
  });

  it('includes the report type label', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the formatted date', () => {
    // Just verify a date string appears (locale-dependent format)
    const output = digestReport(report);
    expect(output).toMatch(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}/);
  });

  it('returns a string', () => {
    expect(typeof digestReport(report)).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// digestReport — source_type: 'account' (GrowthBlueprint)
// ---------------------------------------------------------------------------

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 70, notes: 'Mixed topics dilute brand' },
  view_to_follower_ratio: { value: 0.05, assessment: 'Below average' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'Consistent' },
  theme_correction: ['Focus on tech'],
  view_maximization_tactics: ['Use trending audio'],
  posting_blindspots: ['Monday mornings', 'Late night'],
  per_platform_notes: {},
};

describe('digestReport() — source_type: account', () => {
  const report = makeReport('account', growthAnalysis);

  it('includes the Account Deep-Dive label', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes the thematic consistency score', () => {
    expect(digestReport(report)).toContain('70/100');
  });

  it('includes the thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Mixed topics dilute brand');
  });

  it('includes posting blindspots joined with semicolon', () => {
    expect(digestReport(report)).toContain('Monday mornings; Late night');
  });

  it('handles empty posting_blindspots with "none noted"', () => {
    const empty = makeReport('account', { ...growthAnalysis, posting_blindspots: [] });
    expect(digestReport(empty)).toContain('none noted');
  });
});

// ---------------------------------------------------------------------------
// digestReport — source_type: 'upload' (UploadDiagnosis)
// ---------------------------------------------------------------------------

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 65, verdict: 'moderate', notes: 'Unclear initial frame' },
  audio_balance: { score: 80, notes: 'Good music-to-voice balance' },
  text_overlay_pacing: { assessment: 'Overlays appear too early' },
  b_roll_recommendations: ['Add cutaway at 5s'],
  retention_boosters: ['Add captions'],
  frames_analyzed: 120,
};

describe('digestReport() — source_type: upload', () => {
  const report = makeReport('upload', uploadAnalysis);

  it('includes the Upload Diagnostic label', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes the visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes the visual hook score', () => {
    expect(digestReport(report)).toContain('65/100');
  });

  it('includes the audio balance score', () => {
    expect(digestReport(report)).toContain('80/100');
  });

  it('includes the audio balance notes', () => {
    expect(digestReport(report)).toContain('Good music-to-voice balance');
  });

  it('includes the text-overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Overlays appear too early');
  });
});

// ---------------------------------------------------------------------------
// digestReport — source_type: 'discovery' (SiteDiscoveryResult)
// ---------------------------------------------------------------------------

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'best vlogging cameras 2024',
  sites: [],
  outlier: {
    url: 'https://outdoorphotographer.com/gear',
    reasoning: 'Focuses on outdoor shooting, unlike mainstream consumer picks',
  },
  summary: 'Variety of camera recommendations',
};

describe('digestReport() — source_type: discovery', () => {
  const report = makeReport('discovery', discoveryAnalysis);

  it('includes the Site Discovery label', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the search query', () => {
    expect(digestReport(report)).toContain('best vlogging cameras 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://outdoorphotographer.com/gear');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Focuses on outdoor shooting');
  });
});

// ---------------------------------------------------------------------------
// digestReport — source_type: 'competitors' (CompetitorGapAnalysis, default branch)
// ---------------------------------------------------------------------------

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['AI tutorials'],
  missing_topics: ['Shorts strategy', 'Community posts'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['video gear reviews', 'editing workflows'],
};

describe('digestReport() — source_type: competitors', () => {
  const report = makeReport('competitors', competitorAnalysis);

  it('includes the Competitor Espionage label', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('lists missing topics', () => {
    expect(digestReport(report)).toContain('Shorts strategy; Community posts');
  });

  it('lists untapped keyword clusters', () => {
    expect(digestReport(report)).toContain('video gear reviews; editing workflows');
  });

  it('handles empty missing_topics with "none noted"', () => {
    const empty = makeReport('competitors', { ...competitorAnalysis, missing_topics: [] });
    const out = digestReport(empty);
    expect(out).toContain('missing topics: none noted');
  });

  it('handles empty untapped_keyword_clusters with "none noted"', () => {
    const empty = makeReport('competitors', {
      ...competitorAnalysis,
      untapped_keyword_clusters: [],
    });
    const out = digestReport(empty);
    expect(out).toContain('untapped keyword clusters: none noted');
  });
});

// ---------------------------------------------------------------------------
// digestScript
// ---------------------------------------------------------------------------

const baseScript: ScriptRow = {
  id: 'script-1',
  user_id: 'user-1',
  creator_profile_id: null,
  title: 'My Viral Hook Script',
  source_prompt: null,
  storyboard: {
    spoken_hook: "You won't believe this camera trick",
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Zoom into camera lens',
        dialogue_or_vo: "You won't believe this camera trick",
        audio_sfx_cue: 'woosh',
        retention_loop_note: 'Cut to reaction before viewer can look away',
      },
      {
        scene_number: 2,
        visual_action: 'Demo shot',
        dialogue_or_vo: "Here's the result",
        audio_sfx_cue: 'none',
        retention_loop_note: 'End on cliffhanger',
      },
    ],
    cta: 'Subscribe for more',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-09-12T10:00:00Z',
};

describe('digestScript()', () => {
  it('includes the script title', () => {
    expect(digestScript(baseScript)).toContain('My Viral Hook Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(baseScript)).toContain("You won't believe this camera trick");
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(baseScript)).toContain('Cut to reaction before viewer can look away');
  });

  it('includes the correct scene count', () => {
    expect(digestScript(baseScript)).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    const output = digestScript(baseScript);
    expect(output).toMatch(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}/);
  });

  it('returns a string', () => {
    expect(typeof digestScript(baseScript)).toBe('string');
  });

  it('handles missing retention_loop_note on first scene gracefully', () => {
    const noNote: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [
          {
            ...baseScript.storyboard.scenes[0],
            retention_loop_note: '',
          },
        ],
      },
    };
    // Empty string is falsy with ??, so it falls back to '(none)' only if undefined/null
    // The actual value is '', which is not nullish, so it stays as ''
    const out = digestScript(noNote);
    expect(out).toContain('first scene retention loop');
  });

  it('uses "(none)" when first scene has no retention_loop_note (undefined)', () => {
    const scene = { ...baseScript.storyboard.scenes[0] };
    // @ts-expect-error intentionally removing the field to simulate undefined
    delete scene.retention_loop_note;
    const noNote: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [scene],
      },
    };
    expect(digestScript(noNote)).toContain('(none)');
  });

  it('handles a script with a single scene', () => {
    const oneScene: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [baseScript.storyboard.scenes[0]],
      },
    };
    expect(digestScript(oneScene)).toContain('1 scenes total');
  });

  it('handles a script with many scenes', () => {
    const manyScenes: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: Array.from({ length: 10 }, (_, i) => ({
          ...baseScript.storyboard.scenes[0],
          scene_number: i + 1,
        })),
      },
    };
    expect(digestScript(manyScenes)).toContain('10 scenes total');
  });

  it('uses the first scene (index 0) for retention_loop_note, not the last', () => {
    const script: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [
          { ...baseScript.storyboard.scenes[0], retention_loop_note: 'FIRST-NOTE' },
          { ...baseScript.storyboard.scenes[1], retention_loop_note: 'SECOND-NOTE' },
        ],
      },
    };
    const out = digestScript(script);
    expect(out).toContain('FIRST-NOTE');
    expect(out).not.toContain('SECOND-NOTE');
  });
});
