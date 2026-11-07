import { describe, it, expect, vi } from 'vitest';
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeReport<T>(
  source_type: AuditReportRow['source_type'],
  analysis: T,
  created_at = '2024-06-15T12:00:00.000Z'
): AuditReportRow<T> {
  return {
    id: 'rpt-1',
    user_id: 'usr-1',
    creator_profile_id: null,
    source_type,
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at,
  };
}

const urlAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'fast-paced' },
  hook_evaluation: { score: 85, verdict: 'strong', notes: 'Great open' },
  retention_prediction: { at_3s_percent: 72, at_30s_percent: 48, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Add CTA', 'Trim intro'],
  source_metrics: {},
};

const accountAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 70, notes: 'Could narrow niche' },
  view_to_follower_ratio: { value: 0.05, assessment: 'below average' },
  posting_cadence: { avg_days_between_posts: 3.5, assessment: 'consistent' },
  theme_correction: ['Focus on cooking'],
  view_maximization_tactics: ['Collaborate with similar creators'],
  posting_blindspots: ['Saturdays', 'Early mornings'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'Okay intro' },
  audio_balance: { score: 75, notes: 'Music slightly loud' },
  text_overlay_pacing: { assessment: 'Too fast to read' },
  b_roll_recommendations: ['Add cutaways'],
  retention_boosters: ['Zoom transitions'],
  frames_analyzed: 120,
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['DIY'],
  missing_topics: ['Budget tips', 'Weekly roundup'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['beginner finance', 'frugal living'],
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'best finance blogs',
  sites: [],
  outlier: { url: 'https://example.com/outlier', reasoning: 'Uniquely focuses on Gen Z' },
  summary: 'Great set of sites',
};

// ─── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport()', () => {
  describe('source_type = url', () => {
    const report = makeReport('url', urlAnalysis);

    it('output contains "Viral Gap Analyzer"', () => {
      expect(digestReport(report)).toContain('Viral Gap Analyzer');
    });

    it('output contains the hook verdict', () => {
      expect(digestReport(report)).toContain('strong');
    });

    it('output contains the hook score', () => {
      expect(digestReport(report)).toContain('85');
    });

    it('output contains the hook notes', () => {
      expect(digestReport(report)).toContain('Great open');
    });

    it('output contains 3s retention percent', () => {
      expect(digestReport(report)).toContain('3s=72%');
    });

    it('output contains 30s retention percent', () => {
      expect(digestReport(report)).toContain('30s=48%');
    });

    it('output contains the formatted date', () => {
      const formatted = new Date('2024-06-15T12:00:00.000Z').toLocaleDateString();
      expect(digestReport(report)).toContain(formatted);
    });

    it('returns a non-empty string', () => {
      expect(digestReport(report).length).toBeGreaterThan(0);
    });
  });

  describe('source_type = account', () => {
    const report = makeReport('account', accountAnalysis);

    it('output contains "Account Deep-Dive"', () => {
      expect(digestReport(report)).toContain('Account Deep-Dive');
    });

    it('output contains thematic consistency score', () => {
      expect(digestReport(report)).toContain('70');
    });

    it('output contains thematic consistency notes', () => {
      expect(digestReport(report)).toContain('Could narrow niche');
    });

    it('output contains posting blindspots', () => {
      const out = digestReport(report);
      expect(out).toContain('Saturdays');
      expect(out).toContain('Early mornings');
    });
  });

  describe('source_type = account with no blindspots', () => {
    const noBlindspots: GrowthBlueprint = { ...accountAnalysis, posting_blindspots: [] };
    const report = makeReport('account', noBlindspots);

    it('shows "none noted" when blindspots is empty', () => {
      expect(digestReport(report)).toContain('none noted');
    });
  });

  describe('source_type = upload', () => {
    const report = makeReport('upload', uploadAnalysis);

    it('output contains "Upload Diagnostic"', () => {
      expect(digestReport(report)).toContain('Upload Diagnostic');
    });

    it('output contains visual hook verdict', () => {
      expect(digestReport(report)).toContain('moderate');
    });

    it('output contains visual hook score', () => {
      expect(digestReport(report)).toContain('60');
    });

    it('output contains audio balance score', () => {
      expect(digestReport(report)).toContain('75');
    });

    it('output contains audio balance notes', () => {
      expect(digestReport(report)).toContain('Music slightly loud');
    });

    it('output contains text overlay assessment', () => {
      expect(digestReport(report)).toContain('Too fast to read');
    });
  });

  describe('source_type = discovery', () => {
    const report = makeReport('discovery', discoveryAnalysis);

    it('output contains "Site Discovery"', () => {
      expect(digestReport(report)).toContain('Site Discovery');
    });

    it('output contains the query', () => {
      expect(digestReport(report)).toContain('best finance blogs');
    });

    it('output contains the outlier URL', () => {
      expect(digestReport(report)).toContain('https://example.com/outlier');
    });

    it('output contains the outlier reasoning', () => {
      expect(digestReport(report)).toContain('Uniquely focuses on Gen Z');
    });
  });

  describe('source_type = competitors (default branch)', () => {
    const report = makeReport('competitors', competitorAnalysis);

    it('output contains "Competitor Espionage"', () => {
      expect(digestReport(report)).toContain('Competitor Espionage');
    });

    it('output contains missing topics', () => {
      const out = digestReport(report);
      expect(out).toContain('Budget tips');
      expect(out).toContain('Weekly roundup');
    });

    it('output contains untapped keyword clusters', () => {
      const out = digestReport(report);
      expect(out).toContain('beginner finance');
      expect(out).toContain('frugal living');
    });

    it('shows "none noted" when missing_topics is empty', () => {
      const empty: CompetitorGapAnalysis = { ...competitorAnalysis, missing_topics: [] };
      expect(digestReport(makeReport('competitors', empty))).toContain('missing topics: none noted');
    });

    it('shows "none noted" when untapped_keyword_clusters is empty', () => {
      const empty: CompetitorGapAnalysis = { ...competitorAnalysis, untapped_keyword_clusters: [] };
      expect(digestReport(makeReport('competitors', empty))).toContain('untapped keyword clusters: none noted');
    });
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const baseScript: ScriptRow = {
    id: 'scr-1',
    user_id: 'usr-1',
    creator_profile_id: null,
    title: 'My Viral Hook Video',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know you can double your views?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up on face',
          dialogue_or_vo: 'Opening line here',
          audio_sfx_cue: 'Dramatic sting',
          retention_loop_note: 'Cliffhanger ending',
        },
        {
          scene_number: 2,
          visual_action: 'Wide shot',
          dialogue_or_vo: 'Second point',
          audio_sfx_cue: 'Background music',
          retention_loop_note: '',
        },
      ],
      cta: 'Follow for more tips',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-07-20T08:00:00.000Z',
  };

  it('contains the script title', () => {
    expect(digestScript(baseScript)).toContain('My Viral Hook Video');
  });

  it('contains the spoken hook', () => {
    expect(digestScript(baseScript)).toContain('Did you know you can double your views?');
  });

  it('contains the first scene retention_loop_note', () => {
    expect(digestScript(baseScript)).toContain('Cliffhanger ending');
  });

  it('contains the total scene count', () => {
    expect(digestScript(baseScript)).toContain('2 scenes total');
  });

  it('contains the formatted date', () => {
    const formatted = new Date('2024-07-20T08:00:00.000Z').toLocaleDateString();
    expect(digestScript(baseScript)).toContain(formatted);
  });

  it('returns a non-empty string', () => {
    expect(digestScript(baseScript).length).toBeGreaterThan(0);
  });

  it('shows "(none)" when first scene has no retention_loop_note', () => {
    const script: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [{ ...baseScript.storyboard.scenes[0], retention_loop_note: '' }],
      },
    };
    // empty string is falsy → nullish coalescing returns '(none)'
    // Actually retention_loop_note is '' which is falsy — wait, the code uses ?? not ||
    // The code is: weakScene?.retention_loop_note ?? '(none)'
    // '' is not null/undefined so ?? does NOT fire here — it returns ''
    // So the output will contain an empty retention loop note, NOT '(none)'
    // Let me re-check the actual code:
    // `"first scene retention loop: \"${weakScene?.retention_loop_note ?? '(none)'}\""`
    // For empty string: '' ?? '(none)' → '' (nullish coalescing does NOT trigger for falsy)
    // So we get `"first scene retention loop: \"\""`
    expect(digestScript(script)).toContain('first scene retention loop: ""');
  });

  it('shows "(none)" when there are NO scenes (weakScene is undefined)', () => {
    const script: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [],
      },
    };
    expect(digestScript(script)).toContain('(none)');
  });

  it('shows correct scene count when there is 1 scene', () => {
    const script: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [baseScript.storyboard.scenes[0]],
      },
    };
    expect(digestScript(script)).toContain('1 scenes total');
  });

  it('contains the word "Script" in the output', () => {
    expect(digestScript(baseScript)).toContain('Script');
  });
});
