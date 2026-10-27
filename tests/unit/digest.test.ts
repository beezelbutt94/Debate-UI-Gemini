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

// ── helpers ─────────────────────────────────────────────────────────────────

function makeReport<T>(
  overrides: Partial<AuditReportRow<T>> & { source_type: AuditReportRow['source_type']; analysis: T }
): AuditReportRow<T> {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: '2024-06-15T12:00:00Z',
    ...overrides,
  };
}

const baseViralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
  hook_evaluation: { score: 85, verdict: 'strong', notes: 'Great opener' },
  retention_prediction: { at_3s_percent: 72, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['action one'],
  source_metrics: {},
};

const baseGrowthBlueprint: GrowthBlueprint = {
  thematic_consistency: { score: 78, notes: 'Mostly consistent' },
  view_to_follower_ratio: { value: 3.2, assessment: 'good' },
  posting_cadence: { avg_days_between_posts: 2, assessment: 'frequent' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['Sundays', 'evenings'],
  per_platform_notes: {},
};

const baseUploadDiagnosis: UploadDiagnosis = {
  visual_hook_clarity: { score: 70, verdict: 'moderate', notes: 'Hook needs punch' },
  audio_balance: { score: 60, notes: 'Music slightly loud' },
  text_overlay_pacing: { assessment: 'well-timed' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 120,
};

const baseSiteDiscovery: SiteDiscoveryResult = {
  query: 'viral video tips',
  sites: [],
  outlier: { url: 'https://example.com/outlier', reasoning: 'Unique framing compared to others' },
  summary: 'Found 0 sites',
};

const baseCompetitorGap: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['morning routines', 'fitness'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['gym hacks', 'meal prep'],
};

// ── digestReport – source_type = 'url' ───────────────────────────────────────

describe("digestReport() source_type='url'", () => {
  const report = makeReport<ViralGapAnalysis>({ source_type: 'url', analysis: baseViralAnalysis });

  it('contains "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('contains the hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('contains the hook score', () => {
    expect(digestReport(report)).toContain('85');
  });

  it('contains hook notes', () => {
    expect(digestReport(report)).toContain('Great opener');
  });

  it('contains 3s retention percent', () => {
    expect(digestReport(report)).toContain('72%');
  });

  it('contains 30s retention percent', () => {
    expect(digestReport(report)).toContain('45%');
  });

  it('formats the date from created_at', () => {
    // The exact format depends on locale, so just check it's non-empty and present
    const result = digestReport(report);
    // Should contain a date-like string (e.g. "6/15/2024" or "15/06/2024")
    expect(result).toMatch(/\d+[\/.-]\d+[\/.-]\d+/);
  });

  it('returns a non-empty string', () => {
    expect(digestReport(report).length).toBeGreaterThan(0);
  });
});

// ── digestReport – source_type = 'account' ───────────────────────────────────

describe("digestReport() source_type='account'", () => {
  const report = makeReport<GrowthBlueprint>({ source_type: 'account', analysis: baseGrowthBlueprint });

  it('contains "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('contains thematic consistency score', () => {
    expect(digestReport(report)).toContain('78');
  });

  it('contains consistency notes', () => {
    expect(digestReport(report)).toContain('Mostly consistent');
  });

  it('contains posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Sundays');
    expect(result).toContain('evenings');
  });

  it('separates blindspots with semicolons', () => {
    expect(digestReport(report)).toContain('Sundays; evenings');
  });

  it('shows "none noted" when no blindspots', () => {
    const r = makeReport<GrowthBlueprint>({
      source_type: 'account',
      analysis: { ...baseGrowthBlueprint, posting_blindspots: [] },
    });
    expect(digestReport(r)).toContain('none noted');
  });
});

// ── digestReport – source_type = 'upload' ────────────────────────────────────

describe("digestReport() source_type='upload'", () => {
  const report = makeReport<UploadDiagnosis>({ source_type: 'upload', analysis: baseUploadDiagnosis });

  it('contains "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('contains visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('contains visual hook score', () => {
    expect(digestReport(report)).toContain('70');
  });

  it('contains audio balance score', () => {
    expect(digestReport(report)).toContain('60');
  });

  it('contains audio balance notes', () => {
    expect(digestReport(report)).toContain('Music slightly loud');
  });

  it('contains text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('well-timed');
  });
});

// ── digestReport – source_type = 'discovery' ─────────────────────────────────

describe("digestReport() source_type='discovery'", () => {
  const report = makeReport<SiteDiscoveryResult>({ source_type: 'discovery', analysis: baseSiteDiscovery });

  it('contains "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('contains the query', () => {
    expect(digestReport(report)).toContain('viral video tips');
  });

  it('contains the outlier url', () => {
    expect(digestReport(report)).toContain('https://example.com/outlier');
  });

  it('contains the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Unique framing compared to others');
  });
});

// ── digestReport – source_type = 'competitors' (fallthrough) ─────────────────

describe("digestReport() source_type='competitors'", () => {
  const report = makeReport<CompetitorGapAnalysis>({ source_type: 'competitors', analysis: baseCompetitorGap });

  it('contains "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('contains missing_topics', () => {
    const result = digestReport(report);
    expect(result).toContain('morning routines');
    expect(result).toContain('fitness');
  });

  it('contains untapped_keyword_clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('gym hacks');
    expect(result).toContain('meal prep');
  });

  it('shows "none noted" when missing_topics is empty', () => {
    const r = makeReport<CompetitorGapAnalysis>({
      source_type: 'competitors',
      analysis: { ...baseCompetitorGap, missing_topics: [], untapped_keyword_clusters: [] },
    });
    const result = digestReport(r);
    expect(result).toContain('none noted');
  });

  it('joins multiple missing_topics with semicolons', () => {
    expect(digestReport(report)).toContain('morning routines; fitness');
  });

  it('joins multiple untapped clusters with semicolons', () => {
    expect(digestReport(report)).toContain('gym hacks; meal prep');
  });
});

// ── digestScript ──────────────────────────────────────────────────────────────

const baseScript: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'My Viral Hook Video',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'Wait until you see this trick',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'zoom in',
        dialogue_or_vo: 'Hello world',
        audio_sfx_cue: 'whoosh',
        retention_loop_note: 'Loop back to the hook',
      },
      {
        scene_number: 2,
        visual_action: 'cut',
        dialogue_or_vo: 'Then this happens',
        audio_sfx_cue: '',
        retention_loop_note: 'Tease next scene',
      },
    ],
    cta: 'Follow for more',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-09-12T08:00:00Z',
};

describe('digestScript()', () => {
  it('contains the script title', () => {
    expect(digestScript(baseScript)).toContain('My Viral Hook Video');
  });

  it('contains the spoken hook', () => {
    expect(digestScript(baseScript)).toContain('Wait until you see this trick');
  });

  it('contains the first scene retention loop note', () => {
    expect(digestScript(baseScript)).toContain('Loop back to the hook');
  });

  it('contains total scene count', () => {
    expect(digestScript(baseScript)).toContain('2 scenes');
  });

  it('formats the date from created_at', () => {
    expect(digestScript(baseScript)).toMatch(/\d+[\/.-]\d+[\/.-]\d+/);
  });

  it('returns a non-empty string', () => {
    expect(digestScript(baseScript).length).toBeGreaterThan(0);
  });

  it('handles script with no scenes — retention loop note defaults to "(none)"', () => {
    const s: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    expect(digestScript(s)).toContain('(none)');
  });

  it('handles script with a single scene', () => {
    const s: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [baseScript.storyboard.scenes[0]] },
    };
    const result = digestScript(s);
    expect(result).toContain('1 scenes');
    expect(result).toContain('Loop back to the hook');
  });
});
