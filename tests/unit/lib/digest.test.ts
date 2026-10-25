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

// ── helpers ─────────────────────────────────────────────────────────────────

function makeReport<T>(
  overrides: Partial<AuditReportRow<T>> & { source_type: AuditReportRow['source_type']; analysis: T }
): AuditReportRow<T> {
  return {
    id: 'rep-1',
    user_id: 'user-1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: '2024-06-15T12:00:00.000Z',
    ...overrides,
  };
}

// ── digestReport — source_type: 'url' ───────────────────────────────────────

describe("digestReport — source_type 'url'", () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'good' },
    hook_evaluation: { score: 72, verdict: 'moderate', notes: 'needs faster opener' },
    retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
    action_plan: ['fix the hook'],
    source_metrics: {},
  };
  const report = makeReport({ source_type: 'url', analysis });

  it('starts with "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toMatch(/^Viral Gap Analyzer/);
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('72');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('needs faster opener');
  });

  it('includes 3s retention percent', () => {
    expect(digestReport(report)).toContain('65%');
  });

  it('includes 30s retention percent', () => {
    expect(digestReport(report)).toContain('42%');
  });

  it('includes the formatted date', () => {
    const date = new Date('2024-06-15T12:00:00.000Z').toLocaleDateString();
    expect(digestReport(report)).toContain(date);
  });

  it('returns a string', () => {
    expect(typeof digestReport(report)).toBe('string');
  });
});

// ── digestReport — source_type: 'account' ───────────────────────────────────

describe("digestReport — source_type 'account'", () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 85, notes: 'very cohesive niche' },
    view_to_follower_ratio: { value: 0.12, assessment: 'above average' },
    posting_cadence: { avg_days_between_posts: 3.5, assessment: 'consistent' },
    theme_correction: ['add more comedy'],
    view_maximization_tactics: ['post at 6pm EST'],
    posting_blindspots: ['missing weekend slots', 'no Tuesday content'],
    per_platform_notes: {},
  };
  const report = makeReport({ source_type: 'account', analysis });

  it('starts with "Account Deep-Dive"', () => {
    expect(digestReport(report)).toMatch(/^Account Deep-Dive/);
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('85');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('very cohesive niche');
  });

  it('includes posting blindspots', () => {
    expect(digestReport(report)).toContain('missing weekend slots');
    expect(digestReport(report)).toContain('no Tuesday content');
  });

  it('shows "none noted" when blindspots array is empty', () => {
    const emptyAnalysis: GrowthBlueprint = { ...analysis, posting_blindspots: [] };
    const r = makeReport({ source_type: 'account', analysis: emptyAnalysis });
    expect(digestReport(r)).toContain('none noted');
  });
});

// ── digestReport — source_type: 'upload' ────────────────────────────────────

describe("digestReport — source_type 'upload'", () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 55, verdict: 'weak', notes: 'low contrast text' },
    audio_balance: { score: 80, notes: 'good mix' },
    text_overlay_pacing: { assessment: 'too slow' },
    b_roll_recommendations: ['add b-roll'],
    retention_boosters: ['use captions'],
    frames_analyzed: 120,
  };
  const report = makeReport({ source_type: 'upload', analysis });

  it('starts with "Upload Diagnostic"', () => {
    expect(digestReport(report)).toMatch(/^Upload Diagnostic/);
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('weak');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('55');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('80');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('good mix');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('too slow');
  });
});

// ── digestReport — source_type: 'discovery' ─────────────────────────────────

describe("digestReport — source_type 'discovery'", () => {
  const analysis: SiteDiscoveryResult = {
    query: 'best viral editing techniques',
    sites: [],
    outlier: {
      url: 'https://example.com/outlier',
      reasoning: 'unique angle on motion graphics',
    },
    summary: 'Found 10 great resources',
  };
  const report = makeReport({ source_type: 'discovery', analysis });

  it('starts with "Site Discovery"', () => {
    expect(digestReport(report)).toMatch(/^Site Discovery/);
  });

  it('includes the query', () => {
    expect(digestReport(report)).toContain('best viral editing techniques');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/outlier');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('unique angle on motion graphics');
  });
});

// ── digestReport — source_type: 'competitors' ───────────────────────────────

describe("digestReport — source_type 'competitors'", () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: ['trending audio', 'POV format'],
    missing_topics: ['behind-the-scenes', 'Q&A format'],
    audience_sentiment_gaps: ['more humor needed'],
    untapped_keyword_clusters: ['viral hooks', 'day in my life'],
  };
  const report = makeReport({ source_type: 'competitors', analysis });

  it('starts with "Competitor Espionage"', () => {
    expect(digestReport(report)).toMatch(/^Competitor Espionage/);
  });

  it('includes missing topics', () => {
    expect(digestReport(report)).toContain('behind-the-scenes');
    expect(digestReport(report)).toContain('Q&A format');
  });

  it('includes untapped keyword clusters', () => {
    expect(digestReport(report)).toContain('viral hooks');
    expect(digestReport(report)).toContain('day in my life');
  });

  it('shows "none noted" when missing_topics is empty', () => {
    const emptyAnalysis: CompetitorGapAnalysis = { ...analysis, missing_topics: [] };
    const r = makeReport({ source_type: 'competitors', analysis: emptyAnalysis });
    expect(digestReport(r)).toContain('none noted');
  });

  it('shows "none noted" when untapped_keyword_clusters is empty', () => {
    const emptyAnalysis: CompetitorGapAnalysis = { ...analysis, untapped_keyword_clusters: [] };
    const r = makeReport({ source_type: 'competitors', analysis: emptyAnalysis });
    const result = digestReport(r);
    expect(result).toContain('none noted');
  });
});

// ── digestScript ─────────────────────────────────────────────────────────────

describe('digestScript', () => {
  const script: ScriptRow = {
    id: 'script-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'My Viral Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Wait until you see this!',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Quick zoom on product',
          dialogue_or_vo: 'This changed everything.',
          audio_sfx_cue: 'dramatic sting',
          retention_loop_note: 'Tease the payoff',
        },
        {
          scene_number: 2,
          visual_action: 'Product demonstration',
          dialogue_or_vo: 'Here is how it works.',
          audio_sfx_cue: 'upbeat music',
          retention_loop_note: 'Keep building curiosity',
        },
      ],
      cta: 'Follow for more tips!',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-12T09:00:00.000Z',
  };

  it('includes the script title', () => {
    expect(digestScript(script)).toContain('My Viral Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(script)).toContain('Wait until you see this!');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(script)).toContain('Tease the payoff');
  });

  it('includes the total scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    const date = new Date('2024-09-12T09:00:00.000Z').toLocaleDateString();
    expect(digestScript(script)).toContain(date);
  });

  it('starts with Script keyword', () => {
    expect(digestScript(script)).toMatch(/^Script/);
  });

  it('returns "(none)" when there are no scenes', () => {
    const noScenes: ScriptRow = { ...script, storyboard: { ...script.storyboard, scenes: [] } };
    expect(digestScript(noScenes)).toContain('(none)');
  });

  it('returns a string', () => {
    expect(typeof digestScript(script)).toBe('string');
  });
});
