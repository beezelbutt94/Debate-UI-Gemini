/**
 * Comprehensive unit tests for TypeScript utility functions.
 * Run with: node_modules/.bin/sucrase-node tests/unit/ts/run_tests.ts
 *
 * Uses Node.js built-in assert for zero additional dependencies.
 */
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ ${name}\n      ${msg}`);
    failed++;
  }
}

function suite(title: string, fn: () => void): void {
  console.log(`\n${title}`);
  fn();
}

// ---------------------------------------------------------------------------
// lib/utils  --  cn()
// ---------------------------------------------------------------------------
import { cn } from '../../../lib/utils';

suite('cn() – class name joiner', () => {
  test('joins two truthy strings', () => {
    assert.equal(cn('a', 'b'), 'a b');
  });

  test('single class returned unchanged', () => {
    assert.equal(cn('foo'), 'foo');
  });

  test('filters out false', () => {
    assert.equal(cn('a', false, 'b'), 'a b');
  });

  test('filters out null', () => {
    assert.equal(cn('a', null, 'b'), 'a b');
  });

  test('filters out undefined', () => {
    assert.equal(cn('a', undefined, 'b'), 'a b');
  });

  test('all falsy → empty string', () => {
    assert.equal(cn(false, null, undefined), '');
  });

  test('no arguments → empty string', () => {
    assert.equal(cn(), '');
  });

  test('empty string is falsy → filtered out', () => {
    assert.equal(cn('a', '', 'b'), 'a b');
  });

  test('multiple spaces not merged (strings joined with single space)', () => {
    assert.equal(cn('foo', 'bar'), 'foo bar');
  });

  test('preserves class names with hyphens and colons', () => {
    assert.equal(cn('text-sm', 'hover:text-lg'), 'text-sm hover:text-lg');
  });

  test('returns string type', () => {
    assert.equal(typeof cn('x'), 'string');
  });
});

// ---------------------------------------------------------------------------
// lib/platform  --  detectPlatform() and buildAccountProfileUrl()
// ---------------------------------------------------------------------------
import { detectPlatform, buildAccountProfileUrl } from '../../../lib/platform';

suite('detectPlatform()', () => {
  // TikTok
  test('www.tiktok.com URL → tiktok', () => {
    assert.equal(detectPlatform('https://www.tiktok.com/@user/video/123'), 'tiktok');
  });

  test('bare tiktok.com → tiktok', () => {
    assert.equal(detectPlatform('https://tiktok.com/@user'), 'tiktok');
  });

  test('m.tiktok.com (subdomain) → tiktok', () => {
    assert.equal(detectPlatform('https://m.tiktok.com/@user'), 'tiktok');
  });

  // YouTube Shorts
  test('www.youtube.com/shorts/ → youtube_shorts', () => {
    assert.equal(detectPlatform('https://www.youtube.com/shorts/abc123'), 'youtube_shorts');
  });

  test('youtube.com/shorts/ without www → youtube_shorts', () => {
    assert.equal(detectPlatform('https://youtube.com/shorts/xyz'), 'youtube_shorts');
  });

  test('m.youtube.com/shorts/ → youtube_shorts', () => {
    assert.equal(detectPlatform('https://m.youtube.com/shorts/vid'), 'youtube_shorts');
  });

  test('youtu.be URL → youtube_shorts', () => {
    assert.equal(detectPlatform('https://youtu.be/abc123'), 'youtube_shorts');
  });

  test('youtube.com regular video (no /shorts/) → null', () => {
    assert.equal(detectPlatform('https://www.youtube.com/watch?v=abc123'), null);
  });

  // Facebook Reels
  test('facebook.com/reel/ → facebook_reels', () => {
    assert.equal(detectPlatform('https://www.facebook.com/reel/123456'), 'facebook_reels');
  });

  test('bare facebook.com/reel/ → facebook_reels', () => {
    assert.equal(detectPlatform('https://facebook.com/reel/123'), 'facebook_reels');
  });

  test('fb.watch URL → facebook_reels', () => {
    assert.equal(detectPlatform('https://fb.watch/abc'), 'facebook_reels');
  });

  test('facebook.com without /reel/ → null', () => {
    assert.equal(detectPlatform('https://www.facebook.com/video/123'), null);
  });

  // Unknown / invalid
  test('completely unrelated URL → null', () => {
    assert.equal(detectPlatform('https://example.com/video'), null);
  });

  test('empty string → null', () => {
    assert.equal(detectPlatform(''), null);
  });

  test('non-URL string → null', () => {
    assert.equal(detectPlatform('not a url at all'), null);
  });

  test('instagram.com → null (not a supported platform)', () => {
    assert.equal(detectPlatform('https://www.instagram.com/reel/abc'), null);
  });

  test('vimeo.com → null', () => {
    assert.equal(detectPlatform('https://vimeo.com/123456789'), null);
  });
});

suite('buildAccountProfileUrl()', () => {
  // YouTube
  test('youtube with @ handle', () => {
    assert.equal(
      buildAccountProfileUrl('youtube', '@mychannel'),
      'https://www.youtube.com/@mychannel',
    );
  });

  test('youtube without @ handle adds @', () => {
    assert.equal(
      buildAccountProfileUrl('youtube', 'mychannel'),
      'https://www.youtube.com/@mychannel',
    );
  });

  // TikTok
  test('tiktok with @ handle strips leading @ then adds back', () => {
    assert.equal(
      buildAccountProfileUrl('tiktok', '@tiktokuser'),
      'https://www.tiktok.com/@tiktokuser',
    );
  });

  test('tiktok without @ handle adds @', () => {
    assert.equal(
      buildAccountProfileUrl('tiktok', 'tiktokuser'),
      'https://www.tiktok.com/@tiktokuser',
    );
  });

  // Instagram
  test('instagram with @ strips it', () => {
    assert.equal(
      buildAccountProfileUrl('instagram', '@instauser'),
      'https://www.instagram.com/instauser/',
    );
  });

  test('instagram without @ stays as-is', () => {
    assert.equal(
      buildAccountProfileUrl('instagram', 'instauser'),
      'https://www.instagram.com/instauser/',
    );
  });

  test('all URLs start with https://', () => {
    for (const platform of ['youtube', 'tiktok', 'instagram'] as const) {
      const url = buildAccountProfileUrl(platform, 'someuser');
      assert.ok(url.startsWith('https://'), `${platform} URL should use https`);
    }
  });

  test('returns string type', () => {
    assert.equal(typeof buildAccountProfileUrl('youtube', 'chan'), 'string');
  });
});

// ---------------------------------------------------------------------------
// lib/oauth/state  --  generateState, generateCodeVerifier, etc.
// ---------------------------------------------------------------------------
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '../../../lib/oauth/state';

suite('generateState()', () => {
  test('returns a non-empty string', () => {
    assert.ok(generateState().length > 0);
  });

  test('24 random bytes → base64url ~32 chars', () => {
    const state = generateState();
    assert.ok(state.length >= 30 && state.length <= 36);
  });

  test('two calls produce different values', () => {
    assert.notEqual(generateState(), generateState());
  });

  test('result is a string', () => {
    assert.equal(typeof generateState(), 'string');
  });

  test('no + or / (base64url not base64)', () => {
    const state = generateState();
    assert.ok(!state.includes('+') && !state.includes('/'));
  });
});

suite('stateCookieName()', () => {
  test('prefix + platform', () => {
    assert.equal(stateCookieName('youtube'), 'oauth_state_youtube');
  });

  test('tiktok cookie name', () => {
    assert.equal(stateCookieName('tiktok'), 'oauth_state_tiktok');
  });

  test('arbitrary platform string', () => {
    assert.equal(stateCookieName('myplatform'), 'oauth_state_myplatform');
  });
});

suite('generateCodeVerifier()', () => {
  test('returns non-empty string', () => {
    assert.ok(generateCodeVerifier().length > 0);
  });

  test('32 bytes → ~43 base64url chars', () => {
    const verifier = generateCodeVerifier();
    assert.ok(verifier.length >= 40);
  });

  test('two calls produce different values', () => {
    assert.notEqual(generateCodeVerifier(), generateCodeVerifier());
  });

  test('no padding characters (base64url)', () => {
    const verifier = generateCodeVerifier();
    assert.ok(!verifier.includes('='));
  });

  test('no + or / chars', () => {
    const verifier = generateCodeVerifier();
    assert.ok(!verifier.includes('+') && !verifier.includes('/'));
  });
});

suite('codeChallengeFromVerifier()', () => {
  test('returns a base64url-encoded string', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    assert.ok(challenge.length > 0);
    assert.ok(!challenge.includes('+') && !challenge.includes('/') && !challenge.includes('='));
  });

  test('SHA-256 of "abc" matches expected base64url', () => {
    // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2ec73b00361bbef0469348423f656192561
    // base64url of those bytes: ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0
    const challenge = codeChallengeFromVerifier('abc');
    assert.equal(challenge, 'ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0');
  });

  test('same verifier always produces same challenge', () => {
    const v = 'hello-verifier';
    assert.equal(codeChallengeFromVerifier(v), codeChallengeFromVerifier(v));
  });

  test('different verifiers produce different challenges', () => {
    assert.notEqual(
      codeChallengeFromVerifier('verifier-a'),
      codeChallengeFromVerifier('verifier-b'),
    );
  });

  test('challenge length is always 43 chars (SHA-256 → 32 bytes → 43 base64url)', () => {
    assert.equal(codeChallengeFromVerifier('test-verifier').length, 43);
  });
});

suite('codeVerifierCookieName()', () => {
  test('prefix + platform', () => {
    assert.equal(codeVerifierCookieName('canva'), 'oauth_pkce_canva');
  });

  test('youtube cookie name', () => {
    assert.equal(codeVerifierCookieName('youtube'), 'oauth_pkce_youtube');
  });
});

// ---------------------------------------------------------------------------
// lib/tool-suite  --  TOOL_INFO
// ---------------------------------------------------------------------------
import { TOOL_INFO } from '../../../lib/tool-suite';

suite('TOOL_INFO constants', () => {
  const tools = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

  test('all four tools defined', () => {
    for (const t of tools) {
      assert.ok(t in TOOL_INFO, `${t} should be in TOOL_INFO`);
    }
  });

  test('each tool has a label', () => {
    for (const t of tools) {
      assert.ok(TOOL_INFO[t].label.length > 0, `${t} label empty`);
    }
  });

  test('each tool URL starts with https://', () => {
    for (const t of tools) {
      assert.ok(TOOL_INFO[t].url.startsWith('https://'), `${t} URL not https`);
    }
  });

  test('each tool has a specialty string', () => {
    for (const t of tools) {
      assert.ok(TOOL_INFO[t].specialty.length > 0, `${t} specialty empty`);
    }
  });

  test('descript URL correct', () => {
    assert.equal(TOOL_INFO.descript.url, 'https://www.descript.com/');
  });

  test('canva URL correct', () => {
    assert.equal(TOOL_INFO.canva.url, 'https://www.canva.com/');
  });

  test('opusclip URL correct', () => {
    assert.equal(TOOL_INFO.opusclip.url, 'https://www.opus.pro/');
  });

  test('hyperframes URL correct', () => {
    assert.equal(TOOL_INFO.hyperframes.url, 'https://www.heygen.com/');
  });
});

// ---------------------------------------------------------------------------
// lib/digest  --  digestReport() and digestScript()
// ---------------------------------------------------------------------------
import { digestReport, digestScript } from '../../../lib/digest';
import type {
  AuditReportRow,
  ScriptRow,
  ViralGapAnalysis,
  GrowthBlueprint,
  UploadDiagnosis,
  SiteDiscoveryResult,
  CompetitorGapAnalysis,
} from '../../../lib/types';

function makeBaseReport<T>(source_type: AuditReportRow['source_type'], analysis: T): AuditReportRow<T> {
  return {
    id: 'r1',
    user_id: 'u1',
    creator_profile_id: null,
    source_type,
    source_url: null,
    platform: null,
    viral_score: null,
    analysis,
    timeline_recommendations: [],
    created_at: '2025-01-15T00:00:00.000Z',
  };
}

const viralAnalysis: ViralGapAnalysis = {
  pacing_audit: { cuts_per_10s: 5, assessment: 'good' },
  hook_evaluation: { score: 82, verdict: 'strong', notes: 'Gripping opener' },
  retention_prediction: { at_3s_percent: 70, at_30s_percent: 45, meets_3s_benchmark: true, meets_30s_benchmark: true },
  action_plan: ['Add captions'],
  source_metrics: {},
};

const growthAnalysis: GrowthBlueprint = {
  thematic_consistency: { score: 75, notes: 'Needs focus' },
  view_to_follower_ratio: { value: 2.5, assessment: 'solid' },
  posting_cadence: { avg_days_between_posts: 3, assessment: 'consistent' },
  theme_correction: [],
  view_maximization_tactics: [],
  posting_blindspots: ['weekends', 'evenings'],
  per_platform_notes: {},
};

const uploadAnalysis: UploadDiagnosis = {
  visual_hook_clarity: { score: 60, verdict: 'moderate', notes: 'OK opening' },
  audio_balance: { score: 88, notes: 'Balanced mix' },
  text_overlay_pacing: { assessment: 'Too fast' },
  b_roll_recommendations: [],
  retention_boosters: [],
  frames_analyzed: 120,
};

const discoveryAnalysis: SiteDiscoveryResult = {
  query: 'best video hooks',
  sites: [],
  outlier: { url: 'https://outlier.com', reasoning: 'Unique angle' },
  summary: 'Found 0 sites',
};

const competitorAnalysis: CompetitorGapAnalysis = {
  competitors: [],
  outlier_topics: [],
  missing_topics: ['fitness', 'nutrition'],
  audience_sentiment_gaps: [],
  untapped_keyword_clusters: ['metabolism', 'fat loss'],
};

suite('digestReport()', () => {
  test('url source_type returns viral gap info', () => {
    const result = digestReport(makeBaseReport('url', viralAnalysis));
    assert.ok(result.includes('Viral Gap Analyzer'));
    assert.ok(result.includes('82/100'));
    assert.ok(result.includes('strong'));
  });

  test('url includes 3s and 30s retention percentages', () => {
    const result = digestReport(makeBaseReport('url', viralAnalysis));
    assert.ok(result.includes('3s=70%'));
    assert.ok(result.includes('30s=45%'));
  });

  test('account source_type returns deep-dive info', () => {
    const result = digestReport(makeBaseReport('account', growthAnalysis));
    assert.ok(result.includes('Account Deep-Dive'));
    assert.ok(result.includes('75/100'));
  });

  test('account includes posting blindspots', () => {
    const result = digestReport(makeBaseReport('account', growthAnalysis));
    assert.ok(result.includes('weekends'));
    assert.ok(result.includes('evenings'));
  });

  test('account with empty blindspots shows "none noted"', () => {
    const a = { ...growthAnalysis, posting_blindspots: [] };
    const result = digestReport(makeBaseReport('account', a));
    assert.ok(result.includes('none noted'));
  });

  test('upload source_type returns diagnostic info', () => {
    const result = digestReport(makeBaseReport('upload', uploadAnalysis));
    assert.ok(result.includes('Upload Diagnostic'));
    assert.ok(result.includes('moderate'));
  });

  test('upload includes audio balance score', () => {
    const result = digestReport(makeBaseReport('upload', uploadAnalysis));
    assert.ok(result.includes('88/100'));
  });

  test('upload includes text overlay pacing assessment', () => {
    const result = digestReport(makeBaseReport('upload', uploadAnalysis));
    assert.ok(result.includes('Too fast'));
  });

  test('discovery source_type returns site discovery info', () => {
    const result = digestReport(makeBaseReport('discovery', discoveryAnalysis));
    assert.ok(result.includes('Site Discovery'));
    assert.ok(result.includes('best video hooks'));
  });

  test('discovery includes outlier URL', () => {
    const result = digestReport(makeBaseReport('discovery', discoveryAnalysis));
    assert.ok(result.includes('https://outlier.com'));
  });

  test('competitors source_type returns competitor espionage info', () => {
    const result = digestReport(makeBaseReport('competitors', competitorAnalysis));
    assert.ok(result.includes('Competitor Espionage'));
  });

  test('competitors includes missing topics', () => {
    const result = digestReport(makeBaseReport('competitors', competitorAnalysis));
    assert.ok(result.includes('fitness'));
    assert.ok(result.includes('nutrition'));
  });

  test('competitors includes untapped keyword clusters', () => {
    const result = digestReport(makeBaseReport('competitors', competitorAnalysis));
    assert.ok(result.includes('metabolism'));
  });

  test('competitors with empty topics shows "none noted"', () => {
    const a = { ...competitorAnalysis, missing_topics: [], untapped_keyword_clusters: [] };
    const result = digestReport(makeBaseReport('competitors', a));
    assert.ok(result.includes('none noted'));
  });

  test('includes date from created_at', () => {
    const result = digestReport(makeBaseReport('url', viralAnalysis));
    // Date is locale-formatted but should contain some year digits
    assert.ok(/\d{4}/.test(result) || /\d+\/\d+\/\d+/.test(result));
  });

  test('returns string', () => {
    assert.equal(typeof digestReport(makeBaseReport('url', viralAnalysis)), 'string');
  });
});

const sampleScript: ScriptRow = {
  id: 's1',
  user_id: 'u1',
  creator_profile_id: null,
  title: 'My Viral Video',
  source_prompt: null,
  storyboard: {
    spoken_hook: 'Nobody does this trick',
    scenes: [
      {
        scene_number: 1,
        visual_action: 'Zoom in on face',
        dialogue_or_vo: 'Wait for this',
        audio_sfx_cue: 'whoosh',
        retention_loop_note: 'Cliffhanger at end of scene',
      },
      {
        scene_number: 2,
        visual_action: 'Pan out',
        dialogue_or_vo: 'Here it is',
        audio_sfx_cue: 'ding',
        retention_loop_note: 'Resolution',
      },
    ],
    cta: 'Follow for more',
    memory_context_used: false,
  },
  tone_parameters: {},
  target_platform: 'tiktok',
  created_at: '2025-03-20T00:00:00.000Z',
};

suite('digestScript()', () => {
  test('includes title', () => {
    const result = digestScript(sampleScript);
    assert.ok(result.includes('My Viral Video'));
  });

  test('includes spoken hook', () => {
    const result = digestScript(sampleScript);
    assert.ok(result.includes('Nobody does this trick'));
  });

  test('includes first scene retention note', () => {
    const result = digestScript(sampleScript);
    assert.ok(result.includes('Cliffhanger at end of scene'));
  });

  test('includes total scene count', () => {
    const result = digestScript(sampleScript);
    assert.ok(result.includes('2 scenes total'));
  });

  test('empty scenes shows (none) for retention note', () => {
    const s = {
      ...sampleScript,
      storyboard: { ...sampleScript.storyboard, scenes: [] },
    };
    const result = digestScript(s);
    assert.ok(result.includes('(none)'));
    assert.ok(result.includes('0 scenes total'));
  });

  test('returns string', () => {
    assert.equal(typeof digestScript(sampleScript), 'string');
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const total = passed + failed;
const pct = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed}/${total} passed (${pct}%)`);

if (failed > 0) {
  console.error(`\n${failed} test(s) FAILED`);
  process.exit(1);
}
