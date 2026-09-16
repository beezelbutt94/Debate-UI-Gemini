import { getValidAccessToken } from './tokens';
import type { ScheduledPostRow } from '@/lib/types';

/**
 * Resumable upload protocol (the only way to upload actual bytes, as
 * opposed to metadata):
 * https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
 *
 * The video itself lives at a Cloudinary URL (media_urls[0]), not on this
 * server, so step 1 fetches those bytes and step 2 streams them straight
 * through to Google's upload session -- no full buffering in memory.
 */
export async function publishToYouTube(userId: string, post: ScheduledPostRow): Promise<{ externalPostId: string }> {
  const token = await getValidAccessToken(userId, 'youtube');
  if (!token) {
    throw new Error('YouTube is not connected for this account.');
  }
  const videoUrl = post.media_urls[0];
  if (!videoUrl) {
    throw new Error('This scheduled post has no media to publish.');
  }

  const source = await fetch(videoUrl);
  if (!source.ok || !source.body) {
    throw new Error(`Could not fetch the source video from Cloudinary: ${source.status}`);
  }
  const contentLength = source.headers.get('content-length');
  const contentType = source.headers.get('content-type') ?? 'video/mp4';

  const title = (post.caption ?? 'ViralEngine scheduled upload').slice(0, 95) + ' #Shorts';
  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': contentType,
        ...(contentLength ? { 'X-Upload-Content-Length': contentLength } : {}),
      },
      body: JSON.stringify({
        snippet: {
          title,
          description: post.caption ?? '',
          categoryId: '22', // People & Blogs -- a reasonable default; per-post category selection is a real follow-up
        },
        status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
      }),
    }
  );

  if (!initRes.ok) {
    throw new Error(`YouTube upload session init failed: ${initRes.status} ${await initRes.text()}`);
  }
  const sessionUri = initRes.headers.get('location');
  if (!sessionUri) {
    throw new Error('YouTube did not return a resumable upload session URI.');
  }

  const uploadRes = await fetch(sessionUri, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, ...(contentLength ? { 'Content-Length': contentLength } : {}) },
    // @ts-expect-error -- `duplex` is required by undici for streaming request bodies but missing from the RequestInit type
    duplex: 'half',
    body: source.body,
  });

  if (!uploadRes.ok) {
    throw new Error(`YouTube video upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }

  const body = await uploadRes.json();
  if (!body.id) {
    throw new Error(`YouTube upload succeeded but returned no video id: ${JSON.stringify(body)}`);
  }
  return { externalPostId: body.id };
}
