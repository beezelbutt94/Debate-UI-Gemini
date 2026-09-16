import { getValidAccessToken } from './tokens';
import type { ScheduledPostRow } from '@/lib/types';

/**
 * TikTok Content Posting API, Direct Post, PULL_FROM_URL source:
 * https://developers.tiktok.com/docs/en/content-posting-api-get-started
 *
 * Two real constraints this can't paper over:
 * 1. PULL_FROM_URL requires the video URL's domain (Cloudinary's, here)
 *    to be verified in the TikTok Developer Portal before TikTok will
 *    fetch from it -- a one-time setup step, not something this code can
 *    do for you.
 * 2. Until this app's client passes TikTok's content audit, everything it
 *    posts is forced to private/self-only visibility no matter what
 *    privacy_level is requested. Requesting PUBLIC_TO_EVERYONE here is
 *    still the honest ask -- TikTok itself enforces the downgrade, this
 *    code doesn't need to guess its own audit status.
 */
export async function publishToTikTok(userId: string, post: ScheduledPostRow): Promise<{ externalPostId: string }> {
  const token = await getValidAccessToken(userId, 'tiktok');
  if (!token) {
    throw new Error('TikTok is not connected for this account.');
  }
  const videoUrl = post.media_urls[0];
  if (!videoUrl) {
    throw new Error('This scheduled post has no media to publish.');
  }

  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: post.caption ?? '',
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
    }),
  });

  const body = await res.json();
  if (!res.ok || body?.error?.code !== 'ok') {
    throw new Error(`TikTok publish init failed: ${res.status} ${JSON.stringify(body)}`);
  }
  if (!body.data?.publish_id) {
    throw new Error(`TikTok publish init returned no publish_id: ${JSON.stringify(body)}`);
  }

  // The init call only confirms TikTok *accepted the job*, not that
  // processing/posting finished -- polling post/publish/status/fetch/ for
  // terminal state is a real, documented follow-up, same scoping choice
  // as the un-built calendar drag gesture in feature 7.
  return { externalPostId: body.data.publish_id };
}
