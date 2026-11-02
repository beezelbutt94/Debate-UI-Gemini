/**
 * Unit tests for all pure/deterministic library functions.
 * Coverage target: ≥98% of reachable branches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── lib/utils.ts ────────────────────────────────────────────────────────────

import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins truthy string classes', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });
  it('filters out false', () => {
    expect(cn('foo', false, 'bar')).toBe('foo bar');
  });
  it('filters out null', () => {
    expect(cn('foo', null, 'bar')).toBe('foo bar');
  });
  it('filters out undefined', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar');
  });
  it('returns empty string with no truthy args', () => {
    expect(cn(false, null, undefined)).toBe('');
  });
  it('returns empty string with zero args', () => {
    expect(cn()).toBe('');
  });
  it('handles a single class', () => {
    expect(cn('only')).toBe('only');
  });
  it('handles empty string (falsy — filtered out)', () => {
    // empty string is falsy, so filter(Boolean) removes it
    expect(cn('', 'real')).toBe('real');
  });
  it('handles whitespace-only string (truthy — kept)', () => {
    expect(cn(' ', 'real')).toBe('  real');
  });
  it('handles many mixed args', () => {
    expect(cn('a', false, null, undefined, 'b', false, 'c')).toBe('a b c');
  });
});

// ─── lib/platform.ts ─────────────────────────────────────────────────────────

import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // TikTok
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123')).toBe('tiktok');
  });
  it('detects bare tiktok.com (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/123')).toBe('tiktok');
  });
  it('detects m.tiktok.com subdomain', () => {
    expect(detectPlatform('https://m.tiktok.com/@creator/video/123')).toBe('tiktok');
  });
  it('detects vm.tiktok.com subdomain (share links)', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMabcdef/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com Shorts', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abcXYZ')).toBe('youtube_shorts');
  });
  it('detects youtube.com Shorts without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abcXYZ')).toBe('youtube_shorts');
  });
  it('detects youtu.be short links as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abcXYZ')).toBe('youtube_shorts');
  });
  it('does NOT detect youtube.com watch URLs as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abcXYZ')).toBeNull();
  });
  it('does NOT detect youtube.com channel pages as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/@creator')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });
  it('detects facebook.com reel URL without www', () => {
    expect(detectPlatform('https://facebook.com/reel/1234567890')).toBe('facebook_reels');
  });
  it('detects fb.watch short link as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/xYz123/')).toBe('facebook_reels');
  });
  it('does NOT detect facebook.com non-reel pages', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });
  it('does NOT detect facebook.com group pages', () => {
    expect(detectPlatform('https://www.facebook.com/groups/mygroup')).toBeNull();
  });

  // Null / unsupported
  it('returns null for an Instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });
  it('returns null for a generic URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });
  it('returns null for a malformed URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });
  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });
  it('returns null for a URL with no host', () => {
    expect(detectPlatform('ftp://')).toBeNull();
  });
  it('returns null for Twitter/X', () => {
    expect(detectPlatform('https://x.com/i/status/123')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('prefixes @ for YouTube when handle lacks it', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });
  it('does not double-@ for YouTube', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });
  it('handles YouTube handle with numbers', () => {
    expect(buildAccountProfileUrl('youtube', 'creator123')).toBe('https://www.youtube.com/@creator123');
  });

  // TikTok
  it('builds TikTok URL without leading @', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });
  it('strips leading @ before re-adding it for TikTok', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });
  it('handles TikTok handle with dots and underscores', () => {
    expect(buildAccountProfileUrl('tiktok', 'the.creator_1')).toBe('https://www.tiktok.com/@the.creator_1');
  });

  // Instagram
  it('builds Instagram URL without leading @', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });
  it('strips leading @ for Instagram', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });
  it('handles Instagram handle with underscore', () => {
    expect(buildAccountProfileUrl('instagram', 'my_creator')).toBe('https://www.instagram.com/my_creator/');
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
import { createHash } from 'crypto';

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(generateState().length).toBeGreaterThan(0);
  });
  it('returns a base64url string (no +, /, =)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('returns 32 base64url chars from 24 random bytes', () => {
    // 24 bytes → 32 base64url chars
    expect(generateState().length).toBe(32);
  });
  it('returns unique values on successive calls', () => {
    const states = Array.from({ length: 20 }, generateState);
    const unique = new Set(states);
    expect(unique.size).toBe(20);
  });
});

describe('stateCookieName()', () => {
  it('prefixes platform name correctly', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });
  it('works for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });
  it('works for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });
  it('works for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });
  it('works for arbitrary strings', () => {
    expect(stateCookieName('anything')).toBe('oauth_state_anything');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });
  it('returns a base64url string', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('returns 43 base64url chars from 32 random bytes', () => {
    // 32 bytes → 43 base64url chars (ceiling of 32*4/3, padded to multiple of 4 then stripped)
    expect(generateCodeVerifier().length).toBe(43);
  });
  it('returns unique values on successive calls', () => {
    const verifiers = Array.from({ length: 20 }, generateCodeVerifier);
    const unique = new Set(verifiers);
    expect(unique.size).toBe(20);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url string', () => {
    expect(codeChallengeFromVerifier('test-verifier')).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('produces the correct SHA-256 base64url of the verifier', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });
  it('is deterministic', () => {
    const v = 'some-verifier-string';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });
  it('different verifiers produce different challenges', () => {
    expect(codeChallengeFromVerifier('a')).not.toBe(codeChallengeFromVerifier('b'));
  });
  it('round-trips: challenge is 43 chars (SHA-256 → base64url)', () => {
    // SHA-256 = 32 bytes → 43 base64url chars
    expect(codeChallengeFromVerifier('hello').length).toBe(43);
  });
  it('handles empty string verifier without throwing', () => {
    expect(() => codeChallengeFromVerifier('')).not.toThrow();
  });
});

describe('codeVerifierCookieName()', () => {
  it('prefixes platform name correctly for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });
  it('works for arbitrary platform strings', () => {
    expect(codeVerifierCookieName('myplatform')).toBe('oauth_pkce_myplatform');
  });
});

// ─── lib/oauth/types.ts ───────────────────────────────────────────────────────

import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform()', () => {
  it('accepts youtube', () => expect(isOAuthPlatform('youtube')).toBe(true));
  it('accepts tiktok', () => expect(isOAuthPlatform('tiktok')).toBe(true));
  it('accepts facebook', () => expect(isOAuthPlatform('facebook')).toBe(true));
  it('accepts canva', () => expect(isOAuthPlatform('canva')).toBe(true));
  it('rejects instagram', () => expect(isOAuthPlatform('instagram')).toBe(false));
  it('rejects empty string', () => expect(isOAuthPlatform('')).toBe(false));
  it('rejects uppercase YOUTUBE', () => expect(isOAuthPlatform('YOUTUBE')).toBe(false));
  it('rejects partially matching string', () => expect(isOAuthPlatform('you')).toBe(false));
  it('rejects random string', () => expect(isOAuthPlatform('twitch')).toBe(false));
  it('rejects numeric string', () => expect(isOAuthPlatform('123')).toBe(false));
});

// ─── lib/tool-suite.ts ────────────────────────────────────────────────────────

import { TOOL_INFO } from '@/lib/tool-suite';

describe('TOOL_INFO', () => {
  const tools = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

  it.each(tools)('%s has a label', (tool) => {
    expect(typeof TOOL_INFO[tool].label).toBe('string');
    expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
  });

  it.each(tools)('%s has a valid https URL', (tool) => {
    expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
  });

  it.each(tools)('%s has a specialty string', (tool) => {
    expect(typeof TOOL_INFO[tool].specialty).toBe('string');
    expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
  });

  it('descript url points to descript.com', () => {
    expect(TOOL_INFO.descript.url).toContain('descript.com');
  });
  it('opusclip url points to opus.pro', () => {
    expect(TOOL_INFO.opusclip.url).toContain('opus.pro');
  });
  it('hyperframes url points to heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
  });
  it('canva url points to canva.com', () => {
    expect(TOOL_INFO.canva.url).toContain('canva.com');
  });
  it('all four tools are present', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual(['canva', 'descript', 'hyperframes', 'opusclip']);
  });
});

// ─── lib/digest.ts ────────────────────────────────────────────────────────────

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

// Fixed ISO date for stable toLocaleDateString output
const DATE = '2024-06-15T10:00:00.000Z';

const makeReport = <T>(overrides: Partial<AuditReportRow<T>> & { analysis: T; source_type: AuditReportRow<T>['source_type'] }): AuditReportRow<T> => ({
  id: 'r1',
  user_id: 'u1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: null,
  timeline_recommendations: [],
  created_at: DATE,
  ...overrides,
});

describe('digestReport() — source_type=url (ViralGapAnalysis)', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'Good pacing' },
    hook_evaluation: { score: 82, verdict: 'strong', notes: 'Grabbed attention fast' },
    retention_prediction: { at_3s_percent: 72, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
    action_plan: ['Cut dead air at 0:12'],
    source_metrics: {},
  };
  const report = makeReport({ source_type: 'url', analysis });

  it('includes "Viral Gap Analyzer"', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });
  it('includes the hook verdict', () => {
    expect(digestReport(report)).toContain('strong');
  });
  it('includes the hook score', () => {
    expect(digestReport(report)).toContain('82/100');
  });
  it('includes the hook notes', () => {
    expect(digestReport(report)).toContain('Grabbed attention fast');
  });
  it('includes 3s retention percentage', () => {
    expect(digestReport(report)).toContain('3s=72%');
  });
  it('includes 30s retention percentage', () => {
    expect(digestReport(report)).toContain('30s=45%');
  });
  it('returns a non-empty string', () => {
    expect(digestReport(report).length).toBeGreaterThan(0);
  });
});

describe('digestReport() — source_type=account (GrowthBlueprint)', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 65, notes: 'Mixes niches too broadly' },
    view_to_follower_ratio: { value: 12.5, assessment: 'Above average' },
    posting_cadence: { avg_days_between_posts: 2.5, assessment: 'Consistent' },
    theme_correction: ['Stick to cooking'],
    view_maximization_tactics: ['Use trending audio'],
    posting_blindspots: ['No posts on weekends', 'Missed Friday prime time'],
    per_platform_notes: {},
  };
  const report = makeReport({ source_type: 'account', analysis });

  it('includes "Account Deep-Dive"', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });
  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('65/100');
  });
  it('includes thematic consistency notes', () => {
    expect(digestReport(report)).toContain('Mixes niches too broadly');
  });
  it('includes all posting blindspots joined by semicolons', () => {
    expect(digestReport(report)).toContain('No posts on weekends; Missed Friday prime time');
  });
});

describe('digestReport() — source_type=account with empty posting blindspots', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 90, notes: 'Very consistent' },
    view_to_follower_ratio: { value: null, assessment: 'N/A' },
    posting_cadence: { avg_days_between_posts: null, assessment: 'N/A' },
    theme_correction: [],
    view_maximization_tactics: [],
    posting_blindspots: [],
    per_platform_notes: {},
  };
  const report = makeReport({ source_type: 'account', analysis });

  it('falls back to "none noted" when blindspots list is empty', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

describe('digestReport() — source_type=upload (UploadDiagnosis)', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 55, verdict: 'moderate', notes: 'Hook visible but text too small' },
    audio_balance: { score: 78, notes: 'Music a touch loud' },
    text_overlay_pacing: { assessment: 'Text changes too fast' },
    b_roll_recommendations: [],
    retention_boosters: [],
    frames_analyzed: 120,
  };
  const report = makeReport({ source_type: 'upload', analysis });

  it('includes "Upload Diagnostic"', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });
  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('moderate');
  });
  it('includes visual hook score', () => {
    expect(digestReport(report)).toContain('55/100');
  });
  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('78/100');
  });
  it('includes audio balance notes', () => {
    expect(digestReport(report)).toContain('Music a touch loud');
  });
  it('includes text overlay assessment', () => {
    expect(digestReport(report)).toContain('Text changes too fast');
  });
});

describe('digestReport() — source_type=discovery (SiteDiscoveryResult)', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'viral cooking videos 2024',
    sites: [],
    outlier: { url: 'https://example.com/outlier', reasoning: 'Uses unusual format' },
    summary: 'Found 10 relevant sites',
  };
  const report = makeReport({ source_type: 'discovery', analysis });

  it('includes "Site Discovery"', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });
  it('includes the query string', () => {
    expect(digestReport(report)).toContain('viral cooking videos 2024');
  });
  it('includes the outlier URL', () => {
    expect(digestReport(report)).toContain('https://example.com/outlier');
  });
  it('includes the outlier reasoning', () => {
    expect(digestReport(report)).toContain('Uses unusual format');
  });
});

describe('digestReport() — source_type=competitors (CompetitorGapAnalysis) — default branch', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: ['ASMR cooking'],
    missing_topics: ['Meal prep', 'Budget meals'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['quick recipes', 'one-pan meals'],
  };
  const report = makeReport({ source_type: 'competitors', analysis });

  it('includes "Competitor Espionage"', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });
  it('includes missing topics joined', () => {
    expect(digestReport(report)).toContain('Meal prep; Budget meals');
  });
  it('includes untapped keyword clusters joined', () => {
    expect(digestReport(report)).toContain('quick recipes; one-pan meals');
  });
});

describe('digestReport() — competitors with empty arrays', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: [],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: [],
  };
  const report = makeReport({ source_type: 'competitors', analysis });

  it('shows "none noted" for missing topics when empty', () => {
    expect(digestReport(report)).toContain('missing topics: none noted');
  });
  it('shows "none noted" for untapped keyword clusters when empty', () => {
    expect(digestReport(report)).toContain('untapped keyword clusters: none noted');
  });
});

describe('digestScript()', () => {
  const makeScript = (overrides: Partial<ScriptRow> = {}): ScriptRow => ({
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Viral Hook Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'This one trick will blow your mind',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Show product on counter',
          dialogue_or_vo: 'Have you ever wondered...',
          audio_sfx_cue: 'whoosh',
          retention_loop_note: 'Open loop: answer withheld',
        },
        {
          scene_number: 2,
          visual_action: 'Demo the trick',
          dialogue_or_vo: 'Here is how',
          audio_sfx_cue: 'none',
          retention_loop_note: 'Payoff scene',
        },
      ],
      cta: 'Follow for more',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: DATE,
    ...overrides,
  });

  it('includes the script title', () => {
    expect(digestScript(makeScript())).toContain('My Viral Hook Script');
  });
  it('includes the spoken hook', () => {
    expect(digestScript(makeScript())).toContain('This one trick will blow your mind');
  });
  it('includes the first scene retention loop note', () => {
    expect(digestScript(makeScript())).toContain('Open loop: answer withheld');
  });
  it('includes the total scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });
  it('returns a non-empty string', () => {
    expect(digestScript(makeScript()).length).toBeGreaterThan(0);
  });
  it('handles a script with no scenes gracefully', () => {
    const s = makeScript();
    s.storyboard.scenes = [];
    const result = digestScript(s);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });
  it('handles a script with one scene', () => {
    const s = makeScript();
    s.storyboard.scenes = [s.storyboard.scenes[0]];
    expect(digestScript(s)).toContain('1 scenes total');
  });
  it('uses the date from created_at', () => {
    const s = makeScript({ created_at: '2025-01-01T00:00:00.000Z' });
    // Just check it contains a year-like string; toLocaleDateString varies by locale
    expect(digestScript(s)).toMatch(/\d{4}|\d{1,2}\/\d{1,2}/);
  });
});

// ─── lib/oauth/index.ts — getOAuthProvider() ─────────────────────────────────

import { getOAuthProvider } from '@/lib/oauth';

describe('getOAuthProvider()', () => {
  it('returns an object for youtube', () => {
    const p = getOAuthProvider('youtube');
    expect(typeof p).toBe('object');
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
  });
  it('youtube provider does not require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });
  it('returns an object for tiktok', () => {
    expect(typeof getOAuthProvider('tiktok')).toBe('object');
  });
  it('tiktok provider does not require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });
  it('returns an object for facebook', () => {
    expect(typeof getOAuthProvider('facebook')).toBe('object');
  });
  it('facebook provider does not require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });
  it('returns an object for canva', () => {
    expect(typeof getOAuthProvider('canva')).toBe('object');
  });
  it('canva provider DOES require PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });
});

// ─── OAuth provider authorizationUrl() — env-dependent, mock env vars ────────

describe('youtubeProvider.authorizationUrl()', () => {
  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'test-yt-client-id';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'test-yt-secret';
  });

  it('returns a valid Google OAuth URL', () => {
    const url = getOAuthProvider('youtube').authorizationUrl({
      state: 'teststate',
      redirectUri: 'https://app.example.com/callback',
    });
    expect(url).toContain('accounts.google.com');
  });
  it('includes client_id', () => {
    const url = getOAuthProvider('youtube').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('client_id=test-yt-client-id');
  });
  it('includes state', () => {
    const url = getOAuthProvider('youtube').authorizationUrl({ state: 'abc123', redirectUri: 'https://r.example.com' });
    expect(url).toContain('state=abc123');
  });
  it('requests offline access', () => {
    const url = getOAuthProvider('youtube').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('access_type=offline');
  });
  it('forces consent prompt', () => {
    const url = getOAuthProvider('youtube').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('prompt=consent');
  });
  it('includes YouTube upload scope', () => {
    const url = getOAuthProvider('youtube').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('youtube.upload');
  });
  it('throws when client_id env var is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() =>
      getOAuthProvider('youtube').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' })
    ).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });
});

describe('tiktokProvider.authorizationUrl()', () => {
  beforeEach(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'test-tt-key';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'test-tt-secret';
  });

  it('returns a TikTok authorize URL', () => {
    const url = getOAuthProvider('tiktok').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('tiktok.com');
  });
  it('includes client_key', () => {
    const url = getOAuthProvider('tiktok').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('client_key=test-tt-key');
  });
  it('includes video.publish scope', () => {
    const url = getOAuthProvider('tiktok').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('video.publish');
  });
  it('includes state parameter', () => {
    const url = getOAuthProvider('tiktok').authorizationUrl({ state: 'tts', redirectUri: 'https://r.example.com' });
    expect(url).toContain('state=tts');
  });
  it('throws when client_key env var is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() =>
      getOAuthProvider('tiktok').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' })
    ).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });
});

describe('facebookProvider.authorizationUrl()', () => {
  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = 'test-fb-app-id';
    process.env.FACEBOOK_APP_SECRET = 'test-fb-secret';
  });

  it('returns a Facebook dialog/oauth URL', () => {
    const url = getOAuthProvider('facebook').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('facebook.com');
    expect(url).toContain('dialog/oauth');
  });
  it('includes client_id', () => {
    const url = getOAuthProvider('facebook').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('client_id=test-fb-app-id');
  });
  it('includes page scopes', () => {
    const url = getOAuthProvider('facebook').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('pages_show_list');
  });
  it('throws when FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() =>
      getOAuthProvider('facebook').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' })
    ).toThrow('FACEBOOK_APP_ID');
  });
});

describe('canvaProvider.authorizationUrl()', () => {
  beforeEach(() => {
    process.env.CANVA_CLIENT_ID = 'test-canva-id';
    process.env.CANVA_CLIENT_SECRET = 'test-canva-secret';
  });

  it('returns a Canva authorize URL', () => {
    const url = getOAuthProvider('canva').authorizationUrl({
      state: 's',
      redirectUri: 'https://r.example.com',
      codeChallenge: 'challenge123',
    });
    expect(url).toContain('canva.com');
  });
  it('includes code_challenge', () => {
    const url = getOAuthProvider('canva').authorizationUrl({
      state: 's',
      redirectUri: 'https://r.example.com',
      codeChallenge: 'challenge123',
    });
    expect(url).toContain('code_challenge=challenge123');
  });
  it('includes code_challenge_method=S256', () => {
    const url = getOAuthProvider('canva').authorizationUrl({
      state: 's',
      redirectUri: 'https://r.example.com',
      codeChallenge: 'ch',
    });
    expect(url).toContain('code_challenge_method=S256');
  });
  it('includes design:content:write scope', () => {
    const url = getOAuthProvider('canva').authorizationUrl({
      state: 's',
      redirectUri: 'https://r.example.com',
      codeChallenge: 'ch',
    });
    expect(url).toContain('design%3Acontent%3Awrite');
  });
  it('throws when CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() =>
      getOAuthProvider('canva').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com', codeChallenge: 'c' })
    ).toThrow('CANVA_CLIENT_ID');
  });
});
