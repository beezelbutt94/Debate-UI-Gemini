import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'crypto';
import {
  buildFrameUrl,
  buildWaveformUrl,
  pickFrameTimestamps,
} from '@/lib/cloudinary';

describe('buildFrameUrl()', () => {
  it('produces the expected Cloudinary frame URL', () => {
    const url = buildFrameUrl('mycloud', 'viralengine/uploads/user1/vid', 2.5);
    expect(url).toBe(
      'https://res.cloudinary.com/mycloud/video/upload/so_2.50,f_jpg,w_640,q_auto/viralengine/uploads/user1/vid.jpg'
    );
  });

  it('uses offset 0 when negative offset is given (clamps to 0)', () => {
    const url = buildFrameUrl('mycloud', 'vid', -5);
    expect(url).toContain('so_0.00');
  });

  it('includes the publicId in the URL', () => {
    const url = buildFrameUrl('testcloud', 'my/public/id', 3);
    expect(url).toContain('my/public/id');
  });

  it('uses the correct cloud name', () => {
    const url = buildFrameUrl('specific-cloud', 'vid', 1);
    expect(url).toContain('specific-cloud');
  });

  it('formats offset with two decimal places', () => {
    const url = buildFrameUrl('c', 'v', 1);
    expect(url).toContain('so_1.00');
  });
});

describe('buildWaveformUrl()', () => {
  it('produces the expected Cloudinary waveform URL', () => {
    const url = buildWaveformUrl('mycloud', 'viralengine/uploads/user1/vid');
    expect(url).toBe(
      'https://res.cloudinary.com/mycloud/video/upload/fl_waveform,co_rgb:f59e0b,b_rgb:0a0a0a,w_800,h_160/viralengine/uploads/user1/vid.png'
    );
  });

  it('ends with .png', () => {
    const url = buildWaveformUrl('c', 'v');
    expect(url).toMatch(/\.png$/);
  });

  it('uses the correct cloud name', () => {
    const url = buildWaveformUrl('another-cloud', 'vid');
    expect(url).toContain('another-cloud');
  });
});

describe('pickFrameTimestamps()', () => {
  it('returns timestamps for a short video (under 3 seconds)', () => {
    const ts = pickFrameTimestamps(2);
    expect(ts.length).toBeGreaterThan(0);
    expect(ts.every((t) => t < 2)).toBe(true);
  });

  it('always includes near-start frames', () => {
    const ts = pickFrameTimestamps(30);
    // Hook window: 0, 1.5, 3
    expect(ts).toContain(0);
    expect(ts).toContain(1.5);
    expect(ts).toContain(3);
  });

  it('never returns more than 6 timestamps', () => {
    const ts = pickFrameTimestamps(120);
    expect(ts.length).toBeLessThanOrEqual(6);
  });

  it('returns timestamps in ascending order', () => {
    const ts = pickFrameTimestamps(60);
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]).toBeGreaterThan(ts[i - 1]);
    }
  });

  it('returns no duplicates', () => {
    const ts = pickFrameTimestamps(30);
    expect(new Set(ts).size).toBe(ts.length);
  });

  it('handles exactly 3-second video', () => {
    const ts = pickFrameTimestamps(3);
    expect(ts.every((t) => t < 3)).toBe(true);
  });

  it('includes spread timestamps after 3s for longer videos', () => {
    const ts = pickFrameTimestamps(60);
    // Should have at least one timestamp after 3s
    expect(ts.some((t) => t > 3)).toBe(true);
  });

  it('handles a 1-second video (very short)', () => {
    const ts = pickFrameTimestamps(1);
    expect(ts.length).toBeGreaterThan(0);
    expect(ts.every((t) => t < 1)).toBe(true);
  });

  it('returns 6 timestamps for a long video', () => {
    const ts = pickFrameTimestamps(300);
    expect(ts.length).toBe(6);
  });

  it('all timestamps are non-negative', () => {
    const ts = pickFrameTimestamps(10);
    expect(ts.every((t) => t >= 0)).toBe(true);
  });
});

describe('createSignedVideoUpload()', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });

  afterEach(() => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });

  it('throws when env vars are not set', async () => {
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');
    expect(() => createSignedVideoUpload('user1')).toThrow(
      'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must all be set.'
    );
  });

  it('returns a valid signed upload object when env vars are set', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'testcloud';
    process.env.CLOUDINARY_API_KEY = 'apikey123';
    process.env.CLOUDINARY_API_SECRET = 'secret456';
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');

    const result = createSignedVideoUpload('testuser');
    expect(result.cloudName).toBe('testcloud');
    expect(result.apiKey).toBe('apikey123');
    expect(result.folder).toBe('viralengine/uploads/testuser');
    expect(result.allowedFormats).toBe('mp4,mov');
    expect(typeof result.timestamp).toBe('number');
    expect(typeof result.signature).toBe('string');
    expect(result.signature.length).toBeGreaterThan(0);
  });

  it('generates a deterministic signature from params', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'c';
    process.env.CLOUDINARY_API_KEY = 'k';
    process.env.CLOUDINARY_API_SECRET = 'mysecret';
    const { createSignedVideoUpload } = await import('@/lib/cloudinary');

    const result = createSignedVideoUpload('u1');
    // Manually compute expected signature: sorted params + secret, SHA-1 hex
    const paramsStr = [
      `allowed_formats=${result.allowedFormats}`,
      `folder=${result.folder}`,
      `timestamp=${result.timestamp}`,
    ].join('&');
    const expected = createHash('sha1').update(paramsStr + 'mysecret').digest('hex');
    expect(result.signature).toBe(expected);
  });
});
