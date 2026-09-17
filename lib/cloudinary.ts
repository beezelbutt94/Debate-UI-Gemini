import { createHash } from 'node:crypto';

function config() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must all be set.');
  }

  return { cloudName, apiKey, apiSecret };
}

/**
 * Cloudinary's signed-upload algorithm: sort every signable param
 * alphabetically, join as "key=value&key=value", append the API secret,
 * hash it.
 *
 * On the hash choice — CodeQL flags SHA-1 here as a weak algorithm, and in
 * isolation it is right. But this is not our construction to pick: the
 * digest has to match what Cloudinary independently computes, and SHA-1 is
 * still their default. Switching unilaterally does not harden anything, it
 * just makes every signature mismatch and all uploads fail.
 *
 * What it is used for also matters. This is a keyed integrity tag over
 * non-secret upload parameters, not a password digest or a certificate
 * signature: forging one requires the API secret that is already appended
 * to the payload, so SHA-1's collision weakness does not give an attacker
 * a path in.
 *
 * Cloudinary does support SHA-256, as a per-account setting. Enable it in
 * the Cloudinary console, set CLOUDINARY_SIGNATURE_ALGORITHM=sha256, and
 * this follows. The two must be changed together.
 */
const SIGNATURE_ALGORITHM = process.env.CLOUDINARY_SIGNATURE_ALGORITHM === 'sha256' ? 'sha256' : 'sha1';

function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash(SIGNATURE_ALGORITHM).update(sorted + apiSecret).digest('hex');
}

export interface SignedUpload {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats: string;
}

/**
 * Mints credentials for a direct browser-to-Cloudinary upload, scoped to
 * a per-user folder. The video's bytes never pass through our own
 * serverless function -- the only real fix for Vercel's ~4.5MB request
 * body ceiling, which a multi-hundred-MB video would blow through
 * immediately if proxied.
 */
export function createSignedVideoUpload(userId: string): SignedUpload {
  const { cloudName, apiKey, apiSecret } = config();

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `viralengine/uploads/${userId}`;
  const allowedFormats = 'mp4,mov';

  const signature = signParams({ allowed_formats: allowedFormats, folder, timestamp }, apiSecret);

  return { cloudName, apiKey, timestamp, signature, folder, allowedFormats };
}

export interface CloudinaryVideoResource {
  public_id: string;
  duration: number;
  format: string;
  bytes: number;
  secure_url: string;
}

/**
 * Looks up a video's authoritative metadata via the Cloudinary Admin API
 * (Basic Auth: api_key:api_secret) rather than trusting client-supplied
 * duration/format -- the diagnostic route uses this to confirm the asset
 * is real, owned by the caller (folder-prefix check happens at the call
 * site), and to get a duration it can trust for frame-timestamp math.
 */
export async function fetchVideoResource(publicId: string): Promise<CloudinaryVideoResource> {
  const { cloudName, apiKey, apiSecret } = config();

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/video/upload/${encodeURIComponent(publicId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Cloudinary asset lookup failed (${res.status}): ${body.slice(0, 500)}`);
  }

  return (await res.json()) as CloudinaryVideoResource;
}

/**
 * On-the-fly delivery transformation URLs -- Cloudinary generates these
 * lazily on first request and caches the result, no separate "eager"
 * processing step needed. `so_<seconds>` extracts a video frame as a
 * still image; `fl_waveform` renders the audio track as a waveform PNG.
 * Both are real, standard Cloudinary transformation syntax.
 */
export function buildFrameUrl(cloudName: string, publicId: string, offsetSeconds: number): string {
  const offset = Math.max(0, offsetSeconds).toFixed(2);
  return `https://res.cloudinary.com/${cloudName}/video/upload/so_${offset},f_jpg,w_640,q_auto/${publicId}.jpg`;
}

export function buildWaveformUrl(cloudName: string, publicId: string): string {
  return `https://res.cloudinary.com/${cloudName}/video/upload/fl_waveform,co_rgb:f59e0b,b_rgb:0a0a0a,w_800,h_160/${publicId}.png`;
}

/**
 * Evenly spaced frame timestamps across the video, always including a
 * near-start frame (the 3-second-hook window the rest of ViralEngine's
 * scoring cares about) and capped at 6 frames to keep the vision call's
 * token cost bounded.
 */
export function pickFrameTimestamps(durationSeconds: number): number[] {
  const hookOffsets = [0, Math.min(1.5, durationSeconds / 4), Math.min(3, durationSeconds / 2)].filter(
    (t) => t < durationSeconds
  );

  const remainingSlots = Math.max(0, 6 - hookOffsets.length);
  const rest: number[] = [];
  if (remainingSlots > 0 && durationSeconds > 3) {
    const step = (durationSeconds - 3) / (remainingSlots + 1);
    for (let i = 1; i <= remainingSlots; i++) {
      rest.push(3 + step * i);
    }
  }

  return Array.from(new Set([...hookOffsets, ...rest].map((t) => Math.round(t * 100) / 100))).sort(
    (a, b) => a - b
  );
}
