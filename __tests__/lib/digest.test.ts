import { describe, it, expect } from 'vitest';
import { digestReport, digestScript } from '@/lib/digest';
import type { AuditReportRow, ScriptRow } from '@/lib/types';

const BASE_REPORT: Pick<AuditReportRow, 'id' | 'user_id' | 'creator_profile_id' | 'source_url' | 'platform' | 'viral_score' | 'timeline_recommendations' | 'created_at'> = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-06-15T12:00:00.000Z',
};

describe('digestReport – source_type: url (ViralGapAnalysis)', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'url',
    platform: 'tiktok',
    source_url: 'https://tiktok.com/@creator/video/1',
    analysis: {
      pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
      hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Hook needs clearer CTA' },
      retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
      action_plan: ['tighten opening 2s'],
      source_metrics: {},
    },
  };

  it('mentions "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });

  it('includes hook score', () => {
    expect(digestReport(report)).toContain('72/100');
  });

  it('includes hook notes', () => {
    expect(digestReport(report)).toContain('Hook needs clearer CTA');
  });

  it('includes 3s retention', () => {
    expect(digestReport(report)).toContain('3s=65%');
  });

  it('includes 30s retention', () => {
    expect(digestReport(report)).toContain('30s=42%');
  });

  it('returns a non-empty string', () => {
    expect(digestReport(report).length).toBeGreaterThan(20);
  });
});

describe('digestReport – source_type: account (GrowthBlueprint)', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'account',
    analysis: {
      thematic_consistency: { score: 80, notes: 'Strong niche alignment' },
      view_to_follower_ratio: { value: 1.5, assessment: 'healthy' },
      posting_cadence: { avg_days_between_posts: 2, assessment: 'consistent' },
      theme_correction: [],
      view_maximization_tactics: [],
      posting_blindspots: ['Saturdays', 'evenings'],
      per_platform_notes: {},
    },
  };

  it('mentions "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('80/100');
  });

  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Strong niche alignment');
  });

  it('includes posting blindspots', () => {
    const result = digestReport(report);
    expect(result).toContain('Saturdays');
    expect(result).toContain('evenings');
  });

  it('shows "none noted" when blindspots is empty', () => {
    const noBlindspots: AuditReportRow = {
      ...report,
      analysis: {
        ...(report.analysis as object),
        posting_blindspots: [],
      } as AuditReportRow['analysis'],
    };
    expect(digestReport(noBlindspots)).toContain('none noted');
  });
});

describe('digestReport – source_type: upload (UploadDiagnosis)', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'upload',
    analysis: {
      visual_hook_clarity: { score: 60, verdict: 'weak', notes: 'Opening shot too dark' },
      audio_balance: { score: 85, notes: 'Well balanced' },
      text_overlay_pacing: { assessment: 'Too many words at once' },
      b_roll_recommendations: [],
      retention_boosters: [],
      frames_analyzed: 150,
    },
  };

  it('mentions "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('weak');
  });

  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('60/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('85/100');
  });

  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Well balanced');
  });

  it('includes text overlay pacing assessment', () => {
    expect(digestReport(report)).toContain('Too many words at once');
  });
});

describe('digestReport – source_type: discovery (SiteDiscoveryResult)', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'discovery',
    analysis: {
      query: 'best fitness channels 2024',
      sites: [],
      outlier: { url: 'https://example.com/outlier', reasoning: 'Uniquely focuses on senior athletes' },
      summary: 'Top 10 fitness discovery sites',
    },
  };

  it('mentions "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes the query', () => {
    expect(digestReport(report)).toContain('best fitness channels 2024');
  });

  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/outlier');
  });

  it('includes outlier reasoning', () => {
    expect(digestReport(report)).toContain('Uniquely focuses on senior athletes');
  });
});

describe('digestReport – source_type: competitors (CompetitorGapAnalysis)', () => {
  const report: AuditReportRow = {
    ...BASE_REPORT,
    source_type: 'competitors',
    analysis: {
      competitors: [],
      outlier_topics: [],
      missing_topics: ['long-form tutorials', 'behind-the-scenes'],
      audience_sentiment_gaps: [],
      untapped_keyword_clusters: ['beginner yoga', 'morning routine'],
    },
  };

  it('mentions "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const result = digestReport(report);
    expect(result).toContain('long-form tutorials');
    expect(result).toContain('behind-the-scenes');
  });

  it('includes untapped keyword clusters', () => {
    const result = digestReport(report);
    expect(result).toContain('beginner yoga');
    expect(result).toContain('morning routine');
  });

  it('shows "none noted" for empty missing_topics', () => {
    const noMissing: AuditReportRow = {
      ...report,
      analysis: {
        ...(report.analysis as object),
        missing_topics: [],
      } as AuditReportRow['analysis'],
    };
    expect(digestReport(noMissing)).toContain('none noted');
  });

  it('shows "none noted" for empty untapped_keyword_clusters', () => {
    const noClusters: AuditReportRow = {
      ...report,
      analysis: {
        ...(report.analysis as object),
        untapped_keyword_clusters: [],
      } as AuditReportRow['analysis'],
    };
    expect(digestReport(noClusters)).toContain('none noted');
  });
});

describe('digestScript', () => {
  const script: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Hook Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Stop scrolling – this changes everything',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of product',
          dialogue_or_vo: 'You have been doing it wrong...',
          audio_sfx_cue: 'whoosh',
          retention_loop_note: 'Opens a curiosity loop',
        },
        {
          scene_number: 2,
          visual_action: 'Demo shot',
          dialogue_or_vo: 'Here is the fix...',
          audio_sfx_cue: '',
          retention_loop_note: 'Delivers the payoff',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-07-01T09:00:00.000Z',
  };

  it('includes the script title', () => {
    expect(digestScript(script)).toContain('My Hook Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(script)).toContain('Stop scrolling – this changes everything');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(script)).toContain('Opens a curiosity loop');
  });

  it('includes the total scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('shows empty quotes when first scene has empty retention_loop_note', () => {
    const noNote: ScriptRow = {
      ...script,
      storyboard: {
        ...script.storyboard,
        scenes: [{ ...script.storyboard.scenes[0], retention_loop_note: '' }],
      },
    };
    // ?? only substitutes null/undefined, not ''; empty string renders as ""
    expect(digestScript(noNote)).toContain('first scene retention loop: ""');
  });

  it('shows (none) for empty scenes array', () => {
    const noScenes: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('(none)');
  });

  it('reports correct scene count for a single scene', () => {
    const oneScene: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: [script.storyboard.scenes[0]] },
    };
    expect(digestScript(oneScene)).toContain('1 scenes total');
  });

  it('returns a non-empty string', () => {
    expect(digestScript(script).length).toBeGreaterThan(20);
  });

  it('includes the target platform in context (via title)', () => {
    // platform isn't rendered, but title is — confirm function does not crash for null platform
    const nullPlatform: ScriptRow = { ...script, target_platform: null };
    expect(digestScript(nullPlatform)).toContain('My Hook Script');
  });

  it('handles a script with many scenes correctly', () => {
    const manyScenes = Array.from({ length: 10 }, (_, i) => ({
      ...script.storyboard.scenes[0],
      scene_number: i + 1,
    }));
    const bigScript: ScriptRow = {
      ...script,
      storyboard: { ...script.storyboard, scenes: manyScenes },
    };
    expect(digestScript(bigScript)).toContain('10 scenes total');
  });
});

describe('digestReport – cross-cutting edge cases', () => {
  it('digestReport returns a string for all source_types', () => {
    const sourceTypes: Array<AuditReportRow['source_type']> = [
      'url', 'account', 'upload', 'discovery', 'competitors',
    ];
    const analyses: Record<AuditReportRow['source_type'], unknown> = {
      url: {
        pacing_audit: { cuts_per_10s: 2, assessment: 'ok' },
        hook_evaluation: { score: 80, verdict: 'strong', notes: 'Great hook' },
        retention_prediction: { at_3s_percent: 70, at_30s_percent: 50, meets_3s_benchmark: true, meets_30s_benchmark: true },
        action_plan: [],
        source_metrics: {},
      },
      account: {
        thematic_consistency: { score: 70, notes: 'Consistent' },
        view_to_follower_ratio: { value: 1.0, assessment: 'healthy' },
        posting_cadence: { avg_days_between_posts: 3, assessment: 'regular' },
        theme_correction: [],
        view_maximization_tactics: [],
        posting_blindspots: [],
        per_platform_notes: {},
      },
      upload: {
        visual_hook_clarity: { score: 75, verdict: 'moderate', notes: 'Good' },
        audio_balance: { score: 90, notes: 'Excellent' },
        text_overlay_pacing: { assessment: 'Well paced' },
        b_roll_recommendations: [],
        retention_boosters: [],
        frames_analyzed: 100,
      },
      discovery: {
        query: 'test query',
        sites: [],
        outlier: { url: 'https://example.com', reasoning: 'Unique' },
        summary: 'Summary',
      },
      competitors: {
        competitors: [],
        outlier_topics: [],
        missing_topics: [],
        audience_sentiment_gaps: [],
        untapped_keyword_clusters: [],
      },
    };
    for (const sourceType of sourceTypes) {
      const report: AuditReportRow = {
        id: 'r1',
        user_id: 'u1',
        creator_profile_id: null,
        source_url: null,
        platform: null,
        viral_score: null,
        timeline_recommendations: [],
        created_at: '2024-01-01T00:00:00.000Z',
        source_type: sourceType,
        analysis: analyses[sourceType] as AuditReportRow['analysis'],
      };
      const result = digestReport(report);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(10);
    }
  });
});
