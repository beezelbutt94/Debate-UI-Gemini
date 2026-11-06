import { describe, it, expect } from 'vitest';
import { digestReport, digestScript } from '@/lib/digest';
import type {
  AuditReportRow,
  ScriptRow,
  ViralGapAnalysis,
  GrowthBlueprint,
  UploadDiagnosis,
  CompetitorGapAnalysis,
  SiteDiscoveryResult,
} from '@/lib/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE = {
  id: 'rpt-1',
  user_id: 'u-1',
  creator_profile_id: null,
  source_url: null,
  platform: null as null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-06-15T12:00:00.000Z',
} satisfies Omit<AuditReportRow, 'source_type' | 'analysis'>;

function makeReport<T>(
  source_type: AuditReportRow['source_type'],
  analysis: T,
  override: Partial<typeof BASE> = {}
): AuditReportRow<T> {
  return { ...BASE, ...override, source_type, analysis } as AuditReportRow<T>;
}

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Opens with a question' },
  retention_prediction: { at_3s_percent: 68, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Add B-roll at 5s'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 85, notes: 'Consistently tech-focused' },
  view_to_follower_ratio: { value: 1.2, assessment: 'healthy' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['No weekend content', 'Missing trending audio'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'Dark opening frame' },
  audio_balance: { score: 55, notes: 'Music too loud vs voice' },
  text_overlay_pacing: { assessment: 'Text stays on screen too long' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 48,
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['Behind-the-scenes', 'Tutorials'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['AI tools', 'productivity hacks'],
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'best viral video tools 2024',
  sites: [],
  outlier: { url: 'https://example.com', reasoning: 'Unique tool indexing approach' },
  summary: 'Found 10 relevant sites',
};

// ─── digestReport() ───────────────────────────────────────────────────────────

describe('digestReport()', () => {
  describe('source_type=url (ViralGapAnalysis)', () => {
    const report = makeReport('url', viralAnalysis, { platform: 'tiktok' });

    it('mentions "Viral Gap Analyzer"', () => {
      expect(digestReport(report)).toContain('Viral Gap Analyzer');
    });

    it('includes the hook verdict', () => {
      expect(digestReport(report)).toContain('moderate');
    });

    it('includes the hook score', () => {
      expect(digestReport(report)).toContain('72/100');
    });

    it('includes the hook notes', () => {
      expect(digestReport(report)).toContain('Opens with a question');
    });

    it('includes 3s retention', () => {
      expect(digestReport(report)).toContain('3s=68%');
    });

    it('includes 30s retention', () => {
      expect(digestReport(report)).toContain('30s=42%');
    });

    it('includes the formatted date', () => {
      const date = new Date('2024-06-15T12:00:00.000Z').toLocaleDateString();
      expect(digestReport(report)).toContain(date);
    });
  });

  describe('source_type=account (GrowthBlueprint)', () => {
    const report = makeReport('account', growthAnalysis);

    it('mentions "Account Deep-Dive"', () => {
      expect(digestReport(report)).toContain('Account Deep-Dive');
    });

    it('includes thematic consistency score', () => {
      expect(digestReport(report)).toContain('85/100');
    });

    it('includes thematic consistency notes', () => {
      expect(digestReport(report)).toContain('Consistently tech-focused');
    });

    it('includes posting blindspots', () => {
      const out = digestReport(report);
      expect(out).toContain('No weekend content');
      expect(out).toContain('Missing trending audio');
    });

    it('shows "none noted" when blindspots is empty', () => {
      const noBlindspots: GrowthBlueprint = { ...growthAnalysis, posting_blindspots: [] };
      const r = makeReport('account', noBlindspots);
      expect(digestReport(r)).toContain('none noted');
    });
  });

  describe('source_type=upload (UploadDiagnosis)', () => {
    const report = makeReport('upload', uploadAnalysis);

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
      expect(digestReport(report)).toContain('55/100');
    });

    it('includes audio balance notes', () => {
      expect(digestReport(report)).toContain('Music too loud vs voice');
    });

    it('includes text overlay pacing assessment', () => {
      expect(digestReport(report)).toContain('Text stays on screen too long');
    });
  });

  describe('source_type=competitors (CompetitorGapAnalysis)', () => {
    const report = makeReport('competitors', competitorAnalysis);

    it('mentions "Competitor Espionage"', () => {
      expect(digestReport(report)).toContain('Competitor Espionage');
    });

    it('includes missing topics', () => {
      const out = digestReport(report);
      expect(out).toContain('Behind-the-scenes');
      expect(out).toContain('Tutorials');
    });

    it('includes untapped keyword clusters', () => {
      const out = digestReport(report);
      expect(out).toContain('AI tools');
      expect(out).toContain('productivity hacks');
    });

    it('shows "none noted" when missing_topics is empty', () => {
      const noMissing: CompetitorGapAnalysis = { ...competitorAnalysis, missing_topics: [] };
      const r = makeReport('competitors', noMissing);
      expect(digestReport(r)).toContain('none noted');
    });

    it('shows "none noted" when untapped_keyword_clusters is empty', () => {
      const noClusters: CompetitorGapAnalysis = { ...competitorAnalysis, untapped_keyword_clusters: [] };
      const r = makeReport('competitors', noClusters);
      expect(digestReport(r)).toContain('none noted');
    });
  });

  describe('source_type=discovery (SiteDiscoveryResult)', () => {
    const report = makeReport('discovery', discoveryAnalysis);

    it('mentions "Site Discovery"', () => {
      expect(digestReport(report)).toContain('Site Discovery');
    });

    it('includes the query', () => {
      expect(digestReport(report)).toContain('best viral video tools 2024');
    });

    it('includes the outlier URL', () => {
      expect(digestReport(report)).toContain('https://example.com');
    });

    it('includes the outlier reasoning', () => {
      expect(digestReport(report)).toContain('Unique tool indexing approach');
    });
  });
});

// ─── digestScript() ───────────────────────────────────────────────────────────

const BASE_SCRIPT: ScriptRow = {
  id: 'scr-1',
  user_id: 'u-1',
  creator_profile_id: null,
  title: 'How to Go Viral in 60 Seconds',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'Most creators make this mistake every single day.',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Creator looks at camera',
        dialogue_or_vo: 'Most creators make this mistake every single day.',
        audio_sfx_cue: 'upbeat beat',
        retention_loop_note: 'Tease the reveal to keep viewers watching',
      },
      {
        scene_number: 2,
        visual_action: 'Cut to screen recording',
        dialogue_or_vo: "Here's what they miss...",
        audio_sfx_cue: '',
        retention_loop_note: 'Show the problem visually',
      },
    ],
    cta: 'Follow for more tips',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2024-07-20T09:00:00.000Z',
};

describe('digestScript()', () => {
  it('includes the script title', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('How to Go Viral in 60 Seconds');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Most creators make this mistake every single day.');
  });

  it('includes the first scene retention_loop_note', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('Tease the reveal to keep viewers watching');
  });

  it('includes the total scene count', () => {
    expect(digestScript(BASE_SCRIPT)).toContain('2 scenes total');
  });

  it('includes the formatted date', () => {
    const date = new Date('2024-07-20T09:00:00.000Z').toLocaleDateString();
    expect(digestScript(BASE_SCRIPT)).toContain(date);
  });

  it('renders empty string as empty quotes when retention_loop_note is ""', () => {
    const noNote: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: {
        ...BASE_SCRIPT.storyboard,
        scenes: [{ ...BASE_SCRIPT.storyboard.scenes[0], retention_loop_note: '' }],
      },
    };
    // '' is not null/undefined so ?? '(none)' does NOT kick in; the output has ""
    const out = digestScript(noNote);
    expect(out).toContain('first scene retention loop: ""');
  });

  it('shows "(none)" when scenes array is empty', () => {
    const noScenes: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [] },
    };
    expect(digestScript(noScenes)).toContain('(none)');
  });

  it('shows correct scene count with 1 scene', () => {
    const oneScene: ScriptRow = {
      ...BASE_SCRIPT,
      storyboard: { ...BASE_SCRIPT.storyboard, scenes: [BASE_SCRIPT.storyboard.scenes[0]] },
    };
    expect(digestScript(oneScene)).toContain('1 scenes total');
  });
});
