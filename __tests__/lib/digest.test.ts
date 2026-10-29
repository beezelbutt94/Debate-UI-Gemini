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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseReport<T>(
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
    created_at: '2024-03-15T00:00:00.000Z',
    ...overrides,
  };
}

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'decent hook' },
  retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['improve hook', 'add CTA'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 55, notes: 'too broad' },
  view_to_follower_ratio: { value: 3.2, assessment: 'below average' },
  posting_cadence: { avg_days_between_posts: 7, assessment: 'weekly' },
  theme_correction: ['narrow niche'],
  view_maximization_tactics: ['shorter hooks'],
  posting_blindspots: ['weekends', 'evenings'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 80, verdict: 'strong', notes: 'clear visual' },
  audio_balance: { score: 70, notes: 'slight imbalance' },
  text_overlay_pacing: { assessment: 'too fast' },
  b_roll_recommendations: ['add variety'],
  retention_boosters: ['pattern interrupt'],
  frames_analyzed: 120,
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['tutorial'],
  missing_topics: ['behind-the-scenes', 'Q&A'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['beginner guide', 'tips'],
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'content creator tools',
  sites: [],
  outlier: { url: 'https://example.com', reasoning: 'uniquely niche audience' },
  summary: 'top sites for creators',
};

// ---------------------------------------------------------------------------
// digestReport
// ---------------------------------------------------------------------------

describe('digestReport', () => {
  describe('source_type: url (ViralGapAnalysis)', () => {
    const report = baseReport({ source_type: 'url', analysis: viralAnalysis });

    it('starts with "Viral Gap Analyzer"', () => {
      expect(digestReport(report)).toMatch(/^Viral Gap Analyzer/);
    });

    it('includes hook verdict', () => {
      expect(digestReport(report)).toContain('moderate');
    });

    it('includes hook score', () => {
      expect(digestReport(report)).toContain('72/100');
    });

    it('includes hook notes', () => {
      expect(digestReport(report)).toContain('decent hook');
    });

    it('includes 3s retention percentage', () => {
      expect(digestReport(report)).toContain('3s=65%');
    });

    it('includes 30s retention percentage', () => {
      expect(digestReport(report)).toContain('30s=42%');
    });

    it('includes the formatted date', () => {
      const date = new Date('2024-03-15T00:00:00.000Z').toLocaleDateString();
      expect(digestReport(report)).toContain(date);
    });
  });

  describe('source_type: account (GrowthBlueprint)', () => {
    const report = baseReport({ source_type: 'account', analysis: growthAnalysis });

    it('starts with "Account Deep-Dive"', () => {
      expect(digestReport(report)).toMatch(/^Account Deep-Dive/);
    });

    it('includes thematic consistency score', () => {
      expect(digestReport(report)).toContain('55/100');
    });

    it('includes thematic notes', () => {
      expect(digestReport(report)).toContain('too broad');
    });

    it('includes posting blindspots', () => {
      expect(digestReport(report)).toContain('weekends');
      expect(digestReport(report)).toContain('evenings');
    });
  });

  describe('source_type: account — empty blindspots', () => {
    const emptyBlindspots: GrowthBlueprint = { ...growthAnalysis, posting_blindspots: [] };
    const report = baseReport({ source_type: 'account', analysis: emptyBlindspots });

    it('shows "none noted" when blindspots is empty', () => {
      expect(digestReport(report)).toContain('none noted');
    });
  });

  describe('source_type: upload (UploadDiagnosis)', () => {
    const report = baseReport({ source_type: 'upload', analysis: uploadAnalysis });

    it('starts with "Upload Diagnostic"', () => {
      expect(digestReport(report)).toMatch(/^Upload Diagnostic/);
    });

    it('includes visual hook verdict', () => {
      expect(digestReport(report)).toContain('strong');
    });

    it('includes visual hook score', () => {
      expect(digestReport(report)).toContain('80/100');
    });

    it('includes audio balance score', () => {
      expect(digestReport(report)).toContain('70/100');
    });

    it('includes audio notes', () => {
      expect(digestReport(report)).toContain('slight imbalance');
    });

    it('includes text overlay pacing assessment', () => {
      expect(digestReport(report)).toContain('too fast');
    });
  });

  describe('source_type: discovery (SiteDiscoveryResult)', () => {
    const report = baseReport({ source_type: 'discovery', analysis: discoveryAnalysis });

    it('starts with "Site Discovery"', () => {
      expect(digestReport(report)).toMatch(/^Site Discovery/);
    });

    it('includes the search query', () => {
      expect(digestReport(report)).toContain('content creator tools');
    });

    it('includes the outlier URL', () => {
      expect(digestReport(report)).toContain('https://example.com');
    });

    it('includes the outlier reasoning', () => {
      expect(digestReport(report)).toContain('uniquely niche audience');
    });
  });

  describe('source_type: competitors (CompetitorGapAnalysis)', () => {
    const report = baseReport({ source_type: 'competitors', analysis: competitorAnalysis });

    it('starts with "Competitor Espionage"', () => {
      expect(digestReport(report)).toMatch(/^Competitor Espionage/);
    });

    it('includes missing topics', () => {
      expect(digestReport(report)).toContain('behind-the-scenes');
      expect(digestReport(report)).toContain('Q&A');
    });

    it('includes untapped keyword clusters', () => {
      expect(digestReport(report)).toContain('beginner guide');
      expect(digestReport(report)).toContain('tips');
    });
  });

  describe('source_type: competitors — empty arrays', () => {
    const emptyComp: CompetitorGapAnalysis = {
      ...competitorAnalysis,
      missing_topics: [],
      untapped_keyword_clusters: [],
    };
    const report = baseReport({ source_type: 'competitors', analysis: emptyComp });

    it('shows "none noted" for missing topics', () => {
      expect(digestReport(report)).toContain('none noted');
    });
  });
});

// ---------------------------------------------------------------------------
// digestScript
// ---------------------------------------------------------------------------

function makeScript(overrides: Partial<ScriptRow> = {}): ScriptRow {
  return {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Great Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know...',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'close-up',
          dialogue_or_vo: 'opening line',
          audio_sfx_cue: 'none',
          retention_loop_note: 'open loop on main point',
        },
        {
          scene_number: 2,
          visual_action: 'wide shot',
          dialogue_or_vo: 'second line',
          audio_sfx_cue: 'none',
          retention_loop_note: 'tease reveal',
        },
      ],
      cta: 'Subscribe!',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: null,
    created_at: '2024-06-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('digestScript', () => {
  it('includes the script title', () => {
    expect(digestScript(makeScript())).toContain('My Great Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(makeScript())).toContain('Did you know...');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(makeScript())).toContain('open loop on main point');
  });

  it('includes the correct scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    const date = new Date('2024-06-01T00:00:00.000Z').toLocaleDateString();
    expect(digestScript(makeScript())).toContain(date);
  });

  it('shows "(none)" when scenes array is empty', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    expect(digestScript(script)).toContain('(none)');
  });

  it('shows 0 scenes when scenes array is empty', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    expect(digestScript(script)).toContain('0 scenes total');
  });

  it('uses first scene retention loop note, not second', () => {
    const result = digestScript(makeScript());
    expect(result).toContain('open loop on main point');
    expect(result).not.toContain('tease reveal');
  });
});
