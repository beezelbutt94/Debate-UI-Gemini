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

const CREATED_AT = '2024-06-15T12:00:00.000Z';

function makeReport<T>(
  source_type: AuditReportRow['source_type'],
  analysis: T
): AuditReportRow<T> {
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
    created_at: CREATED_AT,
  };
}

describe('digestReport()', () => {
  it('formats url (ViralGapAnalysis) report correctly', () => {
    const analysis: ViralGapAnalysis = {
      pacing_audit: { cuts_per_10s: null, assessment: 'ok' },
      hook_evaluation: { score: 72, verdict: 'moderate', notes: 'decent start' },
      retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
      action_plan: [],
      source_metrics: {},
    };
    const report = makeReport('url', analysis);
    const out = digestReport(report);
    expect(out).toContain('Viral Gap Analyzer');
    expect(out).toContain('moderate');
    expect(out).toContain('72/100');
    expect(out).toContain('decent start');
    expect(out).toContain('65%');
    expect(out).toContain('42%');
  });

  it('formats account (GrowthBlueprint) report correctly', () => {
    const analysis: GrowthBlueprint = {
      thematic_consistency: { score: 85, notes: 'very focused' },
      view_to_follower_ratio: { value: 1.2, assessment: 'above average' },
      posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
      theme_correction: [],
      view_maximization_tactics: [],
      posting_blindspots: ['weekends', 'evenings'],
      per_platform_notes: {},
    };
    const report = makeReport('account', analysis);
    const out = digestReport(report);
    expect(out).toContain('Account Deep-Dive');
    expect(out).toContain('85/100');
    expect(out).toContain('very focused');
    expect(out).toContain('weekends');
    expect(out).toContain('evenings');
  });

  it('formats account report with empty blindspots as "none noted"', () => {
    const analysis: GrowthBlueprint = {
      thematic_consistency: { score: 90, notes: 'tight niche' },
      view_to_follower_ratio: { value: null, assessment: 'n/a' },
      posting_cadence: { avg_days_between_posts: null, assessment: 'irregular' },
      theme_correction: [],
      view_maximization_tactics: [],
      posting_blindspots: [],
      per_platform_notes: {},
    };
    const out = digestReport(makeReport('account', analysis));
    expect(out).toContain('none noted');
  });

  it('formats upload (UploadDiagnosis) report correctly', () => {
    const analysis: UploadDiagnosis = {
      visual_hook_clarity: { score: 80, verdict: 'strong', notes: 'great thumbnail' },
      audio_balance: { score: 60, notes: 'music too loud' },
      text_overlay_pacing: { assessment: 'too fast' },
      b_roll_recommendations: [],
      retention_boosters: [],
      frames_analyzed: 6,
    };
    const out = digestReport(makeReport('upload', analysis));
    expect(out).toContain('Upload Diagnostic');
    expect(out).toContain('strong');
    expect(out).toContain('80/100');
    expect(out).toContain('60/100');
    expect(out).toContain('music too loud');
    expect(out).toContain('too fast');
  });

  it('formats discovery (SiteDiscoveryResult) report correctly', () => {
    const analysis: SiteDiscoveryResult = {
      query: 'fitness content trends',
      sites: [],
      outlier: { url: 'https://example.com', reasoning: 'unique angle on recovery' },
      summary: 'top sites reviewed',
    };
    const out = digestReport(makeReport('discovery', analysis));
    expect(out).toContain('Site Discovery');
    expect(out).toContain('fitness content trends');
    expect(out).toContain('https://example.com');
    expect(out).toContain('unique angle on recovery');
  });

  it('formats competitors (CompetitorGapAnalysis) report correctly', () => {
    const analysis: CompetitorGapAnalysis = {
      competitors: [],
      outlier_topics: [],
      missing_topics: ['nutrition', 'sleep'],
      audience_sentiment_gaps: [],
      untapped_keyword_clusters: ['recovery', 'mobility'],
    };
    const out = digestReport(makeReport('competitors', analysis));
    expect(out).toContain('Competitor Espionage');
    expect(out).toContain('nutrition');
    expect(out).toContain('sleep');
    expect(out).toContain('recovery');
    expect(out).toContain('mobility');
  });

  it('formats competitors report with empty topics as "none noted"', () => {
    const analysis: CompetitorGapAnalysis = {
      competitors: [],
      outlier_topics: [],
      missing_topics: [],
      audience_sentiment_gaps: [],
      untapped_keyword_clusters: [],
    };
    const out = digestReport(makeReport('competitors', analysis));
    expect(out.match(/none noted/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('digestScript()', () => {
  it('formats a script with scenes correctly', () => {
    const script: ScriptRow = {
      id: 's1',
      user_id: 'u1',
      creator_profile_id: null,
      title: 'Morning Routine',
      source_prompt: null,
      storyboard: {
        spoken_hook: 'This one habit changed my life',
        scenes: [
          {
            scene_number: 1,
            visual_action: 'Wake up shot',
            dialogue_or_vo: 'Good morning...',
            audio_sfx_cue: 'birds',
            retention_loop_note: 'reveal at end',
          },
          {
            scene_number: 2,
            visual_action: 'Coffee shot',
            dialogue_or_vo: 'Start with coffee',
            audio_sfx_cue: 'grinder',
            retention_loop_note: 'tease next step',
          },
        ],
        cta: 'Follow for more',
        memory_context_used: false,
      },
      tone_parameters: {},
      target_platform: 'youtube_shorts',
      created_at: CREATED_AT,
    };
    const out = digestScript(script);
    expect(out).toContain('Morning Routine');
    expect(out).toContain('This one habit changed my life');
    expect(out).toContain('reveal at end');
    expect(out).toContain('2 scenes total');
  });

  it('handles empty scenes array gracefully', () => {
    const script: ScriptRow = {
      id: 's2',
      user_id: 'u1',
      creator_profile_id: null,
      title: 'Empty Script',
      source_prompt: null,
      storyboard: {
        spoken_hook: 'Hook line',
        scenes: [],
        cta: 'Like and subscribe',
        memory_context_used: false,
      },
      tone_parameters: {},
      target_platform: null,
      created_at: CREATED_AT,
    };
    const out = digestScript(script);
    expect(out).toContain('Empty Script');
    expect(out).toContain('Hook line');
    expect(out).toContain('(none)');
    expect(out).toContain('0 scenes total');
  });

  it('includes the title and hook in output', () => {
    const script: ScriptRow = {
      id: 's3',
      user_id: 'u1',
      creator_profile_id: null,
      title: 'Productivity Tips',
      source_prompt: 'write about focus',
      storyboard: {
        spoken_hook: 'Stop scrolling and watch this',
        scenes: [
          {
            scene_number: 1,
            visual_action: 'desk shot',
            dialogue_or_vo: 'Focus matters',
            audio_sfx_cue: 'lo-fi',
            retention_loop_note: 'promise of revelation',
          },
        ],
        cta: 'Subscribe',
        memory_context_used: true,
      },
      tone_parameters: {},
      target_platform: 'tiktok',
      created_at: CREATED_AT,
    };
    const out = digestScript(script);
    expect(out).toContain('Productivity Tips');
    expect(out).toContain('Stop scrolling and watch this');
  });
});
