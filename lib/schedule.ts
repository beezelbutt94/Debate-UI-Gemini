import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { validateMediaUrls } from '@/lib/media';
import type { Platform, ScheduledPostRow } from '@/lib/types';

export const VALID_PLATFORMS: Platform[] = ['tiktok', 'youtube_shorts', 'facebook_reels'];
export const MAX_CAPTION_LENGTH = 2200;

/** Statuses a user may set directly; the rest are owned by the publisher. */
export const USER_SETTABLE_STATUSES = ['draft', 'scheduled'] as const;
export type UserSettableStatus = (typeof USER_SETTABLE_STATUSES)[number];

/** A post can be edited only before the publisher has picked it up. */
export const EDITABLE_STATUSES: ScheduledPostRow['status'][] = ['draft', 'scheduled', 'failed'];

/** Which OAuth connection each calendar platform publishes through. */
export const CONNECTION_FOR_PLATFORM: Record<Platform, 'tiktok' | 'youtube' | 'facebook'> = {
  tiktok: 'tiktok',
  youtube_shorts: 'youtube',
  facebook_reels: 'facebook',
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: 'TikTok',
  youtube_shorts: 'YouTube Shorts',
  facebook_reels: 'Facebook Reels',
};

export interface PostFields {
  platform?: Platform;
  publish_at?: string;
  caption?: string | null;
  media_urls?: string[];
  status?: UserSettableStatus;
}

/**
 * Validates the editable fields of a scheduled post from a JSON body.
 * `partial` allows any subset (PATCH); otherwise platform and publishAt
 * are required (POST).
 */
export function parsePostFields(
  body: Record<string, unknown>,
  userId: string,
  partial: boolean
): { ok: true; fields: PostFields } | { ok: false; error: string } {
  const fields: PostFields = {};

  if (body.platform !== undefined || !partial) {
    if (typeof body.platform !== 'string' || !VALID_PLATFORMS.includes(body.platform as Platform)) {
      return { ok: false, error: `Choose a platform: ${VALID_PLATFORMS.map((p) => PLATFORM_LABEL[p]).join(', ')}.` };
    }
    fields.platform = body.platform as Platform;
  }

  if (body.publishAt !== undefined || !partial) {
    if (typeof body.publishAt !== 'string' || Number.isNaN(Date.parse(body.publishAt))) {
      return { ok: false, error: 'Choose a valid publish date and time.' };
    }
    fields.publish_at = new Date(body.publishAt).toISOString();
  }

  if (body.caption !== undefined) {
    if (body.caption !== null && typeof body.caption !== 'string') {
      return { ok: false, error: 'Caption must be text.' };
    }
    const caption = typeof body.caption === 'string' ? body.caption.trim() : '';
    if (caption.length > MAX_CAPTION_LENGTH) {
      return { ok: false, error: `Captions can be at most ${MAX_CAPTION_LENGTH} characters.` };
    }
    fields.caption = caption || null;
  }

  if (body.mediaUrls !== undefined) {
    const media = validateMediaUrls(body.mediaUrls, process.env.CLOUDINARY_CLOUD_NAME, userId);
    if (!media.ok) return { ok: false, error: media.error };
    fields.media_urls = media.urls;
  }

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !USER_SETTABLE_STATUSES.includes(body.status as UserSettableStatus)) {
      return { ok: false, error: 'Status can only be set to draft or scheduled.' };
    }
    fields.status = body.status as UserSettableStatus;
  }

  return { ok: true, fields };
}

/**
 * Checks a post that is about to become 'scheduled' can actually publish:
 * it has a video and the matching platform account is connected. Returns an
 * error message, or null when ready.
 */
export async function readinessError(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  post: { platform: Platform; media_urls: string[] }
): Promise<string | null> {
  if (post.media_urls.length === 0) {
    return 'Attach a video before scheduling this post.';
  }
  const { data } = await admin
    .from('platform_connections')
    .select('platform')
    .eq('user_id', userId)
    .eq('platform', CONNECTION_FOR_PLATFORM[post.platform])
    .maybeSingle();
  if (!data) {
    return `Connect your ${PLATFORM_LABEL[post.platform]} account on the Connections page before scheduling.`;
  }
  return null;
}
