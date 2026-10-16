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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_DATE = '2024-09-12T10:00:00.000Z';
const BASE_DATE_FORMATTED = new Date(BASE_DATE).toLocaleDateString();

const URL_ANALYSIS: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 3, assessment: 'Good' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'Decent hook but could be sharper' },
  retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Cut opening by 1s', 'Add text overlay'],
  source_metrics: {},
};

const ACCOUNT_ANALYSIS: GrowthBlueprint = {
  thematic_consistency: { score: 80, notes: 'Mostly consistent niche' },
  view_to_follower_ratio: { value: 4.2, assessment: 'Above average' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'Good cadence' },
  theme_correction: ['Avoid off-niche posts'],
  view_maximization_tactics: ['Post at peak hours'],
  posting_blindspots: ['Weekends', 'Holiday season'],
  per_platform_notes: { youtube: 'Focus on thumbnails' },
};

const UPLOAD_ANALYSIS: UploadDiagnosis = {
  visual_hook_clarity: { score: 60, verdict: 'weak', notes: 'Opening frame lacks motion' },
  audio_balance: { score: 85, notes: 'Good balance between voice and music' },
  text_overlay_pacing: { assessment: 'Too slow, text lingers >3s' },
  b_roll_recommendations: ['Add B-roll at 5s'],
  retention_boosters: ['CTA at 15s'],
  frames_analyzed: 30,
};

const COMPETITOR_ANALYSIS: CompetitorGapAnalysis = {
  competitors: [
    { handle: 'competitor1', platform: 'youtube', summary: 'Big channel', fetch_error: null },
  ],
  outlier_topics: ['AI trends'],
  missing_topics: ['Budget tips', 'DIY hacks'],
  audience_sentiment_gaps: ['Negative sentiment on pricing'],
  untapped_keyword_clusters: ['cheap alternatives', 'beginner guide'],
};

const DISCOVERY_ANALYSIS: SiteDiscoveryResult = {
  query: 'viral cooking trends 2024',
  sites: [
    { url: 'https://example.com/1', domain: 'example.com', title: 'Title 1', snippet: 'snip', relevance_reason: 'top result' },
  ],
  outlier: { url: 'https://example.com/1', reasoning: 'Only result that covers budget cooking angle' },
  summary: 'Strong cooking content landscape',
};

function makeReport<T>(
  overrides: Partial<AuditReportRow<T>> & { source_type: AuditReportRow['source_type']; analysis: T }
): AuditReportRow<T> {
  return {
    id: 'report-1',
    user_id: 'user-1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: BASE_DATE,
    ...overrides,
  };
}

// ─── digestReport() ───────────────────────────────────────────────────────────

describe('digestReport()', () => {
  describe('source_type: url (ViralGapAnalysis)', () => {
    const report = makeReport({ source_type: 'url', analysis: URL_ANALYSIS });

    it('includes "Viral Gap Analyzer" label', () => {
      expect(digestReport(report)).toContain('Viral Gap Analyzer');
    });

    it('includes the formatted date', () => {
      expect(digestReport(report)).toContain(BASE_DATE_FORMATTED);
    });

    it('includes the hook verdict', () => {
      expect(digestReport(report)).toContain('moderate');
    });

    it('includes the hook score', () => {
      expect(digestReport(report)).toContain('72/100');
    });

    it('includes hook notes', () => {
      expect(digestReport(report)).toContain('Decent hook but could be sharper');
    });

    it('includes 3s retention percent', () => {
      expect(digestReport(report)).toContain('3s=65%');
    });

    it('includes 30s retention percent', () => {
      expect(digestReport(report)).toContain('30s=42%');
    });
  });

  describe('source_type: account (GrowthBlueprint)', () => {
    const report = makeReport({ source_type: 'account', analysis: ACCOUNT_ANALYSIS });

    it('includes "Account Deep-Dive" label', () => {
      expect(digestReport(report)).toContain('Account Deep-Dive');
    });

    it('includes thematic consistency score', () => {
      expect(digestReport(report)).toContain('80/100');
    });

    it('includes thematic consistency notes', () => {
      expect(digestReport(report)).toContain('Mostly consistent niche');
    });

    it('includes posting blindspots', () => {
      const result = digestReport(report);
      expect(result).toContain('Weekends');
      expect(result).toContain('Holiday season');
    });

    it('includes the formatted date', () => {
      expect(digestReport(report)).toContain(BASE_DATE_FORMATTED);
    });
  });

  describe('source_type: account with no blindspots', () => {
    const report = makeReport({
      source_type: 'account',
      analysis: { ...ACCOUNT_ANALYSIS, posting_blindspots: [] },
    });

    it('shows "none noted" when blindspots array is empty', () => {
      expect(digestReport(report)).toContain('none noted');
    });
  });

  describe('source_type: upload (UploadDiagnosis)', () => {
    const report = makeReport({ source_type: 'upload', analysis: UPLOAD_ANALYSIS });

    it('includes "Upload Diagnostic" label', () => {
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
      expect(digestReport(report)).toContain('Good balance between voice and music');
    });

    it('includes text overlay assessment', () => {
      expect(digestReport(report)).toContain('Too slow, text lingers >3s');
    });

    it('includes the formatted date', () => {
      expect(digestReport(report)).toContain(BASE_DATE_FORMATTED);
    });
  });

  describe('source_type: discovery (SiteDiscoveryResult)', () => {
    const report = makeReport({ source_type: 'discovery', analysis: DISCOVERY_ANALYSIS });

    it('includes "Site Discovery" label', () => {
      expect(digestReport(report)).toContain('Site Discovery');
    });

    it('includes the query', () => {
      expect(digestReport(report)).toContain('viral cooking trends 2024');
    });

    it('includes the outlier URL', () => {
      expect(digestReport(report)).toContain('https://example.com/1');
    });

    it('includes the outlier reasoning', () => {
      expect(digestReport(report)).toContain('Only result that covers budget cooking angle');
    });

    it('includes the formatted date', () => {
      expect(digestReport(report)).toContain(BASE_DATE_FORMATTED);
    });
  });

  describe('source_type: competitors (CompetitorGapAnalysis)', () => {
    const report = makeReport({ source_type: 'competitors', analysis: COMPETITOR_ANALYSIS });

    it('includes "Competitor Espionage" label', () => {
      expect(digestReport(report)).toContain('Competitor Espionage');
    });

    it('includes missing topics', () => {
      const result = digestReport(report);
      expect(result).toContain('Budget tips');
      expect(result).toContain('DIY hacks');
    });

    it('includes untapped keyword clusters', () => {
      const result = digestReport(report);
      expect(result).toContain('cheap alternatives');
      expect(result).toContain('beginner guide');
    });

    it('includes the formatted date', () => {
      expect(digestReport(report)).toContain(BASE_DATE_FORMATTED);
    });
  });

  describe('source_type: competitors with empty arrays', () => {
    const report = makeReport({
      source_type: 'competitors',
      analysis: { ...COMPETITOR_ANALYSIS, missing_topics: [], untapped_keyword_clusters: [] },
    });

    it('shows "none noted" for missing topics', () => {
      expect(digestReport(report)).toContain('none noted');
    });
  });
});

// ─── digestScript() ───────────────────────────────────────────────────────────

const SCRIPT_ROW: ScriptRow = {
  id: 'script-1',
  user_id: 'user-1',
  creator_profile_id: null,
  title: 'My Viral Script',
  source_prompt: null,
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: BASE_DATE,
  storyboard: {
    spoken_hook: 'This one trick changed everything',
    memory_context_used: false,
    cta: 'Follow for more',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Close-up of product',
        dialogue_or_vo: 'Have you ever wondered...',
        audio_sfx_cue: 'Whoosh sound',
        retention_loop_note: 'Tease outcome before revealing',
      },
      {
        scene_number: 2,
        visual_action: 'Wide shot',
        dialogue_or_vo: 'The secret is...',
        audio_sfx_cue: 'Drum roll',
        retention_loop_note: 'Cut to surprise reveal',
      },
    ],
  },
};

describe('digestScript()', () => {
  it('includes the script title', () => {
    expect(digestScript(SCRIPT_ROW)).toContain('My Viral Script');
  });

  it('includes the formatted date', () => {
    expect(digestScript(SCRIPT_ROW)).toContain(BASE_DATE_FORMATTED);
  });

  it('includes the spoken hook', () => {
    expect(digestScript(SCRIPT_ROW)).toContain('This one trick changed everything');
  });

  it('includes the first scene retention loop note', () => {
    expect(digestScript(SCRIPT_ROW)).toContain('Tease outcome before revealing');
  });

  it('includes the scene count', () => {
    expect(digestScript(SCRIPT_ROW)).toContain('2 scenes total');
  });

  it('handles a script with a single scene', () => {
    const singleScene = {
      ...SCRIPT_ROW,
      storyboard: { ...SCRIPT_ROW.storyboard, scenes: [SCRIPT_ROW.storyboard.scenes[0]] },
    };
    expect(digestScript(singleScene)).toContain('1 scenes total');
  });

  it('shows "(none)" for retention loop when scenes array is empty', () => {
    const emptyScenes = {
      ...SCRIPT_ROW,
      storyboard: { ...SCRIPT_ROW.storyboard, scenes: [] },
    };
    expect(digestScript(emptyScenes)).toContain('(none)');
  });
});
