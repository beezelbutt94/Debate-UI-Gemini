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

// ── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-09-15T10:00:00.000Z',
};

const VIRAL_ANALYSIS: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Decent opener but buries product name' },
  retention_prediction: {
    at_3s_percent: 65,
    at_30s_percent: 42,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Tighten hook', 'Add captions'],
  source_metrics: {},
};

const GROWTH_ANALYSIS: GrowthBlueprint = {
  thematic_consistency: { score: 58, notes: 'Mix of cooking and fitness content hurts clarity' },
  view_to_follower_ratio: { value: 3.2, assessment: 'above average' },
  posting_cadence: { avg_days_between_posts: 2.5, assessment: 'consistent' },
  theme_correction: ['Pick one niche'],
  view_maximization_tactics: ['Post at 7pm'],
  posting_blindspots: ['Tuesdays', 'Saturdays'],
  per_platform_notes: {},
};

const UPLOAD_ANALYSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 80, verdict: 'strong', notes: 'Great opening frame' },
  audio_balance: { score: 55, notes: 'Music slightly overpowers voiceover' },
  text_overlay_pacing: { assessment: 'Text appears too late' },
  b_roll_recommendations: ['Add product close-ups'],
  retention_boosters: ['Jump cut at 8s'],
  frames_analyzed: 120,
};

const DISCOVERY_ANALYSIS: SiteDiscoveryResult = {
  query: 'fitness creators monetization',
  sites: [
    {
      url: 'https://example.com/site1',
      domain: 'example.com',
      title: 'Site 1',
      snippet: 'snip',
      relevance_reason: 'reason',
    },
  ],
  outlier: {
    url: 'https://example.com/site1',
    reasoning: 'Only site covering B2B fitness angles',
  },
  summary: 'Broad landscape of fitness monetization',
};

const COMPETITOR_ANALYSIS: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['HIIT challenges'],
  missing_topics: ['Morning routines', 'Meal prep'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['home gym setup', 'no-equipment workout'],
};

function makeReport(
  source_type: AuditReportRow['source_type'],
  analysis: AuditReportRow['analysis']
): AuditReportRow {
  return { ...BASE_REPORT, source_type, analysis };
}

// ── digestReport ─────────────────────────────────────────────────────────────

describe('digestReport()', () => {
  describe('source_type = "url" (ViralGapAnalysis)', () => {
    const report = makeReport('url', VIRAL_ANALYSIS);
    const result = digestReport(report);

    it('includes "Viral Gap Analyzer" label', () => {
      expect(result).toContain('Viral Gap Analyzer');
    });

    it('includes the hook verdict', () => {
      expect(result).toContain('moderate');
    });

    it('includes the hook score', () => {
      expect(result).toContain('72/100');
    });

    it('includes hook notes', () => {
      expect(result).toContain('Decent opener but buries product name');
    });

    it('includes 3s retention percentage', () => {
      expect(result).toContain('3s=65%');
    });

    it('includes 30s retention percentage', () => {
      expect(result).toContain('30s=42%');
    });

    it('includes formatted date', () => {
      // date rendering is locale-dependent; check for some digit pattern
      expect(result).toMatch(/\d+[\\/]\d+[\\/]\d+/);
    });
  });

  describe('source_type = "account" (GrowthBlueprint)', () => {
    const report = makeReport('account', GROWTH_ANALYSIS);
    const result = digestReport(report);

    it('includes "Account Deep-Dive" label', () => {
      expect(result).toContain('Account Deep-Dive');
    });

    it('includes thematic consistency score', () => {
      expect(result).toContain('58/100');
    });

    it('includes thematic consistency notes', () => {
      expect(result).toContain('Mix of cooking and fitness content hurts clarity');
    });

    it('includes posting blindspots', () => {
      expect(result).toContain('Tuesdays');
      expect(result).toContain('Saturdays');
    });

    it('handles empty blindspots gracefully', () => {
      const noBlindspots = { ...GROWTH_ANALYSIS, posting_blindspots: [] };
      const r = digestReport(makeReport('account', noBlindspots));
      expect(r).toContain('none noted');
    });
  });

  describe('source_type = "upload" (UploadDiagnosis)', () => {
    const report = makeReport('upload', UPLOAD_ANALYSIS);
    const result = digestReport(report);

    it('includes "Upload Diagnostic" label', () => {
      expect(result).toContain('Upload Diagnostic');
    });

    it('includes visual hook verdict', () => {
      expect(result).toContain('strong');
    });

    it('includes visual hook score', () => {
      expect(result).toContain('80/100');
    });

    it('includes audio balance score', () => {
      expect(result).toContain('55/100');
    });

    it('includes audio balance notes', () => {
      expect(result).toContain('Music slightly overpowers voiceover');
    });

    it('includes text-overlay pacing assessment', () => {
      expect(result).toContain('Text appears too late');
    });
  });

  describe('source_type = "discovery" (SiteDiscoveryResult)', () => {
    const report = makeReport('discovery', DISCOVERY_ANALYSIS);
    const result = digestReport(report);

    it('includes "Site Discovery" label', () => {
      expect(result).toContain('Site Discovery');
    });

    it('includes the query', () => {
      expect(result).toContain('fitness creators monetization');
    });

    it('includes the outlier URL', () => {
      expect(result).toContain('https://example.com/site1');
    });

    it('includes the outlier reasoning', () => {
      expect(result).toContain('Only site covering B2B fitness angles');
    });
  });

  describe('source_type = "competitors" (CompetitorGapAnalysis)', () => {
    const report = makeReport('competitors', COMPETITOR_ANALYSIS);
    const result = digestReport(report);

    it('includes "Competitor Espionage" label', () => {
      expect(result).toContain('Competitor Espionage');
    });

    it('includes missing topics', () => {
      expect(result).toContain('Morning routines');
      expect(result).toContain('Meal prep');
    });

    it('includes untapped keyword clusters', () => {
      expect(result).toContain('home gym setup');
      expect(result).toContain('no-equipment workout');
    });

    it('handles empty missing_topics gracefully', () => {
      const noMissing = { ...COMPETITOR_ANALYSIS, missing_topics: [] };
      const r = digestReport(makeReport('competitors', noMissing));
      expect(r).toContain('none noted');
    });

    it('handles empty untapped_keyword_clusters gracefully', () => {
      const noClusters = { ...COMPETITOR_ANALYSIS, untapped_keyword_clusters: [] };
      const r = digestReport(makeReport('competitors', noClusters));
      expect(r).toContain('none noted');
    });
  });
});

// ── digestScript ─────────────────────────────────────────────────────────────

const BASE_SCRIPT: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'My Killer Script',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'You have been doing push-ups wrong your whole life',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Demo wrong form',
        dialogue_or_vo: 'Watch this mistake',
        audio_sfx_cue: 'thud',
        retention_loop_note: 'Pause on the form error to build curiosity',
      },
      {
        scene_number: 2,
        visual_action: 'Demo correct form',
        dialogue_or_vo: 'Now the fix',
        audio_sfx_cue: '',
        retention_loop_note: '',
      },
    ],
    cta: 'Follow for more',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-09-20T14:00:00.000Z',
};

describe('digestScript()', () => {
  const result = digestScript(BASE_SCRIPT);

  it('includes script title', () => {
    expect(result).toContain('My Killer Script');
  });

  it('includes spoken hook', () => {
    expect(result).toContain('You have been doing push-ups wrong your whole life');
  });

  it('includes first scene retention_loop_note', () => {
    expect(result).toContain('Pause on the form error to build curiosity');
  });

  it('includes total scene count', () => {
    expect(result).toContain('2 scenes total');
  });

  it('includes formatted date', () => {
    expect(result).toMatch(/\d+[\\/]\d+[\\/]\d+/);
  });

  it('handles single scene', () => {
    const singleScene: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: {
        ...BASE_SCRIPT.storyboard,
        scenes: [BASE_SCRIPT.storyboard.scenes[0]],
      },
    };
    const r = digestScript(singleScene);
    expect(r).toContain('1 scenes total');
  });

  it('handles empty scenes array gracefully (uses "(none)" for retention_loop_note)', () => {
    const noScenes: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    const r = digestScript(noScenes);
    expect(r).toContain('(none)');
    expect(r).toContain('0 scenes total');
  });

  it('handles scene with empty retention_loop_note (empty string passes through, not "(none)")', () => {
    const emptyNote: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: {
        ...BASE_SCRIPT.storyboard,
        scenes: [{ ...BASE_SCRIPT.storyboard.scenes[0], retention_loop_note: '' }],
      },
    };
    // ?? only substitutes (none) for null/undefined; empty string is passed through as-is
    const r = digestScript(emptyNote);
    expect(r).toContain('first scene retention loop: ""');
    expect(r).not.toContain('(none)');
  });
});
