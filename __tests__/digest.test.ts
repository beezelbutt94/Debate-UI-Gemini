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

// ─── Fixtures ────────────────────────────────────────────────────────────────

const baseReport = {
  id: 'report-1',
  user_id: 'user-1',
  creator_profile_id: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-09-12T10:00:00.000Z',
  source_url: null,
} satisfies Omit<AuditReportRow, 'source_type' | 'analysis'>;

function makeReport<T>(
  source_type: AuditReportRow['source_type'],
  analysis: T,
  overrides?: Partial<typeof baseReport>
): AuditReportRow<T> {
  return { ...baseReport, ...overrides, source_type, analysis } as AuditReportRow<T>;
}

const urlAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 4, assessment: 'Fast' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Decent opening but slow reveal' },
  retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Tighten the first 3s', 'Add a hook text overlay'],
  source_metrics: {},
};

const accountAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 80, notes: 'Strong fitness niche focus' },
  view_to_follower_ratio: { value: 4.2, assessment: 'Above average' },
  posting_cadence: { avg_days_between_posts: 2.5, assessment: 'Consistent' },
  theme_correction: [],
  view_maximization_tactics: ['Use trending audio'],
  posting_blindspots: ['Missing weekend posts', 'Ignoring Friday peak'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 55, verdict: 'weak', notes: 'Camera too far from subject' },
  audio_balance: { score: 88, notes: 'Good mix' },
  text_overlay_pacing: { assessment: 'Text appears too late' },
  b_roll_recommendations: ['Cut to product close-up at 5s'],
  retention_boosters: ['Add captions'],
  frames_analyzed: 120,
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['morning routines'],
  missing_topics: ['nutrition guides', 'recovery days'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['high protein meals', 'mobility work'],
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'best calisthenics programs 2024',
  sites: [],
  outlier: { url: 'https://example.com/elite', reasoning: 'Only site with video demos for each exercise' },
  summary: 'Ten calisthenics resource sites found.',
};

// ─── digestReport – source_type: url ─────────────────────────────────────────

describe('digestReport (url)', () => {
  const report = makeReport('url', urlAnalysis);

  it('includes "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('72');
  });

  it('includes the hook notes', () => {
    expect(digestReport(report)).toContain('Decent opening but slow reveal');
  });

  it('includes 3s retention percent', () => {
    expect(digestReport(report)).toContain('65%');
  });

  it('includes 30s retention percent', () => {
    expect(digestReport(report)).toContain('42%');
  });

  it('includes the formatted date', () => {
    // Date format depends on locale but it should be a non-empty string
    const result = digestReport(report);
    expect(result).toMatch(/\d/); // contains at least one digit (from the date)
  });

  it('returns a non-empty string', () => {
    expect(digestReport(report).length).toBeGreaterThan(0);
  });
});

// ─── digestReport – source_type: account ─────────────────────────────────────

describe('digestReport (account)', () => {
  const report = makeReport('account', accountAnalysis);

  it('includes "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('80');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Strong fitness niche focus');
  });

  it('lists posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Missing weekend posts');
    expect(result).toContain('Ignoring Friday peak');
  });

  it('joins posting blindspots with semicolons', () => {
    expect(digestReport(report)).toContain('Missing weekend posts; Ignoring Friday peak');
  });
});

describe('digestReport (account) – no posting blindspots', () => {
  const report = makeReport('account', { ...accountAnalysis, posting_blindspots: [] });

  it('falls back to "none noted" when blindspots array is empty', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

// ─── digestReport – source_type: upload ──────────────────────────────────────

describe('digestReport (upload)', () => {
  const report = makeReport('upload', uploadAnalysis);

  it('includes "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('weak');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('55');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('88');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Good mix');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Text appears too late');
  });
});

// ─── digestReport – source_type: discovery ───────────────────────────────────

describe('digestReport (discovery)', () => {
  const report = makeReport('discovery', discoveryAnalysis);

  it('includes "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query', () => {
    expect(digestReport(report)).toContain('best calisthenics programs 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/elite');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Only site with video demos for each exercise');
  });
});

// ─── digestReport – source_type: competitors (default) ───────────────────────

describe('digestReport (competitors)', () => {
  const report = makeReport('competitors', competitorAnalysis);

  it('includes "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('lists missing topics', () => {
    expect(digestReport(report)).toContain('nutrition guides');
    expect(digestReport(report)).toContain('recovery days');
  });

  it('lists untapped keyword clusters', () => {
    expect(digestReport(report)).toContain('high protein meals');
    expect(digestReport(report)).toContain('mobility work');
  });

  it('joins lists with semicolons', () => {
    expect(digestReport(report)).toContain('nutrition guides; recovery days');
    expect(digestReport(report)).toContain('high protein meals; mobility work');
  });
});

describe('digestReport (competitors) – empty missing_topics', () => {
  const report = makeReport('competitors', { ...competitorAnalysis, missing_topics: [] });

  it('shows "none noted" for empty missing_topics', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport (competitors) – empty untapped_keyword_clusters', () => {
  const report = makeReport('competitors', { ...competitorAnalysis, untapped_keyword_clusters: [] });

  it('shows "none noted" for empty keyword clusters', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

// ─── digestScript ────────────────────────────────────────────────────────────

const scriptBase: ScriptRow = {
  id: 'script-1',
  user_id: 'user-1',
  creator_profile_id: null,
  title: 'Morning Routine',
  source_prompt: null,
  target_platform: 'youtube_shorts',
  tone_parameters: {},
  created_at: '2024-09-12T10:00:00.000Z',
  storyboard: {
    spoken_hook: "You're wasting the best hour of your day",
    memory_context_used: false,
    cta: 'Follow for more',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Creator wakes up',
        dialogue_or_vo: 'Here is what I do every morning',
        audio_sfx_cue: 'upbeat music',
        retention_loop_note: 'Tease the transformation at the end',
      },
      {
        scene_number: 2,
        visual_action: 'Cold shower sequence',
        dialogue_or_vo: '2 minutes cold, 2 minutes warm',
        audio_sfx_cue: 'water sounds',
        retention_loop_note: '',
      },
    ],
  },
};

describe('digestScript', () => {
  it('includes the script title', () => {
    expect(digestScript(scriptBase)).toContain('Morning Routine');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(scriptBase)).toContain("You're wasting the best hour of your day");
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(scriptBase)).toContain('Tease the transformation at the end');
  });

  it('includes the scene count', () => {
    expect(digestScript(scriptBase)).toContain('2 scenes total');
  });

  it('includes the date', () => {
    expect(digestScript(scriptBase)).toMatch(/\d/);
  });

  it('returns a non-empty string', () => {
    expect(digestScript(scriptBase).length).toBeGreaterThan(0);
  });

  it('handles a script with no scenes gracefully', () => {
    const noScenes: ScriptRow = {
      ...scriptBase,
      storyboard: { ...scriptBase.storyboard, scenes: [] },
    };
    const result = digestScript(noScenes);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('handles a single scene', () => {
    const oneScene: ScriptRow = {
      ...scriptBase,
      storyboard: { ...scriptBase.storyboard, scenes: [scriptBase.storyboard.scenes[0]] },
    };
    expect(digestScript(oneScene)).toContain('1 scenes total');
  });
});
