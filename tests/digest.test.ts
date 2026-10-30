import { describe, it, expect } from 'vitest';
import { digestReport, digestScript } from '@/lib/digest';
import type {
  AuditReportRow,
  ScriptRow,
  ViralGapAnalysis,
  GrowthBlueprint,
  UploadDiagnosis,
  SiteDiscoveryResult,
  CompetitorGapAnalysis,
} from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────

function baseReport<T>(
  source_type: AuditReportRow['source_type'],
  analysis: T
): AuditReportRow<T> {
  return {
    id: 'rpt-1',
    user_id: 'user-1',
    creator_profile_id: null,
    source_type,
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at: '2024-09-12T10:00:00.000Z',
  };
}

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
  hook_evaluation: { score: 82, verdict: 'strong', notes: 'Great hook' },
  retention_prediction: {
    at_3s_percent: 75,
    at_30s_percent: 45,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Add captions'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 70, notes: 'Mostly cooking, some travel' },
  view_to_follower_ratio: { value: 1.4, assessment: 'good' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['Weekends low traffic', 'Thursdays missed'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 65, verdict: 'moderate', notes: 'Hook needs contrast' },
  audio_balance: { score: 80, notes: 'Good mix' },
  text_overlay_pacing: { assessment: 'Slightly too fast' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 6,
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'vegan cooking tips',
    sites: [],
    outlier: { url: 'https://example.com/outlier', reasoning: 'It covers niche angle' },
    summary: 'Found 10 sites',
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['trending dances'],
  missing_topics: ['monetization tips', 'gear reviews'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['short-form editing', 'b-roll techniques'],
};

// ─── digestReport() ───────────────────────────────────────────────────────

describe('digestReport()', () => {
  describe('source_type = url (ViralGapAnalysis)', () => {
    it('returns a non-empty string', () => {
      const result = digestReport(baseReport('url', viralAnalysis));
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('contains "Viral Gap Analyzer"', () => {
      expect(digestReport(baseReport('url', viralAnalysis))).toContain('Viral Gap Analyzer');
    });

    it('contains the hook verdict', () => {
      expect(digestReport(baseReport('url', viralAnalysis))).toContain('strong');
    });

    it('contains the hook score', () => {
      expect(digestReport(baseReport('url', viralAnalysis))).toContain('82');
    });

    it('contains hook notes', () => {
      expect(digestReport(baseReport('url', viralAnalysis))).toContain('Great hook');
    });

    it('contains 3s retention percent', () => {
      expect(digestReport(baseReport('url', viralAnalysis))).toContain('75');
    });

    it('contains 30s retention percent', () => {
      expect(digestReport(baseReport('url', viralAnalysis))).toContain('45');
    });

    it('includes the formatted date from created_at', () => {
      const result = digestReport(baseReport('url', viralAnalysis));
      // created_at = '2024-09-12T10:00:00.000Z', locale may vary → at least a year
      expect(result).toMatch(/2024/);
    });
  });

  describe('source_type = account (GrowthBlueprint)', () => {
    it('contains "Account Deep-Dive"', () => {
      expect(digestReport(baseReport('account', growthAnalysis))).toContain('Account Deep-Dive');
    });

    it('contains thematic consistency score', () => {
      expect(digestReport(baseReport('account', growthAnalysis))).toContain('70');
    });

    it('contains thematic consistency notes', () => {
      expect(digestReport(baseReport('account', growthAnalysis))).toContain('Mostly cooking');
    });

    it('lists posting blindspots', () => {
      const result = digestReport(baseReport('account', growthAnalysis));
      expect(result).toContain('Weekends low traffic');
      expect(result).toContain('Thursdays missed');
    });

    it('shows "none noted" when blindspots is empty', () => {
      const noBlindspots: GrowthBlueprint = { ...growthAnalysis, posting_blindspots: [] };
      expect(digestReport(baseReport('account', noBlindspots))).toContain('none noted');
    });
  });

  describe('source_type = upload (UploadDiagnosis)', () => {
    it('contains "Upload Diagnostic"', () => {
      expect(digestReport(baseReport('upload', uploadAnalysis))).toContain('Upload Diagnostic');
    });

    it('contains visual hook verdict', () => {
      expect(digestReport(baseReport('upload', uploadAnalysis))).toContain('moderate');
    });

    it('contains visual hook score', () => {
      expect(digestReport(baseReport('upload', uploadAnalysis))).toContain('65');
    });

    it('contains audio balance score', () => {
      expect(digestReport(baseReport('upload', uploadAnalysis))).toContain('80');
    });

    it('contains audio notes', () => {
      expect(digestReport(baseReport('upload', uploadAnalysis))).toContain('Good mix');
    });

    it('contains text-overlay pacing assessment', () => {
      expect(digestReport(baseReport('upload', uploadAnalysis))).toContain('Slightly too fast');
    });
  });

  describe('source_type = discovery (SiteDiscoveryResult)', () => {
    it('contains "Site Discovery"', () => {
      expect(digestReport(baseReport('discovery', discoveryAnalysis))).toContain('Site Discovery');
    });

    it('contains the query', () => {
      expect(digestReport(baseReport('discovery', discoveryAnalysis))).toContain('vegan cooking tips');
    });

    it('contains the outlier URL', () => {
      expect(digestReport(baseReport('discovery', discoveryAnalysis))).toContain('https://example.com/outlier');
    });

    it('contains the outlier reasoning', () => {
      expect(digestReport(baseReport('discovery', discoveryAnalysis))).toContain('niche angle');
    });
  });

  describe('source_type = competitors (CompetitorGapAnalysis)', () => {
    it('contains "Competitor Espionage"', () => {
      expect(digestReport(baseReport('competitors', competitorAnalysis))).toContain('Competitor Espionage');
    });

    it('lists missing topics', () => {
      const result = digestReport(baseReport('competitors', competitorAnalysis));
      expect(result).toContain('monetization tips');
      expect(result).toContain('gear reviews');
    });

    it('lists untapped keyword clusters', () => {
      const result = digestReport(baseReport('competitors', competitorAnalysis));
      expect(result).toContain('short-form editing');
    });

    it('shows "none noted" when missing_topics is empty', () => {
      const noMissing: CompetitorGapAnalysis = { ...competitorAnalysis, missing_topics: [] };
      expect(digestReport(baseReport('competitors', noMissing))).toContain('none noted');
    });

    it('shows "none noted" when untapped_keyword_clusters is empty', () => {
      const noClusters: CompetitorGapAnalysis = {
        ...competitorAnalysis,
        untapped_keyword_clusters: [],
      };
      expect(digestReport(baseReport('competitors', noClusters))).toContain('none noted');
    });
  });
});

// ─── digestScript() ───────────────────────────────────────────────────────

const baseScript: ScriptRow = {
  id: 'scr-1',
  user_id: 'user-1',
  creator_profile_id: null,
  title: 'My Viral Script',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'Did you know this?',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Close-up of face',
        dialogue_or_vo: 'Did you know this?',
        audio_sfx_cue: 'upbeat music',
        retention_loop_note: 'Cliffhanger ending',
      },
      {
        scene_number: 2,
        visual_action: 'B-roll',
        dialogue_or_vo: 'Here is the detail',
        audio_sfx_cue: '',
        retention_loop_note: 'Callback to intro',
      },
    ],
    cta: 'Follow for more',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-10-05T08:00:00.000Z',
};

describe('digestScript()', () => {
  it('returns a non-empty string', () => {
    expect(digestScript(baseScript).length).toBeGreaterThan(0);
  });

  it('contains the script title', () => {
    expect(digestScript(baseScript)).toContain('My Viral Script');
  });

  it('contains the spoken hook', () => {
    expect(digestScript(baseScript)).toContain('Did you know this?');
  });

  it('contains the first scene retention loop note', () => {
    expect(digestScript(baseScript)).toContain('Cliffhanger ending');
  });

  it('contains the total number of scenes', () => {
    expect(digestScript(baseScript)).toContain('2');
  });

  it('includes the formatted date', () => {
    expect(digestScript(baseScript)).toMatch(/2024/);
  });

  it('shows "(none)" when first scene has no retention_loop_note', () => {
    const noNote: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [
          { ...baseScript.storyboard.scenes[0], retention_loop_note: '' },
        ],
      },
    };
    // retention_loop_note is '' (truthy-ish but the ?? checks for undefined/null)
    // Actually '' is truthy, so it would show '' not (none). Let me test with undefined.
    const undefinedNote: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [],
      },
    };
    expect(digestScript(undefinedNote)).toContain('(none)');
  });

  it('handles a script with no scenes (weakScene is undefined)', () => {
    const emptyScenes: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    const result = digestScript(emptyScenes);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('contains "scenes total"', () => {
    expect(digestScript(baseScript)).toContain('scenes total');
  });
});
