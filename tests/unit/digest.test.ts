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

// ── Shared fixed timestamp so .toLocaleDateString() is predictable ──────────
const CREATED_AT = '2024-06-15T12:00:00.000Z';
const DATE_STR = new Date(CREATED_AT).toLocaleDateString();

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeReport<T>(
  source_type: AuditReportRow['source_type'],
  analysis: T
): AuditReportRow<T> {
  return {
    id: 'rpt-1',
    user_id: 'u-1',
    creator_profile_id: null,
    source_type,
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at: CREATED_AT,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// digestReport – source_type: 'url'  (ViralGapAnalysis)
// ════════════════════════════════════════════════════════════════════════════
describe('digestReport() – url / ViralGapAnalysis', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'fast-paced' },
    hook_evaluation: { score: 85, verdict: 'strong', notes: 'Grabs attention immediately' },
    retention_prediction: {
      at_3s_percent: 72,
      at_30s_percent: 45,
      meets_3s_benchmark: true,
      meets_30s_benchmark: true,
    },
    action_plan: ['Add a CTA at 30s'],
    source_metrics: {},
  };

  const report = makeReport('url', analysis);

  it('starts with "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toMatch(/^Viral Gap Analyzer/);
  });

  it('includes the formatted date', () => {
    expect(digestReport(report)).toContain(DATE_STR);
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('85');
  });

  it('includes the hook notes', () => {
    expect(digestReport(report)).toContain('Grabs attention immediately');
  });

  it('includes the 3s retention percentage', () => {
    expect(digestReport(report)).toContain('72');
  });

  it('includes the 30s retention percentage', () => {
    expect(digestReport(report)).toContain('45');
  });

  it('works with "weak" hook verdict', () => {
    const weak: ViralGapAnalysis = {
      ...analysis,
      hook_evaluation: { score: 20, verdict: 'weak', notes: 'No hook at all' },
    };
    const result = digestReport(makeReport('url', weak));
    expect(result).toContain('weak');
    expect(result).toContain('20');
  });

  it('works with "moderate" hook verdict', () => {
    const mod: ViralGapAnalysis = {
      ...analysis,
      hook_evaluation: { score: 55, verdict: 'moderate', notes: 'Could be stronger' },
    };
    expect(digestReport(makeReport('url', mod))).toContain('moderate');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// digestReport – source_type: 'account'  (GrowthBlueprint)
// ════════════════════════════════════════════════════════════════════════════
describe('digestReport() – account / GrowthBlueprint', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 78, notes: 'Mix of cooking and finance' },
    view_to_follower_ratio: { value: 0.12, assessment: 'Below average' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'Consistent' },
    theme_correction: ['Focus on one niche'],
    view_maximization_tactics: ['Use trending audio'],
    posting_blindspots: ['Weekday mornings', 'Thursday evening'],
    per_platform_notes: {},
  };

  const report = makeReport('account', analysis);

  it('starts with "Account Deep-Dive"', () => {
    expect(digestReport(report)).toMatch(/^Account Deep-Dive/);
  });

  it('includes the thematic consistency score', () => {
    expect(digestReport(report)).toContain('78');
  });

  it('includes the thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Mix of cooking and finance');
  });

  it('includes posting blindspots joined by semicolons', () => {
    const result = digestReport(report);
    expect(result).toContain('Weekday mornings');
    expect(result).toContain('Thursday evening');
  });

  it('shows "none noted" when blindspots is empty', () => {
    const noBlind: GrowthBlueprint = { ...analysis, posting_blindspots: [] };
    expect(digestReport(makeReport('account', noBlind))).toContain('none noted');
  });

  it('includes the formatted date', () => {
    expect(digestReport(report)).toContain(DATE_STR);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// digestReport – source_type: 'upload'  (UploadDiagnosis)
// ════════════════════════════════════════════════════════════════════════════
describe('digestReport() – upload / UploadDiagnosis', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 90, verdict: 'strong', notes: 'Bold opening shot' },
    audio_balance: { score: 65, notes: 'Music slightly overpowers speech' },
    text_overlay_pacing: { assessment: 'Text moves too fast' },
    b_roll_recommendations: ['Add B-roll at 10s'],
    retention_boosters: ['Add a mid-video hook'],
    frames_analyzed: 120,
  };

  const report = makeReport('upload', analysis);

  it('starts with "Upload Diagnostic"', () => {
    expect(digestReport(report)).toMatch(/^Upload Diagnostic/);
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('90');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('65');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Music slightly overpowers speech');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Text moves too fast');
  });

  it('includes the formatted date', () => {
    expect(digestReport(report)).toContain(DATE_STR);
  });

  it('works with "weak" visual hook', () => {
    const weak: UploadDiagnosis = {
      ...analysis,
      visual_hook_clarity: { score: 15, verdict: 'weak', notes: 'No clear opener' },
    };
    expect(digestReport(makeReport('upload', weak))).toContain('weak');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// digestReport – source_type: 'discovery'  (SiteDiscoveryResult)
// ════════════════════════════════════════════════════════════════════════════
describe('digestReport() – discovery / SiteDiscoveryResult', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'best viral hooks 2024',
    sites: [],
    outlier: {
      url: 'https://example.com/outlier',
      reasoning: 'Uses an unusually long hook structure',
    },
    summary: 'Found 10 relevant sites',
  };

  const report = makeReport('discovery', analysis);

  it('starts with "Site Discovery"', () => {
    expect(digestReport(report)).toMatch(/^Site Discovery/);
  });

  it('includes the query string', () => {
    expect(digestReport(report)).toContain('best viral hooks 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/outlier');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Uses an unusually long hook structure');
  });

  it('includes the formatted date', () => {
    expect(digestReport(report)).toContain(DATE_STR);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// digestReport – source_type: 'competitors'  (CompetitorGapAnalysis)
// ════════════════════════════════════════════════════════════════════════════
describe('digestReport() – competitors / CompetitorGapAnalysis', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: ['vlogs'],
    missing_topics: ['productivity hacks', 'morning routines'],
    audience_sentiment_gaps: ['less negative content'],
    untapped_keyword_clusters: ['focus music', 'study with me'],
  };

  const report = makeReport('competitors', analysis);

  it('starts with "Competitor Espionage"', () => {
    expect(digestReport(report)).toMatch(/^Competitor Espionage/);
  });

  it('includes missing topics joined by semicolons', () => {
    const result = digestReport(report);
    expect(result).toContain('productivity hacks');
    expect(result).toContain('morning routines');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('focus music');
    expect(result).toContain('study with me');
  });

  it('shows "none noted" for missing_topics when empty', () => {
    const empty: CompetitorGapAnalysis = { ...analysis, missing_topics: [] };
    expect(digestReport(makeReport('competitors', empty))).toContain('none noted');
  });

  it('shows "none noted" for untapped_keyword_clusters when empty', () => {
    const empty: CompetitorGapAnalysis = { ...analysis, untapped_keyword_clusters: [] };
    expect(digestReport(makeReport('competitors', empty))).toContain('none noted');
  });

  it('includes the formatted date', () => {
    expect(digestReport(report)).toContain(DATE_STR);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// digestScript()
// ════════════════════════════════════════════════════════════════════════════
describe('digestScript()', () => {
  const baseScript: ScriptRow = {
    id: 'scr-1',
    user_id: 'u-1',
    creator_profile_id: null,
    title: 'My Best Hook Ever',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know you can double your views in 7 days?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of face',
          dialogue_or_vo: 'Opening line',
          audio_sfx_cue: 'Upbeat music fade in',
          retention_loop_note: 'Cliffhanger — answer delayed to scene 3',
        },
        {
          scene_number: 2,
          visual_action: 'B-roll montage',
          dialogue_or_vo: 'Build-up content',
          audio_sfx_cue: 'Continue music',
          retention_loop_note: 'Pattern interrupt at 10s',
        },
      ],
      cta: 'Follow for part 2',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: CREATED_AT,
  };

  it('includes the script title', () => {
    expect(digestScript(baseScript)).toContain('My Best Hook Ever');
  });

  it('includes the formatted date', () => {
    expect(digestScript(baseScript)).toContain(DATE_STR);
  });

  it('includes the spoken hook', () => {
    expect(digestScript(baseScript)).toContain('Did you know you can double your views in 7 days?');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(baseScript)).toContain('Cliffhanger — answer delayed to scene 3');
  });

  it('reports total scene count', () => {
    expect(digestScript(baseScript)).toContain('2 scenes total');
  });

  it('renders empty string as "" (not "(none)") — ?? only catches null/undefined', () => {
    const script: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [
          { ...baseScript.storyboard.scenes[0], retention_loop_note: '' },
        ],
      },
    };
    // ?? coalesces null/undefined only — empty string passes through as ""
    const result = digestScript(script);
    expect(result).toContain('first scene retention loop: ""');
    expect(result).not.toContain('(none)');
  });

  it('shows "(none)" when there are no scenes', () => {
    const script: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    expect(digestScript(script)).toContain('(none)');
  });

  it('reports correct scene count with one scene', () => {
    const script: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [baseScript.storyboard.scenes[0]] },
    };
    expect(digestScript(script)).toContain('1 scenes total');
  });

  it('reports correct scene count with zero scenes', () => {
    const script: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    expect(digestScript(script)).toContain('0 scenes total');
  });

  it('starts with Script "Title"', () => {
    expect(digestScript(baseScript)).toMatch(/^Script "My Best Hook Ever"/);
  });
});
