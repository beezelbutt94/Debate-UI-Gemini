/**
 * Validation for media URLs attached to scheduled posts. Pure, so it is
 * unit-tested directly (tests/unit/media.test.ts).
 *
 * The cron publisher downloads media_urls[0] server-side (YouTube) or hands
 * it to a platform to fetch (TikTok, Facebook). Accepting arbitrary URLs
 * would let any signed-in user make the server fetch internal addresses and
 * upload the response to their own channel, so only videos the user
 * uploaded through the app's signed Cloudinary upload are accepted:
 *
 *   https://res.cloudinary.com/<cloud>/video/upload/[v<digits>/]viral-trending/uploads/<userId>/<name>.<mp4|mov>
 */

export const MAX_MEDIA_URLS = 4;

export function uploadFolderFor(userId: string): string {
  return `viral-trending/uploads/${userId}`;
}

export function isOwnedMediaUrl(raw: string, cloudName: string, userId: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return false;
  if (url.username || url.password || url.port || url.search || url.hash) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(cloudName) || !/^[A-Za-z0-9_-]+$/.test(userId)) return false;

  const pattern = new RegExp(
    `^/${cloudName}/video/upload/(?:v\\d+/)?${uploadFolderFor(userId)}/[A-Za-z0-9_-]+\\.(?:mp4|mov)$`
  );
  return pattern.test(url.pathname);
}

/**
 * Normalises a client-supplied mediaUrls value. Returns the cleaned list, or
 * an error message suitable for a 400 response.
 */
export function validateMediaUrls(
  value: unknown,
  cloudName: string | undefined,
  userId: string
): { ok: true; urls: string[] } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, urls: [] };
  if (!Array.isArray(value)) return { ok: false, error: '"mediaUrls" must be an array of URLs.' };
  if (value.length > MAX_MEDIA_URLS) {
    return { ok: false, error: `A post can have at most ${MAX_MEDIA_URLS} media files.` };
  }
  if (value.length === 0) return { ok: true, urls: [] };
  if (!cloudName) {
    return { ok: false, error: 'Video uploads are not configured on this server.' };
  }
  const urls: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !isOwnedMediaUrl(item, cloudName, userId)) {
      return { ok: false, error: 'Attach a video you uploaded here; other links cannot be published.' };
    }
    urls.push(item);
  }
  return { ok: true, urls };
}
