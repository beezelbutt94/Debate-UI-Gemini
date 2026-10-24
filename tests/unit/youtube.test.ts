import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

describe('fetchYoutubeChannelSnapshot()', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv, YOUTUBE_API_KEY: 'yt-test-key' };
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('throws when YOUTUBE_API_KEY is missing', async () => {
    delete process.env.YOUTUBE_API_KEY;
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    await expect(fetchYoutubeChannelSnapshot('@test')).rejects.toThrow('YOUTUBE_API_KEY');
  });

  it('throws when channel not found (empty items)', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ items: [] }));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    await expect(fetchYoutubeChannelSnapshot('@nobody')).rejects.toThrow('No YouTube channel found');
  });

  it('returns channel snapshot with correct structure', async () => {
    const channelRes = {
      items: [{
        id: 'UC123',
        snippet: { title: 'Test Channel', description: 'Desc', publishedAt: '2020-01-01T00:00:00Z' },
        statistics: {
          subscriberCount: '10000',
          viewCount: '500000',
          videoCount: '50',
          hiddenSubscriberCount: false,
        },
        contentDetails: { relatedPlaylists: { uploads: 'UU123' } },
      }],
    };
    const playlistRes = { items: [] };
    mockFetch
      .mockResolvedValueOnce(makeResponse(channelRes))
      .mockResolvedValueOnce(makeResponse(playlistRes));

    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    const snap = await fetchYoutubeChannelSnapshot('@TestChannel');

    expect(snap.channelId).toBe('UC123');
    expect(snap.title).toBe('Test Channel');
    expect(snap.subscriberCount).toBe(10000);
    expect(snap.totalViewCount).toBe(500000);
    expect(snap.totalVideoCount).toBe(50);
    expect(snap.recentVideos).toHaveLength(0);
    expect(snap.avgDaysBetweenUploads).toBeNull();
  });

  it('sets subscriberCount to null when hidden', async () => {
    const channelRes = {
      items: [{
        id: 'UC456',
        snippet: { title: 'Hidden Sub', description: '', publishedAt: '2021-01-01T00:00:00Z' },
        statistics: {
          hiddenSubscriberCount: true,
          viewCount: '100000',
          videoCount: '10',
        },
        contentDetails: { relatedPlaylists: { uploads: 'UU456' } },
      }],
    };
    mockFetch
      .mockResolvedValueOnce(makeResponse(channelRes))
      .mockResolvedValueOnce(makeResponse({ items: [] }));

    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    const snap = await fetchYoutubeChannelSnapshot('@HiddenSub');
    expect(snap.subscriberCount).toBeNull();
  });

  it('computes avgViewToSubscriberRatio from recent videos', async () => {
    const channelRes = {
      items: [{
        id: 'UC789',
        snippet: { title: 'Creator', description: '', publishedAt: '2021-01-01T00:00:00Z' },
        statistics: {
          subscriberCount: '1000',
          viewCount: '50000',
          videoCount: '5',
          hiddenSubscriberCount: false,
        },
        contentDetails: { relatedPlaylists: { uploads: 'UU789' } },
      }],
    };
    const playlistRes = {
      items: [
        { contentDetails: { videoId: 'vid1', videoPublishedAt: '2024-01-01T00:00:00Z' } },
        { contentDetails: { videoId: 'vid2', videoPublishedAt: '2024-01-08T00:00:00Z' } },
      ],
    };
    const videosRes = {
      items: [
        {
          id: 'vid1',
          snippet: { title: 'Video 1', publishedAt: '2024-01-01T00:00:00Z' },
          statistics: { viewCount: '2000', likeCount: '50', commentCount: '10' },
        },
        {
          id: 'vid2',
          snippet: { title: 'Video 2', publishedAt: '2024-01-08T00:00:00Z' },
          statistics: { viewCount: '4000', likeCount: '100', commentCount: '20' },
        },
      ],
    };
    mockFetch
      .mockResolvedValueOnce(makeResponse(channelRes))
      .mockResolvedValueOnce(makeResponse(playlistRes))
      .mockResolvedValueOnce(makeResponse(videosRes));

    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    const snap = await fetchYoutubeChannelSnapshot('@Creator');

    expect(snap.recentVideos).toHaveLength(2);
    // avgViewToSubscriberRatio = avg(2000, 4000) / 1000 = 3000 / 1000 = 3
    expect(snap.avgViewToSubscriberRatio).toBeCloseTo(3, 5);
    // avgDaysBetweenUploads: 7 days between 2 posts
    expect(snap.avgDaysBetweenUploads).toBeCloseTo(7, 0);
  });

  it('throws on YouTube API error response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ error: { message: 'Bad request' } }, 400));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    await expect(fetchYoutubeChannelSnapshot('@test')).rejects.toThrow('400');
  });

  it('normalizes handle with @ prefix', async () => {
    const channelRes = {
      items: [{
        id: 'UC1',
        snippet: { title: 'Channel', description: '', publishedAt: '2020-01-01T00:00:00Z' },
        statistics: { subscriberCount: '100', viewCount: '1000', videoCount: '5', hiddenSubscriberCount: false },
        contentDetails: { relatedPlaylists: { uploads: 'UU1' } },
      }],
    };
    mockFetch
      .mockResolvedValueOnce(makeResponse(channelRes))
      .mockResolvedValueOnce(makeResponse({ items: [] }));

    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    await fetchYoutubeChannelSnapshot('NoBang'); // no @ prefix
    const firstCall = mockFetch.mock.calls[0][0] as string;
    expect(firstCall).toContain('forHandle=%40NoBang'); // encoded @NoBang
  });

  it('normalizes handle from full YouTube URL', async () => {
    const channelRes = {
      items: [{
        id: 'UC1',
        snippet: { title: 'Channel', description: '', publishedAt: '2020-01-01T00:00:00Z' },
        statistics: { subscriberCount: '100', viewCount: '1000', videoCount: '5', hiddenSubscriberCount: false },
        contentDetails: { relatedPlaylists: { uploads: 'UU1' } },
      }],
    };
    mockFetch
      .mockResolvedValueOnce(makeResponse(channelRes))
      .mockResolvedValueOnce(makeResponse({ items: [] }));

    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    await fetchYoutubeChannelSnapshot('https://www.youtube.com/@CreatorName');
    const firstCall = mockFetch.mock.calls[0][0] as string;
    expect(firstCall).toContain('forHandle=%40CreatorName');
  });
});
