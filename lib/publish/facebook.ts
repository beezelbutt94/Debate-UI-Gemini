import { getValidAccessToken } from './tokens';
import type { ScheduledPostRow } from '@/lib/types';

const GRAPH_VERSION = 'v21.0';

/**
 * Facebook Page Reels Publishing API, 3-phase upload from a hosted URL:
 * https://developers.facebook.com/documentation/video-api/guides/reels-publishing
 *
 * Reels can only be published to a Page (never a personal profile or
 * Group), which is why lib/oauth/facebook.ts connects the creator's Page,
 * not their personal account -- externalAccountId here is the Page id.
 */
export async function publishToFacebook(userId: string, post: ScheduledPostRow): Promise<{ externalPostId: string }> {
  const token = await getValidAccessToken(userId, 'facebook');
  if (!token || !token.externalAccountId) {
    throw new Error('Facebook is not connected for this account.');
  }
  const videoUrl = post.media_urls[0];
  if (!videoUrl) {
    throw new Error('This scheduled post has no media to publish.');
  }
  const pageId = token.externalAccountId;
  const pageAccessToken = token.accessToken;

  const start = await postForm(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/video_reels`, {
    upload_phase: 'start',
    access_token: pageAccessToken,
  });
  const videoId = start.video_id;
  if (!videoId) {
    throw new Error(`Facebook Reels start phase returned no video_id: ${JSON.stringify(start)}`);
  }

  const uploadRes = await fetch(`https://rupload.facebook.com/video-upload/${GRAPH_VERSION}/${videoId}`, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${pageAccessToken}`,
      file_url: videoUrl,
    },
  });
  if (!uploadRes.ok) {
    throw new Error(`Facebook Reels upload phase failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }

  const finish = await postForm(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/video_reels`, {
    video_id: videoId,
    upload_phase: 'finish',
    video_state: 'PUBLISHED',
    description: post.caption ?? '',
    access_token: pageAccessToken,
  });
  if (!finish.success) {
    throw new Error(`Facebook Reels finish phase did not report success: ${JSON.stringify(finish)}`);
  }

  return { externalPostId: videoId };
}

async function postForm(url: string, params: Record<string, string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(`Facebook Graph API call to ${url} failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}
