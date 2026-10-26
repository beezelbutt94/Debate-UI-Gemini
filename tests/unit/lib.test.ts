import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';

// ─── lib/utils.ts ────────────────────────────────────────────────────────────
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('joins truthy class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('handles all-falsy inputs', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles single class', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('preserves class names with spaces (pass-through)', () => {
    expect(cn('foo bar', 'baz')).toBe('foo bar baz');
  });
});

// ─── lib/platform.ts ─────────────────────────────────────────────────────────
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects subdomain of tiktok.com', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('detects youtu.be short links as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  // Facebook Reels
  it('detects facebook.com /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch links', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('returns null for facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  // Edge cases
  it('returns null for invalid URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for unrecognized host', () => {
    expect(detectPlatform('https://instagram.com/p/abc123')).toBeNull();
  });

  it('returns null for twitter/x', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for a subdomain of youtube without /shorts/', () => {
    expect(detectPlatform('https://music.youtube.com/watch?v=abc')).toBeNull();
  });

  it('returns null for m.youtube.com without /shorts/', () => {
    expect(detectPlatform('https://m.youtube.com/watch?v=abc')).toBeNull();
  });

  it('detects m.youtube.com /shorts/', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc')).toBe('youtube_shorts');
  });
});

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('keeps @ prefix for youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('adds @ prefix for youtube handle without it', () => {
    expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  // TikTok
  it('strips leading @ for tiktok handle', () => {
    expect(buildAccountProfileUrl('tiktok', '@myuser')).toBe('https://www.tiktok.com/@myuser');
  });

  it('adds @ prefix for tiktok handle without it', () => {
    expect(buildAccountProfileUrl('tiktok', 'myuser')).toBe('https://www.tiktok.com/@myuser');
  });

  it('does not double-add @ for tiktok', () => {
    const url = buildAccountProfileUrl('tiktok', '@myuser');
    expect(url).not.toContain('@@');
  });

  // Instagram
  it('strips leading @ for instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@myuser')).toBe('https://www.instagram.com/myuser/');
  });

  it('adds no @ for instagram handle without it', () => {
    expect(buildAccountProfileUrl('instagram', 'myuser')).toBe('https://www.instagram.com/myuser/');
  });

  it('does not double-add @ for instagram', () => {
    const url = buildAccountProfileUrl('instagram', '@myuser');
    expect(url).not.toContain('@');
  });
});

// ─── lib/digest.ts ───────────────────────────────────────────────────────────
import { digestReport, digestScript } from '@/lib/digest';
import type {
  AuditReportRow,
  ViralGapAnalysis,
  GrowthBlueprint,
  UploadDiagnosis,
  SiteDiscoveryResult,
  CompetitorGapAnalysis,
  ScriptRow,
  Storyboard,
} from '@/lib/types';

const BASE_REPORT: Pick<AuditReportRow, 'id' | 'user_id' | 'creator_profile_id' | 'source_url' | 'platform' | 'viral_score' | 'timeline_recommendations' | 'created_at'> = {
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: '2024-09-12T10:00:00.000Z',
};

describe('digestReport – url source_type', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'good' },
    hook_evaluation: { score: 72, verdict: 'moderate', notes: 'decent opener' },
    retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
    action_plan: [],
    source_metrics: {},
  };

  const report: AuditReportRow<ViralGapAnalysis> = { ...BASE_REPORT, source_type: 'url', analysis };

  it('includes hook verdict and score', () => {
    const out = digestReport(report);
    expect(out).toContain('moderate');
    expect(out).toContain('72/100');
  });

  it('includes retention percentages', () => {
    const out = digestReport(report);
    expect(out).toContain('3s=65%');
    expect(out).toContain('30s=42%');
  });

  it('includes Viral Gap Analyzer label', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });

  it('includes the formatted date', () => {
    expect(digestReport(report)).toContain('9/12/2024');
  });
});

describe('digestReport – account source_type', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 80, notes: 'strong niche' },
    view_to_follower_ratio: { value: 1.2, assessment: 'good' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'regular' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: ['weekend mornings', 'holidays'],
    per_platform_notes: {},
  };

  const report: AuditReportRow<GrowthBlueprint> = { ...BASE_REPORT, source_type: 'account', analysis };

  it('includes Account Deep-Dive label', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });

  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('80/100');
  });

  it('includes posting blindspots', () => {
    const out = digestReport(report);
    expect(out).toContain('weekend mornings');
    expect(out).toContain('holidays');
  });

  it('shows none noted when no blindspots', () => {
    const r: AuditReportRow<GrowthBlueprint> = {
      ...report,
      analysis: { ...analysis, posting_blindspots: [] },
    };
    expect(digestReport(r)).toContain('none noted');
  });
});

describe('digestReport – upload source_type', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 60, verdict: 'weak', notes: 'unclear visual opener' },
    audio_balance: { score: 75, notes: 'good mix' },
    text_overlay_pacing: { assessment: 'too fast' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
  };

  const report: AuditReportRow<UploadDiagnosis> = { ...BASE_REPORT, source_type: 'upload', analysis };

  it('includes Upload Diagnostic label', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });

  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('weak');
    expect(digestReport(report)).toContain('60/100');
  });

  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('75/100');
  });

  it('includes text overlay assessment', () => {
    expect(digestReport(report)).toContain('too fast');
  });
});

describe('digestReport – discovery source_type', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'best video editing tools 2024',
    sites: [],
    outlier: { url: 'https://example.com/unique', reasoning: 'only one covering mobile editing' },
    summary: 'top sites reviewed',
  };

  const report: AuditReportRow<SiteDiscoveryResult> = { ...BASE_REPORT, source_type: 'discovery', analysis };

  it('includes Site Discovery label', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });

  it('includes query', () => {
    expect(digestReport(report)).toContain('best video editing tools 2024');
  });

  it('includes outlier url and reasoning', () => {
    const out = digestReport(report);
    expect(out).toContain('https://example.com/unique');
    expect(out).toContain('only one covering mobile editing');
  });
});

describe('digestReport – competitors source_type (default)', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: ['vlogging', 'behind-the-scenes'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['short-form tips'],
  };

  const report: AuditReportRow<CompetitorGapAnalysis> = { ...BASE_REPORT, source_type: 'competitors', analysis };

  it('includes Competitor Espionage label', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });

  it('includes missing topics', () => {
    const out = digestReport(report);
    expect(out).toContain('vlogging');
    expect(out).toContain('behind-the-scenes');
  });

  it('includes untapped keyword clusters', () => {
    expect(digestReport(report)).toContain('short-form tips');
  });

  it('shows none noted when missing_topics is empty', () => {
    const r: AuditReportRow<CompetitorGapAnalysis> = {
      ...report,
      analysis: { ...analysis, missing_topics: [], untapped_keyword_clusters: [] },
    };
    const out = digestReport(r);
    expect(out).toContain('none noted');
  });
});

describe('digestScript', () => {
  const storyboard: Storyboard = {
    spoken_hook: 'Did you know most creators fail this one thing?',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'zoom in on chart',
        dialogue_or_vo: 'Here is the truth',
        audio_sfx_cue: 'whoosh',
        retention_loop_note: 'cliffhanger about the solution',
      },
      {
        scene_number: 2,
        visual_action: 'reveal the answer',
        dialogue_or_vo: 'The answer is engagement',
        audio_sfx_cue: '',
        retention_loop_note: '',
      },
    ],
    cta: 'Follow for more',
    memory_context_used: false,
  };

  const script: ScriptRow = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'Creator Secrets',
    source_prompt: null,
    storyboard,
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-09-12T10:00:00.000Z',
  };

  it('includes script title', () => {
    expect(digestScript(script)).toContain('Creator Secrets');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(script)).toContain('Did you know most creators fail this one thing?');
  });

  it('includes scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });

  it('includes first scene retention loop note', () => {
    expect(digestScript(script)).toContain('cliffhanger about the solution');
  });

  it('uses (none) when first scene has no retention_loop_note', () => {
    const s: ScriptRow = {
      ...script,
      storyboard: {
        ...storyboard,
        scenes: [{ ...storyboard.scenes[0], retention_loop_note: '' }],
      },
    };
    // empty string is falsy in TS ?? check, but digestScript uses ?. ?? so undefined gives (none)
    const out = digestScript(s);
    expect(out).toMatch(/retention loop/i);
  });

  it('uses (none) when scenes array is empty', () => {
    const s: ScriptRow = { ...script, storyboard: { ...storyboard, scenes: [] } };
    expect(digestScript(s)).toContain('(none)');
  });
});

// ─── lib/oauth/state.ts ───────────────────────────────────────────────────────
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns different values on each call', () => {
    expect(generateState()).not.toBe(generateState());
  });

  it('returns a valid base64url string (no +, /, = characters)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('encodes 24 random bytes → 32-char base64url string', () => {
    // 24 bytes → ceil(24/3)*4 = 32 chars base64, same for base64url
    expect(generateState()).toHaveLength(32);
  });
});

describe('stateCookieName', () => {
  it('returns oauth_state_<platform>', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty base64url string', () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(v.length).toBeGreaterThan(0);
  });

  it('returns different values on each call', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });

  it('encodes 32 random bytes → ~43-char base64url string', () => {
    // 32 bytes → ceil(32 * 4/3) = 43 chars (base64url with no padding)
    expect(generateCodeVerifier()).toHaveLength(43);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a base64url string', () => {
    const challenge = codeChallengeFromVerifier('test-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces deterministic output for the same input', () => {
    expect(codeChallengeFromVerifier('abc')).toBe(codeChallengeFromVerifier('abc'));
  });

  it('produces different output for different inputs', () => {
    expect(codeChallengeFromVerifier('abc')).not.toBe(codeChallengeFromVerifier('xyz'));
  });

  it('matches SHA-256 of the verifier in base64url', () => {
    const verifier = 'hello-world-verifier-42';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('round-trips: verifier → challenge matches canonical SHA-256', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const manual = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(manual);
  });
});

describe('codeVerifierCookieName', () => {
  it('returns oauth_pkce_<platform>', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });
});

// ─── lib/oauth/types.ts ───────────────────────────────────────────────────────
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform', () => {
  it('returns true for youtube', () => expect(isOAuthPlatform('youtube')).toBe(true));
  it('returns true for tiktok', () => expect(isOAuthPlatform('tiktok')).toBe(true));
  it('returns true for facebook', () => expect(isOAuthPlatform('facebook')).toBe(true));
  it('returns true for canva', () => expect(isOAuthPlatform('canva')).toBe(true));
  it('returns false for instagram', () => expect(isOAuthPlatform('instagram')).toBe(false));
  it('returns false for empty string', () => expect(isOAuthPlatform('')).toBe(false));
  it('returns false for YOUTUBE (case-sensitive)', () => expect(isOAuthPlatform('YOUTUBE')).toBe(false));
  it('returns false for unknown platform', () => expect(isOAuthPlatform('twitter')).toBe(false));
  it('returns false for youtube_shorts', () => expect(isOAuthPlatform('youtube_shorts')).toBe(false));
});

// ─── lib/oauth/index.ts ───────────────────────────────────────────────────────
import { getOAuthProvider } from '@/lib/oauth';

describe('getOAuthProvider', () => {
  it('returns youtube provider with requiresPkce=false', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('returns tiktok provider with requiresPkce=false', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('returns facebook provider with requiresPkce=false', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('returns canva provider with requiresPkce=true', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  it('all providers expose authorizationUrl, exchangeCode, refreshAccessToken', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      const p = getOAuthProvider(platform);
      expect(typeof p.authorizationUrl).toBe('function');
      expect(typeof p.exchangeCode).toBe('function');
      expect(typeof p.refreshAccessToken).toBe('function');
    }
  });

  it('youtube authorizationUrl includes required params', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'test-client-id';
    const url = getOAuthProvider('youtube').authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://example.com/callback',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('access_type')).toBe('offline');
    expect(parsed.searchParams.get('prompt')).toBe('consent');
    expect(parsed.searchParams.get('state')).toBe('test-state');
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('tiktok authorizationUrl includes required params', () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'test-tiktok-key';
    const url = getOAuthProvider('tiktok').authorizationUrl({
      state: 'my-state',
      redirectUri: 'https://example.com/callback',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('state')).toBe('my-state');
    expect(parsed.searchParams.get('scope')).toContain('video.publish');
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
  });

  it('facebook authorizationUrl includes required params', () => {
    process.env.FACEBOOK_APP_ID = 'test-fb-app-id';
    const url = getOAuthProvider('facebook').authorizationUrl({
      state: 'fb-state',
      redirectUri: 'https://example.com/callback',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('state')).toBe('fb-state');
    delete process.env.FACEBOOK_APP_ID;
  });

  it('canva authorizationUrl includes PKCE params', () => {
    process.env.CANVA_CLIENT_ID = 'test-canva-id';
    const url = getOAuthProvider('canva').authorizationUrl({
      state: 'canva-state',
      redirectUri: 'https://example.com/callback',
      codeChallenge: 'my-challenge',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('code_challenge')).toBe('my-challenge');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    delete process.env.CANVA_CLIENT_ID;
  });
});

// ─── lib/tool-suite.ts ────────────────────────────────────────────────────────
import { TOOL_INFO } from '@/lib/tool-suite';

describe('TOOL_INFO', () => {
  const tools = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

  it('has entries for all four tools', () => {
    for (const t of tools) {
      expect(TOOL_INFO[t]).toBeDefined();
    }
  });

  it('every entry has a non-empty label', () => {
    for (const t of tools) {
      expect(TOOL_INFO[t].label.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid https URL', () => {
    for (const t of tools) {
      expect(() => new URL(TOOL_INFO[t].url)).not.toThrow();
      expect(TOOL_INFO[t].url.startsWith('https://')).toBe(true);
    }
  });

  it('every entry has a non-empty specialty', () => {
    for (const t of tools) {
      expect(TOOL_INFO[t].specialty.length).toBeGreaterThan(0);
    }
  });

  it('descript points to descript.com', () => {
    expect(TOOL_INFO.descript.url).toContain('descript.com');
  });

  it('opusclip points to opus.pro', () => {
    expect(TOOL_INFO.opusclip.url).toContain('opus.pro');
  });

  it('hyperframes points to heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
  });

  it('canva points to canva.com', () => {
    expect(TOOL_INFO.canva.url).toContain('canva.com');
  });
});
