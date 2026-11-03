/**
 * Tests for lib/publish/youtube.ts, tiktok.ts, facebook.ts.
 * getValidAccessToken is mocked so tests focus on the publish API calls.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/publish/tokens', () => ({
  getValidAccessToken: vi.fn(),
}));

import type { ScheduledPostRow } from '@/lib/types';

function makePost(overrides: Partial<ScheduledPostRow> = {}): ScheduledPostRow {
  return {
    id: 'post-1',
    user_id: 'user-1',
    platform: 'youtube_shorts',
    publish_at: new Date().toISOString(),
    media_urls: ['https://res.cloudinary.com/example/video/upload/v1/test.mp4'],
    caption: 'My caption',
    status: 'scheduled',
    publish_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

async function setupTokenMock(value: { accessToken: string; externalAccountId: string | null } | null) {
  const { getValidAccessToken } = await import('@/lib/publish/tokens');
  (getValidAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue(value);
}

// ─── YouTube ──────────────────────────────────────────────────────────────────

describe('publishToYouTube()', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('throws when YouTube is not connected', async () => {
    await setupTokenMock(null);
    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('user-1', makePost())).rejects.toThrow('not connected');
  });

  it('throws when the post has no media_urls', async () => {
    await setupTokenMock({ accessToken: 'token', externalAccountId: null });
    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('user-1', makePost({ media_urls: [] }))).rejects.toThrow('no media');
  });

  it('throws when source video fetch fails', async () => {
    await setupTokenMock({ accessToken: 'token', externalAccountId: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 404,
      json: async () => ({}), text: async () => 'Not Found',
      headers: { get: () => null }, body: null,
    }));
    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('user-1', makePost())).rejects.toThrow('Could not fetch the source video');
  });

  it('throws when upload session init fails', async () => {
    await setupTokenMock({ accessToken: 'yt-token', externalAccountId: null });
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (call++ === 0) {
        return { ok: true, status: 200, headers: { get: (h: string) => h === 'content-type' ? 'video/mp4' : null }, body: 'video-stream', json: async () => ({}), text: async () => '' };
      }
      return { ok: false, status: 403, text: async () => 'Forbidden', json: async () => ({}), headers: { get: () => null }, body: null };
    }));
    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('user-1', makePost())).rejects.toThrow('YouTube upload session init failed');
  });

  it('throws when upload session has no location header', async () => {
    await setupTokenMock({ accessToken: 'yt-token', externalAccountId: null });
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (call++ === 0) {
        return { ok: true, status: 200, headers: { get: (h: string) => h === 'content-type' ? 'video/mp4' : null }, body: 'stream', json: async () => ({}), text: async () => '' };
      }
      return { ok: true, status: 200, headers: { get: () => null }, body: null, json: async () => ({}), text: async () => '' };
    }));
    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('user-1', makePost())).rejects.toThrow('session URI');
  });

  it('throws when the upload PUT fails', async () => {
    await setupTokenMock({ accessToken: 'yt-token', externalAccountId: null });
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      call++;
      if (call === 1) return { ok: true, status: 200, headers: { get: (h: string) => h === 'content-type' ? 'video/mp4' : null }, body: 'stream', json: async () => ({}), text: async () => '' };
      if (call === 2) return { ok: true, status: 200, headers: { get: (h: string) => h === 'location' ? 'https://upload.googleapis.com/sess' : null }, body: null, json: async () => ({}), text: async () => '' };
      return { ok: false, status: 500, text: async () => 'Server error', json: async () => ({}), headers: { get: () => null }, body: null };
    }));
    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('user-1', makePost())).rejects.toThrow('YouTube video upload failed');
  });

  it('throws when upload response has no video id', async () => {
    await setupTokenMock({ accessToken: 'yt-token', externalAccountId: null });
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      call++;
      if (call === 1) return { ok: true, status: 200, headers: { get: (h: string) => h === 'content-type' ? 'video/mp4' : null }, body: 'stream', json: async () => ({}), text: async () => '' };
      if (call === 2) return { ok: true, status: 200, headers: { get: (h: string) => h === 'location' ? 'https://upload.googleapis.com/sess' : null }, body: null, json: async () => ({}), text: async () => '' };
      return { ok: true, status: 200, json: async () => ({}), headers: { get: () => null }, body: null, text: async () => '' };
    }));
    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await expect(publishToYouTube('user-1', makePost())).rejects.toThrow('no video id');
  });

  it('returns externalPostId on full success', async () => {
    await setupTokenMock({ accessToken: 'yt-token', externalAccountId: null });
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      call++;
      if (call === 1) return { ok: true, status: 200, headers: { get: (h: string) => ({ 'content-type': 'video/mp4', 'content-length': '12345' })[h] ?? null }, body: 'stream', json: async () => ({}), text: async () => '' };
      if (call === 2) return { ok: true, status: 200, headers: { get: (h: string) => h === 'location' ? 'https://upload.googleapis.com/sess' : null }, body: null, json: async () => ({}), text: async () => '' };
      return { ok: true, status: 200, json: async () => ({ id: 'yt-video-id' }), headers: { get: () => null }, body: null, text: async () => '' };
    }));
    const { publishToYouTube } = await import('@/lib/publish/youtube');
    const result = await publishToYouTube('user-1', makePost({ caption: 'My Short' }));
    expect(result.externalPostId).toBe('yt-video-id');
  });

  it('truncates caption to 95 chars and appends #Shorts', async () => {
    await setupTokenMock({ accessToken: 'yt-token', externalAccountId: null });
    const longCaption = 'a'.repeat(200);
    let sentBody: string | undefined;
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      call++;
      if (call === 1) return { ok: true, status: 200, headers: { get: () => null }, body: 'stream', json: async () => ({}), text: async () => '' };
      if (call === 2) {
        sentBody = init?.body as string;
        return { ok: true, status: 200, headers: { get: () => 'https://upload.googleapis.com/sess' }, body: null, json: async () => ({}), text: async () => '' };
      }
      return { ok: true, status: 200, json: async () => ({ id: 'vid' }), headers: { get: () => null }, body: null, text: async () => '' };
    }));
    const { publishToYouTube } = await import('@/lib/publish/youtube');
    await publishToYouTube('user-1', makePost({ caption: longCaption }));
    const parsed = JSON.parse(sentBody ?? '{}');
    expect(parsed.snippet.title).toContain('#Shorts');
    expect(parsed.snippet.title.length).toBeLessThanOrEqual(103); // 95 + ' #Shorts'
  });
});

// ─── TikTok ───────────────────────────────────────────────────────────────────

describe('publishToTikTok()', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('throws when TikTok is not connected', async () => {
    await setupTokenMock(null);
    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    await expect(publishToTikTok('user-1', makePost({ platform: 'tiktok' }))).rejects.toThrow('not connected');
  });

  it('throws when post has no media_urls', async () => {
    await setupTokenMock({ accessToken: 'tt-token', externalAccountId: 'tt-id' });
    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    await expect(publishToTikTok('user-1', makePost({ media_urls: [] }))).rejects.toThrow('no media');
  });

  it('throws when API returns a non-ok status', async () => {
    await setupTokenMock({ accessToken: 'tt-token', externalAccountId: 'tt-id' });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 400,
      json: async () => ({ error: { code: 'invalid_param' } }),
    })));
    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    await expect(publishToTikTok('user-1', makePost({ platform: 'tiktok' }))).rejects.toThrow('TikTok publish init failed');
  });

  it('throws when API returns ok=true but error code is not "ok"', async () => {
    await setupTokenMock({ accessToken: 'tt-token', externalAccountId: 'tt-id' });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ error: { code: 'rate_limit_exceeded' } }),
    })));
    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    await expect(publishToTikTok('user-1', makePost({ platform: 'tiktok' }))).rejects.toThrow('TikTok publish init failed');
  });

  it('throws when publish_id is missing from response', async () => {
    await setupTokenMock({ accessToken: 'tt-token', externalAccountId: 'tt-id' });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ error: { code: 'ok' }, data: {} }),
    })));
    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    await expect(publishToTikTok('user-1', makePost({ platform: 'tiktok' }))).rejects.toThrow('publish_id');
  });

  it('returns externalPostId on success', async () => {
    await setupTokenMock({ accessToken: 'tt-token', externalAccountId: 'tt-id' });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ error: { code: 'ok' }, data: { publish_id: 'tt-pub-123' } }),
    })));
    const { publishToTikTok } = await import('@/lib/publish/tiktok');
    const result = await publishToTikTok('user-1', makePost({ platform: 'tiktok' }));
    expect(result.externalPostId).toBe('tt-pub-123');
  });
});

// ─── Facebook ─────────────────────────────────────────────────────────────────

describe('publishToFacebook()', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('throws when Facebook is not connected (null token)', async () => {
    await setupTokenMock(null);
    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('user-1', makePost({ platform: 'facebook_reels' }))).rejects.toThrow('not connected');
  });

  it('throws when token has no externalAccountId (no page connected)', async () => {
    await setupTokenMock({ accessToken: 'fb-token', externalAccountId: null });
    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('user-1', makePost({ platform: 'facebook_reels' }))).rejects.toThrow('not connected');
  });

  it('throws when post has no media_urls', async () => {
    await setupTokenMock({ accessToken: 'fb-token', externalAccountId: 'page-id' });
    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('user-1', makePost({ media_urls: [] }))).rejects.toThrow('no media');
  });

  it('throws when start phase returns no video_id', async () => {
    await setupTokenMock({ accessToken: 'fb-token', externalAccountId: 'page-id' });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({}),
    })));
    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('user-1', makePost({ platform: 'facebook_reels' }))).rejects.toThrow('video_id');
  });

  it('throws when start phase API fails', async () => {
    await setupTokenMock({ accessToken: 'fb-token', externalAccountId: 'page-id' });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 403,
      json: async () => ({ error: { message: 'Permissions error' } }),
    })));
    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('user-1', makePost({ platform: 'facebook_reels' }))).rejects.toThrow('Facebook Graph API call');
  });

  it('throws when upload phase fails', async () => {
    await setupTokenMock({ accessToken: 'fb-token', externalAccountId: 'page-id' });
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (call++ === 0) return { ok: true, status: 200, json: async () => ({ video_id: 'vid-1' }) };
      return { ok: false, status: 500, text: async () => 'Server error', json: async () => ({}) };
    }));
    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('user-1', makePost({ platform: 'facebook_reels' }))).rejects.toThrow('upload phase failed');
  });

  it('throws when finish phase does not report success', async () => {
    await setupTokenMock({ accessToken: 'fb-token', externalAccountId: 'page-id' });
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      call++;
      if (call === 1) return { ok: true, status: 200, json: async () => ({ video_id: 'vid-1' }) };
      if (call === 2) return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
      return { ok: true, status: 200, json: async () => ({ success: false }) };
    }));
    const { publishToFacebook } = await import('@/lib/publish/facebook');
    await expect(publishToFacebook('user-1', makePost({ platform: 'facebook_reels' }))).rejects.toThrow('finish phase');
  });

  it('returns externalPostId on full success', async () => {
    await setupTokenMock({ accessToken: 'fb-token', externalAccountId: 'page-id' });
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      call++;
      if (call === 1) return { ok: true, status: 200, json: async () => ({ video_id: 'vid-123' }) };
      if (call === 2) return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    }));
    const { publishToFacebook } = await import('@/lib/publish/facebook');
    const result = await publishToFacebook('user-1', makePost({ platform: 'facebook_reels' }));
    expect(result.externalPostId).toBe('vid-123');
  });
});
