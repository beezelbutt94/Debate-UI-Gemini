import { describe, it, expect } from 'vitest';
import { digestReport, digestScript } from '@/lib/digest';
import type { AuditReportRow, ScriptRow } from '@/lib/types';

function makeBaseReport(overrides: Partial<AuditReportRow> = {}): AuditReportRow {
  return {
    id: 'report-1',
    user_id: 'user-1',
    creator_profile_id: null,
    source_type: 'url',
    source_url: 'https://tiktok.com/@user/video/1',
    platform: 'tiktok',
    viral_score: 75,
    analysis: {},
    timeline_recommendations: [],
    created_at: '2024-06-01T12:00:00Z',
    ...overrides,
  } as AuditReportRow;
}

describe('digestReport()', () => {
  it('handles source_type=url (ViralGapAnalysis)', () => {
    const report = makeBaseReport({
      source_type: 'url',
      analysis: {
        pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
        hook_evaluation: { score: 82, verdict: 'strong', notes: 'Great opener' },
        retention_prediction: { at_3s_percent: 70, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
        action_plan: ['Fix pacing'],
        source_metrics: {},
      },
    });

    const result = digestReport(report);

    expect(result).toContain('Viral Gap Analyzer');
    expect(result).toContain('strong');
    expect(result).toContain('82/100');
    expect(result).toContain('Great opener');
    expect(result).toContain('3s=70%');
    expect(result).toContain('30s=45%');
  });

  it('url digest includes date from created_at', () => {
    const report = makeBaseReport({
      source_type: 'url',
      created_at: '2024-01-15T00:00:00Z',
      analysis: {
        hook_evaluation: { score: 50, verdict: 'moderate', notes: 'ok' },
        retention_prediction: { at_3s_percent: 60, at_30s_percent: 40, meets_3s_benchmark: true, meets_30s_benchmark: true },
        pacing_audit: { cuts_per_10s: null, assessment: 'n/a' },
        action_plan: [],
        source_metrics: {},
      },
    });

    const result = digestReport(report);
    expect(result).toMatch(/1\/15\/2024|2024/);
  });

  it('handles source_type=account (GrowthBlueprint)', () => {
    const report = makeBaseReport({
      source_type: 'account',
      analysis: {
        thematic_consistency: { score: 78, notes: 'Good consistency' },
        view_to_follower_ratio: { value: 0.15, assessment: 'average' },
        posting_cadence: { avg_days_between_posts: 3, assessment: 'good' },
        theme_correction: [],
        view_maximization_tactics: [],
        posting_blindspots: ['Weekends', 'Evening slots'],
        per_platform_notes: {},
      },
    });

    const result = digestReport(report);

    expect(result).toContain('Account Deep-Dive');
    expect(result).toContain('78/100');
    expect(result).toContain('Good consistency');
    expect(result).toContain('Weekends');
    expect(result).toContain('Evening slots');
  });

  it('account digest with empty posting_blindspots shows "none noted"', () => {
    const report = makeBaseReport({
      source_type: 'account',
      analysis: {
        thematic_consistency: { score: 90, notes: 'Excellent' },
        view_to_follower_ratio: { value: null, assessment: 'hidden' },
        posting_cadence: { avg_days_between_posts: null, assessment: 'unknown' },
        theme_correction: [],
        view_maximization_tactics: [],
        posting_blindspots: [],
        per_platform_notes: {},
      },
    });

    const result = digestReport(report);
    expect(result).toContain('none noted');
  });

  it('handles source_type=upload (UploadDiagnosis)', () => {
    const report = makeBaseReport({
      source_type: 'upload',
      analysis: {
        visual_hook_clarity: { score: 88, verdict: 'strong', notes: 'Eye-catching' },
        audio_balance: { score: 65, notes: 'Slight music overload' },
        text_overlay_pacing: { assessment: 'Too fast to read' },
        b_roll_recommendations: [],
        retention_boosters: [],
        frames_analyzed: 6,
      },
    });

    const result = digestReport(report);

    expect(result).toContain('Upload Diagnostic');
    expect(result).toContain('strong');
    expect(result).toContain('88/100');
    expect(result).toContain('65/100');
    expect(result).toContain('Slight music overload');
    expect(result).toContain('Too fast to read');
  });

  it('handles source_type=discovery (SiteDiscoveryResult)', () => {
    const report = makeBaseReport({
      source_type: 'discovery',
      analysis: {
        query: 'best cooking hacks 2024',
        sites: [],
        outlier: { url: 'https://example.com/viral', reasoning: 'Surprisingly broad appeal' },
        summary: 'Found 10 sites',
      },
    });

    const result = digestReport(report);

    expect(result).toContain('Site Discovery');
    expect(result).toContain('best cooking hacks 2024');
    expect(result).toContain('https://example.com/viral');
    expect(result).toContain('Surprisingly broad appeal');
  });

  it('handles source_type=competitors (CompetitorGapAnalysis)', () => {
    const report = makeBaseReport({
      source_type: 'competitors',
      analysis: {
        competitors: [],
        outlier_topics: ['trending'],
        missing_topics: ['ASMR', 'Vlogs'],
        audience_sentiment_gaps: [],
        untapped_keyword_clusters: ['budget travel', 'solo trips'],
      },
    });

    const result = digestReport(report);

    expect(result).toContain('Competitor Espionage');
    expect(result).toContain('ASMR');
    expect(result).toContain('Vlogs');
    expect(result).toContain('budget travel');
    expect(result).toContain('solo trips');
  });

  it('competitors digest with empty arrays shows "none noted"', () => {
    const report = makeBaseReport({
      source_type: 'competitors',
      analysis: {
        competitors: [],
        outlier_topics: [],
        missing_topics: [],
        audience_sentiment_gaps: [],
        untapped_keyword_clusters: [],
      },
    });

    const result = digestReport(report);
    const count = (result.match(/none noted/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

describe('digestScript()', () => {
  function makeScript(overrides: Partial<ScriptRow> = {}): ScriptRow {
    return {
      id: 'script-1',
      user_id: 'user-1',
      creator_profile_id: null,
      title: 'My Viral Script',
      source_prompt: null,
      storyboard: {
        spoken_hook: 'You won\'t believe this hack...',
        scenes: [
          {
            scene_number: 1,
            visual_action: 'Close up of hands',
            dialogue_or_vo: 'You won\'t believe this hack...',
            audio_sfx_cue: 'upbeat music',
            retention_loop_note: 'Open loop on first reveal',
          },
          {
            scene_number: 2,
            visual_action: 'Wide shot',
            dialogue_or_vo: 'Here\'s how it works',
            audio_sfx_cue: 'silence',
            retention_loop_note: 'Pattern interrupt',
          },
        ],
        cta: 'Follow for more!',
        memory_context_used: false,
      },
      tone_parameters: {},
      target_platform: 'tiktok',
      created_at: '2024-06-01T12:00:00Z',
      ...overrides,
    } as ScriptRow;
  }

  it('includes the script title', () => {
    const result = digestScript(makeScript());
    expect(result).toContain('My Viral Script');
  });

  it('includes the spoken hook', () => {
    const result = digestScript(makeScript());
    expect(result).toContain("You won't believe this hack...");
  });

  it('includes scene count', () => {
    const result = digestScript(makeScript());
    expect(result).toContain('2 scenes total');
  });

  it('includes the first scene retention_loop_note', () => {
    const result = digestScript(makeScript());
    expect(result).toContain('Open loop on first reveal');
  });

  it('handles script with no scenes (retention_loop_note is "(none)")', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    const result = digestScript(script);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('includes date in output', () => {
    const result = digestScript(makeScript({ created_at: '2024-03-20T00:00:00Z' }));
    expect(result).toMatch(/3\/20\/2024|2024/);
  });

  it('starts with Script keyword', () => {
    const result = digestScript(makeScript());
    expect(result.startsWith('Script "')).toBe(true);
  });

  it('handles single scene', () => {
    const script = makeScript();
    script.storyboard.scenes = [script.storyboard.scenes[0]];
    const result = digestScript(script);
    expect(result).toContain('1 scenes total');
    expect(result).toContain('Open loop on first reveal');
  });
});
