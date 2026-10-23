import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchYoutubeChannelSnapshot } from '@/lib/youtube';

// ---------------------------------------------------------------------------
// We mock the global fetch to test fetchYoutubeChannelSnapshot and the
// private helpers (normalizeHandle, computeAvgDaysBetween) indirectly.
// ---------------------------------------------------------------------------

const CHANNEL_RESPONSE = {
  items: [
    {
      id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
      snippet: { title: 'Google for Developers', description: '', publishedAt: '2007-08-23T00:00:00.000Z' },
      statistics: {
        subscriberCount: '1000000',
        viewCount: '50000000',
        videoCount: '2000',
        hiddenSubscriberCount: false,
      },
      contentDetails: { relatedPlaylists: { uploads: 'UU_x5XG1OV2P6uZZ5FSM9Ttw' } },
    },
  ],
};

const PLAYLIST_RESPONSE = {
  items: [
    { contentDetails: { videoId: 'vid1', videoPublishedAt: '2024-01-10T12:00:00.000Z' } },
    { contentDetails: { videoId: 'vid2', videoPublishedAt: '2024-01-03T12:00:00.000Z' } },
  ],
};

const VIDEOS_RESPONSE = {
  items: [
    {
      id: 'vid1',
      snippet: { title: 'Video 1', publishedAt: '2024-01-10T12:00:00.000Z' },
      statistics: { viewCount: '100000', likeCount: '5000', commentCount: '200' },
    },
    {
      id: 'vid2',
      snippet: { title: 'Video 2', publishedAt: '2024-01-03T12:00:00.000Z' },
      statistics: { viewCount: '80000', likeCount: '4000', commentCount: '150' },
    },
  ],
};

const OLD_ENV = { ...process.env };

describe('fetchYoutubeChannelSnapshot()', () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.restoreAllMocks();
  });

  it('returns a well-shaped snapshot on success', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => CHANNEL_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => PLAYLIST_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => VIDEOS_RESPONSE });

    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchYoutubeChannelSnapshot('@GoogleDevelopers');
    expect(result.channelId).toBe('UC_x5XG1OV2P6uZZ5FSM9Ttw');
    expect(result.title).toBe('Google for Developers');
    expect(result.subscriberCount).toBe(1000000);
    expect(result.totalViewCount).toBe(50000000);
    expect(result.totalVideoCount).toBe(2000);
    expect(result.recentVideos).toHaveLength(2);
  });

  it('resolves subscriberCount to null when hiddenSubscriberCount is true', async () => {
    const hiddenChannel = {
      items: [
        {
          ...CHANNEL_RESPONSE.items[0],
          statistics: { ...CHANNEL_RESPONSE.items[0].statistics, hiddenSubscriberCount: true },
        },
      ],
    };
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => hiddenChannel })
      .mockResolvedValueOnce({ ok: true, json: async () => PLAYLIST_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => VIDEOS_RESPONSE });

    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchYoutubeChannelSnapshot('@TestChannel');
    expect(result.subscriberCount).toBeNull();
  });

  it('computes avgDaysBetweenUploads correctly for two known dates', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => CHANNEL_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => PLAYLIST_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => VIDEOS_RESPONSE });

    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchYoutubeChannelSnapshot('@GoogleDevelopers');
    // Jan 10 - Jan 3 = 7 days, only one gap => avg = 7
    expect(result.avgDaysBetweenUploads).toBeCloseTo(7, 0);
  });

  it('returns null avgDaysBetweenUploads when there is only one video', async () => {
    const singleVideo = { items: [PLAYLIST_RESPONSE.items[0]] };
    const singleVideoDetail = { items: [VIDEOS_RESPONSE.items[0]] };

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => CHANNEL_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => singleVideo })
      .mockResolvedValueOnce({ ok: true, json: async () => singleVideoDetail });

    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchYoutubeChannelSnapshot('@GoogleDevelopers');
    expect(result.avgDaysBetweenUploads).toBeNull();
  });

  it('computes avgViewToSubscriberRatio correctly', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => CHANNEL_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => PLAYLIST_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => VIDEOS_RESPONSE });

    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchYoutubeChannelSnapshot('@GoogleDevelopers');
    // (100000 + 80000) / 2 = 90000 avg views per video / 1000000 subs = 0.09
    expect(result.avgViewToSubscriberRatio).toBeCloseTo(0.09, 4);
  });

  it('returns null avgViewToSubscriberRatio when subscriberCount is null', async () => {
    const hiddenChannel = {
      items: [
        {
          ...CHANNEL_RESPONSE.items[0],
          statistics: { ...CHANNEL_RESPONSE.items[0].statistics, hiddenSubscriberCount: true },
        },
      ],
    };
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => hiddenChannel })
      .mockResolvedValueOnce({ ok: true, json: async () => PLAYLIST_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => VIDEOS_RESPONSE });

    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchYoutubeChannelSnapshot('@TestChannel');
    expect(result.avgViewToSubscriberRatio).toBeNull();
  });

  it('throws when no channel is found for the handle', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) });

    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchYoutubeChannelSnapshot('@nobody')).rejects.toThrow(/"@nobody"/);
  });

  it('throws when the YouTube API returns an error status', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'quotaExceeded' });

    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchYoutubeChannelSnapshot('@some')).rejects.toThrow('403');
  });

  it('throws when YOUTUBE_API_KEY is not set', async () => {
    delete process.env.YOUTUBE_API_KEY;
    await expect(fetchYoutubeChannelSnapshot('@someone')).rejects.toThrow('YOUTUBE_API_KEY');
  });

  // normalizeHandle tests (via the public function)
  it('normalizes a handle with @ prefix correctly', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => CHANNEL_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => PLAYLIST_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => VIDEOS_RESPONSE });

    vi.stubGlobal('fetch', mockFetch);

    await fetchYoutubeChannelSnapshot('@TestChannel');
    // The channels call URL should include forHandle=@TestChannel
    const channelsCallUrl = (mockFetch.mock.calls[0][0] as string);
    expect(channelsCallUrl).toContain('forHandle=%40TestChannel');
  });

  it('normalizes a handle without @ prefix (adds it)', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => CHANNEL_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => PLAYLIST_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => VIDEOS_RESPONSE });

    vi.stubGlobal('fetch', mockFetch);

    await fetchYoutubeChannelSnapshot('TestChannel');
    const channelsCallUrl = (mockFetch.mock.calls[0][0] as string);
    expect(channelsCallUrl).toContain('forHandle=%40TestChannel');
  });

  it('extracts handle from a full YouTube channel URL', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => CHANNEL_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => PLAYLIST_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => VIDEOS_RESPONSE });

    vi.stubGlobal('fetch', mockFetch);

    await fetchYoutubeChannelSnapshot('https://www.youtube.com/@SomeChannel');
    const channelsCallUrl = (mockFetch.mock.calls[0][0] as string);
    expect(channelsCallUrl).toContain('forHandle=%40SomeChannel');
  });

  it('handles an empty playlist (no videos) gracefully', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => CHANNEL_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) });

    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchYoutubeChannelSnapshot('@GoogleDevelopers');
    expect(result.recentVideos).toHaveLength(0);
    expect(result.avgDaysBetweenUploads).toBeNull();
    expect(result.avgViewToSubscriberRatio).toBeNull();
  });

  it('sorts recentVideos by most recent first', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => CHANNEL_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => PLAYLIST_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => VIDEOS_RESPONSE });

    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchYoutubeChannelSnapshot('@GoogleDevelopers');
    const dates = result.recentVideos.map((v) => new Date(v.publishedAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });
});
