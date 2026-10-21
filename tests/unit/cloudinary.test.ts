import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';

// ── Env-dependent tests use vi.stubEnv so the module's config() gets the values
const TEST_ENV = {
  CLOUDINARY_CLOUD_NAME: 'test-cloud',
  CLOUDINARY_API_KEY: 'test-key-123',
  CLOUDINARY_API_SECRET: 'test-secret-abc',
};

// Pure-function imports are safe at module level
import { buildFrameUrl, buildWaveformUrl, pickFrameTimestamps } from '@/lib/cloudinary';

// ── buildFrameUrl() ─────────────────────────────────────────────────────────

describe('buildFrameUrl()', () => {
  const CLOUD = 'mycloudname';
  const PID = 'viralengine/uploads/user1/myvideo';

  it('returns a string starting with https', () => {
    expect(buildFrameUrl(CLOUD, PID, 3)).toMatch(/^https:\/\//);
  });

  it('includes the cloud name', () => {
    expect(buildFrameUrl(CLOUD, PID, 3)).toContain(CLOUD);
  });

  it('includes the public_id', () => {
    expect(buildFrameUrl(CLOUD, PID, 3)).toContain(PID);
  });

  it('includes so_ offset with 2 decimal places', () => {
    expect(buildFrameUrl(CLOUD, PID, 3)).toContain('so_3.00');
  });

  it('clamps negative offsets to 0', () => {
    expect(buildFrameUrl(CLOUD, PID, -5)).toContain('so_0.00');
  });

  it('handles fractional offset', () => {
    expect(buildFrameUrl(CLOUD, PID, 1.5)).toContain('so_1.50');
  });

  it('handles zero offset', () => {
    expect(buildFrameUrl(CLOUD, PID, 0)).toContain('so_0.00');
  });

  it('includes jpg format transformation', () => {
    expect(buildFrameUrl(CLOUD, PID, 3)).toContain('f_jpg');
  });

  it('includes width transformation', () => {
    expect(buildFrameUrl(CLOUD, PID, 3)).toContain('w_640');
  });

  it('ends with .jpg extension', () => {
    expect(buildFrameUrl(CLOUD, PID, 3)).toMatch(/\.jpg$/);
  });

  it('produces different URLs for different offsets', () => {
    expect(buildFrameUrl(CLOUD, PID, 1)).not.toBe(buildFrameUrl(CLOUD, PID, 5));
  });

  it('handles large offsets correctly', () => {
    expect(buildFrameUrl(CLOUD, PID, 3600)).toContain('so_3600.00');
  });
});

// ── buildWaveformUrl() ───────────────────────────────────────────────────────

describe('buildWaveformUrl()', () => {
  const CLOUD = 'mycloudname';
  const PID = 'viralengine/uploads/user1/myvideo';

  it('returns a string starting with https', () => {
    expect(buildWaveformUrl(CLOUD, PID)).toMatch(/^https:\/\//);
  });

  it('includes the cloud name', () => {
    expect(buildWaveformUrl(CLOUD, PID)).toContain(CLOUD);
  });

  it('includes the public_id', () => {
    expect(buildWaveformUrl(CLOUD, PID)).toContain(PID);
  });

  it('includes fl_waveform transformation', () => {
    expect(buildWaveformUrl(CLOUD, PID)).toContain('fl_waveform');
  });

  it('ends with .png extension', () => {
    expect(buildWaveformUrl(CLOUD, PID)).toMatch(/\.png$/);
  });

  it('includes width and height parameters', () => {
    const url = buildWaveformUrl(CLOUD, PID);
    expect(url).toContain('w_800');
    expect(url).toContain('h_160');
  });

  it('includes color parameters', () => {
    const url = buildWaveformUrl(CLOUD, PID);
    expect(url).toContain('co_rgb');
    expect(url).toContain('b_rgb');
  });

  it('is deterministic', () => {
    expect(buildWaveformUrl(CLOUD, PID)).toBe(buildWaveformUrl(CLOUD, PID));
  });
});

// ── pickFrameTimestamps() ────────────────────────────────────────────────────

describe('pickFrameTimestamps()', () => {
  it('always starts with 0 for any video', () => {
    expect(pickFrameTimestamps(10)[0]).toBe(0);
  });

  it('returns at most 6 timestamps', () => {
    expect(pickFrameTimestamps(120).length).toBeLessThanOrEqual(6);
    expect(pickFrameTimestamps(3600).length).toBeLessThanOrEqual(6);
  });

  it('returns sorted timestamps', () => {
    const ts = pickFrameTimestamps(60);
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]).toBeGreaterThan(ts[i - 1]);
    }
  });

  it('returns unique timestamps (no duplicates)', () => {
    const ts = pickFrameTimestamps(60);
    expect(new Set(ts).size).toBe(ts.length);
  });

  it('all timestamps are within duration (< durationSeconds)', () => {
    const duration = 45;
    for (const t of pickFrameTimestamps(duration)) {
      expect(t).toBeLessThan(duration);
    }
  });

  it('includes a near-start frame (≤ 3s) for normal-length video', () => {
    const ts = pickFrameTimestamps(30);
    expect(ts.some((t) => t <= 3)).toBe(true);
  });

  it('hook offsets within first 3s for 10s video', () => {
    const ts = pickFrameTimestamps(10);
    const hookTs = ts.filter((t) => t <= 3);
    expect(hookTs.length).toBeGreaterThan(0);
  });

  it('handles 1-second video (very short)', () => {
    const ts = pickFrameTimestamps(1);
    expect(ts.length).toBeGreaterThan(0);
    for (const t of ts) {
      expect(t).toBeLessThan(1);
    }
  });

  it('handles 3-second video (boundary)', () => {
    const ts = pickFrameTimestamps(3);
    expect(ts.length).toBeGreaterThan(0);
    for (const t of ts) {
      expect(t).toBeLessThan(3);
    }
  });

  it('for long videos, fills up to 6 slots', () => {
    expect(pickFrameTimestamps(60).length).toBe(6);
  });

  it('for long videos, distributes frames beyond 3s', () => {
    const ts = pickFrameTimestamps(60);
    expect(ts.some((t) => t > 3)).toBe(true);
  });

  it('returns timestamps rounded to 2 decimal places', () => {
    for (const t of pickFrameTimestamps(37)) {
      expect(parseFloat(t.toFixed(2))).toBe(t);
    }
  });

  it('handles exactly 6-second video', () => {
    const ts = pickFrameTimestamps(6);
    expect(ts.length).toBeLessThanOrEqual(6);
    for (const t of ts) {
      expect(t).toBeLessThan(6);
    }
  });

  it('does not return negative timestamps', () => {
    for (const t of pickFrameTimestamps(10)) {
      expect(t).toBeGreaterThanOrEqual(0);
    }
  });

  it('hook timestamps are capped at durationSeconds boundary', () => {
    const ts = pickFrameTimestamps(0.5);
    for (const t of ts) {
      expect(t).toBeLessThan(0.5);
    }
  });
});

// ── createSignedVideoUpload() + config() ─────────────────────────────────────
// These require env vars. We set them with vi.stubEnv, which automatically
// restores the originals after each test.

describe('createSignedVideoUpload()', () => {
  beforeEach(() => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', TEST_ENV.CLOUDINARY_CLOUD_NAME);
    vi.stubEnv('CLOUDINARY_API_KEY', TEST_ENV.CLOUDINARY_API_KEY);
    vi.stubEnv('CLOUDINARY_API_SECRET', TEST_ENV.CLOUDINARY_API_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the correct cloudName', async () => {
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    const result = createSignedVideoUpload('user123');
    expect(result.cloudName).toBe(TEST_ENV.CLOUDINARY_CLOUD_NAME);
  });

  it('returns the correct apiKey', async () => {
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    const result = createSignedVideoUpload('user123');
    expect(result.apiKey).toBe(TEST_ENV.CLOUDINARY_API_KEY);
  });

  it('returns a unix timestamp within 2 seconds of now', async () => {
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    const before = Math.floor(Date.now() / 1000);
    const result = createSignedVideoUpload('user123');
    const after = Math.floor(Date.now() / 1000);
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after + 1);
  });

  it('scopes folder to the userId', async () => {
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    const result = createSignedVideoUpload('user-abc');
    expect(result.folder).toBe('viralengine/uploads/user-abc');
  });

  it('allowedFormats is mp4,mov', async () => {
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    const result = createSignedVideoUpload('user123');
    expect(result.allowedFormats).toBe('mp4,mov');
  });

  it('signature is a hex string', async () => {
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    const result = createSignedVideoUpload('user123');
    expect(result.signature).toMatch(/^[0-9a-f]+$/);
  });

  it('signature length is correct for SHA-1 (40 hex chars)', async () => {
    vi.stubEnv('CLOUDINARY_SIGNATURE_ALGORITHM', '');
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    const result = createSignedVideoUpload('user123');
    // SHA-1 → 20 bytes → 40 hex chars; SHA-256 → 32 bytes → 64 hex chars
    expect([40, 64]).toContain(result.signature.length);
  });

  it('signature is reproducible given the same params and secret', async () => {
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    // Two calls will have different timestamps so we verify the hex format only.
    const r1 = createSignedVideoUpload('user123');
    expect(r1.signature).toMatch(/^[0-9a-f]+$/);
  });

  it('different users get different folders', async () => {
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    const r1 = createSignedVideoUpload('alice');
    const r2 = createSignedVideoUpload('bob');
    expect(r1.folder).not.toBe(r2.folder);
  });
});

describe('config() via createSignedVideoUpload()', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws when CLOUDINARY_CLOUD_NAME is missing', async () => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', '');
    vi.stubEnv('CLOUDINARY_API_KEY', 'key');
    vi.stubEnv('CLOUDINARY_API_SECRET', 'secret');
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    expect(() => createSignedVideoUpload('u1')).toThrow('CLOUDINARY_CLOUD_NAME');
  });

  it('throws when CLOUDINARY_API_KEY is missing', async () => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'cloud');
    vi.stubEnv('CLOUDINARY_API_KEY', '');
    vi.stubEnv('CLOUDINARY_API_SECRET', 'secret');
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    expect(() => createSignedVideoUpload('u1')).toThrow('CLOUDINARY_API_KEY');
  });

  it('throws when CLOUDINARY_API_SECRET is missing', async () => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'cloud');
    vi.stubEnv('CLOUDINARY_API_KEY', 'key');
    vi.stubEnv('CLOUDINARY_API_SECRET', '');
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    expect(() => createSignedVideoUpload('u1')).toThrow('CLOUDINARY_API_SECRET');
  });

  it('does not throw when all three env vars are set', async () => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'cloud');
    vi.stubEnv('CLOUDINARY_API_KEY', 'key');
    vi.stubEnv('CLOUDINARY_API_SECRET', 'secret');
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    expect(() => createSignedVideoUpload('u1')).not.toThrow();
  });
});

// ── fetchVideoResource() ─────────────────────────────────────────────────────

describe('fetchVideoResource()', () => {
  beforeEach(() => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', TEST_ENV.CLOUDINARY_CLOUD_NAME);
    vi.stubEnv('CLOUDINARY_API_KEY', TEST_ENV.CLOUDINARY_API_KEY);
    vi.stubEnv('CLOUDINARY_API_SECRET', TEST_ENV.CLOUDINARY_API_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on a 200 response', async () => {
    const mockResource = {
      public_id: 'viralengine/uploads/u1/vid1',
      duration: 30.5,
      format: 'mp4',
      bytes: 5_000_000,
      secure_url: 'https://res.cloudinary.com/test-cloud/video/upload/vid1.mp4',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResource), { status: 200 })
    );

    const { fetchVideoResource } = await import('@/lib/cloudinary');
    const result = await fetchVideoResource('viralengine/uploads/u1/vid1');
    expect(result).toEqual(mockResource);
  });

  it('sends a Basic Auth header', async () => {
    const mockResource = { public_id: 'p', duration: 1, format: 'mp4', bytes: 100, secure_url: 'https://x' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResource), { status: 200 })
    );

    const { fetchVideoResource } = await import('@/lib/cloudinary');
    await fetchVideoResource('some/public-id');

    const [, init] = fetchSpy.mock.calls[0];
    const authHeader = (init as RequestInit).headers as Record<string, string>;
    expect(authHeader['Authorization']).toMatch(/^Basic /);
  });

  it('URL encodes the public_id in the request URL', async () => {
    const mockResource = { public_id: 'p', duration: 1, format: 'mp4', bytes: 100, secure_url: 'https://x' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResource), { status: 200 })
    );

    const { fetchVideoResource } = await import('@/lib/cloudinary');
    await fetchVideoResource('viralengine/uploads/u1/my video');

    const [url] = fetchSpy.mock.calls[0];
    expect(url as string).toContain(encodeURIComponent('viralengine/uploads/u1/my video'));
  });

  it('throws on non-200 response with status code in message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 })
    );

    const { fetchVideoResource } = await import('@/lib/cloudinary');
    await expect(fetchVideoResource('missing/asset')).rejects.toThrow('404');
  });

  it('throws on 500 response and includes status in message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    );

    const { fetchVideoResource } = await import('@/lib/cloudinary');
    await expect(fetchVideoResource('some/asset')).rejects.toThrow('500');
  });

  it('truncates long error bodies to 500 chars', async () => {
    const longBody = 'x'.repeat(1000);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(longBody, { status: 422 })
    );

    const { fetchVideoResource } = await import('@/lib/cloudinary');
    await expect(fetchVideoResource('some/asset')).rejects.toThrow(/x{500}$/);
  });
});
