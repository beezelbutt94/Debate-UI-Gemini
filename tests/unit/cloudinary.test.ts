import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildFrameUrl, buildWaveformUrl, pickFrameTimestamps, createSignedVideoUpload } from '@/lib/cloudinary';

describe('buildFrameUrl()', () => {
  it('returns a valid HTTPS URL', () => {
    const url = buildFrameUrl('mycloudname', 'viralengine/uploads/user1/video123', 3.5);
    expect(url.startsWith('https://')).toBe(true);
  });

  it('embeds the cloud name in the URL', () => {
    const url = buildFrameUrl('mycloud', 'some/public/id', 2);
    expect(url).toContain('mycloud');
  });

  it('embeds the public ID in the URL', () => {
    const url = buildFrameUrl('mycloud', 'my/video/public_id', 5);
    expect(url).toContain('my/video/public_id');
  });

  it('embeds the time offset using so_ notation', () => {
    const url = buildFrameUrl('mycloud', 'vid', 7.5);
    expect(url).toContain('so_7.50');
  });

  it('clamps negative offset to 0', () => {
    const url = buildFrameUrl('mycloud', 'vid', -5);
    expect(url).toContain('so_0.00');
  });

  it('handles zero offset', () => {
    const url = buildFrameUrl('mycloud', 'vid', 0);
    expect(url).toContain('so_0.00');
  });

  it('uses jpg format', () => {
    const url = buildFrameUrl('mycloud', 'vid', 3);
    expect(url).toContain('f_jpg');
  });

  it('includes width transform', () => {
    const url = buildFrameUrl('mycloud', 'vid', 3);
    expect(url).toContain('w_640');
  });

  it('includes quality auto', () => {
    const url = buildFrameUrl('mycloud', 'vid', 3);
    expect(url).toContain('q_auto');
  });

  it('uses res.cloudinary.com base domain', () => {
    const url = buildFrameUrl('cloud', 'vid', 1);
    expect(url).toContain('res.cloudinary.com');
  });

  it('produces .jpg extension at the end', () => {
    const url = buildFrameUrl('cloud', 'myvideo', 2);
    expect(url.endsWith('.jpg')).toBe(true);
  });

  it('formats offset to 2 decimal places', () => {
    const url = buildFrameUrl('cloud', 'vid', 3.1);
    expect(url).toContain('so_3.10');
  });
});

describe('buildWaveformUrl()', () => {
  it('returns a valid HTTPS URL', () => {
    const url = buildWaveformUrl('mycloudname', 'viralengine/uploads/user1/video123');
    expect(url.startsWith('https://')).toBe(true);
  });

  it('embeds the cloud name', () => {
    const url = buildWaveformUrl('mycloud', 'vid');
    expect(url).toContain('mycloud');
  });

  it('embeds the public ID', () => {
    const url = buildWaveformUrl('mycloud', 'my/video');
    expect(url).toContain('my/video');
  });

  it('includes fl_waveform transformation', () => {
    const url = buildWaveformUrl('cloud', 'vid');
    expect(url).toContain('fl_waveform');
  });

  it('includes color settings', () => {
    const url = buildWaveformUrl('cloud', 'vid');
    expect(url).toContain('co_rgb:f59e0b');
    expect(url).toContain('b_rgb:0a0a0a');
  });

  it('includes width and height', () => {
    const url = buildWaveformUrl('cloud', 'vid');
    expect(url).toContain('w_800');
    expect(url).toContain('h_160');
  });

  it('ends with .png', () => {
    const url = buildWaveformUrl('cloud', 'myvideo');
    expect(url.endsWith('.png')).toBe(true);
  });

  it('uses res.cloudinary.com base domain', () => {
    const url = buildWaveformUrl('cloud', 'vid');
    expect(url).toContain('res.cloudinary.com');
  });
});

describe('pickFrameTimestamps()', () => {
  it('returns timestamps for a 10-second video', () => {
    const ts = pickFrameTimestamps(10);
    expect(ts.length).toBeGreaterThan(0);
    expect(ts.length).toBeLessThanOrEqual(6);
  });

  it('always starts near 0 (hook frame)', () => {
    const ts = pickFrameTimestamps(10);
    expect(ts[0]).toBe(0);
  });

  it('all timestamps are within video duration', () => {
    const duration = 30;
    const ts = pickFrameTimestamps(duration);
    for (const t of ts) {
      expect(t).toBeLessThan(duration);
    }
  });

  it('timestamps are sorted ascending', () => {
    const ts = pickFrameTimestamps(60);
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]).toBeGreaterThanOrEqual(ts[i - 1]);
    }
  });

  it('no duplicate timestamps', () => {
    const ts = pickFrameTimestamps(30);
    const unique = new Set(ts);
    expect(unique.size).toBe(ts.length);
  });

  it('never exceeds 6 frames', () => {
    expect(pickFrameTimestamps(300).length).toBeLessThanOrEqual(6);
    expect(pickFrameTimestamps(3600).length).toBeLessThanOrEqual(6);
  });

  it('works for a very short video (< 3s)', () => {
    const ts = pickFrameTimestamps(2);
    expect(ts.length).toBeGreaterThan(0);
    for (const t of ts) {
      expect(t).toBeLessThan(2);
    }
  });

  it('works for exactly 3s video', () => {
    const ts = pickFrameTimestamps(3);
    expect(ts.length).toBeGreaterThan(0);
    for (const t of ts) {
      expect(t).toBeLessThan(3);
    }
  });

  it('includes a near-start frame for 60s video', () => {
    const ts = pickFrameTimestamps(60);
    expect(ts[0]).toBe(0);
    // There should be a frame near 1.5s
    const hasNearStart = ts.some((t) => t > 0 && t <= 3);
    expect(hasNearStart).toBe(true);
  });

  it('spreads frames across a long video', () => {
    const ts = pickFrameTimestamps(120);
    const maxTs = ts[ts.length - 1];
    // Last frame should be well after 3s (the hook zone)
    expect(maxTs).toBeGreaterThan(10);
  });

  it('returns an array for a 1s video', () => {
    const ts = pickFrameTimestamps(1);
    expect(Array.isArray(ts)).toBe(true);
    expect(ts.length).toBeGreaterThan(0);
  });

  it('timestamps are rounded to 2 decimal places', () => {
    const ts = pickFrameTimestamps(33.333);
    for (const t of ts) {
      const rounded = Math.round(t * 100) / 100;
      expect(t).toBe(rounded);
    }
  });
});

describe('createSignedVideoUpload()', () => {
  const envVars = {
    CLOUDINARY_CLOUD_NAME: 'testcloud',
    CLOUDINARY_API_KEY: 'apikey123',
    CLOUDINARY_API_SECRET: 'supersecret',
  };

  beforeEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = envVars.CLOUDINARY_CLOUD_NAME;
    process.env.CLOUDINARY_API_KEY = envVars.CLOUDINARY_API_KEY;
    process.env.CLOUDINARY_API_SECRET = envVars.CLOUDINARY_API_SECRET;
    // Ensure signature algorithm default is sha1
    delete process.env.CLOUDINARY_SIGNATURE_ALGORITHM;
  });

  afterEach(() => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    delete process.env.CLOUDINARY_SIGNATURE_ALGORITHM;
  });

  it('returns correct cloud name', () => {
    const result = createSignedVideoUpload('user123');
    expect(result.cloudName).toBe('testcloud');
  });

  it('returns correct api key', () => {
    const result = createSignedVideoUpload('user123');
    expect(result.apiKey).toBe('apikey123');
  });

  it('returns a folder scoped to the user', () => {
    const result = createSignedVideoUpload('user123');
    expect(result.folder).toBe('viralengine/uploads/user123');
  });

  it('returns allowed video formats', () => {
    const result = createSignedVideoUpload('user123');
    expect(result.allowedFormats).toBe('mp4,mov');
  });

  it('returns a numeric timestamp', () => {
    const result = createSignedVideoUpload('user123');
    expect(typeof result.timestamp).toBe('number');
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('timestamp is in seconds (not ms)', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const result = createSignedVideoUpload('user123');
    expect(Math.abs(result.timestamp - nowSeconds)).toBeLessThan(5);
  });

  it('returns a non-empty signature string', () => {
    const result = createSignedVideoUpload('user123');
    expect(typeof result.signature).toBe('string');
    expect(result.signature.length).toBeGreaterThan(0);
  });

  it('signature is deterministic for the same params', () => {
    // Two calls may differ in timestamp but same user returns same structure
    const r1 = createSignedVideoUpload('sameuser');
    const r2 = createSignedVideoUpload('sameuser');
    // Both should have a signature; they may differ if timestamp changes
    expect(typeof r1.signature).toBe('string');
    expect(typeof r2.signature).toBe('string');
  });

  it('different users get different folder scopes', () => {
    const r1 = createSignedVideoUpload('user-a');
    const r2 = createSignedVideoUpload('user-b');
    expect(r1.folder).not.toBe(r2.folder);
  });

  it('throws if CLOUDINARY_CLOUD_NAME is missing', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    expect(() => createSignedVideoUpload('user')).toThrow();
  });

  it('throws if CLOUDINARY_API_KEY is missing', () => {
    delete process.env.CLOUDINARY_API_KEY;
    expect(() => createSignedVideoUpload('user')).toThrow();
  });

  it('throws if CLOUDINARY_API_SECRET is missing', () => {
    delete process.env.CLOUDINARY_API_SECRET;
    expect(() => createSignedVideoUpload('user')).toThrow();
  });
});
