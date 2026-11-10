import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchYoutubeChannelSnapshot } from '@/lib/youtube';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function mockYoutube(dates: string[]) {
  vi.stubEnv('YOUTUBE_API_KEY', 'unit-test-key');
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    let payload: unknown;
    if (url.pathname.endsWith('/channels')) {
      payload = { items: [{ id: 'channel', snippet: { title: 'Test', description: '', publishedAt: '2020-01-01' },
        statistics: { subscriberCount: '10', viewCount: '100', videoCount: String(dates.length) },
        contentDetails: { relatedPlaylists: { uploads: 'uploads' } } }] };
    } else if (url.pathname.endsWith('/playlistItems')) {
      payload = { items: dates.map((date, i) => ({ contentDetails: { videoId: String(i), videoPublishedAt: date } })) };
    } else if (url.pathname.endsWith('/videos')) {
      payload = { items: dates.map((date, i) => ({ id: String(i), snippet: { title: 'Video', publishedAt: date },
        statistics: { viewCount: '20', likeCount: '1', commentCount: '0' } })) };
    } else { throw new Error('Unexpected endpoint: ' + url.pathname); }
    return new Response(JSON.stringify(payload), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('YouTube handle normalization through the production snapshot API', () => {
  it.each([
    ['MrBeast', '@MrBeast'],
    ['@MrBeast', '@MrBeast'],
    ['https://www.youtube.com/@PewDiePie', '@PewDiePie'],
    ['https://youtube.com/@veritasium/videos', '@veritasium'],
    ['  @trimme  ', '@trimme'],
    ['channelname', '@channelname'],
    ['@channel.name', '@channel.name'],
    ['channel-name', '@channel-name'],
  ])('normalizes %s to %s in the channels request', async (input, expected) => {
    const fetchMock = mockYoutube([]);
    await fetchYoutubeChannelSnapshot(input);
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('forHandle')).toBe(expected);
  });
});

describe('Upload cadence through the production snapshot API', () => {
  it.each([
    [[], null],
    [['2024-01-01T00:00:00Z'], null],
    [['2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z'], 1],
    [['2024-01-01T00:00:00Z', '2024-01-08T00:00:00Z'], 7],
    [['2024-01-01T00:00:00Z', '2024-01-04T00:00:00Z', '2024-01-07T00:00:00Z'], 3],
    [['2024-01-08T00:00:00Z', '2024-01-01T00:00:00Z'], 7],
    [['2024-01-01T00:00:00Z', '2024-01-01T12:00:00Z'], 0.5],
    [['2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'], 0],
    [['2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z', '2024-01-10T00:00:00Z'], 4.5],
  ] satisfies Array<[string[], number | null]>)('computes cadence for %j', async (dates, expected) => {
    mockYoutube(dates);
    const snapshot = await fetchYoutubeChannelSnapshot('test');
    if (expected === null) expect(snapshot.avgDaysBetweenUploads).toBeNull();
    else expect(snapshot.avgDaysBetweenUploads).toBeCloseTo(expected, 6);
  });
});
