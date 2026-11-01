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

// Shared date helpers to make assertions locale-independent.
function expectedDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

const ISO = '2024-06-15T12:00:00.000Z';

// ── Viral Gap Analysis ──────────────────────────────────────────────────────

const urlReport: AuditReportRow<ViralGapAnalysis> = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_type: 'url',
  source_url: 'https://www.tiktok.com/@user/video/123',
  platform: 'tiktok',
  viral_score: 82,
  analysis: {
    pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
    hook_evaluation: { score: 85, verdict: 'strong', notes: 'Very engaging opener' },
    retention_prediction: {
      at_3s_percent: 72,
      at_30s_percent: 48,
      meets_3s_benchmark: true,
      meets_30s_benchmark: true,
    },
    action_plan: ['Add captions', 'Tighten hook'],
    source_metrics: {},
  },
  timeline_recommendations: [],
  created_at: ISO,
};

describe('digestReport() — source_type: url (ViralGapAnalysis)', () => {
  const result = digestReport(urlReport);

  it('includes the source type label', () => {
    expect(result).toContain('Viral Gap Analyzer');
  });

  it('includes the hook verdict', () => {
    expect(result).toContain('strong');
  });

  it('includes the hook score', () => {
    expect(result).toContain('85/100');
  });

  it('includes the hook notes', () => {
    expect(result).toContain('Very engaging opener');
  });

  it('includes 3-second retention percentage', () => {
    expect(result).toContain('3s=72%');
  });

  it('includes 30-second retention percentage', () => {
    expect(result).toContain('30s=48%');
  });

  it('includes the formatted date', () => {
    expect(result).toContain(expectedDate(ISO));
  });
});

// ── Growth Blueprint ────────────────────────────────────────────────────────

const accountReport: AuditReportRow<GrowthBlueprint> = {
  id: 'r2',
  user_id: 'u1',
  creator_profile_id: 'cp1',
  source_type: 'account',
  source_url: null,
  platform: null,
  viral_score: null,
  analysis: {
    thematic_consistency: { score: 78, notes: 'Mostly consistent but drifts' },
    view_to_follower_ratio: { value: 0.04, assessment: 'average' },
    posting_cadence: { avg_days_between_posts: 4, assessment: 'acceptable' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: ['Sundays', 'Early mornings'],
    per_platform_notes: {},
  },
  timeline_recommendations: [],
  created_at: ISO,
};

describe('digestReport() — source_type: account (GrowthBlueprint)', () => {
  const result = digestReport(accountReport);

  it('includes the Account Deep-Dive label', () => {
    expect(result).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(result).toContain('78/100');
  });

  it('includes thematic consistency notes', () => {
    expect(result).toContain('Mostly consistent but drifts');
  });

  it('includes posting blindspots joined by semicolons', () => {
    expect(result).toContain('Sundays; Early mornings');
  });

  it('reports none when blindspots array is empty', () => {
    const emptyBlindspots: AuditReportRow<GrowthBlueprint> = {
      ...accountReport,
      analysis: { ...accountReport.analysis, posting_blindspots: [] },
    };
    expect(digestReport(emptyBlindspots)).toContain('none noted');
  });

  it('includes the formatted date', () => {
    expect(result).toContain(expectedDate(ISO));
  });
});

// ── Upload Diagnosis ────────────────────────────────────────────────────────

const uploadReport: AuditReportRow<UploadDiagnosis> = {
  id: 'r3',
  user_id: 'u1',
  creator_profile_id: null,
  source_type: 'upload',
  source_url: null,
  platform: 'youtube_shorts',
  viral_score: null,
  analysis: {
    visual_hook_clarity: { score: 80, verdict: 'strong', notes: 'Punchy visual' },
    audio_balance: { score: 65, notes: 'Music slightly overpowers voice' },
    text_overlay_pacing: { assessment: 'Too fast — reduce to 1 word/beat' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 300,
  },
  timeline_recommendations: [],
  created_at: ISO,
};

describe('digestReport() — source_type: upload (UploadDiagnosis)', () => {
  const result = digestReport(uploadReport);

  it('includes the Upload Diagnostic label', () => {
    expect(result).toContain('Upload Diagnostic');
  });

  it('includes the visual hook verdict', () => {
    expect(result).toContain('"strong"');
  });

  it('includes visual hook score', () => {
    expect(result).toContain('80/100');
  });

  it('includes audio balance score', () => {
    expect(result).toContain('65/100');
  });

  it('includes audio balance notes', () => {
    expect(result).toContain('Music slightly overpowers voice');
  });

  it('includes text overlay pacing assessment', () => {
    expect(result).toContain('Too fast — reduce to 1 word/beat');
  });

  it('includes the formatted date', () => {
    expect(result).toContain(expectedDate(ISO));
  });
});

// ── Site Discovery ──────────────────────────────────────────────────────────

const discoveryReport: AuditReportRow<SiteDiscoveryResult> = {
  id: 'r4',
  user_id: 'u1',
  creator_profile_id: null,
  source_type: 'discovery',
  source_url: null,
  platform: null,
  viral_score: null,
  analysis: {
    query: 'short-form cooking tips',
    sites: [],
    outlier: { url: 'https://example.com/cooking', reasoning: 'Uniquely combines recipe + comedy' },
    summary: 'Found 0 sites',
  },
  timeline_recommendations: [],
  created_at: ISO,
};

describe('digestReport() — source_type: discovery (SiteDiscoveryResult)', () => {
  const result = digestReport(discoveryReport);

  it('includes the Site Discovery label', () => {
    expect(result).toContain('Site Discovery');
  });

  it('includes the search query', () => {
    expect(result).toContain('short-form cooking tips');
  });

  it('includes the outlier URL', () => {
    expect(result).toContain('https://example.com/cooking');
  });

  it('includes the outlier reasoning', () => {
    expect(result).toContain('Uniquely combines recipe + comedy');
  });

  it('includes the formatted date', () => {
    expect(result).toContain(expectedDate(ISO));
  });
});

// ── Competitor Gap Analysis (fallback branch) ───────────────────────────────

const competitorReport: AuditReportRow<CompetitorGapAnalysis> = {
  id: 'r5',
  user_id: 'u1',
  creator_profile_id: null,
  source_type: 'competitors',
  source_url: null,
  platform: null,
  viral_score: null,
  analysis: {
    competitors: [],
    outlier_topics: [],
    missing_topics: ['SEO basics', 'Thumbnail psychology'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['viral hooks', 'trend riding'],
  },
  timeline_recommendations: [],
  created_at: ISO,
};

describe('digestReport() — source_type: competitors (CompetitorGapAnalysis)', () => {
  const result = digestReport(competitorReport);

  it('includes the Competitor Espionage label', () => {
    expect(result).toContain('Competitor Espionage');
  });

  it('includes missing topics joined by semicolons', () => {
    expect(result).toContain('SEO basics; Thumbnail psychology');
  });

  it('includes untapped keyword clusters', () => {
    expect(result).toContain('viral hooks; trend riding');
  });

  it('reports none when missing_topics is empty', () => {
    const emptyTopics: AuditReportRow<CompetitorGapAnalysis> = {
      ...competitorReport,
      analysis: { ...competitorReport.analysis, missing_topics: [] },
    };
    expect(digestReport(emptyTopics)).toContain('missing topics: none noted');
  });

  it('reports none when untapped_keyword_clusters is empty', () => {
    const emptyClusters: AuditReportRow<CompetitorGapAnalysis> = {
      ...competitorReport,
      analysis: { ...competitorReport.analysis, untapped_keyword_clusters: [] },
    };
    expect(digestReport(emptyClusters)).toContain('untapped keyword clusters: none noted');
  });

  it('includes the formatted date', () => {
    expect(result).toContain(expectedDate(ISO));
  });
});

// ── digestScript ────────────────────────────────────────────────────────────

const baseScript: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'Why Algorithms Hate You',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'Nobody tells you this about the algorithm',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Close-up on face',
        dialogue_or_vo: 'Nobody tells you...',
        audio_sfx_cue: 'dramatic sting',
        retention_loop_note: 'Cut mid-sentence to tease the reveal',
      },
      {
        scene_number: 2,
        visual_action: 'Screen recording',
        dialogue_or_vo: 'Here is what they hide...',
        audio_sfx_cue: 'ambient',
        retention_loop_note: 'Open loop: what is hidden?',
      },
    ],
    cta: 'Follow for part 2',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: ISO,
};

describe('digestScript()', () => {
  it('includes the script title', () => {
    expect(digestScript(baseScript)).toContain('Why Algorithms Hate You');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(baseScript)).toContain('Nobody tells you this about the algorithm');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(baseScript)).toContain('Cut mid-sentence to tease the reveal');
  });

  it('reports total scene count', () => {
    expect(digestScript(baseScript)).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    expect(digestScript(baseScript)).toContain(expectedDate(ISO));
  });

  it('shows (none) when scenes array is empty', () => {
    const noScenes: ScriptRow = {
      ...baseScript,
      storyboard: { ...baseScript.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('"(none)"');
  });

  it('preserves empty-string retention_loop_note (not treated as (none))', () => {
    // The ?? operator only falls back for null/undefined, not for ''.
    const emptyNote: ScriptRow = {
      ...baseScript,
      storyboard: {
        ...baseScript.storyboard,
        scenes: [{ ...baseScript.storyboard.scenes[0], retention_loop_note: '' }],
      },
    };
    const result = digestScript(emptyNote);
    expect(result).not.toContain('(none)');
    expect(result).toContain('first scene retention loop: ""');
  });
});
