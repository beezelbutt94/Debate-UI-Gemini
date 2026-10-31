/**
 * Tests for the platform publish functions (Facebook, TikTok, YouTube).
 *
 * `getValidAccessToken` (from lib/publish/tokens) and the underlying fetch
 * calls are both mocked so these tests exercise only the orchestration logic
 * inside each publisher — not the Supabase vault or the real platform APIs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ScheduledPostRow } from '@/lib/types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeResponse(ok: boolean, status: number, body: unknown): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function makePost(overrides: Partial<ScheduledPostRow> = {}): ScheduledPostRow {
  return {
    id: 'post-1',
    user_id: 'user-1',
    platform: 'tiktok',
    publish_at: '2024-08-01T10:00:00Z',
    media_urls: ['https://res.cloudinary.com/demo/video/upload/test.mp4'],
    caption: 'My awesome video',
    status: 'scheduled',
    publish_error: null,
    created_at: '2024-08-01T09:00:00Z',
    updated_at: '2024-08-01T09:00:00Z',
    ...overrides,
  };
}

// ─── Facebook ─────────────────────────────────────────────────────────────────

describe('publishToFacebook', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns externalPostId on full success (3-phase upload)', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'page-token',
        externalAccountId: 'page-123',
      }),
    }));

    vi.stubGlobal('fetch', vi.fn()
      // Phase 1: start → returns video_id
      .mockResolvedValueOnce(makeResponse(true, 200, { video_id: 'vid-abc' }))
      // Phase 2: upload (rupload)
      .mockResolvedValueOnce(makeResponse(true, 200, {}))
      // Phase 3: finish → success
      .mockResolvedValueOnce(makeResponse(true, 200, { success: true }))
    );

    const { publishToFacebook } = await import('@/lib/publish/facebook');
    const result = await publishToFacebook('user-1', makePost({ platform: 'facebook_reels' }));
    expect(result.externalPostId).toBe('vid-abc');
  });

  it('throws when Facebook is not connected (no token)', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue(null),
    }));
    vi.stubGlobal('fetch', vi.fn());

    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('user-1', makePost())).rejects.toThrow('not connected');
  });

  it('throws when externalAccountId (Page id) is missing from token', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'page-token',
        externalAccountId: null, // missing page id
      }),
    }));
    vi.stubGlobal('fetch', vi.fn());

    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('user-1', makePost())).rejects.toThrow('not connected');
  });

  it('throws when there are no media_urls', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'page-token',
        externalAccountId: 'page-123',
      }),
    }));
    vi.stubGlobal('fetch', vi.fn());

    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(
      publishToFacebook('user-1', makePost({ media_urls: [] }))
    ).rejects.toThrow('no media');
  });

  it('throws when start phase returns no video_id', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'page-token',
        externalAccountId: 'page-123',
      }),
    }));

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {})) // no video_id
    );

    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('user-1', makePost())).rejects.toThrow('no video_id');
  });

  it('throws when upload phase fails', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'page-token',
        externalAccountId: 'page-123',
      }),
    }));

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, { video_id: 'vid-abc' })) // start
      .mockResolvedValueOnce(makeResponse(false, 400, {}))                       // upload fails
    );

    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('user-1', makePost())).rejects.toThrow('upload phase failed');
  });

  it('throws when finish phase does not report success', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'page-token',
        externalAccountId: 'page-123',
      }),
    }));

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, { video_id: 'vid-abc' })) // start
      .mockResolvedValueOnce(makeResponse(true, 200, {}))                       // upload ok
      .mockResolvedValueOnce(makeResponse(true, 200, { success: false }))       // finish: no success
    );

    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('user-1', makePost())).rejects.toThrow('did not report success');
  });

  it('uses empty string for caption when caption is null', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'page-token',
        externalAccountId: 'page-123',
      }),
    }));

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, { video_id: 'vid-abc' }))
      .mockResolvedValueOnce(makeResponse(true, 200, {}))
      .mockResolvedValueOnce(makeResponse(true, 200, { success: true }));

    vi.stubGlobal('fetch', mockFetch);

    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await publishToFacebook('user-1', makePost({ caption: null }));

    const finishCallBody = (mockFetch.mock.calls[2][1] as RequestInit).body as URLSearchParams;
    expect(finishCallBody.get('description')).toBe('');
  });
});

// ─── TikTok ──────────────────────────────────────────────────────────────────

describe('publishToTikTok', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns externalPostId (publish_id) on success', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({ accessToken: 'tt-token', externalAccountId: 'tt-user' }),
    }));

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        error: { code: 'ok' },
        data: { publish_id: 'tt-publish-123' },
      }))
    );

    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    const result = await publishToTikTok('user-1', makePost({ platform: 'tiktok' }));
    expect(result.externalPostId).toBe('tt-publish-123');
  });

  it('throws when TikTok is not connected (null token)', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue(null),
    }));
    vi.stubGlobal('fetch', vi.fn());

    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    await expect(publishToTikTok('user-1', makePost())).rejects.toThrow('not connected');
  });

  it('throws when there are no media_urls', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({ accessToken: 'tt-token', externalAccountId: null }),
    }));
    vi.stubGlobal('fetch', vi.fn());

    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    await expect(
      publishToTikTok('user-1', makePost({ media_urls: [] }))
    ).rejects.toThrow('no media');
  });

  it('throws when TikTok API returns a non-ok status', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({ accessToken: 'tt-token', externalAccountId: null }),
    }));

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(false, 400, { error: { code: 'spam_risk', message: 'Spam risk' } }))
    );

    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    await expect(publishToTikTok('user-1', makePost())).rejects.toThrow('TikTok publish init failed');
  });

  it('throws when error code is not "ok" even on 200 response', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({ accessToken: 'tt-token', externalAccountId: null }),
    }));

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        error: { code: 'spam_risk' }, // non-ok error code
        data: {},
      }))
    );

    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    await expect(publishToTikTok('user-1', makePost())).rejects.toThrow('TikTok publish init failed');
  });

  it('throws when response has no publish_id', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({ accessToken: 'tt-token', externalAccountId: null }),
    }));

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        error: { code: 'ok' },
        data: {}, // no publish_id
      }))
    );

    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    await expect(publishToTikTok('user-1', makePost())).rejects.toThrow('no publish_id');
  });

  it('sends caption as title (null caption becomes empty string)', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({ accessToken: 'tt-token', externalAccountId: null }),
    }));

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        error: { code: 'ok' },
        data: { publish_id: 'pub-null-caption' },
      }));

    vi.stubGlobal('fetch', mockFetch);

    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    const result = await publishToTikTok('user-1', makePost({ caption: null }));
    expect(result.externalPostId).toBe('pub-null-caption');

    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody.post_info.title).toBe('');
  });
});

// ─── YouTube ─────────────────────────────────────────────────────────────────

describe('publishToYouTube', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns externalPostId (video id) on full success', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({ accessToken: 'yt-token', externalAccountId: 'UCchan' }),
    }));

    vi.stubGlobal('fetch', vi.fn()
      // Fetch source video from Cloudinary
      .mockResolvedValueOnce({
        ok: true,
        body: 'video-bytes-stream',
        headers: { get: (h: string) => h === 'content-length' ? '1024' : 'video/mp4' },
      } as unknown as Response)
      // Init resumable upload session
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (h: string) => h === 'location' ? 'https://upload.googleapis.com/session/abc' : null },
        text: () => Promise.resolve(''),
      } as unknown as Response)
      // Upload bytes to session URI
      .mockResolvedValueOnce(makeResponse(true, 200, { id: 'yt-video-id-xyz' }))
    );

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    const result = await publishToYouTube('user-1', makePost({ platform: 'youtube_shorts' }));
    expect(result.externalPostId).toBe('yt-video-id-xyz');
  });

  it('throws when YouTube is not connected', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue(null),
    }));
    vi.stubGlobal('fetch', vi.fn());

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('user-1', makePost())).rejects.toThrow('not connected');
  });

  it('throws when there are no media_urls', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({ accessToken: 'yt-token', externalAccountId: null }),
    }));
    vi.stubGlobal('fetch', vi.fn());

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(
      publishToYouTube('user-1', makePost({ media_urls: [] }))
    ).rejects.toThrow('no media');
  });

  it('throws when the Cloudinary source fetch fails', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({ accessToken: 'yt-token', externalAccountId: null }),
    }));

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        body: null,
        headers: { get: () => null },
      } as unknown as Response)
    );

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('user-1', makePost())).rejects.toThrow('Could not fetch the source video');
  });

  it('throws when YouTube init response is not ok', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({ accessToken: 'yt-token', externalAccountId: null }),
    }));

    vi.stubGlobal('fetch', vi.fn()
      // Cloudinary fetch succeeds
      .mockResolvedValueOnce({
        ok: true,
        body: 'stream',
        headers: { get: () => null },
      } as unknown as Response)
      // YouTube init fails
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: { get: () => null },
        text: () => Promise.resolve('Forbidden'),
      } as unknown as Response)
    );

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('user-1', makePost())).rejects.toThrow('upload session init failed');
  });

  it('throws when YouTube does not return a session URI', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({ accessToken: 'yt-token', externalAccountId: null }),
    }));

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        body: 'stream',
        headers: { get: () => null },
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null }, // no location header
        text: () => Promise.resolve(''),
      } as unknown as Response)
    );

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('user-1', makePost())).rejects.toThrow('session URI');
  });

  it('throws when the byte upload to YouTube fails', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({ accessToken: 'yt-token', externalAccountId: null }),
    }));

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        body: 'stream',
        headers: { get: () => null },
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (h: string) => h === 'location' ? 'https://upload.googleapis.com/session/abc' : null },
        text: () => Promise.resolve(''),
      } as unknown as Response)
      // Upload fails
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      } as unknown as Response)
    );

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('user-1', makePost())).rejects.toThrow('video upload failed');
  });

  it('throws when upload succeeds but response has no video id', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({ accessToken: 'yt-token', externalAccountId: null }),
    }));

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        body: 'stream',
        headers: { get: () => null },
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (h: string) => h === 'location' ? 'https://upload.googleapis.com/session/abc' : null },
        text: () => Promise.resolve(''),
      } as unknown as Response)
      .mockResolvedValueOnce(makeResponse(true, 200, {})) // no id
    );

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('user-1', makePost())).rejects.toThrow('no video id');
  });

  it('truncates long captions to 95 chars and appends #Shorts', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({ accessToken: 'yt-token', externalAccountId: null }),
    }));

    const longCaption = 'a'.repeat(200);
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        body: 'stream',
        headers: { get: () => null },
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (h: string) => h === 'location' ? 'https://upload.googleapis.com/session/abc' : null },
        text: () => Promise.resolve(''),
      } as unknown as Response)
      .mockResolvedValueOnce(makeResponse(true, 200, { id: 'video-id' }));

    vi.stubGlobal('fetch', mockFetch);

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await publishToYouTube('user-1', makePost({ caption: longCaption }));

    const initBody = JSON.parse((mockFetch.mock.calls[1][1] as RequestInit).body as string);
    expect(initBody.snippet.title).toHaveLength(95 + ' #Shorts'.length);
    expect(initBody.snippet.title.endsWith('#Shorts')).toBe(true);
  });

  it('uses default title when caption is null', async () => {
    vi.doMock('@/lib/publish/tokens', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue({ accessToken: 'yt-token', externalAccountId: null }),
    }));

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        body: 'stream',
        headers: { get: () => null },
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (h: string) => h === 'location' ? 'https://upload.googleapis.com/session/abc' : null },
        text: () => Promise.resolve(''),
      } as unknown as Response)
      .mockResolvedValueOnce(makeResponse(true, 200, { id: 'video-id' }));

    vi.stubGlobal('fetch', mockFetch);

    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await publishToYouTube('user-1', makePost({ caption: null }));

    const initBody = JSON.parse((mockFetch.mock.calls[1][1] as RequestInit).body as string);
    expect(initBody.snippet.title).toContain('ViralEngine scheduled upload');
    expect(initBody.snippet.title).toContain('#Shorts');
  });
});
