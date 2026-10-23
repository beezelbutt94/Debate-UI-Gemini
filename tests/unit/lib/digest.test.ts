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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function baseReport(
  source_type: AuditReportRow['source_type'],
  analysis: AuditReportRow['analysis']
): AuditReportRow {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_type,
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at: '2024-06-15T12:00:00Z',
  };
}

// ─── digestReport – source_type: url (ViralGapAnalysis) ──────────────────────

describe("digestReport() – source_type 'url'", () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 4.2, assessment: 'fast-paced' },
    hook_evaluation: { score: 78, verdict: 'moderate', notes: 'hook is okay' },
    retention_prediction: {
      at_3s_percent: 72,
      at_30s_percent: 45,
      meets_3s_benchmark: true,
      meets_30s_benchmark: true,
    },
    action_plan: ['Add a B-roll'],
    source_metrics: {},
  };
  const report = baseReport('url', analysis);

  it('contains "Viral Gap Analyzer" label', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('78');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('hook is okay');
  });

  it('includes 3-second retention', () => {
    expect(digestReport(report)).toContain('72%');
  });

  it('includes 30-second retention', () => {
    expect(digestReport(report)).toContain('45%');
  });

  it('includes a formatted date derived from created_at', () => {
    const result = digestReport(report);
    // Date will be locale-formatted; just check it's non-empty parenthetical
    expect(result).toMatch(/\(\d/);
  });

  it('returns a string', () => {
    expect(typeof digestReport(report)).toBe('string');
  });
});

// ─── digestReport – source_type: account (GrowthBlueprint) ───────────────────

describe("digestReport() – source_type 'account'", () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 65, notes: 'inconsistent niches' },
    view_to_follower_ratio: { value: 0.5, assessment: 'below average' },
    posting_cadence: { avg_days_between_posts: 3.2, assessment: 'good' },
    theme_correction: ['Focus on one niche'],
    view_maximization_tactics: ['Use trending audio'],
    posting_blindspots: ['Weekends', 'Monday mornings'],
    per_platform_notes: {},
  };
  const report = baseReport('account', analysis);

  it('contains "Account Deep-Dive" label', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('65');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('inconsistent niches');
  });

  it('includes posting blindspots', () => {
    expect(digestReport(report)).toContain('Weekends');
    expect(digestReport(report)).toContain('Monday mornings');
  });

  it('uses semicolons to join blindspots', () => {
    expect(digestReport(report)).toContain('Weekends; Monday mornings');
  });

  it('shows "none noted" when posting_blindspots is empty', () => {
    const noBlindspots: GrowthBlueprint = { ...analysis, posting_blindspots: [] };
    expect(digestReport(baseReport('account', noBlindspots))).toContain('none noted');
  });
});

// ─── digestReport – source_type: upload (UploadDiagnosis) ────────────────────

describe("digestReport() – source_type 'upload'", () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 82, verdict: 'strong', notes: 'great thumbnail' },
    audio_balance: { score: 70, notes: 'slightly loud music' },
    text_overlay_pacing: { assessment: 'too fast for mobile' },
    b_roll_recommendations: ['Add landscape shots'],
    retention_boosters: ['Use on-screen prompts'],
    frames_analyzed: 120,
  };
  const report = baseReport('upload', analysis);

  it('contains "Upload Diagnostic" label', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('82');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('70');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('slightly loud music');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('too fast for mobile');
  });
});

// ─── digestReport – source_type: discovery (SiteDiscoveryResult) ─────────────

describe("digestReport() – source_type 'discovery'", () => {
  const analysis: SiteDiscoveryResult = {
    query: 'viral fitness videos 2024',
    sites: [],
    outlier: {
      url: 'https://example.com/video/1',
      reasoning: 'This video has 10x the engagement of others',
    },
    summary: 'Found several relevant sites.',
  };
  const report = baseReport('discovery', analysis);

  it('contains "Site Discovery" label', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query string', () => {
    expect(digestReport(report)).toContain('viral fitness videos 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/video/1');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('10x the engagement');
  });
});

// ─── digestReport – source_type: competitors (CompetitorGapAnalysis) ─────────

describe("digestReport() – source_type 'competitors' (fallback branch)", () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: ['meal prep', 'budget cooking'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['air fryer recipes', 'high protein snacks'],
  };
  const report = baseReport('competitors', analysis);

  it('contains "Competitor Espionage" label', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing_topics joined by semicolons', () => {
    expect(digestReport(report)).toContain('meal prep; budget cooking');
  });

  it('includes untapped_keyword_clusters', () => {
    expect(digestReport(report)).toContain('air fryer recipes; high protein snacks');
  });

  it('shows "none noted" for missing_topics when empty', () => {
    const noMissing: CompetitorGapAnalysis = { ...analysis, missing_topics: [] };
    expect(digestReport(baseReport('competitors', noMissing))).toContain('none noted');
  });

  it('shows "none noted" for untapped_keyword_clusters when empty', () => {
    const noClusters: CompetitorGapAnalysis = { ...analysis, untapped_keyword_clusters: [] };
    expect(digestReport(baseReport('competitors', noClusters))).toContain('none noted');
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const script: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Viral Hook Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'You will not believe this trick',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of face',
          dialogue_or_vo: 'You will not believe this trick',
          audio_sfx_cue: 'upbeat music',
          retention_loop_note: 'Tease the payoff without revealing it',
        },
        {
          scene_number: 2,
          visual_action: 'Show the product',
          dialogue_or_vo: 'Here is the trick',
          audio_sfx_cue: 'silence',
          retention_loop_note: 'Deliver on the promise',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-08-01T09:30:00Z',
  };

  it('includes the script title', () => {
    expect(digestScript(script)).toContain('My Viral Hook Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(script)).toContain('You will not believe this trick');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(script)).toContain('Tease the payoff without revealing it');
  });

  it('includes total scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('includes a formatted date', () => {
    // Date will be locale-formatted; check it has a parenthetical date
    expect(digestScript(script)).toMatch(/\(\d/);
  });

  it('returns a string', () => {
    expect(typeof digestScript(script)).toBe('string');
  });

  it('shows "(none)" for retention_loop_note when scenes array is empty', () => {
    const emptyScenes: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    expect(digestScript(emptyScenes)).toContain('(none)');
  });

  it('shows "0 scenes total" when scenes array is empty', () => {
    const emptyScenes: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    expect(digestScript(emptyScenes)).toContain('0 scenes total');
  });

  it('handles a script with many scenes correctly (uses first scene)', () => {
    const manyScenes: ScriptRow = {
      ...script,
      storyboard: {
        ...script.storyboard,
        scenes: Array.from({ length: 10 }, (_, i) => ({
          scene_number: i + 1,
          visual_action: `action ${i}`,
          dialogue_or_vo: `dialogue ${i}`,
          audio_sfx_cue: 'sfx',
          retention_loop_note: i === 0 ? 'FIRST SCENE NOTE' : `note ${i}`,
        })),
      },
    };
    expect(digestScript(manyScenes)).toContain('FIRST SCENE NOTE');
    expect(digestScript(manyScenes)).toContain('10 scenes total');
  });
});
