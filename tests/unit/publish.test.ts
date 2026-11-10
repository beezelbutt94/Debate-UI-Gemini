/**
 * Tests for all four publish helpers and the token-management layer.
 * Network calls are mocked via vi.stubGlobal('fetch', ...).
 * getValidAccessToken is vi.mock'd for the platform-specific publish tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── helpers ───────────────────────────────────────────────────────────────────

function mockOk(body: unknown, headers: Record<string, string> = {}) {
  const headerMap = new Map(Object.entries(headers));
  return {
    ok: true,
    status: 200,
    headers: { get: (k: string) => headerMap.get(k) ?? null },
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    body: 'stream',
  };
}

function mockFail(status: number, body: unknown = {}) {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(String(status)),
    body: null,
  };
}

function makePost(overrides: Partial<import('@/lib/types').ScheduledPostRow> = {}): import('@/lib/types').ScheduledPostRow {
  return {
    id: 'post1',
    user_id: 'u1',
    platform: 'tiktok',
    publish_at: '2024-01-01T00:00:00Z',
    media_urls: ['https://res.cloudinary.com/demo/video/upload/test.mp4'],
    caption: 'Test caption',
    status: 'scheduled',
    publish_error: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── lib/publish/tiktok.ts ─────────────────────────────────────────────────────

vi.mock('@/lib/publish/tokens', () => ({
  getValidAccessToken: vi.fn(),
}));

describe('publishToTikTok()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns externalPostId on success', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'tt-at',
      externalAccountId: 'tt-uid',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockOk({
      error: { code: 'ok' },
      data: { publish_id: 'pub123' },
    })));

    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    const result = await publishToTikTok('u1', makePost({ platform: 'tiktok' }));
    expect(result.externalPostId).toBe('pub123');
  });

  it('throws when TikTok is not connected', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue(null);

    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    await expect(publishToTikTok('u1', makePost())).rejects.toThrow('not connected');
  });

  it('throws when post has no media', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'at',
      externalAccountId: null,
    });

    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    await expect(
      publishToTikTok('u1', makePost({ media_urls: [] }))
    ).rejects.toThrow('no media');
  });

  it('throws when API returns error code', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'tt-at',
      externalAccountId: 'uid',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockFail(400, { error: { code: 'invalid_request' } })));

    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    await expect(publishToTikTok('u1', makePost())).rejects.toThrow('TikTok publish init failed');
  });

  it('throws when publish_id is missing', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'tt-at',
      externalAccountId: 'uid',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockOk({
      error: { code: 'ok' },
      data: {}, // no publish_id
    })));

    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    await expect(publishToTikTok('u1', makePost())).rejects.toThrow('no publish_id');
  });
});

// ── lib/publish/facebook.ts ───────────────────────────────────────────────────

describe('publishToFacebook()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns externalPostId on success', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'page-at',
      externalAccountId: 'page1',
    });
    vi.stubGlobal('fetch', vi.fn()
      // start phase
      .mockResolvedValueOnce(mockOk({ video_id: 'vid123' }))
      // upload phase
      .mockResolvedValueOnce(mockOk({ success: true }))
      // finish phase
      .mockResolvedValueOnce(mockOk({ success: true }))
    );

    const { publishToFacebook } = await import('@/lib/publish/facebook');
    const result = await publishToFacebook('u1', makePost({ platform: 'facebook_reels' }));
    expect(result.externalPostId).toBe('vid123');
  });

  it('throws when Facebook is not connected (null token)', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue(null);

    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('u1', makePost())).rejects.toThrow('not connected');
  });

  it('throws when externalAccountId is missing (no Page)', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'at',
      externalAccountId: null,
    });

    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('u1', makePost())).rejects.toThrow('not connected');
  });

  it('throws when post has no media', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'at',
      externalAccountId: 'page1',
    });

    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(
      publishToFacebook('u1', makePost({ media_urls: [] }))
    ).rejects.toThrow('no media');
  });

  it('throws when start phase fails with no video_id', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'page-at',
      externalAccountId: 'page1',
    });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({})) // no video_id
    );

    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('u1', makePost())).rejects.toThrow('no video_id');
  });

  it('throws when upload phase returns non-OK', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'page-at',
      externalAccountId: 'page1',
    });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({ video_id: 'vid123' }))
      .mockResolvedValueOnce(mockFail(500))
    );

    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('u1', makePost())).rejects.toThrow('upload phase failed');
  });

  it('throws when finish phase reports no success', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'page-at',
      externalAccountId: 'page1',
    });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({ video_id: 'vid123' }))
      .mockResolvedValueOnce(mockOk({ success: true }))
      .mockResolvedValueOnce(mockOk({ success: false }))
    );

    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('u1', makePost())).rejects.toThrow('finish phase');
  });

  it('throws when postForm receives a Graph API error', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'page-at',
      externalAccountId: 'page1',
    });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockFail(400, { error: { message: 'Invalid token' } }))
    );

    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('u1', makePost())).rejects.toThrow('Facebook Graph API call');
  });
});

// ── lib/publish/youtube.ts ────────────────────────────────────────────────────

describe('publishToYouTube()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns externalPostId on success', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'yt-at',
      externalAccountId: 'ch1',
    });
    vi.stubGlobal('fetch', vi.fn()
      // source video fetch from Cloudinary
      .mockResolvedValueOnce(mockOk({}, { 'content-type': 'video/mp4', 'content-length': '1024' }))
      // upload init
      .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: (k: string) => k === 'location' ? 'https://uploaduri' : null }, text: vi.fn() })
      // upload bytes
      .mockResolvedValueOnce(mockOk({ id: 'yt-vid-id' }))
    );

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    const result = await publishToYouTube('u1', makePost({ platform: 'youtube_shorts' }));
    expect(result.externalPostId).toBe('yt-vid-id');
  });

  it('throws when YouTube is not connected', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue(null);

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('u1', makePost())).rejects.toThrow('not connected');
  });

  it('throws when post has no media', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'yt-at',
      externalAccountId: 'ch1',
    });

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('u1', makePost({ media_urls: [] }))).rejects.toThrow('no media');
  });

  it('throws when source video fetch fails', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'yt-at',
      externalAccountId: 'ch1',
    });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockFail(404))
    );

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('u1', makePost())).rejects.toThrow('Could not fetch');
  });

  it('throws when upload session init fails', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'yt-at',
      externalAccountId: 'ch1',
    });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({}, {}))
      .mockResolvedValueOnce({ ok: false, status: 403, headers: { get: () => null }, text: vi.fn().mockResolvedValue('Forbidden') })
    );

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('u1', makePost())).rejects.toThrow('upload session init failed');
  });

  it('throws when no session URI returned', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'yt-at',
      externalAccountId: 'ch1',
    });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({}, {}))
      .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => null }, text: vi.fn() }) // no location header
    );

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('u1', makePost())).rejects.toThrow('session URI');
  });

  it('throws when upload bytes fails', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'yt-at',
      externalAccountId: 'ch1',
    });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({}, {}))
      .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: (k: string) => k === 'location' ? 'https://upload' : null }, text: vi.fn() })
      .mockResolvedValueOnce({ ok: false, status: 500, text: vi.fn().mockResolvedValue('Server error') })
    );

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('u1', makePost())).rejects.toThrow('video upload failed');
  });

  it('throws when upload succeeds but returns no video id', async () => {
    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: 'yt-at',
      externalAccountId: 'ch1',
    });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({}, {}))
      .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: (k: string) => k === 'location' ? 'https://upload' : null }, text: vi.fn() })
      .mockResolvedValueOnce(mockOk({})) // no id
    );

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('u1', makePost())).rejects.toThrow('no video id');
  });
});

