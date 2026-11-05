import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { digestReport, digestScript } from '@/lib/digest';
import type { AuditReportRow, ScriptRow, ViralGapAnalysis, GrowthBlueprint, UploadDiagnosis, CompetitorGapAnalysis, SiteDiscoveryResult } from '@/lib/types';

// Pin locale-independent date formatting
const FIXED_DATE = '2024-03-15T12:00:00.000Z';

function makeBaseReport(overrides: Partial<AuditReportRow> = {}): AuditReportRow {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: FIXED_DATE,
    source_type: 'url',
    analysis: {} as ViralGapAnalysis,
    ...overrides,
  };
}

describe('digestReport()', () => {
  it('formats a url (ViralGapAnalysis) report', () => {
    const analysis: ViralGapAnalysis = {
      hook_evaluation: { score: 85, verdict: 'strong', notes: 'Great hook' },
      retention_prediction: { at_3s_percent: 72, at_30s_percent: 48, meets_3s_benchmark: true, meets_30s_benchmark: true },
      pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
      action_plan: [],
      source_metrics: {},
    };
    const report = makeBaseReport({ source_type: 'url', analysis });
    const result = digestReport(report);
    expect(result).toContain('Viral Gap Analyzer');
    expect(result).toContain('strong');
    expect(result).toContain('85/100');
    expect(result).toContain('Great hook');
    expect(result).toContain('3s=72%');
    expect(result).toContain('30s=48%');
  });

  it('formats an account (GrowthBlueprint) report', () => {
    const analysis: GrowthBlueprint = {
      thematic_consistency: { score: 70, notes: 'Needs focus' },
      view_to_follower_ratio: { value: 1.5, assessment: 'good' },
      posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
      theme_correction: [],
      view_maximization_tactics: [],
      posting_blindspots: ['Weekends', 'Morning slots'],
      per_platform_notes: {},
    };
    const report = makeBaseReport({ source_type: 'account', analysis });
    const result = digestReport(report);
    expect(result).toContain('Account Deep-Dive');
    expect(result).toContain('70/100');
    expect(result).toContain('Needs focus');
    expect(result).toContain('Weekends');
    expect(result).toContain('Morning slots');
  });

  it('shows "none noted" when posting_blindspots is empty', () => {
    const analysis: GrowthBlueprint = {
      thematic_consistency: { score: 90, notes: 'Great' },
      view_to_follower_ratio: { value: null, assessment: 'unknown' },
      posting_cadence: { avg_days_between_posts: null, assessment: 'unknown' },
      theme_correction: [],
      view_maximization_tactics: [],
      posting_blindspots: [],
      per_platform_notes: {},
    };
    const report = makeBaseReport({ source_type: 'account', analysis });
    expect(digestReport(report)).toContain('none noted');
  });

  it('formats an upload (UploadDiagnosis) report', () => {
    const analysis: UploadDiagnosis = {
      visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'Needs work' },
      audio_balance: { score: 75, notes: 'Good balance' },
      text_overlay_pacing: { assessment: 'Too slow' },
      b_roll_recommendations: [],
      retention_boosters: [],
      frames_analyzed: 120,
    };
    const report = makeBaseReport({ source_type: 'upload', analysis });
    const result = digestReport(report);
    expect(result).toContain('Upload Diagnostic');
    expect(result).toContain('moderate');
    expect(result).toContain('60/100');
    expect(result).toContain('Good balance');
    expect(result).toContain('Too slow');
  });

  it('formats a discovery (SiteDiscoveryResult) report', () => {
    const analysis: SiteDiscoveryResult = {
      query: 'viral hooks 2024',
      sites: [],
      outlier: { url: 'https://example.com', reasoning: 'Unique format' },
      summary: 'summary',
    };
    const report = makeBaseReport({ source_type: 'discovery', analysis });
    const result = digestReport(report);
    expect(result).toContain('Site Discovery');
    expect(result).toContain('viral hooks 2024');
    expect(result).toContain('https://example.com');
    expect(result).toContain('Unique format');
  });

  it('falls back to CompetitorGapAnalysis for unknown source_type', () => {
    const analysis: CompetitorGapAnalysis = {
      competitors: [],
      outlier_topics: [],
      missing_topics: ['Topic A', 'Topic B'],
      audience_sentiment_gaps: [],
      untapped_keyword_clusters: ['kw1', 'kw2'],
    };
    // source_type cast to satisfy TS; real runtime may hit unknown values
    const report = makeBaseReport({ source_type: 'competitors' as AuditReportRow['source_type'], analysis });
    const result = digestReport(report);
    expect(result).toContain('Competitor Espionage');
    expect(result).toContain('Topic A');
    expect(result).toContain('kw1');
  });

  it('shows "none noted" for empty competitor missing_topics', () => {
    const analysis: CompetitorGapAnalysis = {
      competitors: [],
      outlier_topics: [],
      missing_topics: [],
      audience_sentiment_gaps: [],
      untapped_keyword_clusters: [],
    };
    const report = makeBaseReport({ source_type: 'competitors' as AuditReportRow['source_type'], analysis });
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestScript()', () => {
  it('formats a script row', () => {
    const script: ScriptRow = {
      id: 's1',
      user_id: 'u1',
      creator_profile_id: null,
      title: 'My Hook Script',
      source_prompt: null,
      target_platform: 'tiktok',
      tone_parameters: {},
      created_at: FIXED_DATE,
      storyboard: {
        spoken_hook: 'Wait until you see this',
        memory_context_used: false,
        cta: 'Follow for more',
        scenes: [
          {
            scene_number: 1,
            visual_action: 'Cut to face',
            dialogue_or_vo: 'Wait until you see this',
            audio_sfx_cue: 'whoosh',
            retention_loop_note: 'Jump cut keeps eyes locked',
          },
          {
            scene_number: 2,
            visual_action: 'B-roll',
            dialogue_or_vo: 'Here is why',
            audio_sfx_cue: '',
            retention_loop_note: '',
          },
        ],
      },
    };
    const result = digestScript(script);
    expect(result).toContain('My Hook Script');
    expect(result).toContain('Wait until you see this');
    expect(result).toContain('Jump cut keeps eyes locked');
    expect(result).toContain('2 scenes total');
  });

  it('shows (none) for retention_loop_note when first scene is undefined', () => {
    const script: ScriptRow = {
      id: 's2',
      user_id: 'u1',
      creator_profile_id: null,
      title: 'Empty Script',
      source_prompt: null,
      target_platform: null,
      tone_parameters: {},
      created_at: FIXED_DATE,
      storyboard: {
        spoken_hook: 'Hook text',
        memory_context_used: false,
        cta: '',
        scenes: [],
      },
    };
    const result = digestScript(script);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });
});
