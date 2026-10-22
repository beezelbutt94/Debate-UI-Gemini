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

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'rep-1',
  user_id: 'usr-1',
  creator_profile_id: null,
  source_url: 'https://www.tiktok.com/@user/video/1',
  platform: 'tiktok',
  viral_score: 72,
  timeline_recommendations: [],
  created_at: '2024-06-15T12:00:00Z',
};

const VIRAL_GAP_ANALYSIS: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'Good pacing' },
  hook_evaluation: { score: 78, verdict: 'strong', notes: 'Compelling opening' },
  retention_prediction: {
    at_3s_percent: 70,
    at_30s_percent: 45,
    meets_3s_benchmark: true,
    meets_30s_benchmark: true,
  },
  action_plan: ['Add pattern interrupt at 5s'],
  source_metrics: {},
};

const GROWTH_BLUEPRINT: GrowthBlueprint = {
  thematic_consistency: { score: 65, notes: 'Somewhat inconsistent niche' },
  view_to_follower_ratio: { value: 2.4, assessment: 'Above average' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'Regular' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['Weekend mornings', 'Holiday slots'],
  per_platform_notes: {},
};

const UPLOAD_DIAGNOSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 82, verdict: 'strong', notes: 'Clear subject' },
  audio_balance: { score: 74, notes: 'Slightly loud music' },
  text_overlay_pacing: { assessment: 'Text stays on screen too long' },
  b_roll_recommendations: ['Add B-roll at 10s'],
  retention_boosters: [],
  frames_analyzed: 120,
};

const COMPETITOR_GAP: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['AI tools'],
  missing_topics: ['Budgeting tips', 'Side hustles'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['passive income 2024', 'money mindset'],
};

const SITE_DISCOVERY: SiteDiscoveryResult = {
  query: 'best productivity apps 2024',
  sites: [],
  outlier: {
    url: 'https://example.com/outlier',
    reasoning: 'Uniquely focused on hardware rather than software',
  },
  summary: 'Ten top productivity resources',
};

const BASE_SCRIPT: ScriptRow = {
  id: 'scr-1',
  user_id: 'usr-1',
  creator_profile_id: null,
  title: 'My Viral Script',
  source_prompt: 'Write a script about productivity',
  storyboard: {
    spoken_hook: 'Stop wasting your mornings like this',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Person hitting snooze',
        dialogue_or_vo: 'Every morning you lose 30 minutes...',
        audio_sfx_cue: 'Alarm sound',
        retention_loop_note: 'Open loop: how much time are they losing?',
      },
      {
        scene_number: 2,
        visual_action: 'Calendar montage',
        dialogue_or_vo: "Here's the fix",
        audio_sfx_cue: 'Upbeat music in',
        retention_loop_note: 'Transition to solution',
      },
    ],
    cta: 'Follow for daily productivity tips',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-09-12T09:00:00Z',
};

// ─── digestReport ────────────────────────────────────────────────────────────

describe('digestReport — url (ViralGapAnalysis)', () => {
  const report: AuditReportRow<ViralGapAnalysis> = {
    ...BASE_REPORT,
    source_type: 'url',
    analysis: VIRAL_GAP_ANALYSIS,
  };

  it('starts with "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toMatch(/^Viral Gap Analyzer/);
  });

  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('78/100');
  });

  it('includes the hook notes', () => {
    expect(digestReport(report)).toContain('Compelling opening');
  });

  it('includes 3s retention percent', () => {
    expect(digestReport(report)).toContain('3s=70%');
  });

  it('includes 30s retention percent', () => {
    expect(digestReport(report)).toContain('30s=45%');
  });

  it('includes a formatted date', () => {
    // locale-dependent but should contain digits
    expect(digestReport(report)).toMatch(/\d/);
  });
});

describe('digestReport — account (GrowthBlueprint)', () => {
  const report: AuditReportRow<GrowthBlueprint> = {
    ...BASE_REPORT,
    source_type: 'account',
    analysis: GROWTH_BLUEPRINT,
  };

  it('starts with "Account Deep-Dive"', () => {
    expect(digestReport(report)).toMatch(/^Account Deep-Dive/);
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('65/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Somewhat inconsistent niche');
  });

  it('includes posting blindspots', () => {
    expect(digestReport(report)).toContain('Weekend mornings');
    expect(digestReport(report)).toContain('Holiday slots');
  });
});

describe('digestReport — account with no posting blindspots', () => {
  const report: AuditReportRow<GrowthBlueprint> = {
    ...BASE_REPORT,
    source_type: 'account',
    analysis: { ...GROWTH_BLUEPRINT, posting_blindspots: [] },
  };

  it('says "none noted" when blindspots array is empty', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport — upload (UploadDiagnosis)', () => {
  const report: AuditReportRow<UploadDiagnosis> = {
    ...BASE_REPORT,
    source_type: 'upload',
    analysis: UPLOAD_DIAGNOSIS,
  };

  it('starts with "Upload Diagnostic"', () => {
    expect(digestReport(report)).toMatch(/^Upload Diagnostic/);
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('82/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('74/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Slightly loud music');
  });

  it('includes text overlay assessment', () => {
    expect(digestReport(report)).toContain('Text stays on screen too long');
  });
});

describe('digestReport — competitors (CompetitorGapAnalysis)', () => {
  const report: AuditReportRow<CompetitorGapAnalysis> = {
    ...BASE_REPORT,
    source_type: 'competitors',
    analysis: COMPETITOR_GAP,
  };

  it('starts with "Competitor Espionage"', () => {
    expect(digestReport(report)).toMatch(/^Competitor Espionage/);
  });

  it('includes missing topics', () => {
    expect(digestReport(report)).toContain('Budgeting tips');
    expect(digestReport(report)).toContain('Side hustles');
  });

  it('includes untapped keyword clusters', () => {
    expect(digestReport(report)).toContain('passive income 2024');
    expect(digestReport(report)).toContain('money mindset');
  });
});

describe('digestReport — competitors with empty arrays', () => {
  const report: AuditReportRow<CompetitorGapAnalysis> = {
    ...BASE_REPORT,
    source_type: 'competitors',
    analysis: { ...COMPETITOR_GAP, missing_topics: [], untapped_keyword_clusters: [] },
  };

  it('says "none noted" for missing topics when empty', () => {
    expect(digestReport(report)).toMatch(/missing topics: none noted/);
  });

  it('says "none noted" for keyword clusters when empty', () => {
    expect(digestReport(report)).toMatch(/untapped keyword clusters: none noted/);
  });
});

describe('digestReport — discovery (SiteDiscoveryResult)', () => {
  const report: AuditReportRow<SiteDiscoveryResult> = {
    ...BASE_REPORT,
    source_type: 'discovery',
    analysis: SITE_DISCOVERY,
  };

  it('starts with "Site Discovery"', () => {
    expect(digestReport(report)).toMatch(/^Site Discovery/);
  });

  it('includes the query', () => {
    expect(digestReport(report)).toContain('best productivity apps 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/outlier');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Uniquely focused on hardware');
  });
});

// ─── digestScript ────────────────────────────────────────────────────────────

describe('digestScript', () => {
  it('includes the script title', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('My Viral Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Stop wasting your mornings like this');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Open loop: how much time are they losing?');
  });

  it('includes the total scene count', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('2 scenes total');
  });

  it('includes a date (contains digits)', () => {
    expect(digestScript(BASE_SCRIPT)).toMatch(/\d/);
  });

  it('starts with Script "', () => {
    expect(digestScript(BASE_SCRIPT)).toMatch(/^Script "/);
  });

  it('handles a script with no scenes gracefully', () => {
    const noScenes: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    const result = digestScript(noScenes);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('handles a script with one scene', () => {
    const oneScene: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: {
        ...BASE_SCRIPT.storyboard,
        scenes: [BASE_SCRIPT.storyboard.scenes[0]],
      },
    };
    expect(digestScript(oneScene)).toContain('1 scenes total');
  });
});
