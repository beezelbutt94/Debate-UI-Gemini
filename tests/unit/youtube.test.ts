import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// fetchYoutubeChannelSnapshot and its private helpers (normalizeHandle,
// computeAvgDaysBetween) can only be exercised through the public function.
// We mock fetch so the tests run without network access.

function makeChannelItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'UC_channel_1',
    snippet: { title: 'Test Channel', description: 'desc', publishedAt: '2020-01-01T00:00:00Z' },
    statistics: {
      subscriberCount: '100000',
      viewCount: '5000000',
      videoCount: '50',
      hiddenSubscriberCount: false,
    },
    contentDetails: { relatedPlaylists: { uploads: 'UU_channel_1' } },
    ...overrides,
  };
}

function makePlaylistItem(videoId: string, publishedAt: string) {
  return { contentDetails: { videoId, videoPublishedAt: publishedAt } };
}

function makeVideoItem(id: string, title: string, publishedAt: string, stats = {}) {
  return {
    id,
    snippet: { title, publishedAt },
    statistics: { viewCount: '1000', likeCount: '50', commentCount: '5', ...stats },
  };
}

describe('fetchYoutubeChannelSnapshot', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = 'test-api-key';
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('throws when YOUTUBE_API_KEY is not set', async () => {
    delete process.env.YOUTUBE_API_KEY;
    vi.resetModules();
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    vi.stubGlobal('fetch', vi.fn());
    await expect(fetchYoutubeChannelSnapshot('@testchannel')).rejects.toThrow('YOUTUBE_API_KEY');
  });

  it('throws when no channel is found for the handle', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    }));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    await expect(fetchYoutubeChannelSnapshot('@unknown')).rejects.toThrow('No YouTube channel found');
  });

  it('throws when the YouTube API returns a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'quota exceeded',
    }));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    await expect(fetchYoutubeChannelSnapshot('@test')).rejects.toThrow('403');
  });

  it('returns channel snapshot with correct basic fields', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) {
        // channels.list
        return Promise.resolve({ ok: true, json: async () => ({ items: [makeChannelItem()] }) });
      }
      if (call === 2) {
        // playlistItems.list
        return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
    }));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    const snap = await fetchYoutubeChannelSnapshot('@TestChannel');
    expect(snap.channelId).toBe('UC_channel_1');
    expect(snap.title).toBe('Test Channel');
    expect(snap.subscriberCount).toBe(100000);
    expect(snap.totalViewCount).toBe(5000000);
    expect(snap.totalVideoCount).toBe(50);
  });

  it('sets subscriberCount to null when hiddenSubscriberCount is true', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [makeChannelItem({ statistics: { hiddenSubscriberCount: true, viewCount: '1000', videoCount: '5' } })],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
    }));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    const snap = await fetchYoutubeChannelSnapshot('@private');
    expect(snap.subscriberCount).toBeNull();
  });

  it('computes avgDaysBetweenUploads as null when fewer than 2 videos', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ items: [makeChannelItem()] }) });
      }
      if (call === 2) {
        // only one playlist item
        return Promise.resolve({ ok: true, json: async () => ({ items: [makePlaylistItem('v1', '2024-01-01T00:00:00Z')] }) });
      }
      // videos.list
      return Promise.resolve({
        ok: true,
        json: async () => ({ items: [makeVideoItem('v1', 'First video', '2024-01-01T00:00:00Z')] }),
      });
    }));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    const snap = await fetchYoutubeChannelSnapshot('@one-video');
    expect(snap.avgDaysBetweenUploads).toBeNull();
  });

  it('computes avgDaysBetweenUploads correctly for two videos 7 days apart', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ items: [makeChannelItem()] }) });
      }
      if (call === 2) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              makePlaylistItem('v1', '2024-01-08T00:00:00Z'),
              makePlaylistItem('v2', '2024-01-01T00:00:00Z'),
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [
            makeVideoItem('v1', 'Week 2', '2024-01-08T00:00:00Z'),
            makeVideoItem('v2', 'Week 1', '2024-01-01T00:00:00Z'),
          ],
        }),
      });
    }));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    const snap = await fetchYoutubeChannelSnapshot('@weekly');
    expect(snap.avgDaysBetweenUploads).toBeCloseTo(7, 2);
  });

  it('sets avgViewToSubscriberRatio to null when subscriberCount is hidden', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [makeChannelItem({ statistics: { hiddenSubscriberCount: true, viewCount: '1000', videoCount: '5' } })],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
    }));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    const snap = await fetchYoutubeChannelSnapshot('@private');
    expect(snap.avgViewToSubscriberRatio).toBeNull();
  });

  it('sets avgViewToSubscriberRatio to null when there are no videos', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ items: [makeChannelItem()] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
    }));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    const snap = await fetchYoutubeChannelSnapshot('@new');
    expect(snap.avgViewToSubscriberRatio).toBeNull();
  });

  it('computes avgViewToSubscriberRatio correctly', async () => {
    // 2 videos × 1000 views each = 2000 total, avg = 1000, ratio = 1000/100000 = 0.01
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ items: [makeChannelItem()] }) });
      }
      if (call === 2) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              makePlaylistItem('v1', '2024-01-02T00:00:00Z'),
              makePlaylistItem('v2', '2024-01-01T00:00:00Z'),
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [
            makeVideoItem('v1', 'V1', '2024-01-02T00:00:00Z', { viewCount: '1000' }),
            makeVideoItem('v2', 'V2', '2024-01-01T00:00:00Z', { viewCount: '1000' }),
          ],
        }),
      });
    }));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    const snap = await fetchYoutubeChannelSnapshot('@test');
    expect(snap.avgViewToSubscriberRatio).toBeCloseTo(0.01, 5);
  });

  it('sorts recent videos newest-first', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ items: [makeChannelItem()] }) });
      }
      if (call === 2) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              makePlaylistItem('v1', '2024-01-01T00:00:00Z'),
              makePlaylistItem('v2', '2024-03-01T00:00:00Z'),
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [
            makeVideoItem('v1', 'Old', '2024-01-01T00:00:00Z'),
            makeVideoItem('v2', 'New', '2024-03-01T00:00:00Z'),
          ],
        }),
      });
    }));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    const snap = await fetchYoutubeChannelSnapshot('@test');
    expect(snap.recentVideos[0].title).toBe('New');
    expect(snap.recentVideos[1].title).toBe('Old');
  });

  // normalizeHandle edge cases (exercised indirectly through fetch call params)
  it('prepends @ to a bare handle without @', async () => {
    let capturedUrl = '';
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({ ok: false, status: 200, text: async () => '' });
    }));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    // Will throw, but we capture the URL first
    await fetchYoutubeChannelSnapshot('MrBeast').catch(() => {});
    expect(capturedUrl).toContain('forHandle=%40MrBeast');
  });

  it('keeps existing @ on a handle that already starts with @', async () => {
    let capturedUrl = '';
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({ ok: false, status: 200, text: async () => '' });
    }));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    await fetchYoutubeChannelSnapshot('@MrBeast').catch(() => {});
    // %40 is URL-encoded @
    expect(capturedUrl).toContain('forHandle=%40MrBeast');
  });

  it('extracts handle from a full youtube.com/@handle URL', async () => {
    let capturedUrl = '';
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({ ok: false, status: 200, text: async () => '' });
    }));
    const { fetchYoutubeChannelSnapshot } = await import('@/lib/youtube');
    await fetchYoutubeChannelSnapshot('https://www.youtube.com/@MrBeast').catch(() => {});
    expect(capturedUrl).toContain('forHandle=%40MrBeast');
  });
});
