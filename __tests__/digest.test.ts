import { describe, it, expect } from 'vitest';
import { digestReport, digestScript } from '@/lib/digest';
import type { AuditReportRow, ScriptRow } from '@/lib/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE = {
  id: 'report-1',
  user_id: 'user-1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-03-15T10:00:00.000Z',
} as const;

// ── digestReport() ────────────────────────────────────────────────────────────

describe('digestReport() — source_type: url (ViralGapAnalysis)', () => {
  const report: AuditReportRow = {
    ...BASE,
    source_type: 'url',
    analysis: {
      hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Opens mid-action' },
      retention_prediction: {
        at_3s_percent: 65,
        at_30s_percent: 42,
        meets_3s_benchmark: true,
        meets_30s_benchmark: true,
      },
      pacing_audit: { cuts_per_10s: 4, assessment: 'Fast paced' },
      action_plan: ['Improve hook', 'Add captions'],
      source_metrics: {},
    },
  };

  it('includes "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('72/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Opens mid-action');
  });

  it('includes 3s retention percentage', () => {
    expect(digestReport(report)).toContain('3s=65%');
  });

  it('includes 30s retention percentage', () => {
    expect(digestReport(report)).toContain('30s=42%');
  });

  it('includes a formatted date', () => {
    const result = digestReport(report);
    // The date is locale-dependent but must not be empty
    expect(result).toMatch(/\d/);
  });
});

describe('digestReport() — source_type: account (GrowthBlueprint)', () => {
  const report: AuditReportRow = {
    ...BASE,
    source_type: 'account',
    analysis: {
      thematic_consistency: { score: 88, notes: 'Tight niche focus' },
      view_to_follower_ratio: { value: 0.12, assessment: 'Above average' },
      posting_cadence: { avg_days_between_posts: 3, assessment: 'Consistent' },
      theme_correction: [],
      view_maximization_tactics: [],
      posting_blindspots: ['Late nights', 'Weekends'],
      per_platform_notes: {},
    },
  };

  it('includes "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('88/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Tight niche focus');
  });

  it('includes posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Late nights');
    expect(result).toContain('Weekends');
  });

  it('shows "none noted" when posting_blindspots is empty', () => {
    const r: AuditReportRow = {
      ...report,
      analysis: { ...(report.analysis as object), posting_blindspots: [] } as never,
    };
    expect(digestReport(r)).toContain('none noted');
  });
});

describe('digestReport() — source_type: upload (UploadDiagnosis)', () => {
  const report: AuditReportRow = {
    ...BASE,
    source_type: 'upload',
    analysis: {
      visual_hook_clarity: { score: 60, verdict: 'weak', notes: 'Hook unclear' },
      audio_balance: { score: 80, notes: 'Good levels' },
      text_overlay_pacing: { assessment: 'Too fast' },
      b_roll_recommendations: [],
      retention_boosters: [],
      frames_analyzed: 120,
    },
  };

  it('includes "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('weak');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('60/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('80/100');
  });

  it('includes audio notes', () => {
    expect(digestReport(report)).toContain('Good levels');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Too fast');
  });
});

describe('digestReport() — source_type: discovery (SiteDiscoveryResult)', () => {
  const report: AuditReportRow = {
    ...BASE,
    source_type: 'discovery',
    analysis: {
      query: 'best faceless youtube channels',
      sites: [],
      outlier: {
        url: 'https://example.com/outlier',
        reasoning: 'Unique monetization model',
      },
      summary: 'A summary.',
    },
  };

  it('includes "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the search query', () => {
    expect(digestReport(report)).toContain('best faceless youtube channels');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/outlier');
  });

  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Unique monetization model');
  });
});

describe('digestReport() — source_type: competitors (CompetitorGapAnalysis)', () => {
  const report: AuditReportRow = {
    ...BASE,
    source_type: 'competitors',
    analysis: {
      competitors: [],
      outlier_topics: [],
      missing_topics: ['Tutorials', 'Behind the scenes'],
      audience_sentiment_gaps: [],
      untapped_keyword_clusters: ['short-form editing', 'AI tools'],
    },
  };

  it('includes "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('Tutorials');
    expect(result).toContain('Behind the scenes');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('short-form editing');
    expect(result).toContain('AI tools');
  });

  it('shows "none noted" for empty missing_topics', () => {
    const r: AuditReportRow = {
      ...report,
      analysis: {
        ...(report.analysis as object),
        missing_topics: [],
      } as never,
    };
    expect(digestReport(r)).toContain('none noted');
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    const r: AuditReportRow = {
      ...report,
      analysis: {
        ...(report.analysis as object),
        untapped_keyword_clusters: [],
      } as never,
    };
    expect(digestReport(r)).toContain('none noted');
  });
});

// ── digestScript() ────────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const script: ScriptRow = {
    id: 'script-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'How I went viral in 7 days',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'I made $10k in one week.',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Show dashboard',
          dialogue_or_vo: 'Here is my earnings.',
          audio_sfx_cue: 'none',
          retention_loop_note: 'Cliffhanger: HOW?',
        },
        {
          scene_number: 2,
          visual_action: 'Explain steps',
          dialogue_or_vo: 'Step one...',
          audio_sfx_cue: 'none',
          retention_loop_note: 'Next step coming...',
        },
      ],
      cta: 'Follow for part 2',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-03-15T10:00:00.000Z',
  };

  it('includes the script title', () => {
    expect(digestScript(script)).toContain('How I went viral in 7 days');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(script)).toContain('I made $10k in one week.');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(script)).toContain('Cliffhanger: HOW?');
  });

  it('includes total scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('includes a date', () => {
    const result = digestScript(script);
    expect(result).toMatch(/\d/);
  });

  it('shows "(none)" when scenes array is empty', () => {
    const s: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    expect(digestScript(s)).toContain('(none)');
  });

  it('shows "0 scenes total" for empty scenes', () => {
    const s: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    expect(digestScript(s)).toContain('0 scenes total');
  });
});
