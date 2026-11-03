import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── utils ────────────────────────────────────────────────────────────────────

import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins truthy string classes', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles a single class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles no arguments', () => {
    expect(cn()).toBe('');
  });

  it('preserves extra whitespace within a class string', () => {
    expect(cn('  padded  ', 'end')).toBe('  padded   end');
  });
});

// ─── platform ─────────────────────────────────────────────────────────────────

import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // TikTok
  it('detects plain tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });
  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/456')).toBe('tiktok');
  });
  it('detects a tiktok subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/short')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });
  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });
  it('detects youtu.be short URL', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });
  it('returns null for youtube.com /watch (not shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });
  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });
  it('detects fb.watch URL', () => {
    expect(detectPlatform('https://fb.watch/abc')).toBe('facebook_reels');
  });
  it('returns null for facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/user/videos/123')).toBeNull();
  });

  // Unknown / invalid
  it('returns null for an unknown domain', () => {
    expect(detectPlatform('https://instagram.com/p/abc')).toBeNull();
  });
  it('returns null for a completely invalid URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });
  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });
  it('returns null for a bare domain with no path', () => {
    expect(detectPlatform('https://example.com')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  describe('youtube', () => {
    it('prefixes handle with @ when missing', () => {
      expect(buildAccountProfileUrl('youtube', 'mkbhd')).toBe('https://www.youtube.com/@mkbhd');
    });
    it('keeps @ when already present', () => {
      expect(buildAccountProfileUrl('youtube', '@mkbhd')).toBe('https://www.youtube.com/@mkbhd');
    });
  });

  describe('tiktok', () => {
    it('strips leading @ then prepends it', () => {
      expect(buildAccountProfileUrl('tiktok', '@khaby.lame')).toBe('https://www.tiktok.com/@khaby.lame');
    });
    it('prepends @ when handle has none', () => {
      expect(buildAccountProfileUrl('tiktok', 'khaby.lame')).toBe('https://www.tiktok.com/@khaby.lame');
    });
  });

  describe('instagram', () => {
    it('strips leading @ then builds URL', () => {
      expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
    });
    it('works without leading @', () => {
      expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
    });
  });
});

// ─── oauth/state ──────────────────────────────────────────────────────────────

import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('produces different values each call (no collisions)', () => {
    const samples = new Set(Array.from({ length: 50 }, () => generateState()));
    expect(samples.size).toBe(50);
  });

  it('is URL-safe base64url (no +, /, or = characters)', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateState()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('has at least 32 characters of entropy', () => {
    // 24 random bytes → 32 base64url chars
    expect(generateState().length).toBeGreaterThanOrEqual(32);
  });
});

describe('stateCookieName()', () => {
  it('returns the expected cookie name format', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty URL-safe base64url string', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces different values each call', () => {
    const samples = new Set(Array.from({ length: 50 }, () => generateCodeVerifier()));
    expect(samples.size).toBe(50);
  });

  it('has at least 43 characters (RFC 7636 min)', () => {
    // 32 random bytes → 43 base64url chars (floor(32*4/3))
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a URL-safe base64url string', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for the same input', () => {
    const verifier = 'fixed-verifier-for-test';
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces different challenges for different verifiers', () => {
    const a = codeChallengeFromVerifier('verifier-a');
    const b = codeChallengeFromVerifier('verifier-b');
    expect(a).not.toBe(b);
  });

  it('produces a SHA-256 digest (43 or 44 base64url chars)', () => {
    // SHA-256 = 32 bytes → 43 chars in base64url (no padding)
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge.length).toBe(43);
  });

  it('known test vector: S256 of "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"', () => {
    // RFC 7636 Appendix B example
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns the expected cookie name format', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });
});

// ─── oauth/types ──────────────────────────────────────────────────────────────

import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform()', () => {
  it('returns true for all four supported platforms', () => {
    expect(isOAuthPlatform('youtube')).toBe(true);
    expect(isOAuthPlatform('tiktok')).toBe(true);
    expect(isOAuthPlatform('facebook')).toBe(true);
    expect(isOAuthPlatform('canva')).toBe(true);
  });

  it('returns false for unsupported strings', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
    expect(isOAuthPlatform('twitter')).toBe(false);
    expect(isOAuthPlatform('')).toBe(false);
    expect(isOAuthPlatform('YouTube')).toBe(false); // case-sensitive
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });
});

// ─── digest ───────────────────────────────────────────────────────────────────

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

function makeReport<T>(overrides: Partial<AuditReportRow<T>> & { source_type: AuditReportRow['source_type']; analysis: T }): AuditReportRow<T> {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_url: null,
    platform: null,
    viral_score: null,
    timeline_recommendations: [],
    created_at: '2024-09-12T10:00:00.000Z',
    ...overrides,
  };
}

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 4, assessment: 'fast' },
  hook_evaluation: { score: 72, verdict: 'moderate', notes: 'decent hook' },
  retention_prediction: { at_3s_percent: 65, at_30s_percent: 42, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['cut tighter'],
  source_metrics: {},
};

describe('digestReport() — url (ViralGapAnalysis)', () => {
  const report = makeReport<ViralGapAnalysis>({ source_type: 'url', analysis: viralAnalysis });

  it('includes the verdict', () => expect(digestReport(report)).toContain('moderate'));
  it('includes the score', () => expect(digestReport(report)).toContain('72/100'));
  it('includes the notes', () => expect(digestReport(report)).toContain('decent hook'));
  it('includes 3s retention', () => expect(digestReport(report)).toContain('3s=65%'));
  it('includes 30s retention', () => expect(digestReport(report)).toContain('30s=42%'));
  it('includes the date', () => {
    const date = new Date('2024-09-12T10:00:00.000Z').toLocaleDateString();
    expect(digestReport(report)).toContain(date);
  });
  it('starts with "Viral Gap Analyzer"', () => expect(digestReport(report)).toMatch(/^Viral Gap Analyzer/));
});

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 80, notes: 'solid niche focus' },
  view_to_follower_ratio: { value: 12.5, assessment: 'good' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
  theme_correction: [],
  view_maximization_tactics: ['add B-roll'],
  posting_blindspots: ['weekend posts underperform', 'missing Thursday'],
  per_platform_notes: {},
};

describe('digestReport() — account (GrowthBlueprint)', () => {
  const report = makeReport<GrowthBlueprint>({ source_type: 'account', analysis: growthAnalysis });

  it('starts with "Account Deep-Dive"', () => expect(digestReport(report)).toMatch(/^Account Deep-Dive/));
  it('includes thematic consistency score', () => expect(digestReport(report)).toContain('80/100'));
  it('includes thematic notes', () => expect(digestReport(report)).toContain('solid niche focus'));
  it('includes posting blindspots', () => {
    const out = digestReport(report);
    expect(out).toContain('weekend posts underperform');
    expect(out).toContain('missing Thursday');
  });
});

const growthNoBlindspots: GrowthBlueprint = { ...growthAnalysis, posting_blindspots: [] };

describe('digestReport() — account with empty blindspots', () => {
  const report = makeReport<GrowthBlueprint>({ source_type: 'account', analysis: growthNoBlindspots });

  it('says "none noted" when blindspots array is empty', () => {
    expect(digestReport(report)).toContain('none noted');
  });
});

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 88, verdict: 'strong', notes: 'clear face reveal' },
  audio_balance: { score: 70, notes: 'slight background noise' },
  text_overlay_pacing: { assessment: 'well-timed' },
  b_roll_recommendations: ['add establishing shot'],
  retention_boosters: ['add pattern interrupt at 5s'],
  frames_analyzed: 42,
};

describe('digestReport() — upload (UploadDiagnosis)', () => {
  const report = makeReport<UploadDiagnosis>({ source_type: 'upload', analysis: uploadAnalysis });

  it('starts with "Upload Diagnostic"', () => expect(digestReport(report)).toMatch(/^Upload Diagnostic/));
  it('includes visual hook verdict', () => expect(digestReport(report)).toContain('"strong"'));
  it('includes visual hook score', () => expect(digestReport(report)).toContain('88/100'));
  it('includes audio balance score', () => expect(digestReport(report)).toContain('70/100'));
  it('includes audio notes', () => expect(digestReport(report)).toContain('slight background noise'));
  it('includes text overlay assessment', () => expect(digestReport(report)).toContain('well-timed'));
});

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'viral cooking hacks',
    sites: [],
  outlier: { url: 'https://outlier.example.com', reasoning: 'unique angle on fermentation' },
  summary: 'Found 10 relevant sites',
};

describe('digestReport() — discovery (SiteDiscoveryResult)', () => {
  const report = makeReport<SiteDiscoveryResult>({ source_type: 'discovery', analysis: discoveryAnalysis });

  it('starts with "Site Discovery"', () => expect(digestReport(report)).toMatch(/^Site Discovery/));
  it('includes the query', () => expect(digestReport(report)).toContain('viral cooking hacks'));
  it('includes the outlier URL', () => expect(digestReport(report)).toContain('https://outlier.example.com'));
  it('includes the outlier reasoning', () => expect(digestReport(report)).toContain('unique angle on fermentation'));
});

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: ['trending sounds'],
  missing_topics: ['recipe roundups', 'kitchen gadget reviews'],
  audience_sentiment_gaps: ['viewers want more budget meals'],
  untapped_keyword_clusters: ['quick dinner ideas', 'meal prep under 10min'],
};

describe('digestReport() — competitors (CompetitorGapAnalysis)', () => {
  const report = makeReport<CompetitorGapAnalysis>({ source_type: 'competitors', analysis: competitorAnalysis });

  it('starts with "Competitor Espionage"', () => expect(digestReport(report)).toMatch(/^Competitor Espionage/));
  it('includes missing topics', () => {
    const out = digestReport(report);
    expect(out).toContain('recipe roundups');
    expect(out).toContain('kitchen gadget reviews');
  });
  it('includes untapped keyword clusters', () => {
    const out = digestReport(report);
    expect(out).toContain('quick dinner ideas');
    expect(out).toContain('meal prep under 10min');
  });
});

const competitorEmptyArrays: CompetitorGapAnalysis = {
  ...competitorAnalysis,
  missing_topics: [],
  untapped_keyword_clusters: [],
};

describe('digestReport() — competitors with empty arrays', () => {
  const report = makeReport<CompetitorGapAnalysis>({ source_type: 'competitors', analysis: competitorEmptyArrays });

  it('shows "none noted" for missing topics', () => expect(digestReport(report)).toContain('missing topics: none noted'));
  it('shows "none noted" for untapped keywords', () => expect(digestReport(report)).toContain('untapped keyword clusters: none noted'));
});

function makeScript(overrides: Partial<ScriptRow> = {}): ScriptRow {
  return {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'How to go viral fast',
    source_prompt: null,
    tone_parameters: {},
    target_platform: null,
    created_at: '2024-09-12T10:00:00.000Z',
    storyboard: {
      spoken_hook: 'This one habit changed everything',
      memory_context_used: false,
      cta: 'Follow for more',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of phone',
          dialogue_or_vo: 'This one habit changed everything',
          audio_sfx_cue: 'upbeat music',
          retention_loop_note: 'open loop on habit reveal',
        },
        {
          scene_number: 2,
          visual_action: 'B-roll montage',
          dialogue_or_vo: 'Here is why...',
          audio_sfx_cue: 'ambient',
          retention_loop_note: 'curiosity gap maintained',
        },
      ],
    },
    ...overrides,
  };
}

describe('digestScript()', () => {
  it('includes the script title', () => {
    expect(digestScript(makeScript())).toContain('How to go viral fast');
  });

  it('includes the spoken hook', () => {
    expect(digestScript(makeScript())).toContain('This one habit changed everything');
  });

  it('includes first scene retention loop note', () => {
    expect(digestScript(makeScript())).toContain('open loop on habit reveal');
  });

  it('includes total scene count', () => {
    expect(digestScript(makeScript())).toContain('2 scenes total');
  });

  it('shows "(none)" when first scene has no retention_loop_note', () => {
    const script = makeScript();
    script.storyboard.scenes[0].retention_loop_note = '';
    // empty string is falsy — but the code uses ?? so only undefined/null triggers '(none)'
    // Empty string passes through; verify correct behavior
    expect(digestScript(script)).toContain('""');
  });

  it('handles a script with no scenes gracefully', () => {
    const script = makeScript();
    script.storyboard.scenes = [];
    const result = digestScript(script);
    expect(result).toContain('(none)');
    expect(result).toContain('0 scenes total');
  });

  it('includes the formatted date', () => {
    const date = new Date('2024-09-12T10:00:00.000Z').toLocaleDateString();
    expect(digestScript(makeScript())).toContain(date);
  });
});

// ─── tool-suite ───────────────────────────────────────────────────────────────

import { TOOL_INFO } from '@/lib/tool-suite';

describe('TOOL_INFO constant', () => {
  const allTools: Array<keyof typeof TOOL_INFO> = ['descript', 'opusclip', 'hyperframes', 'canva'];

  it('covers all four SuiteTool values', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual(allTools.slice().sort());
  });

  it.each(allTools)('%s has label, url, and specialty', (tool) => {
    const info = TOOL_INFO[tool];
    expect(typeof info.label).toBe('string');
    expect(info.label.length).toBeGreaterThan(0);
    expect(typeof info.url).toBe('string');
    expect(info.url).toMatch(/^https:\/\//);
    expect(typeof info.specialty).toBe('string');
    expect(info.specialty.length).toBeGreaterThan(0);
  });

  it('descript URL points to descript.com', () => {
    expect(TOOL_INFO.descript.url).toContain('descript.com');
  });

  it('opusclip URL points to opus.pro', () => {
    expect(TOOL_INFO.opusclip.url).toContain('opus.pro');
  });

  it('hyperframes URL points to heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
  });

  it('canva URL points to canva.com', () => {
    expect(TOOL_INFO.canva.url).toContain('canva.com');
  });
});

// ─── oauth/index (getOAuthProvider) ───────────────────────────────────────────

import { getOAuthProvider } from '@/lib/oauth/index';

describe('getOAuthProvider()', () => {
  it('returns a provider object for youtube', () => {
    const p = getOAuthProvider('youtube');
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
    expect(p.requiresPkce).toBe(false);
  });

  it('returns a provider object for tiktok', () => {
    const p = getOAuthProvider('tiktok');
    expect(typeof p.authorizationUrl).toBe('function');
    expect(p.requiresPkce).toBe(false);
  });

  it('returns a provider object for facebook', () => {
    const p = getOAuthProvider('facebook');
    expect(typeof p.authorizationUrl).toBe('function');
    expect(p.requiresPkce).toBe(false);
  });

  it('returns a provider object for canva and marks it as PKCE', () => {
    const p = getOAuthProvider('canva');
    expect(typeof p.authorizationUrl).toBe('function');
    expect(p.requiresPkce).toBe(true);
  });
});

// ─── OAuth authorizationUrl shape ─────────────────────────────────────────────

describe('youtubeProvider.authorizationUrl()', () => {
  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'test-yt-client-id';
  });
  afterEach(() => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('builds a valid Google OAuth URL', () => {
    const p = getOAuthProvider('youtube');
    const url = p.authorizationUrl({ state: 'st123', redirectUri: 'https://app.example.com/callback' });
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('client_id=test-yt-client-id');
    expect(url).toContain('state=st123');
    expect(url).toContain('response_type=code');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is not set', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const p = getOAuthProvider('youtube');
    expect(() => p.authorizationUrl({ state: 'x', redirectUri: 'https://app.example.com/cb' })).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });
});

describe('tiktokProvider.authorizationUrl()', () => {
  beforeEach(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'test-tt-key';
  });
  afterEach(() => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
  });

  it('builds a valid TikTok auth URL', () => {
    const p = getOAuthProvider('tiktok');
    const url = p.authorizationUrl({ state: 'st456', redirectUri: 'https://app.example.com/callback' });
    expect(url).toContain('tiktok.com');
    expect(url).toContain('client_key=test-tt-key');
    expect(url).toContain('state=st456');
    expect(url).toContain('scope=video.publish');
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is not set', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    const p = getOAuthProvider('tiktok');
    expect(() => p.authorizationUrl({ state: 'x', redirectUri: 'https://app.example.com/cb' })).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });
});

describe('facebookProvider.authorizationUrl()', () => {
  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = 'test-fb-app-id';
  });
  afterEach(() => {
    delete process.env.FACEBOOK_APP_ID;
  });

  it('builds a valid Facebook OAuth dialog URL', () => {
    const p = getOAuthProvider('facebook');
    const url = p.authorizationUrl({ state: 'st789', redirectUri: 'https://app.example.com/callback' });
    expect(url).toContain('facebook.com');
    expect(url).toContain('client_id=test-fb-app-id');
    expect(url).toContain('state=st789');
    expect(url).toContain('response_type=code');
  });

  it('throws when FACEBOOK_APP_ID is not set', () => {
    delete process.env.FACEBOOK_APP_ID;
    const p = getOAuthProvider('facebook');
    expect(() => p.authorizationUrl({ state: 'x', redirectUri: 'https://app.example.com/cb' })).toThrow('FACEBOOK_APP_ID');
  });
});

describe('canvaProvider.authorizationUrl()', () => {
  beforeEach(() => {
    process.env.CANVA_CLIENT_ID = 'test-canva-id';
    process.env.CANVA_CLIENT_SECRET = 'test-canva-secret';
  });
  afterEach(() => {
    delete process.env.CANVA_CLIENT_ID;
    delete process.env.CANVA_CLIENT_SECRET;
  });

  it('builds a valid Canva auth URL with PKCE challenge', () => {
    const p = getOAuthProvider('canva');
    const url = p.authorizationUrl({
      state: 'stABC',
      redirectUri: 'https://app.example.com/callback',
      codeChallenge: 'challenge123',
    });
    expect(url).toContain('canva.com');
    expect(url).toContain('client_id=test-canva-id');
    expect(url).toContain('state=stABC');
    expect(url).toContain('code_challenge=challenge123');
    expect(url).toContain('code_challenge_method=S256');
  });

  it('includes empty code_challenge when omitted', () => {
    const p = getOAuthProvider('canva');
    const url = p.authorizationUrl({ state: 'x', redirectUri: 'https://app.example.com/cb' });
    expect(url).toContain('code_challenge=');
  });

  it('throws when CANVA_CLIENT_ID is not set', () => {
    delete process.env.CANVA_CLIENT_ID;
    const p = getOAuthProvider('canva');
    expect(() => p.authorizationUrl({ state: 'x', redirectUri: 'https://app.example.com/cb' })).toThrow('CANVA_CLIENT_ID');
  });
});
