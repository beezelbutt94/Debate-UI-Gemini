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
  Storyboard,
} from '@/lib/types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const baseReport = {
  id: 'rpt-1',
  user_id: 'u-1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-01-15T00:00:00.000Z',
} as const;

function makeReport<T>(
  source_type: AuditReportRow['source_type'],
  analysis: T,
  overrides: Partial<AuditReportRow> = {}
): AuditReportRow<T> {
  return { ...baseReport, source_type, analysis, ...overrides } as unknown as AuditReportRow<T>;
}

// ─── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport', () => {
  describe('source_type = url (ViralGapAnalysis)', () => {
    const analysis: ViralGapAnalysis = {
      pacing_audit: { cuts_per_10s: 4, assessment: 'Good pacing' },
      hook_evaluation: { score: 82, verdict: 'strong', notes: 'Compelling opener' },
      retention_prediction: { at_3s_percent: 75, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
      action_plan: ['Add captions', 'Trim the intro'],
      source_metrics: {},
    };
    const report = makeReport<ViralGapAnalysis>('url', analysis);

    it('mentions hook verdict', () => {
      expect(digestReport(report)).toContain('"strong"');
    });

    it('mentions hook score', () => {
      expect(digestReport(report)).toContain('82/100');
    });

    it('mentions hook notes', () => {
      expect(digestReport(report)).toContain('Compelling opener');
    });

    it('mentions 3s retention', () => {
      expect(digestReport(report)).toContain('3s=75%');
    });

    it('mentions 30s retention', () => {
      expect(digestReport(report)).toContain('30s=45%');
    });

    it('includes label Viral Gap Analyzer', () => {
      expect(digestReport(report)).toContain('Viral Gap Analyzer');
    });

    it('includes formatted date', () => {
      const result = digestReport(report);
      // date will be locale-formatted from 2024-01-15
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('source_type = account (GrowthBlueprint)', () => {
    const analysis: GrowthBlueprint = {
      thematic_consistency: { score: 65, notes: 'Inconsistent niche' },
      view_to_follower_ratio: { value: 0.15, assessment: 'Below average' },
      posting_cadence: { avg_days_between_posts: 3.5, assessment: 'Good' },
      theme_correction: ['Focus on cooking only'],
      view_maximization_tactics: ['Post at peak times'],
      posting_blindspots: ['Missing Sundays', 'No late-night content'],
      per_platform_notes: { tiktok: 'Strong' },
    };
    const report = makeReport<GrowthBlueprint>('account', analysis);

    it('includes label Account Deep-Dive', () => {
      expect(digestReport(report)).toContain('Account Deep-Dive');
    });

    it('includes thematic consistency score', () => {
      expect(digestReport(report)).toContain('65/100');
    });

    it('includes thematic consistency notes', () => {
      expect(digestReport(report)).toContain('Inconsistent niche');
    });

    it('includes posting blindspots', () => {
      const result = digestReport(report);
      expect(result).toContain('Missing Sundays');
      expect(result).toContain('No late-night content');
    });

    it('joins blindspots with semicolons', () => {
      expect(digestReport(report)).toContain('Missing Sundays; No late-night content');
    });

    it('shows "none noted" when posting_blindspots is empty', () => {
      const emptyBlindspots = { ...analysis, posting_blindspots: [] };
      const r = makeReport<GrowthBlueprint>('account', emptyBlindspots);
      expect(digestReport(r)).toContain('none noted');
    });
  });

  describe('source_type = upload (UploadDiagnosis)', () => {
    const analysis: UploadDiagnosis = {
      visual_hook_clarity: { score: 70, verdict: 'moderate', notes: 'Text too small' },
      audio_balance: { score: 55, notes: 'Music too loud vs voice' },
      text_overlay_pacing: { assessment: 'Too fast, reduce text speed' },
      b_roll_recommendations: ['Add transition shots'],
      retention_boosters: ['Use pattern interrupt at 5s'],
      frames_analyzed: 120,
    };
    const report = makeReport<UploadDiagnosis>('upload', analysis);

    it('includes label Upload Diagnostic', () => {
      expect(digestReport(report)).toContain('Upload Diagnostic');
    });

    it('includes visual hook verdict', () => {
      expect(digestReport(report)).toContain('"moderate"');
    });

    it('includes visual hook score', () => {
      expect(digestReport(report)).toContain('70/100');
    });

    it('includes audio balance score', () => {
      expect(digestReport(report)).toContain('55/100');
    });

    it('includes audio balance notes', () => {
      expect(digestReport(report)).toContain('Music too loud vs voice');
    });

    it('includes text-overlay pacing assessment', () => {
      expect(digestReport(report)).toContain('Too fast, reduce text speed');
    });
  });

  describe('source_type = discovery (SiteDiscoveryResult)', () => {
    const analysis: SiteDiscoveryResult = {
      query: 'viral cooking tips',
      sites: [
        {
          url: 'https://example.com/cooking',
          domain: 'example.com',
          title: 'Best Cooking Tips',
          snippet: 'Amazing recipes',
          relevance_reason: 'Top cooking content',
        },
      ],
      outlier: {
        url: 'https://example.com/cooking',
        reasoning: 'Uses unique format unlike others',
      },
      summary: 'Top cooking content sites',
    };
    const report = makeReport<SiteDiscoveryResult>('discovery', analysis);

    it('includes label Site Discovery', () => {
      expect(digestReport(report)).toContain('Site Discovery');
    });

    it('includes the query', () => {
      expect(digestReport(report)).toContain('"viral cooking tips"');
    });

    it('includes outlier URL', () => {
      expect(digestReport(report)).toContain('https://example.com/cooking');
    });

    it('includes outlier reasoning', () => {
      expect(digestReport(report)).toContain('Uses unique format unlike others');
    });
  });

  describe('source_type = competitors (CompetitorGapAnalysis) — fallthrough', () => {
    const analysis: CompetitorGapAnalysis = {
      competitors: [],
      outlier_topics: [],
      missing_topics: ['ASMR content', 'Product reviews'],
      audience_sentiment_gaps: [],
      untapped_keyword_clusters: ['#cookinghacks', '#quickmeals'],
    };
    const report = makeReport<CompetitorGapAnalysis>('competitors', analysis);

    it('includes label Competitor Espionage', () => {
      expect(digestReport(report)).toContain('Competitor Espionage');
    });

    it('includes missing topics', () => {
      const result = digestReport(report);
      expect(result).toContain('ASMR content');
      expect(result).toContain('Product reviews');
    });

    it('joins missing topics with semicolons', () => {
      expect(digestReport(report)).toContain('ASMR content; Product reviews');
    });

    it('includes untapped keyword clusters', () => {
      const result = digestReport(report);
      expect(result).toContain('#cookinghacks');
      expect(result).toContain('#quickmeals');
    });

    it('shows "none noted" when missing_topics is empty', () => {
      const empty = { ...analysis, missing_topics: [] };
      const r = makeReport<CompetitorGapAnalysis>('competitors', empty);
      expect(digestReport(r)).toContain('missing topics: none noted');
    });

    it('shows "none noted" when untapped_keyword_clusters is empty', () => {
      const empty = { ...analysis, untapped_keyword_clusters: [] };
      const r = makeReport<CompetitorGapAnalysis>('competitors', empty);
      expect(digestReport(r)).toContain('untapped keyword clusters: none noted');
    });
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

describe('digestScript', () => {
  const storyboard: Storyboard = {
    spoken_hook: "You won't believe this trick",
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Zoom in on subject',
        dialogue_or_vo: 'Opening line',
        audio_sfx_cue: 'Ding',
        retention_loop_note: 'Tease the reveal',
      },
      {
        scene_number: 2,
        visual_action: 'Cut to demo',
        dialogue_or_vo: 'Here is how',
        audio_sfx_cue: 'Whoosh',
        retention_loop_note: 'Keep them watching',
      },
    ],
    cta: 'Follow for more',
    memory_context_used: false,
  };

  const script: ScriptRow = {
    id: 'scr-1',
    user_id: 'u-1',
    creator_profile_id: null,
    title: 'Epic Cooking Hack',
    source_prompt: null,
    storyboard,
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-03-20T00:00:00.000Z',
  };

  it('includes script title', () => {
    expect(digestScript(script)).toContain('"Epic Cooking Hack"');
  });

  it('includes spoken hook', () => {
    expect(digestScript(script)).toContain("You won't believe this trick");
  });

  it('includes first scene retention_loop_note', () => {
    expect(digestScript(script)).toContain('Tease the reveal');
  });

  it('includes scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('includes formatted date', () => {
    const result = digestScript(script);
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/);
  });

  it('shows (none) for retention_loop_note when no scenes', () => {
    const emptyScenes: ScriptRow = {
      ...script,
      storyboard: { ...storyboard, scenes: [] },
    };
    expect(digestScript(emptyScenes)).toContain('(none)');
  });

  it('shows 0 scenes total when storyboard has no scenes', () => {
    const emptyScenes: ScriptRow = {
      ...script,
      storyboard: { ...storyboard, scenes: [] },
    };
    expect(digestScript(emptyScenes)).toContain('0 scenes total');
  });

  it('includes label Script', () => {
    expect(digestScript(script)).toContain('Script');
  });
});
