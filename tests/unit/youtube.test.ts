import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchYoutubeChannelSnapshot } from '@/lib/youtube';

// Helper to build a mock Response
function mockResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

// Canonical fake API responses
const FAKE_CHANNEL_LIST = {
  items: [
    {
      id: 'UC_channel123',
      snippet: {
        title: 'Test Channel',
        description: 'A test channel',
        publishedAt: '2020-01-01T00:00:00Z',
      },
      statistics: {
        subscriberCount: '10000',
        viewCount: '500000',
        videoCount: '50',
        hiddenSubscriberCount: false,
      },
      contentDetails: { relatedPlaylists: { uploads: 'UU_uploads123' } },
    },
  ],
};

const FAKE_PLAYLIST_ITEMS = {
  items: [
    { contentDetails: { videoId: 'vid1', videoPublishedAt: '2024-01-15T00:00:00Z' } },
    { contentDetails: { videoId: 'vid2', videoPublishedAt: '2024-01-10T00:00:00Z' } },
    { contentDetails: { videoId: 'vid3', videoPublishedAt: '2024-01-05T00:00:00Z' } },
  ],
};

const FAKE_VIDEOS = {
  items: [
    {
      id: 'vid1',
      snippet: { title: 'Video One', publishedAt: '2024-01-15T00:00:00Z' },
      statistics: { viewCount: '5000', likeCount: '200', commentCount: '30' },
    },
    {
      id: 'vid2',
      snippet: { title: 'Video Two', publishedAt: '2024-01-10T00:00:00Z' },
      statistics: { viewCount: '3000', likeCount: '100', commentCount: '10' },
    },
    {
      id: 'vid3',
      snippet: { title: 'Video Three', publishedAt: '2024-01-05T00:00:00Z' },
      statistics: { viewCount: '1000', likeCount: '50', commentCount: '5' },
    },
  ],
};

function setupFetchSequence(responses: ReturnType<typeof mockResponse>[]) {
  let call = 0;
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(responses[call++])));
}

beforeEach(() => {
  process.env.YOUTUBE_API_KEY = 'fake-api-key';
});

afterEach(() => {
  delete process.env.YOUTUBE_API_KEY;
  vi.unstubAllGlobals();
});

describe('fetchYoutubeChannelSnapshot', () => {
  it('returns the correct channelId', async () => {
    setupFetchSequence([
      mockResponse(FAKE_CHANNEL_LIST),
      mockResponse(FAKE_PLAYLIST_ITEMS),
      mockResponse(FAKE_VIDEOS),
    ]);
    const snap = await fetchYoutubeChannelSnapshot('@TestChannel');
    expect(snap.channelId).toBe('UC_channel123');
  });

  it('returns the channel title', async () => {
    setupFetchSequence([
      mockResponse(FAKE_CHANNEL_LIST),
      mockResponse(FAKE_PLAYLIST_ITEMS),
      mockResponse(FAKE_VIDEOS),
    ]);
    const snap = await fetchYoutubeChannelSnapshot('@TestChannel');
    expect(snap.title).toBe('Test Channel');
  });

  it('returns subscriberCount as a number', async () => {
    setupFetchSequence([
      mockResponse(FAKE_CHANNEL_LIST),
      mockResponse(FAKE_PLAYLIST_ITEMS),
      mockResponse(FAKE_VIDEOS),
    ]);
    const snap = await fetchYoutubeChannelSnapshot('@TestChannel');
    expect(snap.subscriberCount).toBe(10000);
  });

  it('returns subscriberCount as null when hidden', async () => {
    const hiddenChannel = {
      items: [
        {
          ...FAKE_CHANNEL_LIST.items[0],
          statistics: {
            ...FAKE_CHANNEL_LIST.items[0].statistics,
            hiddenSubscriberCount: true,
          },
        },
      ],
    };
    setupFetchSequence([
      mockResponse(hiddenChannel),
      mockResponse(FAKE_PLAYLIST_ITEMS),
      mockResponse(FAKE_VIDEOS),
    ]);
    const snap = await fetchYoutubeChannelSnapshot('@TestChannel');
    expect(snap.subscriberCount).toBeNull();
  });

  it('returns totalViewCount as a number', async () => {
    setupFetchSequence([
      mockResponse(FAKE_CHANNEL_LIST),
      mockResponse(FAKE_PLAYLIST_ITEMS),
      mockResponse(FAKE_VIDEOS),
    ]);
    const snap = await fetchYoutubeChannelSnapshot('@TestChannel');
    expect(snap.totalViewCount).toBe(500000);
  });

  it('returns totalVideoCount as a number', async () => {
    setupFetchSequence([
      mockResponse(FAKE_CHANNEL_LIST),
      mockResponse(FAKE_PLAYLIST_ITEMS),
      mockResponse(FAKE_VIDEOS),
    ]);
    const snap = await fetchYoutubeChannelSnapshot('@TestChannel');
    expect(snap.totalVideoCount).toBe(50);
  });

  it('returns recentVideos sorted by publishedAt descending', async () => {
    setupFetchSequence([
      mockResponse(FAKE_CHANNEL_LIST),
      mockResponse(FAKE_PLAYLIST_ITEMS),
      mockResponse(FAKE_VIDEOS),
    ]);
    const snap = await fetchYoutubeChannelSnapshot('@TestChannel');
    expect(snap.recentVideos[0].id).toBe('vid1'); // most recent
    expect(snap.recentVideos[2].id).toBe('vid3'); // oldest
  });

  it('returns recentVideos with numeric viewCount, likeCount, commentCount', async () => {
    setupFetchSequence([
      mockResponse(FAKE_CHANNEL_LIST),
      mockResponse(FAKE_PLAYLIST_ITEMS),
      mockResponse(FAKE_VIDEOS),
    ]);
    const snap = await fetchYoutubeChannelSnapshot('@TestChannel');
    expect(snap.recentVideos[0].viewCount).toBe(5000);
    expect(snap.recentVideos[0].likeCount).toBe(200);
    expect(snap.recentVideos[0].commentCount).toBe(30);
  });

  it('computes avgDaysBetweenUploads correctly for 3 videos 5 days apart', async () => {
    setupFetchSequence([
      mockResponse(FAKE_CHANNEL_LIST),
      mockResponse(FAKE_PLAYLIST_ITEMS),
      mockResponse(FAKE_VIDEOS),
    ]);
    const snap = await fetchYoutubeChannelSnapshot('@TestChannel');
    // Dates: Jan 15, Jan 10, Jan 5 → gaps of 5 and 5 days → avg 5
    expect(snap.avgDaysBetweenUploads).toBeCloseTo(5, 0);
  });

  it('returns avgDaysBetweenUploads as null when only one video', async () => {
    const oneVideo = {
      items: [{ contentDetails: { videoId: 'vid1', videoPublishedAt: '2024-01-15T00:00:00Z' } }],
    };
    const oneVideoList = { items: [FAKE_VIDEOS.items[0]] };
    setupFetchSequence([
      mockResponse(FAKE_CHANNEL_LIST),
      mockResponse(oneVideo),
      mockResponse(oneVideoList),
    ]);
    const snap = await fetchYoutubeChannelSnapshot('@TestChannel');
    expect(snap.avgDaysBetweenUploads).toBeNull();
  });

  it('computes avgViewToSubscriberRatio correctly', async () => {
    setupFetchSequence([
      mockResponse(FAKE_CHANNEL_LIST),
      mockResponse(FAKE_PLAYLIST_ITEMS),
      mockResponse(FAKE_VIDEOS),
    ]);
    const snap = await fetchYoutubeChannelSnapshot('@TestChannel');
    // avg views = (5000+3000+1000)/3 = 3000; subscribers = 10000; ratio = 0.3
    expect(snap.avgViewToSubscriberRatio).toBeCloseTo(0.3, 5);
  });

  it('returns avgViewToSubscriberRatio as null when subscribers are hidden', async () => {
    const hiddenChannel = {
      items: [
        {
          ...FAKE_CHANNEL_LIST.items[0],
          statistics: {
            ...FAKE_CHANNEL_LIST.items[0].statistics,
            hiddenSubscriberCount: true,
          },
        },
      ],
    };
    setupFetchSequence([
      mockResponse(hiddenChannel),
      mockResponse(FAKE_PLAYLIST_ITEMS),
      mockResponse(FAKE_VIDEOS),
    ]);
    const snap = await fetchYoutubeChannelSnapshot('@TestChannel');
    expect(snap.avgViewToSubscriberRatio).toBeNull();
  });

  it('returns empty recentVideos and null avgDaysBetweenUploads when playlist is empty', async () => {
    const emptyPlaylist = { items: [] };
    setupFetchSequence([
      mockResponse(FAKE_CHANNEL_LIST),
      mockResponse(emptyPlaylist),
      // No videos.list call needed since no videoIds
    ]);
    const snap = await fetchYoutubeChannelSnapshot('@TestChannel');
    expect(snap.recentVideos).toHaveLength(0);
    expect(snap.avgDaysBetweenUploads).toBeNull();
  });

  it('throws when YOUTUBE_API_KEY is not set', async () => {
    delete process.env.YOUTUBE_API_KEY;
    await expect(fetchYoutubeChannelSnapshot('@handle')).rejects.toThrow('YOUTUBE_API_KEY');
  });

  it('throws when no channel is found for the handle', async () => {
    setupFetchSequence([mockResponse({ items: [] })]);
    await expect(fetchYoutubeChannelSnapshot('@unknown')).rejects.toThrow('No YouTube channel found');
  });

  it('throws when the YouTube API returns a non-ok status', async () => {
    setupFetchSequence([mockResponse({ error: 'quota exceeded' }, false, 403)]);
    await expect(fetchYoutubeChannelSnapshot('@handle')).rejects.toThrow('403');
  });

  it('normalizes handle without @ by adding it', async () => {
    setupFetchSequence([
      mockResponse(FAKE_CHANNEL_LIST),
      mockResponse(FAKE_PLAYLIST_ITEMS),
      mockResponse(FAKE_VIDEOS),
    ]);
    const fetchMock = vi.mocked(fetch);
    await fetchYoutubeChannelSnapshot('TestChannel'); // no @ prefix
    // The first call should include forHandle=@TestChannel
    const firstCallUrl = (fetchMock.mock.calls[0][0] as string);
    expect(firstCallUrl).toContain('forHandle=%40TestChannel');
  });

  it('normalizes handle with @ correctly', async () => {
    setupFetchSequence([
      mockResponse(FAKE_CHANNEL_LIST),
      mockResponse(FAKE_PLAYLIST_ITEMS),
      mockResponse(FAKE_VIDEOS),
    ]);
    const fetchMock = vi.mocked(fetch);
    await fetchYoutubeChannelSnapshot('@TestChannel');
    const firstCallUrl = (fetchMock.mock.calls[0][0] as string);
    expect(firstCallUrl).toContain('forHandle=%40TestChannel');
  });

  it('normalizes handle from a full youtube.com URL', async () => {
    setupFetchSequence([
      mockResponse(FAKE_CHANNEL_LIST),
      mockResponse(FAKE_PLAYLIST_ITEMS),
      mockResponse(FAKE_VIDEOS),
    ]);
    const fetchMock = vi.mocked(fetch);
    await fetchYoutubeChannelSnapshot('https://www.youtube.com/@TestChannel');
    const firstCallUrl = (fetchMock.mock.calls[0][0] as string);
    expect(firstCallUrl).toContain('forHandle=%40TestChannel');
  });

  it('defaults missing statistics fields to 0', async () => {
    const channelNoStats = {
      items: [
        {
          ...FAKE_CHANNEL_LIST.items[0],
          statistics: { hiddenSubscriberCount: false },
        },
      ],
    };
    setupFetchSequence([
      mockResponse(channelNoStats),
      mockResponse({ items: [] }),
    ]);
    const snap = await fetchYoutubeChannelSnapshot('@handle');
    expect(snap.totalViewCount).toBe(0);
    expect(snap.totalVideoCount).toBe(0);
  });
});
