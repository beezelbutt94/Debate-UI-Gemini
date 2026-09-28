import { ConfigurationError, UserFacingError } from '@/lib/errors';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface YoutubeChannelListResponse {
  items: {
    id: string;
    snippet: { title: string; description: string; publishedAt: string };
    statistics: {
      subscriberCount?: string;
      viewCount?: string;
      videoCount?: string;
      hiddenSubscriberCount?: boolean;
    };
    contentDetails: { relatedPlaylists: { uploads: string } };
  }[];
}

interface YoutubePlaylistItemsResponse {
  items: { contentDetails: { videoId: string; videoPublishedAt: string } }[];
}

interface YoutubeVideoListResponse {
  items: {
    id: string;
    snippet: { title: string; publishedAt: string };
    statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
  }[];
}

export interface YoutubeChannelSnapshot {
  channelId: string;
  title: string;
  subscriberCount: number | null;
  totalViewCount: number;
  totalVideoCount: number;
  recentVideos: {
    id: string;
    title: string;
    publishedAt: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
  }[];
  avgDaysBetweenUploads: number | null;
  avgViewToSubscriberRatio: number | null;
}

function apiKey(): string {
  if (!process.env.YOUTUBE_API_KEY) {
    throw new ConfigurationError('YOUTUBE_API_KEY');
  }
  return process.env.YOUTUBE_API_KEY;
}

async function youtubeGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${YOUTUBE_API_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('key', apiKey());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(url.toString(), { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`YouTube Data API ${path} failed (${res.status}): ${body.slice(0, 500)}`);
  }

  return (await res.json()) as T;
}

/**
 * Strips a leading "@" or a full channel/handle URL down to the bare
 * handle YouTube's API expects for the `forHandle` parameter.
 */
function normalizeHandle(rawHandle: string): string {
  const trimmed = rawHandle.trim();
  const fromUrl = trimmed.match(/youtube\.com\/(@[\w.-]+)/i);
  const handle = fromUrl ? fromUrl[1] : trimmed;
  return handle.startsWith('@') ? handle : `@${handle}`;
}

/**
 * Real, official YouTube Data API v3 calls (channels.list, playlistItems.list,
 * videos.list) — no scraping, no speculative endpoints. Computes posting
 * cadence and view-to-subscriber ratio from the last 15 uploads, the two
 * "posting patterns" / "view-to-follower ratio" signals the Creator Account
 * Deep-Dive spec asks for, that the API actually provides real numbers for.
 */
export async function fetchYoutubeChannelSnapshot(rawHandle: string): Promise<YoutubeChannelSnapshot> {
  const handle = normalizeHandle(rawHandle);

  const channelRes = await youtubeGet<YoutubeChannelListResponse>('channels', {
    part: 'snippet,statistics,contentDetails',
    forHandle: handle,
  });

  const channel = channelRes.items[0];
  if (!channel) {
    throw new UserFacingError(`No YouTube channel found for handle "${rawHandle}".`, 404);
  }

  const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

  const playlistRes = await youtubeGet<YoutubePlaylistItemsResponse>('playlistItems', {
    part: 'contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: '15',
  });

  const videoIds = playlistRes.items.map((item) => item.contentDetails.videoId);
  let recentVideos: YoutubeChannelSnapshot['recentVideos'] = [];

  if (videoIds.length > 0) {
    const videosRes = await youtubeGet<YoutubeVideoListResponse>('videos', {
      part: 'snippet,statistics',
      id: videoIds.join(','),
    });

    recentVideos = videosRes.items
      .map((v) => ({
        id: v.id,
        title: v.snippet.title,
        publishedAt: v.snippet.publishedAt,
        viewCount: Number(v.statistics.viewCount ?? 0),
        likeCount: Number(v.statistics.likeCount ?? 0),
        commentCount: Number(v.statistics.commentCount ?? 0),
      }))
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  const avgDaysBetweenUploads = computeAvgDaysBetween(recentVideos.map((v) => v.publishedAt));

  const subscriberCount = channel.statistics.hiddenSubscriberCount
    ? null
    : Number(channel.statistics.subscriberCount ?? 0);

  const avgViewToSubscriberRatio =
    subscriberCount && subscriberCount > 0 && recentVideos.length > 0
      ? recentVideos.reduce((sum, v) => sum + v.viewCount, 0) / recentVideos.length / subscriberCount
      : null;

  return {
    channelId: channel.id,
    title: channel.snippet.title,
    subscriberCount,
    totalViewCount: Number(channel.statistics.viewCount ?? 0),
    totalVideoCount: Number(channel.statistics.videoCount ?? 0),
    recentVideos,
    avgDaysBetweenUploads,
    avgViewToSubscriberRatio,
  };
}

function computeAvgDaysBetween(publishedAtDates: string[]): number | null {
  if (publishedAtDates.length < 2) return null;

  const sorted = [...publishedAtDates]
    .map((d) => new Date(d).getTime())
    .sort((a, b) => b - a);

  let totalGapMs = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    totalGapMs += sorted[i] - sorted[i + 1];
  }

  return totalGapMs / (sorted.length - 1) / (1000 * 60 * 60 * 24);
}
