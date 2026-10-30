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

// ── helpers ────────────────────────────────────────────────────────────────

function makeBase(overrides?: Partial<AuditReportRow>): AuditReportRow {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_type: 'url',
    source_url: 'https://www.tiktok.com/@user/video/1',
    platform: 'tiktok',
    viral_score: 75,
    analysis: {} as ViralGapAnalysis,
    timeline_recommendations: [],
    created_at: '2024-06-15T12:00:00.000Z',
    ...overrides,
  };
}

const viralGapAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'good' },
  hook_evaluation: { score: 82, verdict: 'strong', notes: 'Opens with a bold question' },
  retention_prediction: { at_3s_percent: 72, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Add captions', 'Improve CTA'],
  source_metrics: {},
};

const growthBlueprint: GrowthBlueprint = {
  thematic_consistency: { score: 65, notes: 'Mix of fitness and cooking' },
  view_to_follower_ratio: { value: 1.4, assessment: 'healthy' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
  theme_correction: ['Focus on fitness'],
  view_maximization_tactics: ['Post at 7pm'],
  posting_blindspots: ['Weekends unused', 'Morning slots empty'],
  per_platform_notes: {},
};

const uploadDiagnosis: UploadDiagnosis = {
  visual_hook_clarity: { score: 70, verdict: 'moderate', notes: 'Hook visible but slow' },
  audio_balance: { score: 88, notes: 'Clean audio' },
  text_overlay_pacing: { assessment: 'Overlays disappear too quickly' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 30,
};

const competitorGapAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['viral dances', 'recipe hacks'],
  missing_topics: ['cooking tips', 'workout routines'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['beginner fitness', 'meal prep ideas'],
};

const siteDiscoveryResult: SiteDiscoveryResult = {
  query: 'best fitness YouTube channels',
  sites: [],
  outlier: { url: 'https://outlier.example.com', reasoning: 'Unique angle on data-driven workouts' },
  summary: 'Top 10 fitness sites',
};

// ── digestReport ───────────────────────────────────────────────────────────

describe('digestReport() - url (ViralGapAnalysis)', () => {
  const report = makeBase({ source_type: 'url', analysis: viralGapAnalysis });

  it('includes "Viral Gap Analyzer" label', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('82');
  });

  it('includes hook notes text', () => {
    expect(digestReport(report)).toContain('Opens with a bold question');
  });

  it('includes 3s retention percentage', () => {
    expect(digestReport(report)).toContain('72%');
  });

  it('includes 30s retention percentage', () => {
    expect(digestReport(report)).toContain('45%');
  });

  it('includes a formatted date', () => {
    // The date 2024-06-15 should appear formatted by toLocaleDateString
    const result = digestReport(report);
    expect(result).toMatch(/\d+\/\d+\/\d+/);
  });
});

describe('digestReport() - account (GrowthBlueprint)', () => {
  const report = makeBase({ source_type: 'account', analysis: growthBlueprint });

  it('includes "Account Deep-Dive" label', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('65');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Mix of fitness and cooking');
  });

  it('includes posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Weekends unused');
    expect(result).toContain('Morning slots empty');
  });
});

describe('digestReport() - account with no posting blindspots', () => {
  const report = makeBase({
    source_type: 'account',
    analysis: { ...growthBlueprint, posting_blindspots: [] },
  });

  it('says "none noted" when blindspots array is empty', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport() - upload (UploadDiagnosis)', () => {
  const report = makeBase({ source_type: 'upload', analysis: uploadDiagnosis });

  it('includes "Upload Diagnostic" label', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('70');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('88');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Clean audio');
  });

  it('includes text overlay assessment', () => {
    expect(digestReport(report)).toContain('Overlays disappear too quickly');
  });
});

describe('digestReport() - discovery (SiteDiscoveryResult)', () => {
  const report = makeBase({ source_type: 'discovery', analysis: siteDiscoveryResult });

  it('includes "Site Discovery" label', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the search query', () => {
    expect(digestReport(report)).toContain('best fitness YouTube channels');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://outlier.example.com');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Unique angle on data-driven workouts');
  });
});

describe('digestReport() - competitors (CompetitorGapAnalysis)', () => {
  const report = makeBase({ source_type: 'competitors', analysis: competitorGapAnalysis });

  it('includes "Competitor Espionage" label', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('cooking tips');
    expect(result).toContain('workout routines');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('beginner fitness');
    expect(result).toContain('meal prep ideas');
  });
});

describe('digestReport() - competitors with empty arrays', () => {
  const report = makeBase({
    source_type: 'competitors',
    analysis: { ...competitorGapAnalysis, missing_topics: [], untapped_keyword_clusters: [] },
  });

  it('says "none noted" for missing topics when empty', () => {
    const result = digestReport(report);
    expect(result).toContain('none noted');
  });
});

// ── digestScript ───────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const script: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'Morning Routine Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'This one habit changed my mornings forever.',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Wake up shot',
          dialogue_or_vo: 'Open your eyes to...',
          audio_sfx_cue: 'alarm sfx',
          retention_loop_note: 'Cut before they can blink',
        },
        {
          scene_number: 2,
          visual_action: 'Coffee shot',
          dialogue_or_vo: 'Brew the magic...',
          audio_sfx_cue: 'coffee sfx',
          retention_loop_note: 'Sensory hook',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-08-01T09:00:00.000Z',
  };

  it('includes script title', () => {
    expect(digestScript(script)).toContain('Morning Routine Script');
  });

  it('includes spoken hook', () => {
    expect(digestScript(script)).toContain('This one habit changed my mornings forever.');
  });

  it('includes first scene retention loop note', () => {
    expect(digestScript(script)).toContain('Cut before they can blink');
  });

  it('includes scene count', () => {
    expect(digestScript(script)).toContain('2 scenes');
  });

  it('includes a date', () => {
    expect(digestScript(script)).toMatch(/\d+\/\d+\/\d+/);
  });

  it('handles a script with no scenes gracefully', () => {
    const noScenes: ScriptRow = { ...script, storyboard: { ...script.storyboard, scenes: [] } };
    const result = digestScript(noScenes);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes');
  });
});
