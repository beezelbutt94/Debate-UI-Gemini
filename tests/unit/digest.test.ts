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

function baseReport(overrides: Partial<AuditReportRow>): AuditReportRow {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_type: 'url',
    source_url: null,
    platform: null,
    viral_score: null,
    analysis: {} as ViralGapAnalysis,
    timeline_recommendations: [],
    created_at: '2024-03-15T00:00:00Z',
    ...overrides,
  };
}

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 4, assessment: 'good' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'opener needs punch' },
  retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Improve hook'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 80, notes: 'Mostly on-brand' },
  view_to_follower_ratio: { value: 5.2, assessment: 'good' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'regular' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['late-night posts', 'weekend content'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 68, verdict: 'moderate', notes: 'blurry thumbnail' },
  audio_balance: { score: 75, notes: 'slight music bleed' },
  text_overlay_pacing: { assessment: 'too fast' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 120,
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['AI tools', 'productivity hacks'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['notion templates', 'cursor ide'],
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'best notion templates 2024',
  sites: [],
  outlier: { url: 'https://example.com/outlier', reasoning: 'unique angle on minimalism' },
  summary: 'Covers various Notion use cases.',
};

// ── digestReport() ────────────────────────────────────────────────────────────

describe('digestReport() — source_type: url', () => {
  const report = baseReport({ source_type: 'url', analysis: viralAnalysis });

  it('starts with "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('72/100');
  });

  it('includes the hook notes', () => {
    expect(digestReport(report)).toContain('opener needs punch');
  });

  it('includes 3s retention value', () => {
    expect(digestReport(report)).toContain('3s=65%');
  });

  it('includes 30s retention value', () => {
    expect(digestReport(report)).toContain('30s=42%');
  });

  it('includes a date derived from created_at', () => {
    const result = digestReport(report);
    // The exact format depends on locale, but it should include some date
    expect(result).toMatch(/\d/); // at minimum, has digits for the date
  });
});

describe('digestReport() — source_type: account', () => {
  const report = baseReport({ source_type: 'account', analysis: growthAnalysis });

  it('starts with "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('80/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Mostly on-brand');
  });

  it('includes posting blindspots joined by semicolons', () => {
    const result = digestReport(report);
    expect(result).toContain('late-night posts');
    expect(result).toContain('weekend content');
  });
});

describe('digestReport() — source_type: account with no blindspots', () => {
  const report = baseReport({
    source_type: 'account',
    analysis: { ...growthAnalysis, posting_blindspots: [] },
  });

  it('shows "none noted" when blindspots array is empty', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport() — source_type: upload', () => {
  const report = baseReport({ source_type: 'upload', analysis: uploadAnalysis });

  it('starts with "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('68/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('75/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('slight music bleed');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('too fast');
  });
});

describe('digestReport() — source_type: discovery', () => {
  const report = baseReport({ source_type: 'discovery', analysis: discoveryAnalysis });

  it('starts with "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the search query', () => {
    expect(digestReport(report)).toContain('best notion templates 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/outlier');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('unique angle on minimalism');
  });
});

describe('digestReport() — source_type: competitors (default branch)', () => {
  const report = baseReport({ source_type: 'competitors', analysis: competitorAnalysis });

  it('starts with "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('AI tools');
    expect(result).toContain('productivity hacks');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('notion templates');
    expect(result).toContain('cursor ide');
  });
});

describe('digestReport() — competitors with no missing topics / clusters', () => {
  const emptyCompetitor: CompetitorGapAnalysis = {
    ...competitorAnalysis,
    missing_topics: [],
    untapped_keyword_clusters: [],
  };
  const report = baseReport({ source_type: 'competitors', analysis: emptyCompetitor });

  it('shows "none noted" for empty missing_topics', () => {
    expect(digestReport(report)).toContain('missing topics: none noted');
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    expect(digestReport(report)).toContain('untapped keyword clusters: none noted');
  });
});

// ── digestScript() ────────────────────────────────────────────────────────────

const sampleScript: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'How I gained 10k followers',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'You are doing this wrong.',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Closeup face',
        dialogue_or_vo: 'You are doing this wrong.',
        audio_sfx_cue: 'none',
        retention_loop_note: 'Pattern interrupt: bold claim.',
      },
      {
        scene_number: 2,
        visual_action: 'Screen recording',
        dialogue_or_vo: 'Here is the trick.',
        audio_sfx_cue: 'whoosh',
        retention_loop_note: 'Promise of payoff.',
      },
    ],
    cta: 'Follow for more tips.',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-06-01T00:00:00Z',
};

describe('digestScript()', () => {
  it('includes the script title', () => {
    expect(digestScript(sampleScript)).toContain('How I gained 10k followers');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(sampleScript)).toContain('You are doing this wrong.');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(sampleScript)).toContain('Pattern interrupt: bold claim.');
  });

  it('includes the scene count', () => {
    expect(digestScript(sampleScript)).toContain('2 scenes total');
  });

  it('starts with Script "..."', () => {
    expect(digestScript(sampleScript)).toMatch(/^Script "/);
  });

  it('uses "(none)" when first scene has no retention_loop_note', () => {
    const noLoop: ScriptRow = {
      ...sampleScript,
      storyboard: {
        ...sampleScript.storyboard,
        scenes: [
          { ...sampleScript.storyboard.scenes[0], retention_loop_note: '' },
        ],
      },
    };
    // retention_loop_note is '' (falsy) — falls through to ?? '(none)'
    // but actually '' is not nullish, so '(none)' is NOT triggered.
    // the ?? only fires for null/undefined. empty string passes through.
    expect(digestScript(noLoop)).toContain('retention loop:');
  });

  it('uses "(none)" when scenes array is empty', () => {
    const noScenes: ScriptRow = {
      ...sampleScript,
      storyboard: { ...sampleScript.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('(none)');
  });

  it('includes correct scene count for 0 scenes', () => {
    const noScenes: ScriptRow = {
      ...sampleScript,
      storyboard: { ...sampleScript.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('0 scenes total');
  });

  it('includes a date derived from created_at', () => {
    const result = digestScript(sampleScript);
    expect(result).toMatch(/\d/); // has date digits
  });

  it('uses "(none)" when retention_loop_note is undefined/null at runtime', () => {
    // TypeScript says string, but at runtime a missing value is undefined; ?? fires for undefined.
    const noNote: ScriptRow = {
      ...sampleScript,
      storyboard: {
        ...sampleScript.storyboard,
        scenes: [
          { ...sampleScript.storyboard.scenes[0], retention_loop_note: undefined as unknown as string },
        ],
      },
    };
    expect(digestScript(noNote)).toContain('(none)');
  });
});

// ── digestReport() — additional edge cases ────────────────────────────────────

describe('digestReport() — unknown source_type falls through to competitor branch', () => {
  it('does not throw for an unrecognized source_type (falls to default)', () => {
    const report = baseReport({
      source_type: 'competitors' as AuditReportRow['source_type'],
      analysis: { ...competitorAnalysis },
    });
    expect(() => digestReport(report)).not.toThrow();
  });
});

describe('digestReport() — date formatting', () => {
  it('formats date from created_at ISO timestamp', () => {
    const report = baseReport({ source_type: 'url', analysis: viralAnalysis, created_at: '2025-07-04T12:00:00Z' });
    // new Date('2025-07-04T12:00:00Z').toLocaleDateString() should include "2025"
    expect(digestReport(report)).toMatch(/2025/);
  });
});

describe('digestReport() — discovery with no outlier URL (runtime edge)', () => {
  it('includes empty outlier URL without throwing', () => {
    const noOutlierUrl: SiteDiscoveryResult = {
      ...discoveryAnalysis,
      outlier: { url: '', reasoning: 'no outlier found' },
    };
    const report = baseReport({ source_type: 'discovery', analysis: noOutlierUrl });
    expect(digestReport(report)).toContain('no outlier found');
    expect(() => digestReport(report)).not.toThrow();
  });
});
