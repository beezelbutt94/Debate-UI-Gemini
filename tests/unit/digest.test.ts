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

// Shared date for predictable output assertions
const ISO_DATE = '2024-06-15T12:00:00.000Z';
const LOCALE_DATE = new Date(ISO_DATE).toLocaleDateString();

function baseReport<T>(overrides: Partial<AuditReportRow> & { analysis: T }): AuditReportRow<T> {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: ISO_DATE,
    ...overrides,
  } as AuditReportRow<T>;
}

describe('digestReport() — source_type: url (ViralGapAnalysis)', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
    hook_evaluation: { score: 82, verdict: 'strong', notes: 'great pattern interrupt' },
    retention_prediction: { at_3s_percent: 72, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
    action_plan: ['add b-roll'],
    source_metrics: {},
  };

  const report = baseReport({ source_type: 'url', analysis });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('82/100');
  });

  it('includes the hook notes', () => {
    expect(digestReport(report)).toContain('great pattern interrupt');
  });

  it('includes 3s retention', () => {
    expect(digestReport(report)).toContain('3s=72%');
  });

  it('includes 30s retention', () => {
    expect(digestReport(report)).toContain('30s=45%');
  });

  it('includes the formatted date', () => {
    expect(digestReport(report)).toContain(LOCALE_DATE);
  });

  it('contains "Viral Gap Analyzer" label', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });
});

describe('digestReport() — source_type: account (GrowthBlueprint)', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 65, notes: 'mixed niches' },
    view_to_follower_ratio: { value: 2.3, assessment: 'average' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'good' },
    theme_correction: ['focus on tech'],
    view_maximization_tactics: ['stronger hooks'],
    posting_blindspots: ['no weekend posts', 'missing morning slot'],
    per_platform_notes: {},
  };

  const report = baseReport({ source_type: 'account', analysis });

  it('contains "Account Deep-Dive" label', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('65/100');
  });

  it('includes thematic notes', () => {
    expect(digestReport(report)).toContain('mixed niches');
  });

  it('includes posting blindspots joined by semicolons', () => {
    expect(digestReport(report)).toContain('no weekend posts; missing morning slot');
  });

  it('shows "none noted" when blindspots array is empty', () => {
    const noBlindspots: GrowthBlueprint = { ...analysis, posting_blindspots: [] };
    const r = baseReport({ source_type: 'account', analysis: noBlindspots });
    expect(digestReport(r)).toContain('none noted');
  });
});

describe('digestReport() — source_type: upload (UploadDiagnosis)', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 55, verdict: 'moderate', notes: 'slow start' },
    audio_balance: { score: 78, notes: 'slight bass boost' },
    text_overlay_pacing: { assessment: 'too dense' },
    b_roll_recommendations: ['use nature shots'],
    retention_boosters: ['add captions'],
    frames_analyzed: 120,
  };

  const report = baseReport({ source_type: 'upload', analysis });

  it('contains "Upload Diagnostic" label', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('55/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('78/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('slight bass boost');
  });

  it('includes text overlay assessment', () => {
    expect(digestReport(report)).toContain('too dense');
  });
});

describe('digestReport() — source_type: discovery (SiteDiscoveryResult)', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'viral marketing strategies',
    sites: [],
    outlier: { url: 'https://example.com', reasoning: 'unique angle on retention' },
    summary: 'top sites for viral marketing',
  };

  const report = baseReport({ source_type: 'discovery', analysis });

  it('contains "Site Discovery" label', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the search query', () => {
    expect(digestReport(report)).toContain('viral marketing strategies');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com');
  });

  it('includes outlier reasoning', () => {
    expect(digestReport(report)).toContain('unique angle on retention');
  });
});

describe('digestReport() — source_type: competitors (CompetitorGapAnalysis)', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: ['meme formats'],
    missing_topics: ['behind the scenes', 'tutorials'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['#growthhack', '#creatoreconomy'],
  };

  const report = baseReport({ source_type: 'competitors', analysis });

  it('contains "Competitor Espionage" label', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics joined by semicolons', () => {
    expect(digestReport(report)).toContain('behind the scenes; tutorials');
  });

  it('includes untapped keyword clusters', () => {
    expect(digestReport(report)).toContain('#growthhack; #creatoreconomy');
  });

  it('shows "none noted" for empty missing_topics', () => {
    const a2: CompetitorGapAnalysis = { ...analysis, missing_topics: [] };
    const r = baseReport({ source_type: 'competitors', analysis: a2 });
    expect(digestReport(r)).toContain('none noted');
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    const a2: CompetitorGapAnalysis = { ...analysis, untapped_keyword_clusters: [] };
    const r = baseReport({ source_type: 'competitors', analysis: a2 });
    expect(digestReport(r)).toContain('none noted');
  });
});

describe('digestScript()', () => {
  function makeScript(overrides?: Partial<ScriptRow>): ScriptRow {
    return {
      id: 's1',
      user_id: 'u1',
      creator_profile_id: null,
      title: 'My Viral Script',
      source_prompt: null,
      tone_parameters: {},
      target_platform: 'tiktok',
      created_at: ISO_DATE,
      storyboard: {
        spoken_hook: 'Stop what you are doing right now.',
        scenes: [
          {
            scene_number: 1,
            visual_action: 'Close-up of hands',
            dialogue_or_vo: 'You will not believe this.',
            audio_sfx_cue: 'dramatic sting',
            retention_loop_note: 'open loop: what happens next?',
          },
          {
            scene_number: 2,
            visual_action: 'Wide shot of city',
            dialogue_or_vo: 'Here is the secret.',
            audio_sfx_cue: 'build up',
            retention_loop_note: 'payoff moment',
          },
        ],
        cta: 'Follow for more.',
        memory_context_used: false,
      },
      ...overrides,
    };
  }

  it('includes the script title', () => {
    expect(digestScript(makeScript())).toContain('My Viral Script');
  });

  it('includes the formatted date', () => {
    expect(digestScript(makeScript())).toContain(LOCALE_DATE);
  });

  it('includes the spoken hook', () => {
    expect(digestScript(makeScript())).toContain('Stop what you are doing right now.');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(makeScript())).toContain('open loop: what happens next?');
  });

  it('includes the total scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });

  it('handles script with no scenes gracefully', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    const result = digestScript(script);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('uses first scene retention_loop_note, not the second', () => {
    const result = digestScript(makeScript());
    expect(result).toContain('open loop: what happens next?');
    expect(result).not.toContain('payoff moment');
  });
});
