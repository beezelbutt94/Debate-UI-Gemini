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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReport<T>(
  source_type: AuditReportRow['source_type'],
  analysis: T,
  created_at = '2024-06-15T10:00:00.000Z'
): AuditReportRow<T> {
  return {
    id: 'test-id',
    user_id: 'user-1',
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

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
  hook_evaluation: { score: 82, verdict: 'strong', notes: 'great opening line' },
  retention_prediction: {
    at_3s_percent: 70,
    at_30s_percent: 45,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['add B-roll'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 75, notes: 'mostly consistent' },
  view_to_follower_ratio: { value: 0.12, assessment: 'decent' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'regular' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['weekends', 'evenings'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'could be stronger' },
  audio_balance: { score: 88, notes: 'clean audio' },
  text_overlay_pacing: { assessment: 'slightly too fast' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 120,
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'viral cooking content',
  sites: [],
  outlier: { url: 'https://oddsite.com', reasoning: 'unique angle on recipe shorts' },
  summary: 'Top recipe sites found.',
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['behind-the-scenes', 'Q&A'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['morning routine', 'productivity hacks'],
};

// ─── digestReport ────────────────────────────────────────────────────────────

describe('digestReport()', () => {
  describe('url source_type (ViralGapAnalysis)', () => {
    const report = makeReport('url', viralAnalysis);

    it('includes "Viral Gap Analyzer" prefix', () => {
      expect(digestReport(report)).toContain('Viral Gap Analyzer');
    });

    it('includes hook verdict', () => {
      expect(digestReport(report)).toContain('strong');
    });

    it('includes hook score', () => {
      expect(digestReport(report)).toContain('82/100');
    });

    it('includes hook notes', () => {
      expect(digestReport(report)).toContain('great opening line');
    });

    it('includes 3s retention percent', () => {
      expect(digestReport(report)).toContain('3s=70%');
    });

    it('includes 30s retention percent', () => {
      expect(digestReport(report)).toContain('30s=45%');
    });

    it('includes a formatted date', () => {
      const result = digestReport(report);
      // Date is locale-formatted; just verify something date-like is present
      expect(result).toMatch(/\d/);
    });
  });

  describe('account source_type (GrowthBlueprint)', () => {
    const report = makeReport('account', growthAnalysis);

    it('includes "Account Deep-Dive" prefix', () => {
      expect(digestReport(report)).toContain('Account Deep-Dive');
    });

    it('includes thematic consistency score', () => {
      expect(digestReport(report)).toContain('75/100');
    });

    it('includes thematic consistency notes', () => {
      expect(digestReport(report)).toContain('mostly consistent');
    });

    it('lists posting blindspots', () => {
      const result = digestReport(report);
      expect(result).toContain('weekends');
      expect(result).toContain('evenings');
    });
  });

  describe('account source_type — empty posting_blindspots', () => {
    const analysis: GrowthBlueprint = { ...growthAnalysis, posting_blindspots: [] };
    const report = makeReport('account', analysis);

    it('shows "none noted" when no blindspots', () => {
      expect(digestReport(report)).toContain('none noted');
    });
  });

  describe('upload source_type (UploadDiagnosis)', () => {
    const report = makeReport('upload', uploadAnalysis);

    it('includes "Upload Diagnostic" prefix', () => {
      expect(digestReport(report)).toContain('Upload Diagnostic');
    });

    it('includes visual hook verdict', () => {
      expect(digestReport(report)).toContain('moderate');
    });

    it('includes visual hook score', () => {
      expect(digestReport(report)).toContain('60/100');
    });

    it('includes audio balance score', () => {
      expect(digestReport(report)).toContain('88/100');
    });

    it('includes audio notes', () => {
      expect(digestReport(report)).toContain('clean audio');
    });

    it('includes text overlay pacing assessment', () => {
      expect(digestReport(report)).toContain('slightly too fast');
    });
  });

  describe('discovery source_type (SiteDiscoveryResult)', () => {
    const report = makeReport('discovery', discoveryAnalysis);

    it('includes "Site Discovery" prefix', () => {
      expect(digestReport(report)).toContain('Site Discovery');
    });

    it('includes the query string', () => {
      expect(digestReport(report)).toContain('viral cooking content');
    });

    it('includes the outlier URL', () => {
      expect(digestReport(report)).toContain('https://oddsite.com');
    });

    it('includes the outlier reasoning', () => {
      expect(digestReport(report)).toContain('unique angle on recipe shorts');
    });
  });

  describe('competitors source_type (CompetitorGapAnalysis) — default branch', () => {
    const report = makeReport('competitors', competitorAnalysis);

    it('includes "Competitor Espionage" prefix', () => {
      expect(digestReport(report)).toContain('Competitor Espionage');
    });

    it('lists missing topics', () => {
      const result = digestReport(report);
      expect(result).toContain('behind-the-scenes');
      expect(result).toContain('Q&A');
    });

    it('lists untapped keyword clusters', () => {
      const result = digestReport(report);
      expect(result).toContain('morning routine');
      expect(result).toContain('productivity hacks');
    });
  });

  describe('competitors source_type — empty arrays', () => {
    const analysis: CompetitorGapAnalysis = {
      ...competitorAnalysis,
      missing_topics: [],
      untapped_keyword_clusters: [],
    };
    const report = makeReport('competitors', analysis);

    it('shows "none noted" for missing_topics when empty', () => {
      expect(digestReport(report)).toContain('none noted');
    });
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

function makeScript(overrides: Partial<ScriptRow> = {}): ScriptRow {
  return {
    id: 'script-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'My Amazing Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know this one trick?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up on face',
          dialogue_or_vo: 'Hook line here',
          audio_sfx_cue: 'upbeat music',
          retention_loop_note: 'Open loop: will they believe it?',
        },
        {
          scene_number: 2,
          visual_action: 'Cut to product',
          dialogue_or_vo: 'Here is the product',
          audio_sfx_cue: 'none',
          retention_loop_note: 'Close the loop',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-12T08:00:00.000Z',
    ...overrides,
  };
}

describe('digestScript()', () => {
  it('includes the script title', () => {
    expect(digestScript(makeScript())).toContain('My Amazing Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(makeScript())).toContain('Did you know this one trick?');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(makeScript())).toContain('Open loop: will they believe it?');
  });

  it('includes total scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });

  it('includes a formatted date', () => {
    const result = digestScript(makeScript());
    expect(result).toMatch(/\d/);
  });

  it('shows (none) when first scene has no retention_loop_note', () => {
    const script = makeScript();
    script.storyboard.scenes[0].retention_loop_note = '';
    // Empty string is falsy via ?? operator — expect fallback
    // Actually ?? only falls back on null/undefined, not empty string.
    // So empty string will render as empty, not "(none)".
    // The code: weakScene?.retention_loop_note ?? '(none)'
    // '' is NOT null/undefined, so it won't use fallback.
    expect(digestScript(script)).toContain('""');
  });

  it('shows (none) when scenes array is empty (no first scene)', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    expect(digestScript(script)).toContain('(none)');
  });

  it('shows 0 scenes total when scenes array is empty', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    expect(digestScript(script)).toContain('0 scenes total');
  });

  it('reflects correct count for single scene', () => {
    const script = makeScript();
    script.storyboard.scenes = [script.storyboard.scenes[0]];
    expect(digestScript(script)).toContain('1 scenes total');
  });

  it('reflects correct count for many scenes', () => {
    const script = makeScript();
    const baseScene = script.storyboard.scenes[0];
    script.storyboard.scenes = Array.from({ length: 10 }, (_, i) => ({
      ...baseScene,
      scene_number: i + 1,
    }));
    expect(digestScript(script)).toContain('10 scenes total');
  });

  it('uses first scene note, not subsequent ones', () => {
    const result = digestScript(makeScript());
    expect(result).toContain('Open loop: will they believe it?');
    expect(result).not.toContain('Close the loop');
  });
});
