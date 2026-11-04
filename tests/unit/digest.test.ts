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

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_REPORT = {
  id: 'rpt-1',
  user_id: 'usr-1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-06-01T12:00:00Z',
};

function makeReport<T>(
  source_type: AuditReportRow['source_type'],
  analysis: T
): AuditReportRow<T> {
  return { ...BASE_REPORT, source_type, analysis } as AuditReportRow<T>;
}

const VIRAL_ANALYSIS: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 4, assessment: 'Good pacing' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Opening question works but drags at 2s' },
  retention_prediction: { at_3s_percent: 68, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Cut the intro by 1s'],
  source_metrics: {},
};

const GROWTH_ANALYSIS: GrowthBlueprint = {
  thematic_consistency: { score: 85, notes: 'Strong niche focus' },
  view_to_follower_ratio: { value: 1.8, assessment: 'Healthy' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'Good cadence' },
  theme_correction: [],
  view_maximization_tactics: ['Add B-roll'],
  posting_blindspots: ['Weekday mornings', 'Thursday evenings'],
  per_platform_notes: {},
};

const UPLOAD_ANALYSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'Hook visible but text small' },
  audio_balance: { score: 78, notes: 'Music slightly overpowers VO at 0:05' },
  text_overlay_pacing: { assessment: 'Text stays on screen too long' },
  b_roll_recommendations: ['Add cutaway at 0:12'],
  retention_boosters: ['Pattern interrupt at 0:08'],
  frames_analyzed: 48,
};

const DISCOVERY_ANALYSIS: SiteDiscoveryResult = {
  query: 'best TikTok growth strategies 2024',
  sites: [],
  outlier: { url: 'https://example.com/outlier', reasoning: 'Uses an entirely different angle' },
  summary: 'Found 10 relevant sites',
};

const COMPETITOR_ANALYSIS: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['Trending audio hooks'],
  missing_topics: ['Behind-the-scenes content', 'Tutorial formats'],
  audience_sentiment_gaps: ['Users want more Q&A content'],
  untapped_keyword_clusters: ['morning routine tiktok', 'aesthetic vlog'],
};

// ─── digestReport ─────────────────────────────────────────────────────────

describe('digestReport()', () => {
  describe('source_type = url (ViralGapAnalysis)', () => {
    const report = makeReport('url', VIRAL_ANALYSIS);

    it('mentions "Viral Gap Analyzer"', () => {
      expect(digestReport(report)).toContain('Viral Gap Analyzer');
    });

    it('includes the hook verdict', () => {
      expect(digestReport(report)).toContain('moderate');
    });

    it('includes the hook score', () => {
      expect(digestReport(report)).toContain('72/100');
    });

    it('includes hook notes', () => {
      expect(digestReport(report)).toContain('Opening question works but drags at 2s');
    });

    it('includes 3s retention percentage', () => {
      expect(digestReport(report)).toContain('3s=68%');
    });

    it('includes 30s retention percentage', () => {
      expect(digestReport(report)).toContain('30s=42%');
    });

    it('includes the formatted date', () => {
      const date = new Date('2024-06-01T12:00:00Z').toLocaleDateString();
      expect(digestReport(report)).toContain(date);
    });
  });

  describe('source_type = account (GrowthBlueprint)', () => {
    const report = makeReport('account', GROWTH_ANALYSIS);

    it('mentions "Account Deep-Dive"', () => {
      expect(digestReport(report)).toContain('Account Deep-Dive');
    });

    it('includes thematic consistency score', () => {
      expect(digestReport(report)).toContain('85/100');
    });

    it('includes thematic consistency notes', () => {
      expect(digestReport(report)).toContain('Strong niche focus');
    });

    it('includes posting blindspots joined by semicolons', () => {
      const result = digestReport(report);
      expect(result).toContain('Weekday mornings');
      expect(result).toContain('Thursday evenings');
    });

    it('handles empty posting blindspots gracefully', () => {
      const noBlindspotsReport = makeReport('account', {
        ...GROWTH_ANALYSIS,
        posting_blindspots: [],
      });
      expect(digestReport(noBlindspotsReport)).toContain('none noted');
    });
  });

  describe('source_type = upload (UploadDiagnosis)', () => {
    const report = makeReport('upload', UPLOAD_ANALYSIS);

    it('mentions "Upload Diagnostic"', () => {
      expect(digestReport(report)).toContain('Upload Diagnostic');
    });

    it('includes visual hook verdict', () => {
      expect(digestReport(report)).toContain('moderate');
    });

    it('includes visual hook score', () => {
      expect(digestReport(report)).toContain('60/100');
    });

    it('includes audio balance score', () => {
      expect(digestReport(report)).toContain('78/100');
    });

    it('includes audio balance notes', () => {
      expect(digestReport(report)).toContain('Music slightly overpowers VO at 0:05');
    });

    it('includes text overlay pacing assessment', () => {
      expect(digestReport(report)).toContain('Text stays on screen too long');
    });
  });

  describe('source_type = discovery (SiteDiscoveryResult)', () => {
    const report = makeReport('discovery', DISCOVERY_ANALYSIS);

    it('mentions "Site Discovery"', () => {
      expect(digestReport(report)).toContain('Site Discovery');
    });

    it('includes the query string', () => {
      expect(digestReport(report)).toContain('best TikTok growth strategies 2024');
    });

    it('includes the outlier URL', () => {
      expect(digestReport(report)).toContain('https://example.com/outlier');
    });

    it('includes the outlier reasoning', () => {
      expect(digestReport(report)).toContain('Uses an entirely different angle');
    });
  });

  describe('source_type = competitors (CompetitorGapAnalysis)', () => {
    const report = makeReport('competitors', COMPETITOR_ANALYSIS);

    it('mentions "Competitor Espionage"', () => {
      expect(digestReport(report)).toContain('Competitor Espionage');
    });

    it('includes missing topics joined by semicolons', () => {
      const result = digestReport(report);
      expect(result).toContain('Behind-the-scenes content');
      expect(result).toContain('Tutorial formats');
    });

    it('includes untapped keyword clusters', () => {
      const result = digestReport(report);
      expect(result).toContain('morning routine tiktok');
      expect(result).toContain('aesthetic vlog');
    });

    it('handles empty missing topics', () => {
      const noMissing = makeReport('competitors', {
        ...COMPETITOR_ANALYSIS,
        missing_topics: [],
      });
      expect(digestReport(noMissing)).toContain('none noted');
    });

    it('handles empty keyword clusters', () => {
      const noClusters = makeReport('competitors', {
        ...COMPETITOR_ANALYSIS,
        untapped_keyword_clusters: [],
      });
      expect(digestReport(noClusters)).toContain('none noted');
    });
  });
});

// ─── digestScript ─────────────────────────────────────────────────────────

describe('digestScript()', () => {
  const BASE_SCRIPT: ScriptRow = {
    id: 'scr-1',
    user_id: 'usr-1',
    creator_profile_id: null,
    title: 'My Hook Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Did you know you can double your views in 7 days?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of phone screen',
          dialogue_or_vo: 'Open TikTok right now.',
          audio_sfx_cue: 'upbeat music fade in',
          retention_loop_note: 'Pattern interrupt with quick zoom',
        },
        {
          scene_number: 2,
          visual_action: 'Talking head',
          dialogue_or_vo: 'Here is what most creators miss.',
          audio_sfx_cue: 'music continues',
          retention_loop_note: 'Tease upcoming revelation',
        },
      ],
      cta: 'Follow for more growth tips.',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-07-15T09:30:00Z',
  };

  it('includes the script title', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('My Hook Script');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(BASE_SCRIPT)).toContain(
      'Did you know you can double your views in 7 days?'
    );
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Pattern interrupt with quick zoom');
  });

  it('includes the total scene count', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    const date = new Date('2024-07-15T09:30:00Z').toLocaleDateString();
    expect(digestScript(BASE_SCRIPT)).toContain(date);
  });

  it('handles a script with no scenes gracefully (retention_loop_note is "(none)")', () => {
    const noScenes: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    const result = digestScript(noScenes);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('handles a single scene', () => {
    const oneScene: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [BASE_SCRIPT.storyboard.scenes[0]] },
    };
    expect(digestScript(oneScene)).toContain('1 scenes total');
  });

  it('uses first scene (index 0) for retention_loop_note, not last', () => {
    // The first scene has 'Pattern interrupt with quick zoom'
    // The second scene has 'Tease upcoming revelation'
    // The result must include the first scene's note
    expect(digestScript(BASE_SCRIPT)).toContain('Pattern interrupt with quick zoom');
    expect(digestScript(BASE_SCRIPT)).not.toContain('Tease upcoming revelation');
  });
});
