import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const makeChannelResponse = (overrides: Record<string, unknown> = {}) => ({
  items: [{
    id: 'UCchannel123',
    snippet: { title: 'Test Channel', description: 'desc', publishedAt: '2020-01-01T00:00:00Z' },
    statistics: {
      subscriberCount: '100000',
      viewCount: '5000000',
      videoCount: '150',
      hiddenSubscriberCount: false,
    },
    contentDetails: { relatedPlaylists: { uploads: 'UUchannel123' } },
    ...overrides,
  }],
});

const makePlaylistResponse = (videoIds: string[], publishedAts: string[]) => ({
  items: videoIds.map((id, i) => ({
    contentDetails: { videoId: id, videoPublishedAt: publishedAts[i] },
  })),
});

const makeVideosResponse = (videoIds: string[], publishedAts: string[]) => ({
  items: videoIds.map((id, i) => ({
    id,
    snippet: { title: `Video ${i + 1}`, publishedAt: publishedAts[i] },
    statistics: { viewCount: '10000', likeCount: '500', commentCount: '50' },
  })),
});

describe('fetchYoutubeChannelSnapshot()', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.YOUTUBE_API_KEY;
    vi.restoreAllMocks();
  });

  it('throws when YOUTUBE_API_KEY is not set', async () => {
    delete process.env.YOUTUBE_API_KEY;
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    await expect(fetchYoutubeChannelSnapshot('@testchannel')).rejects.toThrow('YOUTUBE_API_KEY is not configured.');
  });

  it('throws when no channel is found', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    }));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    await expect(fetchYoutubeChannelSnapshot('@nobody')).rejects.toThrow('No YouTube channel found');
  });

  it('throws on non-OK YouTube API response', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    }));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    await expect(fetchYoutubeChannelSnapshot('@chan')).rejects.toThrow('403');
  });

  it('returns a snapshot with correct subscriber count', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    const dates = ['2024-06-01T00:00:00Z', '2024-05-01T00:00:00Z'];
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => makeChannelResponse() })
      .mockResolvedValueOnce({ ok: true, json: async () => makePlaylistResponse(['v1', 'v2'], dates) })
      .mockResolvedValueOnce({ ok: true, json: async () => makeVideosResponse(['v1', 'v2'], dates) })
    );
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    const snap = await fetchYoutubeChannelSnapshot('@testchannel');
    expect(snap.subscriberCount).toBe(100000);
    expect(snap.title).toBe('Test Channel');
  });

  it('sets subscriberCount to null when hiddenSubscriberCount is true', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    const dates = ['2024-06-01T00:00:00Z'];
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true, json: async () => makeChannelResponse({
          statistics: { hiddenSubscriberCount: true, viewCount: '1000000', videoCount: '50' }
        })
      })
      .mockResolvedValueOnce({ ok: true, json: async () => makePlaylistResponse(['v1'], dates) })
      .mockResolvedValueOnce({ ok: true, json: async () => makeVideosResponse(['v1'], dates) })
    );
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    const snap = await fetchYoutubeChannelSnapshot('testchannel');
    expect(snap.subscriberCount).toBeNull();
  });

  it('computes avgDaysBetweenUploads for multiple videos', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    // 3 videos, 7 days apart each
    const dates = [
      '2024-06-15T00:00:00Z',
      '2024-06-08T00:00:00Z',
      '2024-06-01T00:00:00Z',
    ];
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => makeChannelResponse() })
      .mockResolvedValueOnce({ ok: true, json: async () => makePlaylistResponse(['v1','v2','v3'], dates) })
      .mockResolvedValueOnce({ ok: true, json: async () => makeVideosResponse(['v1','v2','v3'], dates) })
    );
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    const snap = await fetchYoutubeChannelSnapshot('@chan');
    expect(snap.avgDaysBetweenUploads).toBeCloseTo(7, 0);
  });

  it('returns avgDaysBetweenUploads null for single video', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    const dates = ['2024-06-01T00:00:00Z'];
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => makeChannelResponse() })
      .mockResolvedValueOnce({ ok: true, json: async () => makePlaylistResponse(['v1'], dates) })
      .mockResolvedValueOnce({ ok: true, json: async () => makeVideosResponse(['v1'], dates) })
    );
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    const snap = await fetchYoutubeChannelSnapshot('@chan');
    expect(snap.avgDaysBetweenUploads).toBeNull();
  });

  it('handles empty playlist (no videos)', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => makeChannelResponse() })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
    );
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    const snap = await fetchYoutubeChannelSnapshot('@emptychan');
    expect(snap.recentVideos).toEqual([]);
    expect(snap.avgDaysBetweenUploads).toBeNull();
    expect(snap.avgViewToSubscriberRatio).toBeNull();
  });

  it('normalizes handle: adds @ when missing', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => makeChannelResponse() });
    vi.stubGlobal('fetch', mockFetch);
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    try { await fetchYoutubeChannelSnapshot('mkbhd'); } catch { /* second call will use wrong shape */ }
    const firstUrl = mockFetch.mock.calls[0][0] as string;
    expect(firstUrl).toContain('forHandle=%40mkbhd');
  });

  it('normalizes handle: keeps @ when already present', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => makeChannelResponse() });
    vi.stubGlobal('fetch', mockFetch);
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    try { await fetchYoutubeChannelSnapshot('@mkbhd'); } catch { /* ok */ }
    const firstUrl = mockFetch.mock.calls[0][0] as string;
    expect(firstUrl).toContain('forHandle=%40mkbhd');
  });

  it('normalizes handle from full YouTube URL', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => makeChannelResponse() });
    vi.stubGlobal('fetch', mockFetch);
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    try { await fetchYoutubeChannelSnapshot('https://www.youtube.com/@mkbhd'); } catch { /* ok */ }
    const firstUrl = mockFetch.mock.calls[0][0] as string;
    expect(firstUrl).toContain('forHandle=%40mkbhd');
  });
});
