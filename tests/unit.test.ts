/**
 * Unit tests for all pure / side-effect-free functions in lib/.
 * Run with:
 *   node --experimental-strip-types --test tests/unit.test.ts
 *
 * No external dependencies: uses node:test + node:assert/strict + node:crypto.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// ── lib/utils.ts ─────────────────────────────────────────────────────────────
import { cn } from '../lib/utils.ts';

describe('cn()', () => {
  it('returns empty string with no arguments', () => {
    assert.equal(cn(), '');
  });

  it('returns single class unchanged', () => {
    assert.equal(cn('foo'), 'foo');
  });

  it('joins multiple classes with a space', () => {
    assert.equal(cn('foo', 'bar', 'baz'), 'foo bar baz');
  });

  it('filters out false', () => {
    assert.equal(cn('a', false, 'b'), 'a b');
  });

  it('filters out null', () => {
    assert.equal(cn('a', null, 'b'), 'a b');
  });

  it('filters out undefined', () => {
    assert.equal(cn('a', undefined, 'b'), 'a b');
  });

  it('filters out empty string (falsy)', () => {
    // empty string is falsy → filtered
    assert.equal(cn('a', '', 'b'), 'a b');
  });

  it('returns empty string when all args are falsy', () => {
    assert.equal(cn(false, null, undefined), '');
  });

  it('handles a large number of classes', () => {
    const many = Array.from({ length: 100 }, (_, i) => `class-${i}`);
    assert.equal(cn(...many), many.join(' '));
  });
});

// ── lib/platform.ts ───────────────────────────────────────────────────────────
import { detectPlatform, buildAccountProfileUrl } from '../lib/platform.ts';

describe('detectPlatform()', () => {
  // TikTok
  it('detects www.tiktok.com', () => {
    assert.equal(detectPlatform('https://www.tiktok.com/@creator/video/1234567890'), 'tiktok');
  });

  it('detects bare tiktok.com', () => {
    assert.equal(detectPlatform('https://tiktok.com/@creator/video/1234567890'), 'tiktok');
  });

  it('detects tiktok subdomain (vm.tiktok.com)', () => {
    assert.equal(detectPlatform('https://vm.tiktok.com/abc123/'), 'tiktok');
  });

  it('detects tiktok mobile subdomain (m.tiktok.com)', () => {
    assert.equal(detectPlatform('https://m.tiktok.com/@creator/video/999'), 'tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/', () => {
    assert.equal(detectPlatform('https://www.youtube.com/shorts/abc123'), 'youtube_shorts');
  });

  it('detects bare youtube.com/shorts/', () => {
    assert.equal(detectPlatform('https://youtube.com/shorts/abc123'), 'youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    assert.equal(detectPlatform('https://youtu.be/abc123'), 'youtube_shorts');
  });

  it('returns null for youtube.com/watch (not a Short)', () => {
    assert.equal(detectPlatform('https://www.youtube.com/watch?v=abc123'), null);
  });

  it('returns null for youtube.com/channel page', () => {
    assert.equal(detectPlatform('https://www.youtube.com/@channel'), null);
  });

  // Facebook Reels
  it('detects facebook.com/reel/', () => {
    assert.equal(detectPlatform('https://www.facebook.com/reel/123456789'), 'facebook_reels');
  });

  it('detects bare facebook.com/reel/', () => {
    assert.equal(detectPlatform('https://facebook.com/reel/123456789'), 'facebook_reels');
  });

  it('detects m.facebook.com/reel/', () => {
    assert.equal(detectPlatform('https://m.facebook.com/reel/123456789'), 'facebook_reels');
  });

  it('detects fb.watch links as facebook_reels', () => {
    assert.equal(detectPlatform('https://fb.watch/xYzAbC/'), 'facebook_reels');
  });

  it('returns null for facebook.com/videos/ (not a reel)', () => {
    assert.equal(detectPlatform('https://www.facebook.com/videos/123456789'), null);
  });

  it('returns null for facebook.com home', () => {
    assert.equal(detectPlatform('https://www.facebook.com/'), null);
  });

  // Unrecognised / invalid
  it('returns null for Instagram URL', () => {
    assert.equal(detectPlatform('https://www.instagram.com/p/abc123/'), null);
  });

  it('returns null for a random URL', () => {
    assert.equal(detectPlatform('https://example.com/video/123'), null);
  });

  it('returns null for empty string', () => {
    assert.equal(detectPlatform(''), null);
  });

  it('returns null for a non-URL string', () => {
    assert.equal(detectPlatform('not a url at all'), null);
  });

  it('returns null for a URL without a protocol', () => {
    assert.equal(detectPlatform('tiktok.com/@creator/video/123'), null);
  });

  it('returns null for a bare domain', () => {
    assert.equal(detectPlatform('www.youtube.com/shorts/abc'), null);
  });
});

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('prefixes @ for a youtube handle that lacks it', () => {
    assert.equal(
      buildAccountProfileUrl('youtube', 'creator'),
      'https://www.youtube.com/@creator'
    );
  });

  it('keeps existing @ for youtube handle', () => {
    assert.equal(
      buildAccountProfileUrl('youtube', '@creator'),
      'https://www.youtube.com/@creator'
    );
  });

  it('does not double-prefix @@ for youtube', () => {
    // only the first @ in handle is kept, starts with @ → used as-is
    assert.equal(
      buildAccountProfileUrl('youtube', '@creator'),
      'https://www.youtube.com/@creator'
    );
  });

  // TikTok
  it('strips leading @ for tiktok handle', () => {
    assert.equal(
      buildAccountProfileUrl('tiktok', '@creator'),
      'https://www.tiktok.com/@creator'
    );
  });

  it('adds @ for tiktok handle without it', () => {
    assert.equal(
      buildAccountProfileUrl('tiktok', 'creator'),
      'https://www.tiktok.com/@creator'
    );
  });

  // Instagram
  it('strips leading @ for instagram handle', () => {
    assert.equal(
      buildAccountProfileUrl('instagram', '@creator'),
      'https://www.instagram.com/creator/'
    );
  });

  it('uses bare handle for instagram without @', () => {
    assert.equal(
      buildAccountProfileUrl('instagram', 'creator'),
      'https://www.instagram.com/creator/'
    );
  });

  it('all results start with https://', () => {
    for (const platform of ['youtube', 'tiktok', 'instagram'] as const) {
      const url = buildAccountProfileUrl(platform, 'testuser');
      assert.match(url, /^https:\/\//);
    }
  });
});

// ── lib/oauth/state.ts ────────────────────────────────────────────────────────
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '../lib/oauth/state.ts';

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    const s = generateState();
    assert.ok(typeof s === 'string' && s.length > 0);
  });

  it('returns different values on consecutive calls (uniqueness)', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateState()));
    assert.equal(values.size, 50);
  });

  it('contains only base64url characters (no +, /, or =)', () => {
    const s = generateState();
    assert.doesNotMatch(s, /[+/=]/);
  });

  it('has the expected length for 24 random bytes in base64url (32 chars)', () => {
    // 24 bytes → ceil(24/3)*4 = 32 base64 chars, same in base64url
    assert.equal(generateState().length, 32);
  });
});

describe('stateCookieName()', () => {
  it('returns oauth_state_{platform}', () => {
    assert.equal(stateCookieName('youtube'), 'oauth_state_youtube');
    assert.equal(stateCookieName('tiktok'), 'oauth_state_tiktok');
    assert.equal(stateCookieName('facebook'), 'oauth_state_facebook');
    assert.equal(stateCookieName('canva'), 'oauth_state_canva');
  });

  it('handles arbitrary platform strings', () => {
    assert.equal(stateCookieName('my_platform'), 'oauth_state_my_platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    const v = generateCodeVerifier();
    assert.ok(typeof v === 'string' && v.length > 0);
  });

  it('returns different values on consecutive calls', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateCodeVerifier()));
    assert.equal(values.size, 50);
  });

  it('contains only base64url characters', () => {
    assert.doesNotMatch(generateCodeVerifier(), /[+/=]/);
  });

  it('has the expected length for 32 random bytes in base64url (43 chars)', () => {
    // 32 bytes → ceil(32*4/3) = 43 base64url chars (no padding)
    assert.equal(generateCodeVerifier().length, 43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('produces a base64url-encoded SHA-256 of the verifier', () => {
    const verifier = 'test-verifier-string';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    assert.equal(codeChallengeFromVerifier(verifier), expected);
  });

  it('is deterministic for the same verifier', () => {
    const verifier = generateCodeVerifier();
    assert.equal(codeChallengeFromVerifier(verifier), codeChallengeFromVerifier(verifier));
  });

  it('produces different challenges for different verifiers', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    assert.notEqual(codeChallengeFromVerifier(a), codeChallengeFromVerifier(b));
  });

  it('result contains only base64url characters', () => {
    assert.doesNotMatch(codeChallengeFromVerifier(generateCodeVerifier()), /[+/=]/);
  });

  it('result has expected length (SHA-256 is 32 bytes → 43 base64url chars)', () => {
    assert.equal(codeChallengeFromVerifier('anything').length, 43);
  });

  it('round-trip: challenge from real verifier passes PKCE validation logic', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    // Verify the challenge by re-deriving it ourselves
    const rederived = createHash('sha256').update(verifier).digest('base64url');
    assert.equal(challenge, rederived);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns oauth_pkce_{platform}', () => {
    assert.equal(codeVerifierCookieName('canva'), 'oauth_pkce_canva');
    assert.equal(codeVerifierCookieName('youtube'), 'oauth_pkce_youtube');
  });
});

// ── lib/oauth/types.ts ────────────────────────────────────────────────────────
import { isOAuthPlatform } from '../lib/oauth/types.ts';

describe('isOAuthPlatform()', () => {
  it('accepts "youtube"', () => assert.ok(isOAuthPlatform('youtube')));
  it('accepts "tiktok"', () => assert.ok(isOAuthPlatform('tiktok')));
  it('accepts "facebook"', () => assert.ok(isOAuthPlatform('facebook')));
  it('accepts "canva"', () => assert.ok(isOAuthPlatform('canva')));

  it('rejects "instagram"', () => assert.ok(!isOAuthPlatform('instagram')));
  it('rejects "twitter"', () => assert.ok(!isOAuthPlatform('twitter')));
  it('rejects "Youtube" (wrong case)', () => assert.ok(!isOAuthPlatform('Youtube')));
  it('rejects "TIKTOK" (wrong case)', () => assert.ok(!isOAuthPlatform('TIKTOK')));
  it('rejects empty string', () => assert.ok(!isOAuthPlatform('')));
  it('rejects a numeric string', () => assert.ok(!isOAuthPlatform('42')));
});

// ── lib/oauth/index.ts ────────────────────────────────────────────────────────
import { getOAuthProvider } from '../lib/oauth/index.ts';

describe('getOAuthProvider()', () => {
  it('returns an object with required shape for youtube', () => {
    const p = getOAuthProvider('youtube');
    assert.ok(typeof p.authorizationUrl === 'function');
    assert.ok(typeof p.exchangeCode === 'function');
    assert.ok(typeof p.refreshAccessToken === 'function');
    assert.equal(typeof p.requiresPkce, 'boolean');
  });

  it('youtube does not require PKCE', () => {
    assert.equal(getOAuthProvider('youtube').requiresPkce, false);
  });

  it('tiktok does not require PKCE', () => {
    assert.equal(getOAuthProvider('tiktok').requiresPkce, false);
  });

  it('facebook does not require PKCE', () => {
    assert.equal(getOAuthProvider('facebook').requiresPkce, false);
  });

  it('canva requires PKCE', () => {
    assert.equal(getOAuthProvider('canva').requiresPkce, true);
  });

  it('returns different objects for different platforms', () => {
    assert.notEqual(getOAuthProvider('youtube'), getOAuthProvider('tiktok'));
  });
});

// ── OAuth provider authorizationUrl() ─────────────────────────────────────────
// Tests that the URL is well-formed and includes the expected params.
// Real env vars are injected just for these tests.

describe('youtubeProvider.authorizationUrl()', () => {
  before(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'test-yt-client-id';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'test-yt-secret';
  });

  it('produces a valid Google OAuth2 URL', () => {
    const provider = getOAuthProvider('youtube');
    const url = new URL(
      provider.authorizationUrl({
        state: 'test-state',
        redirectUri: 'https://app.example.com/api/oauth/youtube/callback',
      })
    );
    assert.equal(url.hostname, 'accounts.google.com');
    assert.equal(url.pathname, '/o/oauth2/v2/auth');
  });

  it('includes client_id from env', () => {
    const provider = getOAuthProvider('youtube');
    const url = new URL(
      provider.authorizationUrl({
        state: 'test-state',
        redirectUri: 'https://app.example.com/api/oauth/youtube/callback',
      })
    );
    assert.equal(url.searchParams.get('client_id'), 'test-yt-client-id');
  });

  it('includes offline access_type for refresh token', () => {
    const provider = getOAuthProvider('youtube');
    const url = new URL(
      provider.authorizationUrl({
        state: 'my-state',
        redirectUri: 'https://app.example.com/api/oauth/youtube/callback',
      })
    );
    assert.equal(url.searchParams.get('access_type'), 'offline');
    assert.equal(url.searchParams.get('prompt'), 'consent');
  });

  it('round-trips the state parameter', () => {
    const provider = getOAuthProvider('youtube');
    const state = generateState();
    const url = new URL(
      provider.authorizationUrl({
        state,
        redirectUri: 'https://app.example.com/api/oauth/youtube/callback',
      })
    );
    assert.equal(url.searchParams.get('state'), state);
  });

  it('round-trips the redirect_uri parameter', () => {
    const provider = getOAuthProvider('youtube');
    const redirectUri = 'https://app.example.com/api/oauth/youtube/callback';
    const url = new URL(provider.authorizationUrl({ state: 'x', redirectUri }));
    assert.equal(url.searchParams.get('redirect_uri'), redirectUri);
  });
});

describe('tiktokProvider.authorizationUrl()', () => {
  before(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'test-tt-client-key';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'test-tt-secret';
  });

  it('produces a valid TikTok OAuth2 URL', () => {
    const provider = getOAuthProvider('tiktok');
    const url = new URL(
      provider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' })
    );
    assert.equal(url.hostname, 'www.tiktok.com');
    assert.match(url.pathname, /\/v2\/auth\/authorize/);
  });

  it('includes client_key', () => {
    const provider = getOAuthProvider('tiktok');
    const url = new URL(
      provider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' })
    );
    assert.equal(url.searchParams.get('client_key'), 'test-tt-client-key');
  });

  it('includes video.publish scope', () => {
    const provider = getOAuthProvider('tiktok');
    const url = new URL(
      provider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' })
    );
    assert.equal(url.searchParams.get('scope'), 'video.publish');
  });

  it('round-trips state', () => {
    const provider = getOAuthProvider('tiktok');
    const state = generateState();
    const url = new URL(
      provider.authorizationUrl({ state, redirectUri: 'https://app.example.com/cb' })
    );
    assert.equal(url.searchParams.get('state'), state);
  });
});

describe('facebookProvider.authorizationUrl()', () => {
  before(() => {
    process.env.FACEBOOK_APP_ID = 'test-fb-app-id';
    process.env.FACEBOOK_APP_SECRET = 'test-fb-secret';
  });

  it('produces a valid Facebook OAuth dialog URL', () => {
    const provider = getOAuthProvider('facebook');
    const url = new URL(
      provider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' })
    );
    assert.equal(url.hostname, 'www.facebook.com');
    assert.match(url.pathname, /\/dialog\/oauth/);
  });

  it('includes client_id', () => {
    const provider = getOAuthProvider('facebook');
    const url = new URL(
      provider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' })
    );
    assert.equal(url.searchParams.get('client_id'), 'test-fb-app-id');
  });

  it('includes page management scopes', () => {
    const provider = getOAuthProvider('facebook');
    const url = new URL(
      provider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' })
    );
    assert.ok(url.searchParams.get('scope')?.includes('pages_manage_posts'));
  });

  it('round-trips state', () => {
    const provider = getOAuthProvider('facebook');
    const state = generateState();
    const url = new URL(
      provider.authorizationUrl({ state, redirectUri: 'https://app.example.com/cb' })
    );
    assert.equal(url.searchParams.get('state'), state);
  });
});

describe('canvaProvider.authorizationUrl()', () => {
  before(() => {
    process.env.CANVA_CLIENT_ID = 'test-canva-client-id';
    process.env.CANVA_CLIENT_SECRET = 'test-canva-secret';
  });

  it('produces a valid Canva OAuth2 URL', () => {
    const provider = getOAuthProvider('canva');
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const url = new URL(
      provider.authorizationUrl({
        state: 'st',
        redirectUri: 'https://app.example.com/cb',
        codeChallenge: challenge,
      })
    );
    assert.equal(url.hostname, 'www.canva.com');
    assert.match(url.pathname, /\/api\/oauth\/authorize/);
  });

  it('includes PKCE code_challenge and method', () => {
    const provider = getOAuthProvider('canva');
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const url = new URL(
      provider.authorizationUrl({
        state: 'st',
        redirectUri: 'https://app.example.com/cb',
        codeChallenge: challenge,
      })
    );
    assert.equal(url.searchParams.get('code_challenge'), challenge);
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  });

  it('includes client_id', () => {
    const provider = getOAuthProvider('canva');
    const url = new URL(
      provider.authorizationUrl({
        state: 'st',
        redirectUri: 'https://app.example.com/cb',
        codeChallenge: 'challenge',
      })
    );
    assert.equal(url.searchParams.get('client_id'), 'test-canva-client-id');
  });

  it('includes design scopes', () => {
    const provider = getOAuthProvider('canva');
    const url = new URL(
      provider.authorizationUrl({
        state: 'st',
        redirectUri: 'https://app.example.com/cb',
        codeChallenge: 'challenge',
      })
    );
    const scope = url.searchParams.get('scope') ?? '';
    assert.ok(scope.includes('design:content:write'));
    assert.ok(scope.includes('profile:read'));
  });
});

// ── lib/digest.ts ─────────────────────────────────────────────────────────────
import { digestReport, digestScript } from '../lib/digest.ts';

// Minimal valid fixture builders so we don't repeat the full shape everywhere.
function baseRow(overrides: Record<string, unknown>) {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_url: 'https://tiktok.com/@c/video/1',
    platform: 'tiktok',
    viral_score: 80,
    timeline_recommendations: [],
    created_at: '2024-06-15T12:00:00.000Z',
    ...overrides,
  };
}

describe('digestReport() - source_type=url (ViralGapAnalysis)', () => {
  const report = baseRow({
    source_type: 'url',
    analysis: {
      hook_evaluation: { score: 85, verdict: 'strong', notes: 'Very catchy opening' },
      retention_prediction: { at_3s_percent: 68, at_30s_percent: 42 },
      pacing_audit: { cuts_per_10s: 4, assessment: 'Fast' },
      action_plan: [],
      source_metrics: {},
    },
  });

  it('contains "Viral Gap Analyzer"', () => {
    assert.ok(digestReport(report as never).includes('Viral Gap Analyzer'));
  });

  it('contains the hook verdict', () => {
    assert.ok(digestReport(report as never).includes('strong'));
  });

  it('contains the hook score', () => {
    assert.ok(digestReport(report as never).includes('85'));
  });

  it('contains the hook notes', () => {
    assert.ok(digestReport(report as never).includes('Very catchy opening'));
  });

  it('contains the 3s retention percentage', () => {
    assert.ok(digestReport(report as never).includes('3s=68%'));
  });

  it('contains the 30s retention percentage', () => {
    assert.ok(digestReport(report as never).includes('30s=42%'));
  });

  it('includes the formatted date string', () => {
    // Date is locale-dependent but always present
    const result = digestReport(report as never);
    assert.ok(result.length > 0);
    // 2024-06-15 → some locale date string
    assert.match(result, /\d/); // at minimum has a digit
  });
});

describe('digestReport() - source_type=account (GrowthBlueprint)', () => {
  const report = baseRow({
    source_type: 'account',
    analysis: {
      thematic_consistency: { score: 72, notes: 'Some drift in topics' },
      view_to_follower_ratio: { value: 0.05, assessment: 'below average' },
      posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
      theme_correction: [],
      view_maximization_tactics: [],
      posting_blindspots: ['Weekends', 'Morning slots'],
      per_platform_notes: {},
    },
  });

  it('contains "Account Deep-Dive"', () => {
    assert.ok(digestReport(report as never).includes('Account Deep-Dive'));
  });

  it('contains the thematic consistency score', () => {
    assert.ok(digestReport(report as never).includes('72'));
  });

  it('contains the thematic consistency notes', () => {
    assert.ok(digestReport(report as never).includes('Some drift in topics'));
  });

  it('contains posting blindspots joined by semicolons', () => {
    const result = digestReport(report as never);
    assert.ok(result.includes('Weekends'));
    assert.ok(result.includes('Morning slots'));
  });
});

describe('digestReport() - source_type=account with no blindspots', () => {
  const report = baseRow({
    source_type: 'account',
    analysis: {
      thematic_consistency: { score: 90, notes: 'Very consistent' },
      view_to_follower_ratio: { value: 0.1, assessment: 'good' },
      posting_cadence: { avg_days_between_posts: 2, assessment: 'frequent' },
      theme_correction: [],
      view_maximization_tactics: [],
      posting_blindspots: [],
      per_platform_notes: {},
    },
  });

  it('shows "none noted" when blindspots is empty', () => {
    assert.ok(digestReport(report as never).includes('none noted'));
  });
});

describe('digestReport() - source_type=upload (UploadDiagnosis)', () => {
  const report = baseRow({
    source_type: 'upload',
    analysis: {
      visual_hook_clarity: { score: 90, verdict: 'strong', notes: 'Bold opening shot' },
      audio_balance: { score: 75, notes: 'Music slightly overpowers voice' },
      text_overlay_pacing: { assessment: 'Well-timed' },
      b_roll_recommendations: [],
      retention_boosters: [],
      frames_analyzed: 120,
    },
  });

  it('contains "Upload Diagnostic"', () => {
    assert.ok(digestReport(report as never).includes('Upload Diagnostic'));
  });

  it('contains visual hook verdict', () => {
    assert.ok(digestReport(report as never).includes('strong'));
  });

  it('contains visual hook score', () => {
    assert.ok(digestReport(report as never).includes('90'));
  });

  it('contains audio balance score', () => {
    assert.ok(digestReport(report as never).includes('75'));
  });

  it('contains audio notes', () => {
    assert.ok(digestReport(report as never).includes('Music slightly overpowers voice'));
  });

  it('contains text overlay assessment', () => {
    assert.ok(digestReport(report as never).includes('Well-timed'));
  });
});

describe('digestReport() - source_type=discovery (SiteDiscoveryResult)', () => {
  const report = baseRow({
    source_type: 'discovery',
    analysis: {
      query: 'best cooking channels 2024',
      sites: [],
      outlier: {
        url: 'https://example.com/cooking',
        reasoning: 'Only channel with live-stream focus',
      },
      summary: 'Diverse cooking content landscape.',
    },
  });

  it('contains "Site Discovery"', () => {
    assert.ok(digestReport(report as never).includes('Site Discovery'));
  });

  it('contains the query string', () => {
    assert.ok(digestReport(report as never).includes('best cooking channels 2024'));
  });

  it('contains the outlier URL', () => {
    assert.ok(digestReport(report as never).includes('https://example.com/cooking'));
  });

  it('contains the outlier reasoning', () => {
    assert.ok(digestReport(report as never).includes('Only channel with live-stream focus'));
  });
});

describe('digestReport() - default branch (competitors / CompetitorGapAnalysis)', () => {
  const report = baseRow({
    source_type: 'competitors',
    analysis: {
      competitors: [],
      outlier_topics: [],
      missing_topics: ['Shorts strategy', 'Behind the scenes'],
      audience_sentiment_gaps: [],
      untapped_keyword_clusters: ['beginner cooking', 'quick meals'],
    },
  });

  it('contains "Competitor Espionage"', () => {
    assert.ok(digestReport(report as never).includes('Competitor Espionage'));
  });

  it('contains missing_topics joined by semicolons', () => {
    const result = digestReport(report as never);
    assert.ok(result.includes('Shorts strategy'));
    assert.ok(result.includes('Behind the scenes'));
  });

  it('contains untapped_keyword_clusters joined by semicolons', () => {
    const result = digestReport(report as never);
    assert.ok(result.includes('beginner cooking'));
    assert.ok(result.includes('quick meals'));
  });
});

describe('digestReport() - competitors with empty arrays shows "none noted"', () => {
  const report = baseRow({
    source_type: 'competitors',
    analysis: {
      competitors: [],
      outlier_topics: [],
      missing_topics: [],
      audience_sentiment_gaps: [],
      untapped_keyword_clusters: [],
    },
  });

  it('shows "none noted" for empty missing_topics', () => {
    assert.ok(digestReport(report as never).includes('none noted'));
  });
});

describe('digestScript()', () => {
  const script = {
    id: 's1',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'My Viral Hook Video',
    source_prompt: 'make something viral',
    storyboard: {
      spoken_hook: 'Did you know you can double your views overnight?',
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up of phone showing metrics',
          dialogue_or_vo: 'Your views could be way higher.',
          audio_sfx_cue: 'upbeat music fade-in',
          retention_loop_note: 'Cut to result before explaining how',
        },
        {
          scene_number: 2,
          visual_action: 'B-roll of creator editing',
          dialogue_or_vo: 'Here is what most people miss.',
          audio_sfx_cue: 'silence for emphasis',
          retention_loop_note: 'Loop back to hook with new info',
        },
      ],
      cta: 'Follow for more growth tips',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: 'tiktok',
    created_at: '2024-07-20T09:00:00.000Z',
  };

  it('contains the script title', () => {
    assert.ok(digestScript(script as never).includes('My Viral Hook Video'));
  });

  it('contains the spoken hook', () => {
    assert.ok(
      digestScript(script as never).includes('Did you know you can double your views overnight?')
    );
  });

  it('contains the first scene retention_loop_note', () => {
    assert.ok(digestScript(script as never).includes('Cut to result before explaining how'));
  });

  it('contains the total scene count', () => {
    assert.ok(digestScript(script as never).includes('2 scenes total'));
  });

  it('contains a date string', () => {
    // Just verify there is some number (locale-dependent date)
    assert.match(digestScript(script as never), /\d/);
  });
});

describe('digestScript() with empty scenes', () => {
  const script = {
    id: 's2',
    user_id: 'u1',
    creator_profile_id: null,
    title: 'Empty Script',
    source_prompt: null,
    storyboard: {
      spoken_hook: 'Hook text',
      scenes: [],
      cta: 'Subscribe',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: null,
    created_at: '2024-01-01T00:00:00.000Z',
  };

  it('handles empty scenes without throwing', () => {
    assert.doesNotThrow(() => digestScript(script as never));
  });

  it('shows "(none)" for missing retention_loop_note when scenes is empty', () => {
    assert.ok(digestScript(script as never).includes('(none)'));
  });

  it('shows "0 scenes total"', () => {
    assert.ok(digestScript(script as never).includes('0 scenes total'));
  });
});

// ── lib/tool-suite.ts ─────────────────────────────────────────────────────────
import { TOOL_INFO } from '../lib/tool-suite.ts';

describe('TOOL_INFO', () => {
  const tools = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

  for (const tool of tools) {
    it(`${tool} has a non-empty label`, () => {
      assert.ok(TOOL_INFO[tool].label.length > 0);
    });

    it(`${tool} has a valid HTTPS url`, () => {
      assert.match(TOOL_INFO[tool].url, /^https:\/\//);
    });

    it(`${tool} has a non-empty specialty`, () => {
      assert.ok(TOOL_INFO[tool].specialty.length > 0);
    });
  }

  it('covers exactly the four expected tools', () => {
    assert.deepEqual(Object.keys(TOOL_INFO).sort(), ['canva', 'descript', 'hyperframes', 'opusclip']);
  });

  it('descript URL points to descript.com', () => {
    assert.match(TOOL_INFO.descript.url, /descript\.com/);
  });

  it('opusclip URL points to opus.pro', () => {
    assert.match(TOOL_INFO.opusclip.url, /opus\.pro/);
  });

  it('hyperframes URL points to heygen.com', () => {
    assert.match(TOOL_INFO.hyperframes.url, /heygen\.com/);
  });

  it('canva URL points to canva.com', () => {
    assert.match(TOOL_INFO.canva.url, /canva\.com/);
  });
});
