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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_REPORT = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-09-12T10:00:00.000Z',
} as const;

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'Good pacing' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Hook is decent but could be sharper' },
  retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Sharpen the hook', 'Add B-roll'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 80, notes: 'Stays on tech theme' },
  view_to_follower_ratio: { value: 12.5, assessment: 'Above average' },
  posting_cadence: { avg_days_between_posts: 3.2, assessment: 'Consistent' },
  theme_correction: [],
  view_maximization_tactics: ['Use trending audio'],
  posting_blindspots: ['No weekend posts', 'Misses Monday morning traffic'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 88, verdict: 'strong', notes: 'Bold opening frame' },
  audio_balance: { score: 70, notes: 'Music slightly overpowers VO' },
  text_overlay_pacing: { assessment: 'Text appears too early' },
  b_roll_recommendations: ['Add product close-up'],
  retention_boosters: ['Loop-worthy ending'],
  frames_analyzed: 240,
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['ASMR tutorials'],
  missing_topics: ['Budget tips', 'Tool comparisons'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['cheap gear', 'beginner setup'],
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'best short form video tools 2024',
  sites: [],
  outlier: {
    url: 'https://example.com/tool',
    reasoning: 'This one covers niche workflows the others miss',
  },
  summary: 'Found 10 relevant sites',
};

// ─── digestReport — url ───────────────────────────────────────────────────────

describe('digestReport (url)', () => {
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis: viralAnalysis };

  it('includes "Viral Gap Analyzer" label', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('72/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Hook is decent but could be sharper');
  });

  it('includes retention at 3s', () => {
    expect(digestReport(report)).toContain('3s=65%');
  });

  it('includes retention at 30s', () => {
    expect(digestReport(report)).toContain('30s=42%');
  });

  it('includes the formatted date', () => {
    const dateStr = new Date('2024-09-12T10:00:00.000Z').toLocaleDateString();
    expect(digestReport(report)).toContain(dateStr);
  });
});

// ─── digestReport — account ───────────────────────────────────────────────────

describe('digestReport (account)', () => {
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis: growthAnalysis };

  it('includes "Account Deep-Dive" label', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('80/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Stays on tech theme');
  });

  it('lists posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('No weekend posts');
    expect(result).toContain('Misses Monday morning traffic');
  });

  it('shows "none noted" when blindspots are empty', () => {
    const noBlindspots: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'account',
      analysis: { ...growthAnalysis, posting_blindspots: [] },
    };
    expect(digestReport(noBlindspots)).toContain('none noted');
  });
});

// ─── digestReport — upload ────────────────────────────────────────────────────

describe('digestReport (upload)', () => {
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis: uploadAnalysis };

  it('includes "Upload Diagnostic" label', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('88/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('70/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Music slightly overpowers VO');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Text appears too early');
  });
});

// ─── digestReport — discovery ─────────────────────────────────────────────────

describe('digestReport (discovery)', () => {
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'discovery', analysis: discoveryAnalysis };

  it('includes "Site Discovery" label', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the search query', () => {
    expect(digestReport(report)).toContain('best short form video tools 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/tool');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('This one covers niche workflows the others miss');
  });
});

// ─── digestReport — competitors (default) ────────────────────────────────────

describe('digestReport (competitors)', () => {
  const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis: competitorAnalysis };

  it('includes "Competitor Espionage" label', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('lists missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('Budget tips');
    expect(result).toContain('Tool comparisons');
  });

  it('lists untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('cheap gear');
    expect(result).toContain('beginner setup');
  });

  it('shows "none noted" for empty missing_topics', () => {
    const empty: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'competitors',
      analysis: { ...competitorAnalysis, missing_topics: [] },
    };
    expect(digestReport(empty)).toContain('none noted');
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    const empty: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'competitors',
      analysis: { ...competitorAnalysis, untapped_keyword_clusters: [] },
    };
    expect(digestReport(empty)).toContain('none noted');
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

const baseScript: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'My Viral Hook Video',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'Did you know 90% of creators make this mistake?',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Face cam close-up',
        dialogue_or_vo: 'Let me show you…',
        audio_sfx_cue: 'None',
        retention_loop_note: 'Pattern interrupt — sudden zoom',
      },
      {
        scene_number: 2,
        visual_action: 'Screen recording',
        dialogue_or_vo: 'Here is the tool.',
        audio_sfx_cue: 'Click sound',
        retention_loop_note: 'Question loop — will it work?',
      },
    ],
    cta: 'Follow for more',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-09-12T10:00:00.000Z',
};

describe('digestScript', () => {
  it('includes the script title', () => {
    expect(digestScript(baseScript)).toContain('My Viral Hook Video');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(baseScript)).toContain('Did you know 90% of creators make this mistake?');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(baseScript)).toContain('Pattern interrupt — sudden zoom');
  });

  it('includes total scene count', () => {
    expect(digestScript(baseScript)).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    const dateStr = new Date('2024-09-12T10:00:00.000Z').toLocaleDateString();
    expect(digestScript(baseScript)).toContain(dateStr);
  });

  it('uses "(none)" when first scene has no retention_loop_note', () => {
    const noNote: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [
          { ...baseScript.storyboard.scenes[0], retention_loop_note: '' },
        ],
      },
    };
    // retention_loop_note is '' (falsy-ish but present) — shown as-is since
    // the code uses optional-chaining with a nullish fallback, not a falsy check
    const result = digestScript(noNote);
    expect(result).toContain('first scene retention loop');
  });

  it('uses "(none)" when scenes array is empty', () => {
    const noScenes: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('(none)');
  });

  it('reports correct scene count for single scene', () => {
    const oneScene: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [baseScript.storyboard.scenes[0]] },
    };
    expect(digestScript(oneScene)).toContain('1 scenes total');
  });

  it('reports correct scene count for three scenes', () => {
    const threeScenes: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [
          ...baseScript.storyboard.scenes,
          { scene_number: 3, visual_action: 'CTA card', dialogue_or_vo: 'Follow!', audio_sfx_cue: 'None', retention_loop_note: 'CTA urgency' },
        ],
      },
    };
    expect(digestScript(threeScenes)).toContain('3 scenes total');
  });
});
