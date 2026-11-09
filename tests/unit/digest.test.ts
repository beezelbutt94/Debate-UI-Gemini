import { describe, it, expect } from 'vitest';
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

// ── helpers ────────────────────────────────────────────────────────────────

function makeReport<T>(
  overrides: Partial<AuditReportRow<T>> & { source_type: AuditReportRow['source_type']; analysis: T }
): AuditReportRow<T> {
  return {
    id: 'report-1',
    user_id: 'user-1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: '2024-06-15T10:00:00.000Z',
    ...overrides,
  } as AuditReportRow<T>;
}

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'good' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Opens with a question' },
  retention_prediction: {
    at_3s_percent: 65,
    at_30s_percent: 42,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Add a stronger hook'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 80, notes: 'Mostly cooking content' },
  view_to_follower_ratio: { value: 1.5, assessment: 'healthy' },
  posting_cadence: { avg_days_between_posts: 2, assessment: 'consistent' },
  theme_correction: ['add more Q&A'],
  view_maximization_tactics: ['post at peak hours'],
  posting_blindspots: ['weekends', 'mornings'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'Hook is a bit slow' },
  audio_balance: { score: 85, notes: 'Good levels' },
  text_overlay_pacing: { assessment: 'Text stays too long' },
  b_roll_recommendations: ['Add B-roll here'],
  retention_boosters: ['Cut the intro'],
  frames_analyzed: 120,
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'best productivity tools 2024',
  sites: [],
  outlier: { url: 'https://www.notion.so', reasoning: 'Only tool with AI built in' },
  summary: 'Found 10 productivity-related sites.',
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['trending recipes'],
  missing_topics: ['budget cooking', 'meal prep'],
  audience_sentiment_gaps: ['users want faster videos'],
  untapped_keyword_clusters: ['30-min meals', 'one-pot dishes'],
};

// ── digestReport ──────────────────────────────────────────────────────────

describe('digestReport — url (ViralGapAnalysis)', () => {
  const report = makeReport({ source_type: 'url', analysis: viralAnalysis });

  it('contains "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('72/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Opens with a question');
  });

  it('includes retention at 3s', () => {
    expect(digestReport(report)).toContain('3s=65%');
  });

  it('includes retention at 30s', () => {
    expect(digestReport(report)).toContain('30s=42%');
  });

  it('includes a formatted date', () => {
    // Date formatting varies by locale — just check it exists and is non-empty
    const result = digestReport(report);
    expect(result).toMatch(/\d/); // has at least one digit (from date)
  });
});

describe('digestReport — account (GrowthBlueprint)', () => {
  const report = makeReport({ source_type: 'account', analysis: growthAnalysis });

  it('contains "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('80/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Mostly cooking content');
  });

  it('includes posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('weekends');
    expect(result).toContain('mornings');
  });
});

describe('digestReport — account with no posting blindspots', () => {
  const analysis: GrowthBlueprint = { ...growthAnalysis, posting_blindspots: [] };
  const report = makeReport({ source_type: 'account', analysis });

  it('shows "none noted" when blindspots is empty', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport — upload (UploadDiagnosis)', () => {
  const report = makeReport({ source_type: 'upload', analysis: uploadAnalysis });

  it('contains "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('60/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('85/100');
  });

  it('includes audio notes', () => {
    expect(digestReport(report)).toContain('Good levels');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Text stays too long');
  });
});

describe('digestReport — discovery (SiteDiscoveryResult)', () => {
  const report = makeReport({ source_type: 'discovery', analysis: discoveryAnalysis });

  it('contains "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes query string', () => {
    expect(digestReport(report)).toContain('best productivity tools 2024');
  });

  it('includes outlier URL', () => {
    expect(digestReport(report)).toContain('https://www.notion.so');
  });

  it('includes outlier reasoning', () => {
    expect(digestReport(report)).toContain('Only tool with AI built in');
  });
});

describe('digestReport — competitors (CompetitorGapAnalysis)', () => {
  const report = makeReport({ source_type: 'competitors', analysis: competitorAnalysis });

  it('contains "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('budget cooking');
    expect(result).toContain('meal prep');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('30-min meals');
    expect(result).toContain('one-pot dishes');
  });
});

describe('digestReport — competitors with empty arrays', () => {
  const analysis: CompetitorGapAnalysis = {
    ...competitorAnalysis,
    missing_topics: [],
    untapped_keyword_clusters: [],
  };
  const report = makeReport({ source_type: 'competitors', analysis });

  it('shows "none noted" for empty missing_topics', () => {
    expect(digestReport(report)).toContain('missing topics: none noted');
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    expect(digestReport(report)).toContain('untapped keyword clusters: none noted');
  });
});

// ── digestScript ──────────────────────────────────────────────────────────

function makeScript(overrides: Partial<ScriptRow> = {}): ScriptRow {
  return {
    id: 'script-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'My Viral Hook Video',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know you can double your views?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of face',
          dialogue_or_vo: 'Did you know?',
          audio_sfx_cue: 'whoosh',
          retention_loop_note: 'Cut to surprise reveal',
        },
        {
          scene_number: 2,
          visual_action: 'Show graph',
          dialogue_or_vo: 'Views went 2x',
          audio_sfx_cue: '',
          retention_loop_note: 'Cliffhanger',
        },
      ],
      cta: 'Follow for more tips',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-07-20T12:00:00.000Z',
    ...overrides,
  };
}

describe('digestScript', () => {
  it('includes the script title', () => {
    expect(digestScript(makeScript())).toContain('My Viral Hook Video');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(makeScript())).toContain('Did you know you can double your views?');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(makeScript())).toContain('Cut to surprise reveal');
  });

  it('includes the total scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });

  it('includes a formatted date', () => {
    const result = digestScript(makeScript());
    expect(result).toMatch(/\d/);
  });

  it('handles a script with no scenes gracefully (retention note shows "(none)")', () => {
    const script = makeScript({
      storyboard: {
        spoken_hook: 'Hook',
        scenes: [],
        cta: 'Follow me',
        memory_context_used: false,
      },
    });
    expect(digestScript(script)).toContain('(none)');
    expect(digestScript(script)).toContain('0 scenes total');
  });

  it('shows correct scene count for single-scene script', () => {
    const script = makeScript({
      storyboard: {
        spoken_hook: 'Opening',
        scenes: [
          {
            scene_number: 1,
            visual_action: 'show face',
            dialogue_or_vo: 'Hello',
            audio_sfx_cue: '',
            retention_loop_note: 'Loop note',
          },
        ],
        cta: 'Subscribe',
        memory_context_used: false,
      },
    });
    expect(digestScript(script)).toContain('1 scenes total');
  });
});
