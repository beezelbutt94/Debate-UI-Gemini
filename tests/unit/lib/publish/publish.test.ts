import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ScheduledPostRow } from '@/lib/types';

// Mock the tokens module so tests don't hit Supabase
vi.mock('@/lib/publish/tokens', () => ({
  getValidAccessToken: vi.fn(),
}));

import { getValidAccessToken } from '@/lib/publish/tokens';
import { publishToTikTok } from '@/lib/publish/tiktok';
import { publishToFacebook } from '@/lib/publish/facebook';
import { publishToYouTube } from '@/lib/publish/youtube';

const mockGetValidAccessToken = vi.mocked(getValidAccessToken);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

function makePost(overrides: Partial<ScheduledPostRow> = {}): ScheduledPostRow {
  return {
    id: 'post-1',
    user_id: 'user-1',
    platform: 'tiktok',
    publish_at: new Date().toISOString(),
    media_urls: ['https://res.cloudinary.com/demo/video/sample.mp4'],
    caption: 'My caption',
    status: 'scheduled',
    publish_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─────────────────────────── TikTok ───────────────────────────────────

describe('publishToTikTok', () => {
  it('throws when no TikTok connection', async () => {
    mockGetValidAccessToken.mockResolvedValue(null);
    await expect(publishToTikTok('user-1', makePost())).rejects.toThrow('TikTok is not connected');
  });

  it('throws when no media_urls on the post', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'at', externalAccountId: null });
    await expect(publishToTikTok('user-1', makePost({ media_urls: [] }))).rejects.toThrow('no media');
  });

  it('returns externalPostId on success', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'tt-at', externalAccountId: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ data: { publish_id: 'pub-123' }, error: { code: 'ok' } }),
      text: () => Promise.resolve(''),
    }));
    const result = await publishToTikTok('user-1', makePost());
    expect(result.externalPostId).toBe('pub-123');
  });

  it('throws when TikTok init fails (error code not ok)', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'tt-at', externalAccountId: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 400,
      json: () => Promise.resolve({ error: { code: 'invalid_param', message: 'bad' } }),
      text: () => Promise.resolve(''),
    }));
    await expect(publishToTikTok('user-1', makePost())).rejects.toThrow('TikTok publish init failed');
  });

  it('throws when publish_id is missing from response', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'tt-at', externalAccountId: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ data: {}, error: { code: 'ok' } }),
      text: () => Promise.resolve(''),
    }));
    await expect(publishToTikTok('user-1', makePost())).rejects.toThrow('no publish_id');
  });

  it('uses first media_url from the post', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'tt-at', externalAccountId: null });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ data: { publish_id: 'pub-456' }, error: { code: 'ok' } }),
      text: () => Promise.resolve(''),
    });
    vi.stubGlobal('fetch', fetchMock);
    await publishToTikTok('user-1', makePost({ media_urls: ['https://first.mp4', 'https://second.mp4'] }));
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.source_info.video_url).toBe('https://first.mp4');
  });

  it('sends empty caption when post has no caption', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'tt-at', externalAccountId: null });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ data: { publish_id: 'pub-789' }, error: { code: 'ok' } }),
      text: () => Promise.resolve(''),
    });
    vi.stubGlobal('fetch', fetchMock);
    await publishToTikTok('user-1', makePost({ caption: null }));
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.post_info.title).toBe('');
  });
});

// ─────────────────────────── Facebook ─────────────────────────────────

describe('publishToFacebook', () => {
  it('throws when no Facebook connection', async () => {
    mockGetValidAccessToken.mockResolvedValue(null);
    await expect(publishToFacebook('user-1', makePost({ platform: 'facebook_reels' }))).rejects.toThrow('Facebook is not connected');
  });

  it('throws when connection has no externalAccountId (page id)', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'at', externalAccountId: null });
    await expect(publishToFacebook('user-1', makePost({ platform: 'facebook_reels' }))).rejects.toThrow('Facebook is not connected');
  });

  it('throws when no media_urls', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'page-at', externalAccountId: 'page-123' });
    await expect(publishToFacebook('user-1', makePost({ media_urls: [] }))).rejects.toThrow('no media');
  });

  it('returns externalPostId on success', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'page-at', externalAccountId: 'page-123' });
    vi.stubGlobal('fetch', vi.fn()
      // start phase
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ video_id: 'vid-999' }), text: () => Promise.resolve('') })
      // upload phase
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
      // finish phase
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ success: true }), text: () => Promise.resolve('') })
    );
    const result = await publishToFacebook('user-1', makePost({ platform: 'facebook_reels' }));
    expect(result.externalPostId).toBe('vid-999');
  });

  it('throws when start phase returns no video_id', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'page-at', externalAccountId: 'page-123' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    }));
    await expect(publishToFacebook('user-1', makePost({ platform: 'facebook_reels' }))).rejects.toThrow('no video_id');
  });

  it('throws when upload phase fails', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'page-at', externalAccountId: 'page-123' });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ video_id: 'vid-1' }), text: () => Promise.resolve('') })
      .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('server error'), json: () => Promise.resolve({}) })
    );
    await expect(publishToFacebook('user-1', makePost({ platform: 'facebook_reels' }))).rejects.toThrow('upload phase failed');
  });

  it('throws when finish phase does not report success', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'page-at', externalAccountId: 'page-123' });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ video_id: 'vid-1' }), text: () => Promise.resolve('') })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ success: false }), text: () => Promise.resolve('') })
    );
    await expect(publishToFacebook('user-1', makePost({ platform: 'facebook_reels' }))).rejects.toThrow('finish phase');
  });
});

// ─────────────────────────── YouTube ───────────────────────────────────

describe('publishToYouTube', () => {
  it('throws when no YouTube connection', async () => {
    mockGetValidAccessToken.mockResolvedValue(null);
    await expect(publishToYouTube('user-1', makePost({ platform: 'youtube_shorts' }))).rejects.toThrow('YouTube is not connected');
  });

  it('throws when no media_urls', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'yt-at', externalAccountId: null });
    await expect(publishToYouTube('user-1', makePost({ media_urls: [] }))).rejects.toThrow('no media');
  });

  it('throws when source video fetch fails', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'yt-at', externalAccountId: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 404,
      body: null, json: () => Promise.resolve({}), text: () => Promise.resolve(''),
      headers: { get: () => null },
    }));
    await expect(publishToYouTube('user-1', makePost({ platform: 'youtube_shorts' }))).rejects.toThrow('Could not fetch the source video');
  });

  it('returns externalPostId on success', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'yt-at', externalAccountId: null });
    const mockBody = new ReadableStream();
    vi.stubGlobal('fetch', vi.fn()
      // source video fetch
      .mockResolvedValueOnce({
        ok: true, status: 200, body: mockBody,
        headers: { get: (h: string) => h === 'content-type' ? 'video/mp4' : h === 'content-length' ? '1024' : null },
      })
      // YouTube init (session)
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: { get: (h: string) => h === 'location' ? 'https://uploads.googleapis.com/session/abc' : null },
        json: () => Promise.resolve({}), text: () => Promise.resolve(''),
      })
      // YouTube upload
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: 'yt-video-id-123' }),
        text: () => Promise.resolve(''),
      })
    );
    const result = await publishToYouTube('user-1', makePost({ platform: 'youtube_shorts' }));
    expect(result.externalPostId).toBe('yt-video-id-123');
  });

  it('throws when YouTube init returns no location header', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'yt-at', externalAccountId: null });
    const mockBody = new ReadableStream();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200, body: mockBody,
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: { get: () => null }, // no location
        json: () => Promise.resolve({}), text: () => Promise.resolve(''),
      })
    );
    await expect(publishToYouTube('user-1', makePost({ platform: 'youtube_shorts' }))).rejects.toThrow('session URI');
  });

  it('throws when YouTube init request fails', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'yt-at', externalAccountId: null });
    const mockBody = new ReadableStream();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200, body: mockBody,
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({
        ok: false, status: 403,
        headers: { get: () => null },
        json: () => Promise.resolve({}), text: () => Promise.resolve('forbidden'),
      })
    );
    await expect(publishToYouTube('user-1', makePost({ platform: 'youtube_shorts' }))).rejects.toThrow('upload session init failed');
  });

  it('throws when upload request fails', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'yt-at', externalAccountId: null });
    const mockBody = new ReadableStream();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200, body: mockBody,
        headers: { get: (h: string) => h === 'content-type' ? 'video/mp4' : null },
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: { get: (h: string) => h === 'location' ? 'https://uploads.googleapis.com/session/xyz' : null },
        json: () => Promise.resolve({}), text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: false, status: 500,
        json: () => Promise.resolve({}), text: () => Promise.resolve('server error'),
      })
    );
    await expect(publishToYouTube('user-1', makePost({ platform: 'youtube_shorts' }))).rejects.toThrow('video upload failed');
  });

  it('throws when upload succeeds but returns no video id', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'yt-at', externalAccountId: null });
    const mockBody = new ReadableStream();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200, body: mockBody,
        headers: { get: (h: string) => h === 'content-type' ? 'video/mp4' : null },
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: { get: (h: string) => h === 'location' ? 'https://uploads.googleapis.com/session/xyz' : null },
        json: () => Promise.resolve({}), text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({}), // no id field
        text: () => Promise.resolve(''),
      })
    );
    await expect(publishToYouTube('user-1', makePost({ platform: 'youtube_shorts' }))).rejects.toThrow('no video id');
  });

  it('appends #Shorts to the title', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'yt-at', externalAccountId: null });
    const mockBody = new ReadableStream();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200, body: mockBody,
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: { get: (h: string) => h === 'location' ? 'https://uploads.googleapis.com/session/xyz' : null },
        json: () => Promise.resolve({}), text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: 'yt-id' }),
        text: () => Promise.resolve(''),
      });
    vi.stubGlobal('fetch', fetchMock);
    await publishToYouTube('user-1', makePost({ caption: 'My Short Video', platform: 'youtube_shorts' }));
    const initBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(initBody.snippet.title).toContain('#Shorts');
    expect(initBody.snippet.title).toContain('My Short Video');
  });
});
