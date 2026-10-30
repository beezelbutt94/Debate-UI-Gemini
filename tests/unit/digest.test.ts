import { describe, it, expect } from 'vitest';
import { digestReport, digestScript } from '@/lib/digest';
import type {
  AuditReportRow,
  ScriptRow,
  ViralGapAnalysis,
  GrowthBlueprint,
  UploadDiagnosis,
  CompetitorGapAnalysis,
  SiteDiscoveryResult,
} from '@/lib/types';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeReport<T>(
  overrides: Partial<AuditReportRow<T>> & { analysis: T; source_type: AuditReportRow['source_type'] }
): AuditReportRow<T> {
  return {
    id: 'report-1',
    user_id: 'user-1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: '2024-09-12T10:00:00.000Z',
    ...overrides,
  };
}

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Decent open' },
  retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Add music', 'Cut intro'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 80, notes: 'Consistent theme' },
  view_to_follower_ratio: { value: 1.5, assessment: 'Good' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'Regular' },
  theme_correction: [],
  view_maximization_tactics: ['Use trending sounds'],
  posting_blindspots: ['Sunday mornings', 'Late nights'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 55, verdict: 'weak', notes: 'Hook is unclear' },
  audio_balance: { score: 70, notes: 'Good mix' },
  text_overlay_pacing: { assessment: 'Slightly fast' },
  b_roll_recommendations: ['Add B-roll at 10s'],
  retention_boosters: ['Loop at end'],
  frames_analyzed: 120,
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['trending sound #1'],
  missing_topics: ['How-to videos', 'Day-in-life'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['vlog tips', 'creator hacks'],
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'video editing tutorials',
  sites: [],
  outlier: { url: 'https://example.com', reasoning: 'Uniquely covers X unlike the others' },
  summary: 'Found 10 relevant sites',
};

// ── digestReport() tests ──────────────────────────────────────────────────────

describe('digestReport() — source_type: url', () => {
  const report = makeReport({ source_type: 'url', analysis: viralAnalysis });

  it('contains "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('72');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Decent open');
  });

  it('includes 3s retention percentage', () => {
    expect(digestReport(report)).toContain('65%');
  });

  it('includes 30s retention percentage', () => {
    expect(digestReport(report)).toContain('42%');
  });

  it('includes date derived from created_at', () => {
    const result = digestReport(report);
    // Date formatting is locale-dependent but must be non-empty
    expect(result).toMatch(/\d/);
  });

  it('returns a string', () => {
    expect(typeof digestReport(report)).toBe('string');
  });
});

describe('digestReport() — source_type: account', () => {
  const report = makeReport({ source_type: 'account', analysis: growthAnalysis });

  it('contains "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('80');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Consistent theme');
  });

  it('includes posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Sunday mornings');
    expect(result).toContain('Late nights');
  });

  it('handles empty blindspots gracefully', () => {
    const noBlind: GrowthBlueprint = { ...growthAnalysis, posting_blindspots: [] };
    const r = makeReport({ source_type: 'account', analysis: noBlind });
    expect(digestReport(r)).toContain('none noted');
  });
});

describe('digestReport() — source_type: upload', () => {
  const report = makeReport({ source_type: 'upload', analysis: uploadAnalysis });

  it('contains "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('weak');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('55');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('70');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Good mix');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Slightly fast');
  });
});

describe('digestReport() — source_type: competitors', () => {
  const report = makeReport({ source_type: 'competitors', analysis: competitorAnalysis });

  it('contains "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('How-to videos');
    expect(result).toContain('Day-in-life');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('vlog tips');
    expect(result).toContain('creator hacks');
  });

  it('handles empty missing_topics gracefully', () => {
    const empty: CompetitorGapAnalysis = { ...competitorAnalysis, missing_topics: [], untapped_keyword_clusters: [] };
    const r = makeReport({ source_type: 'competitors', analysis: empty });
    expect(digestReport(r)).toContain('none noted');
  });
});

describe('digestReport() — source_type: discovery', () => {
  const report = makeReport({ source_type: 'discovery', analysis: discoveryAnalysis });

  it('contains "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query string', () => {
    expect(digestReport(report)).toContain('video editing tutorials');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Uniquely covers X unlike the others');
  });
});

// ── digestScript() tests ──────────────────────────────────────────────────────

const sampleScript: ScriptRow = {
  id: 'script-1',
  user_id: 'user-1',
  creator_profile_id: null,
  title: 'My Viral Hook',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'Did you know this trick?',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Pan across screen',
        dialogue_or_vo: 'Here is the hook',
        audio_sfx_cue: 'none',
        retention_loop_note: 'Cut to reaction shot',
      },
      {
        scene_number: 2,
        visual_action: 'B-roll',
        dialogue_or_vo: 'More content',
        audio_sfx_cue: 'music',
        retention_loop_note: 'Loop callback',
      },
    ],
    cta: 'Follow for more',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-10-01T08:00:00.000Z',
};

describe('digestScript()', () => {
  it('returns a string', () => {
    expect(typeof digestScript(sampleScript)).toBe('string');
  });

  it('includes the script title', () => {
    expect(digestScript(sampleScript)).toContain('My Viral Hook');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(sampleScript)).toContain('Did you know this trick?');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(sampleScript)).toContain('Cut to reaction shot');
  });

  it('includes the total scene count', () => {
    expect(digestScript(sampleScript)).toContain('2 scenes total');
  });

  it('includes date from created_at', () => {
    const result = digestScript(sampleScript);
    expect(result).toMatch(/\d/);
  });

  it('handles script with no scenes gracefully', () => {
    const noScenes: ScriptRow = {
      ...sampleScript,
      storyboard: { ...sampleScript.storyboard, scenes: [] },
    };
    const result = digestScript(noScenes);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('handles script with one scene', () => {
    const oneScene: ScriptRow = {
      ...sampleScript,
      storyboard: { ...sampleScript.storyboard, scenes: [sampleScript.storyboard.scenes[0]] },
    };
    expect(digestScript(oneScene)).toContain('1 scenes total');
  });
});
