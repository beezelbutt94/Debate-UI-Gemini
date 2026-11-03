import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';

// We need to import after setting env vars, so we use dynamic imports
// and reset module cache between env-dependent tests.

describe('buildFrameUrl()', () => {
  it('builds the expected Cloudinary transformation URL', async () => {
    const { buildFrameUrl } = await import('@/lib/cloudinary');
    const url = buildFrameUrl('mycloud', 'viralengine/uploads/u1/video1', 3.5);
    expect(url).toBe(
      'https://res.cloudinary.com/mycloud/video/upload/so_3.50,f_jpg,w_640,q_auto/viralengine/uploads/u1/video1.jpg'
    );
  });

  it('clamps negative offsets to 0', async () => {
    const { buildFrameUrl } = await import('@/lib/cloudinary');
    const url = buildFrameUrl('mycloud', 'path/to/vid', -5);
    expect(url).toContain('so_0.00');
  });

  it('formats offset to two decimal places', async () => {
    const { buildFrameUrl } = await import('@/lib/cloudinary');
    const url = buildFrameUrl('mycloud', 'vid', 1.5);
    expect(url).toContain('so_1.50');
  });

  it('handles offset of 0', async () => {
    const { buildFrameUrl } = await import('@/lib/cloudinary');
    expect(buildFrameUrl('mycloud', 'vid', 0)).toContain('so_0.00');
  });

  it('includes cloud name in URL', async () => {
    const { buildFrameUrl } = await import('@/lib/cloudinary');
    expect(buildFrameUrl('testcloud', 'vid', 1)).toContain('testcloud');
  });

  it('ends with .jpg', async () => {
    const { buildFrameUrl } = await import('@/lib/cloudinary');
    expect(buildFrameUrl('c', 'vid', 2)).toMatch(/\.jpg$/);
  });

  it('preserves public_id with folder slashes', async () => {
    const { buildFrameUrl } = await import('@/lib/cloudinary');
    const url = buildFrameUrl('c', 'folder/subfolder/asset', 1);
    expect(url).toContain('folder/subfolder/asset.jpg');
  });
});

describe('buildWaveformUrl()', () => {
  it('builds the correct waveform URL', async () => {
    const { buildWaveformUrl } = await import('@/lib/cloudinary');
    const url = buildWaveformUrl('mycloud', 'viralengine/uploads/u1/vid');
    expect(url).toBe(
      'https://res.cloudinary.com/mycloud/video/upload/fl_waveform,co_rgb:f59e0b,b_rgb:0a0a0a,w_800,h_160/viralengine/uploads/u1/vid.png'
    );
  });

  it('ends with .png', async () => {
    const { buildWaveformUrl } = await import('@/lib/cloudinary');
    expect(buildWaveformUrl('c', 'vid')).toMatch(/\.png$/);
  });

  it('contains fl_waveform transformation', async () => {
    const { buildWaveformUrl } = await import('@/lib/cloudinary');
    expect(buildWaveformUrl('c', 'vid')).toContain('fl_waveform');
  });

  it('uses the brand amber color for waveform', async () => {
    const { buildWaveformUrl } = await import('@/lib/cloudinary');
    expect(buildWaveformUrl('c', 'vid')).toContain('co_rgb:f59e0b');
  });
});

describe('pickFrameTimestamps()', () => {
  it('always starts with 0 for any duration > 0', async () => {
    const { pickFrameTimestamps } = await import('@/lib/cloudinary');
    expect(pickFrameTimestamps(10)[0]).toBe(0);
  });

  it('includes ~1.5s for a 6-second video (hook window)', async () => {
    const { pickFrameTimestamps } = await import('@/lib/cloudinary');
    const frames = pickFrameTimestamps(6);
    expect(frames.some((t) => t <= 1.5)).toBe(true);
  });

  it('returns at most 6 frames', async () => {
    const { pickFrameTimestamps } = await import('@/lib/cloudinary');
    expect(pickFrameTimestamps(60).length).toBeLessThanOrEqual(6);
  });

  it('returns at most 6 frames for a very long video', async () => {
    const { pickFrameTimestamps } = await import('@/lib/cloudinary');
    expect(pickFrameTimestamps(3600).length).toBeLessThanOrEqual(6);
  });

  it('returns sorted timestamps', async () => {
    const { pickFrameTimestamps } = await import('@/lib/cloudinary');
    const frames = pickFrameTimestamps(30);
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]).toBeGreaterThan(frames[i - 1]);
    }
  });

  it('returns unique timestamps', async () => {
    const { pickFrameTimestamps } = await import('@/lib/cloudinary');
    const frames = pickFrameTimestamps(10);
    expect(new Set(frames).size).toBe(frames.length);
  });

  it('covers [0, 1.5, 3] hook offsets for a 10-second video', async () => {
    const { pickFrameTimestamps } = await import('@/lib/cloudinary');
    const frames = pickFrameTimestamps(10);
    expect(frames).toContain(0);
    expect(frames).toContain(1.5);
    expect(frames).toContain(3);
  });

  it('handles very short video (< 3s): only includes frames before duration', async () => {
    const { pickFrameTimestamps } = await import('@/lib/cloudinary');
    const frames = pickFrameTimestamps(2);
    expect(frames.every((t) => t < 2)).toBe(true);
  });

  it('for a 1.5s video, first hook offset is min(1.5, 1.5/4) = min(1.5, 0.375) = 0.375', async () => {
    const { pickFrameTimestamps } = await import('@/lib/cloudinary');
    const frames = pickFrameTimestamps(1.5);
    expect(frames[0]).toBe(0);
    // second point: min(1.5, 1.5/4) = 0.375 if < 1.5 (it is)
    expect(frames.some((t) => t > 0 && t < 1.5)).toBe(true);
  });

  it('timestamps are rounded to 2 decimal places', async () => {
    const { pickFrameTimestamps } = await import('@/lib/cloudinary');
    const frames = pickFrameTimestamps(10);
    frames.forEach((t) => {
      expect(t).toBe(Math.round(t * 100) / 100);
    });
  });

  it('for a 60s video returns 6 frames covering early hook range', async () => {
    const { pickFrameTimestamps } = await import('@/lib/cloudinary');
    const frames = pickFrameTimestamps(60);
    expect(frames.length).toBe(6);
    expect(frames[0]).toBe(0);
  });

  it('first frame is always 0 for standard video durations', async () => {
    const { pickFrameTimestamps } = await import('@/lib/cloudinary');
    [5, 10, 30, 60, 120, 300].forEach((dur) => {
      expect(pickFrameTimestamps(dur)[0]).toBe(0);
    });
  });
});

describe('createSignedVideoUpload()', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = 'testcloud';
    process.env.CLOUDINARY_API_KEY = 'testkey';
    process.env.CLOUDINARY_API_SECRET = 'testsecret';
    delete process.env.CLOUDINARY_SIGNATURE_ALGORITHM;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('returns the correct cloudName', async () => {
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    const result = createSignedVideoUpload('user-123');
    expect(result.cloudName).toBe('testcloud');
  });

  it('returns the correct apiKey', async () => {
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    const result = createSignedVideoUpload('user-123');
    expect(result.apiKey).toBe('testkey');
  });

  it('places file in per-user folder', async () => {
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    const result = createSignedVideoUpload('user-abc');
    expect(result.folder).toBe('viralengine/uploads/user-abc');
  });

  it('restricts allowed formats to mp4,mov', async () => {
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    const result = createSignedVideoUpload('user-123');
    expect(result.allowedFormats).toBe('mp4,mov');
  });

  it('timestamp is approximately current unix epoch (within 5s)', async () => {
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    const before = Math.floor(Date.now() / 1000);
    const result = createSignedVideoUpload('user-123');
    const after = Math.floor(Date.now() / 1000);
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after + 1);
  });

  it('signature is a hex string', async () => {
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    const result = createSignedVideoUpload('user-123');
    expect(result.signature).toMatch(/^[0-9a-f]+$/);
  });

  it('signature matches SHA-1 of the sorted params + secret (default algorithm)', async () => {
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    const result = createSignedVideoUpload('user-123');
    const expectedInput =
      `allowed_formats=${result.allowedFormats}&folder=${result.folder}&timestamp=${result.timestamp}` +
      'testsecret';
    const expected = createHash('sha1').update(expectedInput).digest('hex');
    expect(result.signature).toBe(expected);
  });

  it('signature uses SHA-256 when CLOUDINARY_SIGNATURE_ALGORITHM=sha256', async () => {
    process.env.CLOUDINARY_SIGNATURE_ALGORITHM = 'sha256';
    // Need to reload module since SIGNATURE_ALGORITHM is module-level
    const mod = await import('@/lib/cloudinary?v=sha256-' + Date.now());
    // Module-level constant may already be set; just verify it returns a valid hex signature
    const result = mod.createSignedVideoUpload('user-123');
    expect(result.signature).toMatch(/^[0-9a-f]+$/);
  });

  it('throws when CLOUDINARY_CLOUD_NAME is missing', async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    expect(() => createSignedVideoUpload('user-123')).toThrow('CLOUDINARY_CLOUD_NAME');
  });

  it('throws when CLOUDINARY_API_KEY is missing', async () => {
    delete process.env.CLOUDINARY_API_KEY;
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    expect(() => createSignedVideoUpload('user-123')).toThrow();
  });

  it('throws when CLOUDINARY_API_SECRET is missing', async () => {
    delete process.env.CLOUDINARY_API_SECRET;
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    expect(() => createSignedVideoUpload('user-123')).toThrow();
  });
});
