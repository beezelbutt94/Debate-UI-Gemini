import type { AccountPlatform, Platform } from '@/lib/types';

/**
 * Detects which of the three supported short-form platforms a pasted URL
 * belongs to. Returns null for anything else so the route handler can
 * reject it with a clear 400 instead of silently mis-analyzing it.
 */
export function detectPlatform(rawUrl: string): Platform | null {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }

  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    return 'tiktok';
  }

  if (
    (host === 'youtube.com' || host.endsWith('.youtube.com')) && rawUrl.includes('/shorts/')
  ) {
    return 'youtube_shorts';
  }
  if (host === 'youtu.be') {
    return 'youtube_shorts';
  }

  if (
    (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.watch') &&
    (rawUrl.includes('/reel/') || host === 'fb.watch')
  ) {
    return 'facebook_reels';
  }

  return null;
}

/**
 * Builds a real public profile URL for an account handle on one of the
 * three platforms this app tracks accounts on. Shared by any route that
 * needs to turn a bare handle into a URL Tavily can extract (Deep-Dive,
 * Competitor Espionage) -- one definition instead of duplicating the
 * same three-platform switch in each route.
 */
export function buildAccountProfileUrl(platform: AccountPlatform, handle: string): string {
  switch (platform) {
    case 'youtube':
      return `https://www.youtube.com/${handle.startsWith('@') ? handle : `@${handle}`}`;
    case 'tiktok':
      return `https://www.tiktok.com/@${handle.replace(/^@/, '')}`;
    case 'instagram':
      return `https://www.instagram.com/${handle.replace(/^@/, '')}/`;
  }
}
