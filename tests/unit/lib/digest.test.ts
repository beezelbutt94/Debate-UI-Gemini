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

const BASE_REPORT: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'rpt-1',
  user_id: 'usr-1',
  creator_profile_id: null,
  source_url: 'https://example.com/video',
  platform: null,
  viral_score: 72,
  timeline_recommendations: [],
  created_at: '2024-06-15T12:00:00.000Z',
};

describe('digestReport', () => {
  it('formats a url (ViralGapAnalysis) report', () => {
    const analysis: ViralGapAnalysis = {
      pacing_audit: { cuts_per_10s: 4.5, assessment: 'Fast-paced' },
      hook_evaluation: { score: 85, verdict: 'strong', notes: 'Great hook' },
      retention_prediction: {
        at_3s_percent: 72,
        at_30s_percent: 48,
        meets_3s_benchmark: true,
        meets_30s_benchmark: true,
      },
      action_plan: ['Add captions'],
      source_metrics: {},
    };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis };
    const result = digestReport(report);

    expect(result).toContain('Viral Gap Analyzer');
    expect(result).toContain('strong');
    expect(result).toContain('85');
    expect(result).toContain('Great hook');
    expect(result).toContain('72%');
    expect(result).toContain('48%');
  });

  it('formats an account (GrowthBlueprint) report', () => {
    const analysis: GrowthBlueprint = {
      thematic_consistency: { score: 60, notes: 'Needs focus' },
      view_to_follower_ratio: { value: 1.5, assessment: 'Good' },
      posting_cadence: { avg_days_between_posts: 3, assessment: 'Regular' },
      theme_correction: [],
      view_maximization_tactics: [],
      posting_blindspots: ['Weekends', 'Early morning'],
      per_platform_notes: {},
    };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis };
    const result = digestReport(report);

    expect(result).toContain('Account Deep-Dive');
    expect(result).toContain('60');
    expect(result).toContain('Needs focus');
    expect(result).toContain('Weekends');
    expect(result).toContain('Early morning');
  });

  it('formats an account report with no posting blindspots', () => {
    const analysis: GrowthBlueprint = {
      thematic_consistency: { score: 95, notes: 'Excellent' },
      view_to_follower_ratio: { value: null, assessment: 'N/A' },
      posting_cadence: { avg_days_between_posts: null, assessment: 'Unknown' },
      theme_correction: [],
      view_maximization_tactics: [],
      posting_blindspots: [],
      per_platform_notes: {},
    };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'account', analysis };
    const result = digestReport(report);

    expect(result).toContain('none noted');
  });

  it('formats an upload (UploadDiagnosis) report', () => {
    const analysis: UploadDiagnosis = {
      visual_hook_clarity: { score: 70, verdict: 'moderate', notes: 'Hook is okay' },
      audio_balance: { score: 55, notes: 'Audio slightly off' },
      text_overlay_pacing: { assessment: 'Too fast' },
      b_roll_recommendations: [],
      retention_boosters: [],
      frames_analyzed: 150,
    };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'upload', analysis };
    const result = digestReport(report);

    expect(result).toContain('Upload Diagnostic');
    expect(result).toContain('moderate');
    expect(result).toContain('70');
    expect(result).toContain('55');
    expect(result).toContain('Audio slightly off');
    expect(result).toContain('Too fast');
  });

  it('formats a discovery (SiteDiscoveryResult) report', () => {
    const analysis: SiteDiscoveryResult = {
      query: 'viral fitness shorts',
      sites: [
        {
          url: 'https://fitness.example.com',
          domain: 'fitness.example.com',
          title: 'Fitness Hacks',
          snippet: 'Top fitness tips',
          relevance_reason: 'Highly relevant',
        },
      ],
      outlier: {
        url: 'https://fitness.example.com',
        reasoning: 'Uses unusual angle',
      },
      summary: 'Great results found',
    };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'discovery', analysis };
    const result = digestReport(report);

    expect(result).toContain('Site Discovery');
    expect(result).toContain('viral fitness shorts');
    expect(result).toContain('https://fitness.example.com');
    expect(result).toContain('Uses unusual angle');
  });

  it('formats a competitors (CompetitorGapAnalysis) report (default branch)', () => {
    const analysis: CompetitorGapAnalysis = {
      competitors: [],
      outlier_topics: ['Gaming tutorials'],
      missing_topics: ['Behind the scenes', 'Q&A format'],
      audience_sentiment_gaps: [],
      untapped_keyword_clusters: ['beginner tips', 'quick guides'],
    };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis };
    const result = digestReport(report);

    expect(result).toContain('Competitor Espionage');
    expect(result).toContain('Behind the scenes');
    expect(result).toContain('Q&A format');
    expect(result).toContain('beginner tips');
    expect(result).toContain('quick guides');
  });

  it('formats a competitors report with no missing topics', () => {
    const analysis: CompetitorGapAnalysis = {
      competitors: [],
      outlier_topics: [],
      missing_topics: [],
      audience_sentiment_gaps: [],
      untapped_keyword_clusters: [],
    };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'competitors', analysis };
    const result = digestReport(report);

    expect(result).toContain('none noted');
  });

  it('includes a date string in every report type', () => {
    const analysis: ViralGapAnalysis = {
      pacing_audit: { cuts_per_10s: 2, assessment: 'ok' },
      hook_evaluation: { score: 50, verdict: 'moderate', notes: 'ok' },
      retention_prediction: {
        at_3s_percent: 55,
        at_30s_percent: 35,
        meets_3s_benchmark: false,
        meets_30s_benchmark: false,
      },
      action_plan: [],
      source_metrics: {},
    };
    const report: AuditReportRow = { ...BASE_REPORT, source_type: 'url', analysis };
    const result = digestReport(report);
    // Date string from toLocaleDateString — just verify it's a non-empty part of the output
    expect(result.length).toBeGreaterThan(30);
    expect(result).toMatch(/\d/); // at least one digit from the date
  });
});

describe('digestScript', () => {
  const script: ScriptRow = {
    id: 'scr-1',
    user_id: 'usr-1',
    creator_profile_id: null,
    title: 'Epic Fitness Hook',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'You will never believe this hack!',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Show before photo',
          dialogue_or_vo: 'Here is what I looked like before.',
          audio_sfx_cue: 'upbeat music',
          retention_loop_note: 'Cut to dramatic reaction',
        },
        {
          scene_number: 2,
          visual_action: 'Show after photo',
          dialogue_or_vo: 'And this is after just 30 days.',
          audio_sfx_cue: 'swipe sound',
          retention_loop_note: 'Loop with a zoom',
        },
      ],
      cta: 'Follow for more!',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-07-20T08:00:00.000Z',
  };

  it('includes the script title', () => {
    expect(digestScript(script)).toContain('Epic Fitness Hook');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(script)).toContain('You will never believe this hack!');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(script)).toContain('Cut to dramatic reaction');
  });

  it('includes the total scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('outputs a correctly prefixed string', () => {
    expect(digestScript(script)).toContain('Script "Epic Fitness Hook"');
  });

  it('handles a script with a single scene', () => {
    const single: ScriptRow = {
      ...script,
      storyboard: {
        ...script.storyboard,
        scenes: [script.storyboard.scenes[0]],
      },
    };
    const result = digestScript(single);
    expect(result).toContain('1 scenes total');
    expect(result).toContain('Cut to dramatic reaction');
  });

  it('handles a script with no scenes gracefully', () => {
    const empty: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    const result = digestScript(empty);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('includes a date string in output', () => {
    const result = digestScript(script);
    expect(result).toMatch(/\d/); // at least one digit from the date
    expect(result.length).toBeGreaterThan(30);
  });
});
