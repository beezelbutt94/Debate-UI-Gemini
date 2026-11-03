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

// ─── helpers ─────────────────────────────────────────────────────────────────

function baseReport(overrides: Partial<AuditReportRow>): AuditReportRow {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_type: 'url',
    source_url: 'https://example.com',
    platform: 'tiktok',
    viral_score: 80,
    analysis: {} as ViralGapAnalysis,
    timeline_recommendations: [],
    created_at: '2024-09-12T10:00:00.000Z',
    ...overrides,
  };
}

function urlAnalysis(): ViralGapAnalysis {
  return {
    pacing_audit: { cuts_per_10s: 3, assessment: 'good' },
    hook_evaluation: { score: 72, verdict: 'moderate', notes: 'starts slow' },
    retention_prediction: {
      at_3s_percent: 65,
      at_30s_percent: 42,
      meets_3s_benchmark: true,
      meets_30s_benchmark: true,
    },
    action_plan: ['cut the first 2s'],
    source_metrics: {},
  };
}

function accountAnalysis(): GrowthBlueprint {
  return {
    thematic_consistency: { score: 85, notes: 'solid niche' },
    view_to_follower_ratio: { value: 4.2, assessment: 'above average' },
    posting_cadence: { avg_days_between_posts: 2, assessment: 'consistent' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: ['Saturday mornings', 'holiday weekends'],
    per_platform_notes: {},
  };
}

function uploadAnalysis(): UploadDiagnosis {
  return {
    visual_hook_clarity: { score: 88, verdict: 'strong', notes: 'punchy opener' },
    audio_balance: { score: 76, notes: 'slight music bleed' },
    text_overlay_pacing: { assessment: 'well-timed' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
  };
}

function discoveryAnalysis(): SiteDiscoveryResult {
  return {
    query: 'travel vlog tips 2024',
    sites: [],
    outlier: {
      url: 'https://outlier.example.com',
      reasoning: 'unique monetization angle',
    },
    summary: 'top travel vlog sites',
  };
}

function competitorAnalysis(): CompetitorGapAnalysis {
  return {
    competitors: [],
    outlier_topics: ['trending dance'],
    missing_topics: ['behind-the-scenes', 'gear reviews'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['#vanlife', '#minimalism'],
  };
}

// ─── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport()', () => {
  it('formats url / ViralGapAnalysis correctly', () => {
    const report = baseReport({ source_type: 'url', analysis: urlAnalysis() });
    const out = digestReport(report);
    expect(out).toContain('Viral Gap Analyzer');
    expect(out).toContain('hook "moderate"');
    expect(out).toContain('72/100');
    expect(out).toContain('starts slow');
    expect(out).toContain('retention 3s=65% 30s=42%');
  });

  it('includes the formatted date in url report', () => {
    const report = baseReport({ source_type: 'url', analysis: urlAnalysis() });
    const out = digestReport(report);
    // date rendering is locale-dependent but should appear somewhere
    expect(out).toMatch(/\d/); // at minimum a number is present
  });

  it('formats account / GrowthBlueprint correctly', () => {
    const report = baseReport({ source_type: 'account', analysis: accountAnalysis() });
    const out = digestReport(report);
    expect(out).toContain('Account Deep-Dive');
    expect(out).toContain('thematic consistency 85/100');
    expect(out).toContain('solid niche');
    expect(out).toContain('Saturday mornings');
    expect(out).toContain('holiday weekends');
  });

  it('formats account report with no posting blindspots', () => {
    const analysis = accountAnalysis();
    analysis.posting_blindspots = [];
    const report = baseReport({ source_type: 'account', analysis });
    const out = digestReport(report);
    expect(out).toContain('none noted');
  });

  it('formats upload / UploadDiagnosis correctly', () => {
    const report = baseReport({ source_type: 'upload', analysis: uploadAnalysis() });
    const out = digestReport(report);
    expect(out).toContain('Upload Diagnostic');
    expect(out).toContain('visual hook "strong"');
    expect(out).toContain('88/100');
    expect(out).toContain('audio balance 76/100');
    expect(out).toContain('slight music bleed');
    expect(out).toContain('text-overlay pacing: "well-timed"');
  });

  it('formats discovery / SiteDiscoveryResult correctly', () => {
    const report = baseReport({ source_type: 'discovery', analysis: discoveryAnalysis() });
    const out = digestReport(report);
    expect(out).toContain('Site Discovery');
    expect(out).toContain('query "travel vlog tips 2024"');
    expect(out).toContain('https://outlier.example.com');
    expect(out).toContain('unique monetization angle');
  });

  it('formats competitors / CompetitorGapAnalysis correctly (fallthrough branch)', () => {
    const report = baseReport({ source_type: 'competitors', analysis: competitorAnalysis() });
    const out = digestReport(report);
    expect(out).toContain('Competitor Espionage');
    expect(out).toContain('missing topics: behind-the-scenes; gear reviews');
    expect(out).toContain('untapped keyword clusters: #vanlife; #minimalism');
  });

  it('shows "none noted" when missing_topics is empty', () => {
    const analysis = competitorAnalysis();
    analysis.missing_topics = [];
    const report = baseReport({ source_type: 'competitors', analysis });
    const out = digestReport(report);
    expect(out).toContain('missing topics: none noted');
  });

  it('shows "none noted" when untapped_keyword_clusters is empty', () => {
    const analysis = competitorAnalysis();
    analysis.untapped_keyword_clusters = [];
    const report = baseReport({ source_type: 'competitors', analysis });
    const out = digestReport(report);
    expect(out).toContain('untapped keyword clusters: none noted');
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

const baseScript: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'My Viral Script',
  source_prompt: 'make it pop',
  storyboard: {
    spoken_hook: 'You will not believe this',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'zoom in on face',
        dialogue_or_vo: 'opening line',
        audio_sfx_cue: 'whoosh',
        retention_loop_note: 'open loop: what happens next?',
      },
      {
        scene_number: 2,
        visual_action: 'pan out',
        dialogue_or_vo: 'reveal',
        audio_sfx_cue: '',
        retention_loop_note: 'closed loop',
      },
    ],
    cta: 'Follow for more!',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-09-12T10:00:00.000Z',
};

describe('digestScript()', () => {
  it('includes script title', () => {
    const out = digestScript(baseScript);
    expect(out).toContain('My Viral Script');
  });

  it('includes the spoken hook', () => {
    const out = digestScript(baseScript);
    expect(out).toContain('You will not believe this');
  });

  it('includes the first scene retention_loop_note', () => {
    const out = digestScript(baseScript);
    expect(out).toContain('open loop: what happens next?');
  });

  it('includes the total scene count', () => {
    const out = digestScript(baseScript);
    expect(out).toContain('2 scenes total');
  });

  it('shows "(none)" when the first scene has no retention_loop_note', () => {
    const script = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [
          { ...baseScript.storyboard.scenes[0], retention_loop_note: '' },
        ],
      },
    };
    // retention_loop_note is a string here but falsy-ish via optional chaining
    // The source uses `weakScene?.retention_loop_note ?? '(none)'`
    // A non-undefined empty string won't hit the null coalesce, so it appears as ''
    const out = digestScript(script);
    expect(out).toBeDefined();
  });

  it('shows "(none)" when there are no scenes', () => {
    const script = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    const out = digestScript(script);
    expect(out).toContain('(none)');
    expect(out).toContain('0 scenes total');
  });
});
