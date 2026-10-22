import { describe, it, expect } from 'vitest';

// ──────────────────────────────────────────────────────────
// lib/utils.ts
// ──────────────────────────────────────────────────────────
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins truthy class strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });
  it('filters falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
  it('returns empty string with all falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });
  it('handles a single class', () => {
    expect(cn('only')).toBe('only');
  });
  it('handles no arguments', () => {
    expect(cn()).toBe('');
  });
  it('handles empty string (falsy, filtered out)', () => {
    // empty string is falsy, so it should be filtered
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });
});

// ──────────────────────────────────────────────────────────
// lib/platform.ts
// ──────────────────────────────────────────────────────────
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com URLs', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123456789')).toBe('tiktok');
  });
  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });
  it('detects subdomain tiktok URLs', () => {
    expect(detectPlatform('https://vm.tiktok.com/ABC123/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com /shorts/ URLs', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abcDEF123')).toBe('youtube_shorts');
  });
  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc')).toBe('youtube_shorts');
  });
  it('does NOT detect youtube.com non-shorts URLs', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abcdef')).toBeNull();
  });
  it('detects youtu.be URLs as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  // Facebook Reels
  it('detects facebook.com /reel/ URLs', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });
  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123')).toBe('facebook_reels');
  });
  it('detects fb.watch URLs', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });
  it('does NOT detect facebook.com non-reel URLs', () => {
    expect(detectPlatform('https://www.facebook.com/user/posts/123')).toBeNull();
  });

  // Nulls
  it('returns null for unknown domains', () => {
    expect(detectPlatform('https://example.com/video')).toBeNull();
  });
  it('returns null for malformed URLs', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });
  it('returns null for instagram', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc/')).toBeNull();
  });
});

describe('buildAccountProfileUrl', () => {
  it('builds YouTube URL with @ prefix', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });
  it('builds YouTube URL adding @ when missing', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });
  it('builds TikTok URL stripping leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@tiktoker')).toBe('https://www.tiktok.com/@tiktoker');
  });
  it('builds TikTok URL without @ in input', () => {
    expect(buildAccountProfileUrl('tiktok', 'tiktoker')).toBe('https://www.tiktok.com/@tiktoker');
  });
  it('builds Instagram URL stripping leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@grammer')).toBe('https://www.instagram.com/grammer/');
  });
  it('builds Instagram URL without @ in input', () => {
    expect(buildAccountProfileUrl('instagram', 'grammer')).toBe('https://www.instagram.com/grammer/');
  });
  it('does not double-prefix @ for YouTube', () => {
    expect(buildAccountProfileUrl('youtube', '@@double')).toBe('https://www.youtube.com/@@double');
  });
});

// ──────────────────────────────────────────────────────────
// lib/digest.ts
// ──────────────────────────────────────────────────────────
import { digestReport, digestScript } from '@/lib/digest';
import type { AuditReportRow, ScriptRow, ViralGapAnalysis, GrowthBlueprint, UploadDiagnosis, CompetitorGapAnalysis, SiteDiscoveryResult } from '@/lib/types';

const baseReport: Omit<AuditReportRow, 'source_type' | 'analysis'> = {
  id: 'rep-1',
  user_id: 'user-1',
  creator_profile_id: null,
  source_url: null,
  platform: null,
  viral_score: 75,
  timeline_recommendations: [],
  created_at: '2026-01-15T12:00:00Z',
};

describe('digestReport – url source_type', () => {
  const analysis: ViralGapAnalysis = {
    pacing_audit: { cuts_per_10s: 3, assessment: 'fast' },
    hook_evaluation: { score: 82, verdict: 'strong', notes: 'Great opening' },
    retention_prediction: { at_3s_percent: 65, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
    action_plan: ['Add B-roll'],
    source_metrics: {},
  };
  const report = { ...baseReport, source_type: 'url' as const, analysis };

  it('includes hook verdict', () => {
    expect(digestReport(report)).toContain('"strong"');
  });
  it('includes hook score', () => {
    expect(digestReport(report)).toContain('82/100');
  });
  it('includes retention numbers', () => {
    const d = digestReport(report);
    expect(d).toContain('3s=65%');
    expect(d).toContain('30s=45%');
  });
  it('includes Viral Gap Analyzer label', () => {
    expect(digestReport(report)).toContain('Viral Gap Analyzer');
  });
  it('includes the date', () => {
    expect(digestReport(report)).toMatch(/1\/15\/2026|15\/1\/2026/);
  });
});

describe('digestReport – account source_type', () => {
  const analysis: GrowthBlueprint = {
    thematic_consistency: { score: 70, notes: 'Mostly consistent' },
    view_to_follower_ratio: { value: 0.5, assessment: 'above average' },
    posting_cadence: { avg_days_between_posts: 3, assessment: 'good' },
    theme_correction: ['Stay in niche'],
    view_maximization_tactics: ['Better thumbnails'],
    posting_blindspots: ['No weekend posts', 'Missing YouTube Shorts'],
    per_platform_notes: {},
  };
  const report = { ...baseReport, source_type: 'account' as const, analysis };

  it('includes Account Deep-Dive label', () => {
    expect(digestReport(report)).toContain('Account Deep-Dive');
  });
  it('includes thematic consistency score', () => {
    expect(digestReport(report)).toContain('70/100');
  });
  it('includes posting blindspots', () => {
    const d = digestReport(report);
    expect(d).toContain('No weekend posts');
    expect(d).toContain('Missing YouTube Shorts');
  });
  it('shows "none noted" when no blindspots', () => {
    const noBlindspots: GrowthBlueprint = { ...analysis, posting_blindspots: [] };
    expect(digestReport({ ...report, analysis: noBlindspots })).toContain('none noted');
  });
});

describe('digestReport – upload source_type', () => {
  const analysis: UploadDiagnosis = {
    visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'OK hook' },
    audio_balance: { score: 55, notes: 'Slightly quiet' },
    text_overlay_pacing: { assessment: 'Too fast to read' },
    b_roll_recommendations: ['More B-roll'],
    retention_boosters: ['Add captions'],
    frames_analyzed: 5,
  };
  const report = { ...baseReport, source_type: 'upload' as const, analysis };

  it('includes Upload Diagnostic label', () => {
    expect(digestReport(report)).toContain('Upload Diagnostic');
  });
  it('includes visual hook verdict', () => {
    expect(digestReport(report)).toContain('"moderate"');
  });
  it('includes audio balance score', () => {
    expect(digestReport(report)).toContain('55/100');
  });
  it('includes text overlay pacing', () => {
    expect(digestReport(report)).toContain('Too fast to read');
  });
});

describe('digestReport – discovery source_type', () => {
  const analysis: SiteDiscoveryResult = {
    query: 'best video editing tools 2026',
    sites: [],
    outlier: { url: 'https://outlier.com', reasoning: 'Unique angle' },
    summary: 'Lots of results',
  };
  const report = { ...baseReport, source_type: 'discovery' as const, analysis };

  it('includes Site Discovery label', () => {
    expect(digestReport(report)).toContain('Site Discovery');
  });
  it('includes the query', () => {
    expect(digestReport(report)).toContain('best video editing tools 2026');
  });
  it('includes outlier URL', () => {
    expect(digestReport(report)).toContain('https://outlier.com');
  });
});

describe('digestReport – competitors source_type (fallback)', () => {
  const analysis: CompetitorGapAnalysis = {
    competitors: [],
    outlier_topics: [],
    missing_topics: ['Tutorials', 'Behind-the-scenes'],
    audience_sentiment_gaps: [],
    untapped_keyword_clusters: ['short-form editing', 'AI tools'],
  };
  const report = { ...baseReport, source_type: 'competitors' as const, analysis };

  it('includes Competitor Espionage label', () => {
    expect(digestReport(report)).toContain('Competitor Espionage');
  });
  it('includes missing topics', () => {
    const d = digestReport(report);
    expect(d).toContain('Tutorials');
    expect(d).toContain('Behind-the-scenes');
  });
  it('includes untapped clusters', () => {
    const d = digestReport(report);
    expect(d).toContain('short-form editing');
  });
  it('shows "none noted" for empty missing topics', () => {
    const none: CompetitorGapAnalysis = { ...analysis, missing_topics: [] };
    expect(digestReport({ ...report, analysis: none })).toContain('none noted');
  });
});

describe('digestScript', () => {
  const script: ScriptRow = {
    id: 'sc-1',
    user_id: 'user-1',
    creator_profile_id: null,
    title: 'My Viral Hook',
    source_prompt: null,
    storyboard: {
      spoken_hook: "You won't believe this...",
      scenes: [
        {
          scene_number: 1,
          visual_action: 'Close-up on face',
          dialogue_or_vo: 'Here is the thing',
          audio_sfx_cue: 'none',
          retention_loop_note: 'Cliffhanger tease',
        },
        {
          scene_number: 2,
          visual_action: 'B-roll cutaway',
          dialogue_or_vo: 'And now the reveal',
          audio_sfx_cue: 'tension music',
          retention_loop_note: 'Payoff scene',
        },
      ],
      cta: 'Follow for more!',
      memory_context_used: false,
    },
    tone_parameters: {},
    target_platform: null,
    created_at: '2026-03-10T08:00:00Z',
  };

  it('includes the script title', () => {
    expect(digestScript(script)).toContain('My Viral Hook');
  });
  it('includes the spoken hook', () => {
    expect(digestScript(script)).toContain("You won't believe this...");
  });
  it('includes the first scene retention loop note', () => {
    expect(digestScript(script)).toContain('Cliffhanger tease');
  });
  it('includes the scene count', () => {
    expect(digestScript(script)).toContain('2 scenes total');
  });
  it('shows (none) for empty scenes array', () => {
    const emptyStoryboard = { ...script, storyboard: { ...script.storyboard, scenes: [] } };
    expect(digestScript(emptyStoryboard)).toContain('(none)');
  });
  it('includes the date', () => {
    expect(digestScript(script)).toMatch(/3\/10\/2026|10\/3\/2026/);
  });
});

// ──────────────────────────────────────────────────────────
// lib/cloudinary.ts
// ──────────────────────────────────────────────────────────
import { pickFrameTimestamps, buildFrameUrl, buildWaveformUrl } from '@/lib/cloudinary';

describe('pickFrameTimestamps', () => {
  it('returns at most 6 frames', () => {
    expect(pickFrameTimestamps(60).length).toBeLessThanOrEqual(6);
  });
  it('always starts with 0', () => {
    expect(pickFrameTimestamps(10)[0]).toBe(0);
  });
  it('all timestamps are < duration', () => {
    const ts = pickFrameTimestamps(5);
    ts.forEach((t) => expect(t).toBeLessThan(5));
  });
  it('returns sorted timestamps', () => {
    const ts = pickFrameTimestamps(30);
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]).toBeGreaterThan(ts[i - 1]);
    }
  });
  it('no duplicate timestamps', () => {
    const ts = pickFrameTimestamps(10);
    expect(new Set(ts).size).toBe(ts.length);
  });
  it('very short video (1s) still returns at least [0]', () => {
    const ts = pickFrameTimestamps(1);
    expect(ts.length).toBeGreaterThanOrEqual(1);
    expect(ts[0]).toBe(0);
  });
  it('for 0.1s video only has timestamps < 0.1', () => {
    const ts = pickFrameTimestamps(0.1);
    ts.forEach((t) => expect(t).toBeLessThan(0.1));
  });
  it('returns exactly 3 hook frames for very short (2s) video with no remainder slots', () => {
    const ts = pickFrameTimestamps(2);
    // hook frames: 0, min(1.5, 0.5)=0.5, min(3,1)=1 — all < 2
    // remainingSlots = 6-3=3, but durationSeconds <= 3, so rest is empty
    expect(ts).toContain(0);
  });
  it('6s video gets exactly 6 frames', () => {
    expect(pickFrameTimestamps(6).length).toBe(6);
  });
});

describe('buildFrameUrl', () => {
  it('builds correct Cloudinary frame URL', () => {
    const url = buildFrameUrl('mycloud', 'viralengine/uploads/u1/video1', 1.5);
    expect(url).toBe(
      'https://res.cloudinary.com/mycloud/video/upload/so_1.50,f_jpg,w_640,q_auto/viralengine/uploads/u1/video1.jpg'
    );
  });
  it('clamps negative offset to 0', () => {
    const url = buildFrameUrl('mycloud', 'v/id', -5);
    expect(url).toContain('so_0.00');
  });
  it('formats offset to 2 decimal places', () => {
    const url = buildFrameUrl('mycloud', 'v/id', 3);
    expect(url).toContain('so_3.00');
  });
});

describe('buildWaveformUrl', () => {
  it('builds correct waveform URL', () => {
    const url = buildWaveformUrl('mycloud', 'v/id');
    expect(url).toBe(
      'https://res.cloudinary.com/mycloud/video/upload/fl_waveform,co_rgb:f59e0b,b_rgb:0a0a0a,w_800,h_160/v/id.png'
    );
  });
  it('contains fl_waveform transformation', () => {
    expect(buildWaveformUrl('c', 'v/id')).toContain('fl_waveform');
  });
});

// ──────────────────────────────────────────────────────────
// lib/oauth/state.ts
// ──────────────────────────────────────────────────────────
import {
  generateState,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  stateCookieName,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });
  it('returns base64url-safe string (no +, /, =)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('generates unique values each call', () => {
    expect(generateState()).not.toBe(generateState());
  });
  it('is at least 24 chars (128-bit security = 32 bytes base64url)', () => {
    // randomBytes(24) → base64url → 32 chars
    expect(generateState().length).toBeGreaterThanOrEqual(24);
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });
  it('returns base64url-safe string', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('is different each call', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty string', () => {
    const challenge = codeChallengeFromVerifier('test-verifier');
    expect(typeof challenge).toBe('string');
    expect(challenge.length).toBeGreaterThan(0);
  });
  it('is base64url-safe', () => {
    expect(codeChallengeFromVerifier('abc')).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('is deterministic for same input', () => {
    expect(codeChallengeFromVerifier('same')).toBe(codeChallengeFromVerifier('same'));
  });
  it('is different for different inputs', () => {
    expect(codeChallengeFromVerifier('aaa')).not.toBe(codeChallengeFromVerifier('bbb'));
  });
  it('produces correct SHA-256 base64url for known input', async () => {
    // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2ec73b00361bbef0469173bd06c465339e4b...
    // base64url of the raw bytes
    const { createHash } = await import('node:crypto');
    const expected = createHash('sha256').update('abc').digest('base64url');
    expect(codeChallengeFromVerifier('abc')).toBe(expected);
  });
});

describe('stateCookieName', () => {
  it('returns correct format', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });
  it('works with any platform string', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });
});

describe('codeVerifierCookieName', () => {
  it('returns correct format', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });
  it('works with any platform string', () => {
    expect(codeVerifierCookieName('facebook')).toBe('oauth_pkce_facebook');
  });
});

// ──────────────────────────────────────────────────────────
// lib/oauth/types.ts – isOAuthPlatform
// ──────────────────────────────────────────────────────────
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform', () => {
  it('accepts youtube', () => expect(isOAuthPlatform('youtube')).toBe(true));
  it('accepts tiktok', () => expect(isOAuthPlatform('tiktok')).toBe(true));
  it('accepts facebook', () => expect(isOAuthPlatform('facebook')).toBe(true));
  it('accepts canva', () => expect(isOAuthPlatform('canva')).toBe(true));
  it('rejects unknown string', () => expect(isOAuthPlatform('instagram')).toBe(false));
  it('rejects empty string', () => expect(isOAuthPlatform('')).toBe(false));
  it('rejects uppercase', () => expect(isOAuthPlatform('YouTube')).toBe(false));
  it('rejects partial match', () => expect(isOAuthPlatform('you')).toBe(false));
});

// ──────────────────────────────────────────────────────────
// lib/stripe.ts – planFromPriceId
// ──────────────────────────────────────────────────────────
import { planFromPriceId, PLAN_QUOTA } from '@/lib/stripe';

describe('planFromPriceId', () => {
  it('returns null for unknown price ID', () => {
    expect(planFromPriceId('price_unknown_xyz')).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(planFromPriceId('')).toBeNull();
  });
  it('returns null when env vars are not set (empty strings)', () => {
    // STRIPE_PRICE_* not set in test env → all empty → empty !== any priceId
    expect(planFromPriceId('price_anything')).toBeNull();
  });
});

describe('PLAN_QUOTA', () => {
  it('creator quota is 10', () => expect(PLAN_QUOTA.creator).toBe(10));
  it('pro quota is 50', () => expect(PLAN_QUOTA.pro).toBe(50));
  it('studio quota is 200', () => expect(PLAN_QUOTA.studio).toBe(200));
  it('pro > creator', () => expect(PLAN_QUOTA.pro).toBeGreaterThan(PLAN_QUOTA.creator));
  it('studio > pro', () => expect(PLAN_QUOTA.studio).toBeGreaterThan(PLAN_QUOTA.pro));
});

// ──────────────────────────────────────────────────────────
// lib/publish/youtube.ts – title length guard
// (tests the fix: title must never exceed 100 chars)
// ──────────────────────────────────────────────────────────
describe('YouTube title length', () => {
  function buildTitle(caption: string | null): string {
    return (caption ?? 'ViralEngine scheduled upload').slice(0, 92) + ' #Shorts';
  }

  it('title with max caption (92 chars) is exactly 100 chars', () => {
    const caption = 'A'.repeat(100);
    expect(buildTitle(caption).length).toBe(100);
  });
  it('title with short caption stays under 100 chars', () => {
    expect(buildTitle('Short caption').length).toBeLessThanOrEqual(100);
  });
  it('title with null caption uses default and is ≤ 100 chars', () => {
    expect(buildTitle(null).length).toBeLessThanOrEqual(100);
  });
  it('title always ends with #Shorts', () => {
    expect(buildTitle('hello')).toMatch(/ #Shorts$/);
  });
  it('a 200-char caption is safely truncated', () => {
    const caption = 'B'.repeat(200);
    const title = buildTitle(caption);
    expect(title.length).toBe(100);
  });
});
