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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'rpt-1',
  user_id: 'user-1',
  creator_profile_id: null,
  source_url: 'https://example.com',
  platform: 'tiktok',
  viral_score: 80,
  timeline_recommendations: [],
  created_at: '2024-06-01T12:00:00.000Z',
};

const VIRAL_GAP: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'Good pacing' },
  hook_evaluation: { score: 75, verdict: 'strong', notes: 'Engaging opener' },
  retention_prediction: {
    at_3s_percent: 65,
    at_30s_percent: 42,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Add captions', 'Speed up intro'],
  source_metrics: {},
};

const GROWTH_BLUEPRINT: GrowthBlueprint = {
  thematic_consistency: { score: 88, notes: 'Consistent cooking niche' },
  view_to_follower_ratio: { value: 12.5, assessment: 'Above average' },
  posting_cadence: { avg_days_between_posts: 2, assessment: 'Frequent' },
  theme_correction: [],
  view_maximization_tactics: ['Cross-post to Reels'],
  posting_blindspots: ['Weekends underutilised', 'Morning slots missed'],
  per_platform_notes: { tiktok: 'Good performance' },
};

const UPLOAD_DIAGNOSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'Could improve thumbnail' },
  audio_balance: { score: 85, notes: 'Clear voice, balanced music' },
  text_overlay_pacing: { assessment: 'Text appears too quickly' },
  b_roll_recommendations: ['Use nature b-roll'],
  retention_boosters: ['Cut 5s from intro'],
  frames_analyzed: 120,
};

const SITE_DISCOVERY: SiteDiscoveryResult = {
  query: 'cooking hacks for beginners',
  sites: [],
  outlier: {
    url: 'https://foodhacks.io',
    reasoning: 'Far higher engagement-to-view ratio than the other nine',
  },
  summary: 'Found 10 relevant cooking sites',
};

const COMPETITOR_GAP: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['vegan swaps', 'meal prep'],
  missing_topics: ['budget meals', 'air fryer recipes'],
  audience_sentiment_gaps: ['wants shorter videos'],
  untapped_keyword_clusters: ['5-minute dinners', 'college cooking'],
};

// ─── digestReport() ───────────────────────────────────────────────────────────

describe('digestReport()', () => {
  it('formats a "url" (Viral Gap) report correctly', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'url',
      analysis: VIRAL_GAP,
    };
    const result = digestReport(report);
    expect(result).toContain('Viral Gap Analyzer');
    expect(result).toContain('strong');
    expect(result).toContain('75/100');
    expect(result).toContain('Engaging opener');
    expect(result).toContain('65%');
    expect(result).toContain('42%');
  });

  it('includes hook verdict in "url" report', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'url',
      analysis: { ...VIRAL_GAP, hook_evaluation: { score: 30, verdict: 'weak', notes: 'Poor' } },
    };
    expect(digestReport(report)).toContain('weak');
  });

  it('formats an "account" (Growth Blueprint) report correctly', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'account',
      analysis: GROWTH_BLUEPRINT,
    };
    const result = digestReport(report);
    expect(result).toContain('Account Deep-Dive');
    expect(result).toContain('88/100');
    expect(result).toContain('Consistent cooking niche');
    expect(result).toContain('Weekends underutilised');
    expect(result).toContain('Morning slots missed');
  });

  it('shows "none noted" for "account" report with empty blindspots', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'account',
      analysis: { ...GROWTH_BLUEPRINT, posting_blindspots: [] },
    };
    expect(digestReport(report)).toContain('none noted');
  });

  it('formats an "upload" (Upload Diagnostic) report correctly', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'upload',
      analysis: UPLOAD_DIAGNOSIS,
    };
    const result = digestReport(report);
    expect(result).toContain('Upload Diagnostic');
    expect(result).toContain('moderate');
    expect(result).toContain('60/100');
    expect(result).toContain('85/100');
    expect(result).toContain('Clear voice, balanced music');
    expect(result).toContain('Text appears too quickly');
  });

  it('formats a "discovery" (Site Discovery) report correctly', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'discovery',
      analysis: SITE_DISCOVERY,
    };
    const result = digestReport(report);
    expect(result).toContain('Site Discovery');
    expect(result).toContain('cooking hacks for beginners');
    expect(result).toContain('https://foodhacks.io');
    expect(result).toContain('Far higher engagement-to-view ratio');
  });

  it('formats a "competitors" (Competitor Espionage) report correctly', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'competitors',
      analysis: COMPETITOR_GAP,
    };
    const result = digestReport(report);
    expect(result).toContain('Competitor Espionage');
    expect(result).toContain('budget meals');
    expect(result).toContain('air fryer recipes');
    expect(result).toContain('5-minute dinners');
    expect(result).toContain('college cooking');
  });

  it('shows "none noted" for competitors report with empty missing_topics', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'competitors',
      analysis: { ...COMPETITOR_GAP, missing_topics: [] },
    };
    expect(digestReport(report)).toContain('none noted');
  });

  it('shows "none noted" for competitors report with empty untapped_keyword_clusters', () => {
    const report: AuditReportRow = {
      ...BASE_REPORT,
      source_type: 'competitors',
      analysis: { ...COMPETITOR_GAP, untapped_keyword_clusters: [] },
    };
    expect(digestReport(report)).toContain('none noted');
  });

  it('returns a non-empty string for every source_type', () => {
    const types: Array<AuditReportRow['source_type']> = ['url', 'account', 'upload', 'discovery', 'competitors'];
    const analyses = [VIRAL_GAP, GROWTH_BLUEPRINT, UPLOAD_DIAGNOSIS, SITE_DISCOVERY, COMPETITOR_GAP];
    types.forEach((source_type, i) => {
      const result = digestReport({ ...BASE_REPORT, source_type, analysis: analyses[i] });
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

// ─── digestScript() ───────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const BASE_SCRIPT: ScriptRow = {
    id: 'scr-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'My Viral Hook',
    source_prompt: 'Make a viral video about cooking',
    storyboard: {
      spoken_hook: 'Did you know this kitchen hack saves 10 minutes?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of pan',
          dialogue_or_vo: 'Here is the trick...',
          audio_sfx_cue: 'Sizzle sound',
          retention_loop_note: 'Re-hook with the payoff tease',
        },
        {
          scene_number: 2,
          visual_action: 'Wide shot',
          dialogue_or_vo: 'And here is the result',
          audio_sfx_cue: 'Upbeat music',
          retention_loop_note: 'Loop curiosity gap',
        },
      ],
      cta: 'Follow for more kitchen hacks!',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-06-15T09:00:00.000Z',
  };

  it('includes the script title', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('My Viral Hook');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Did you know this kitchen hack saves 10 minutes?');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Re-hook with the payoff tease');
  });

  it('includes the scene count', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('2 scenes total');
  });

  it('returns "(none)" for retention_loop_note when scenes array is empty', () => {
    const script: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    expect(digestScript(script)).toContain('(none)');
  });

  it('shows 0 scenes total when scenes is empty', () => {
    const script: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    expect(digestScript(script)).toContain('0 scenes total');
  });

  it('includes first-scene note even with only one scene', () => {
    const script: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: {
        ...BASE_SCRIPT.storyboard,
        scenes: [BASE_SCRIPT.storyboard.scenes[0]],
      },
    };
    expect(digestScript(script)).toContain('Re-hook with the payoff tease');
    expect(digestScript(script)).toContain('1 scenes total');
  });

  it('returns a non-empty string', () => {
    expect(digestScript(BASE_SCRIPT).length).toBeGreaterThan(0);
  });

  it('label begins with Script', () => {
    expect(digestScript(BASE_SCRIPT)).toMatch(/^Script\s/);
  });
});
