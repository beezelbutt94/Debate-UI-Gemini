import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildFrameUrl, buildWaveformUrl, pickFrameTimestamps, createSignedVideoUpload } from '@/lib/cloudinary';

describe('buildFrameUrl', () => {
  it('returns a cloudinary URL with the correct cloud name', () => {
    const url = buildFrameUrl('mycloudname', 'viralengine/uploads/user1/video1', 5);
    expect(url).toContain('https://res.cloudinary.com/mycloudname/');
  });

  it('includes the public_id', () => {
    const url = buildFrameUrl('cloud', 'viralengine/uploads/user1/video1', 5);
    expect(url).toContain('viralengine/uploads/user1/video1');
  });

  it('uses so_ prefix for the offset', () => {
    const url = buildFrameUrl('cloud', 'my/video', 10);
    expect(url).toContain('so_10.00');
  });

  it('uses f_jpg transform', () => {
    const url = buildFrameUrl('cloud', 'my/video', 3);
    expect(url).toContain('f_jpg');
  });

  it('uses w_640 transform', () => {
    const url = buildFrameUrl('cloud', 'my/video', 3);
    expect(url).toContain('w_640');
  });

  it('uses q_auto transform', () => {
    const url = buildFrameUrl('cloud', 'my/video', 3);
    expect(url).toContain('q_auto');
  });

  it('clamps negative offsets to 0', () => {
    const url = buildFrameUrl('cloud', 'video', -5);
    expect(url).toContain('so_0.00');
  });

  it('formats offset with 2 decimal places', () => {
    const url = buildFrameUrl('cloud', 'video', 1.5);
    expect(url).toContain('so_1.50');
  });

  it('handles fractional seconds', () => {
    const url = buildFrameUrl('cloud', 'video', 2.75);
    expect(url).toContain('so_2.75');
  });

  it('ends with .jpg extension', () => {
    const url = buildFrameUrl('cloud', 'video', 5);
    expect(url).toMatch(/\.jpg$/);
  });

  it('handles zero offset', () => {
    const url = buildFrameUrl('cloud', 'video', 0);
    expect(url).toContain('so_0.00');
  });
});

describe('buildWaveformUrl', () => {
  it('returns a cloudinary URL', () => {
    const url = buildWaveformUrl('mycloudname', 'viralengine/uploads/user1/video1');
    expect(url).toContain('https://res.cloudinary.com/mycloudname/');
  });

  it('includes fl_waveform transform', () => {
    const url = buildWaveformUrl('cloud', 'video');
    expect(url).toContain('fl_waveform');
  });

  it('includes w_800 dimension', () => {
    const url = buildWaveformUrl('cloud', 'video');
    expect(url).toContain('w_800');
  });

  it('includes h_160 dimension', () => {
    const url = buildWaveformUrl('cloud', 'video');
    expect(url).toContain('h_160');
  });

  it('ends with .png extension', () => {
    const url = buildWaveformUrl('cloud', 'video');
    expect(url).toMatch(/\.png$/);
  });

  it('includes the public_id in the URL', () => {
    const url = buildWaveformUrl('cloud', 'path/to/my-video');
    expect(url).toContain('path/to/my-video');
  });

  it('includes color parameter for waveform styling', () => {
    const url = buildWaveformUrl('cloud', 'video');
    expect(url).toContain('co_rgb');
  });
});

describe('pickFrameTimestamps', () => {
  it('always starts with offset 0 for a long video', () => {
    const ts = pickFrameTimestamps(60);
    expect(ts[0]).toBe(0);
  });

  it('returns sorted ascending timestamps', () => {
    const ts = pickFrameTimestamps(30);
    const sorted = [...ts].sort((a, b) => a - b);
    expect(ts).toEqual(sorted);
  });

  it('returns at most 6 timestamps for a 120s video', () => {
    const ts = pickFrameTimestamps(120);
    expect(ts.length).toBeLessThanOrEqual(6);
  });

  it('returns at most 6 timestamps for a 20s video', () => {
    const ts = pickFrameTimestamps(20);
    expect(ts.length).toBeLessThanOrEqual(6);
  });

  it('all timestamps are within [0, durationSeconds)', () => {
    const dur = 30;
    const ts = pickFrameTimestamps(dur);
    for (const t of ts) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(dur);
    }
  });

  it('includes a hook frame <= 3 seconds for a 60s video', () => {
    const ts = pickFrameTimestamps(60);
    expect(ts.some((t) => t <= 3)).toBe(true);
  });

  it('handles very short video (0.5s) without error', () => {
    const ts = pickFrameTimestamps(0.5);
    expect(Array.isArray(ts)).toBe(true);
    for (const t of ts) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(0.5);
    }
  });

  it('handles exactly 3-second video — no timestamp at or after 3s', () => {
    const ts = pickFrameTimestamps(3);
    expect(ts.length).toBeGreaterThan(0);
    for (const t of ts) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(3);
    }
  });

  it('has no duplicate timestamps', () => {
    const ts = pickFrameTimestamps(60);
    const unique = new Set(ts);
    expect(unique.size).toBe(ts.length);
  });

  it('returns timestamps rounded to at most 2 decimal places', () => {
    const ts = pickFrameTimestamps(60);
    for (const t of ts) {
      const str = t.toString();
      const decimalPart = str.includes('.') ? str.split('.')[1] : '';
      expect(decimalPart.length).toBeLessThanOrEqual(2);
    }
  });

  it('returns 6 timestamps for a sufficiently long video', () => {
    const ts = pickFrameTimestamps(120);
    expect(ts.length).toBe(6);
  });

  it('distributes extra frames beyond the 3s hook window', () => {
    const ts = pickFrameTimestamps(30);
    const afterHook = ts.filter((t) => t > 3);
    expect(afterHook.length).toBeGreaterThan(0);
  });
});

describe('createSignedVideoUpload', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CLOUDINARY_CLOUD_NAME: 'testcloud',
      CLOUDINARY_API_KEY: 'testkey123',
      CLOUDINARY_API_SECRET: 'testsecret456',
    };
    delete process.env.CLOUDINARY_SIGNATURE_ALGORITHM;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns cloudName from env', () => {
    const result = createSignedVideoUpload('user123');
    expect(result.cloudName).toBe('testcloud');
  });

  it('returns apiKey from env', () => {
    const result = createSignedVideoUpload('user123');
    expect(result.apiKey).toBe('testkey123');
  });

  it('returns a numeric timestamp', () => {
    const result = createSignedVideoUpload('user123');
    expect(typeof result.timestamp).toBe('number');
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('timestamp is in seconds (not milliseconds)', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const result = createSignedVideoUpload('user123');
    expect(Math.abs(result.timestamp - nowSeconds)).toBeLessThan(5);
  });

  it('returns a non-empty hex signature string', () => {
    const result = createSignedVideoUpload('user123');
    expect(typeof result.signature).toBe('string');
    expect(result.signature.length).toBeGreaterThan(0);
    expect(result.signature).toMatch(/^[0-9a-f]+$/);
  });

  it('sha1 signature is 40 hex characters', () => {
    const result = createSignedVideoUpload('user123');
    // sha1 produces 40 hex chars
    expect(result.signature.length).toBe(40);
  });

  it('scopes folder to user id', () => {
    const result = createSignedVideoUpload('user123');
    expect(result.folder).toContain('user123');
  });

  it('folder starts with viralengine/uploads/', () => {
    const result = createSignedVideoUpload('user42');
    expect(result.folder).toMatch(/^viralengine\/uploads\//);
  });

  it('allows mp4 format', () => {
    const result = createSignedVideoUpload('user123');
    expect(result.allowedFormats).toContain('mp4');
  });

  it('allows mov format', () => {
    const result = createSignedVideoUpload('user123');
    expect(result.allowedFormats).toContain('mov');
  });

  it('throws when CLOUDINARY_CLOUD_NAME is missing', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    expect(() => createSignedVideoUpload('user1')).toThrow();
  });

  it('throws when CLOUDINARY_API_KEY is missing', () => {
    delete process.env.CLOUDINARY_API_KEY;
    expect(() => createSignedVideoUpload('user1')).toThrow();
  });

  it('throws when CLOUDINARY_API_SECRET is missing', () => {
    delete process.env.CLOUDINARY_API_SECRET;
    expect(() => createSignedVideoUpload('user1')).toThrow();
  });

  it('produces different signatures for different users', () => {
    const r1 = createSignedVideoUpload('user1');
    const r2 = createSignedVideoUpload('user2');
    expect(r1.signature).not.toBe(r2.signature);
  });

  it('produces different signatures with different API secrets', () => {
    const r1 = createSignedVideoUpload('user1');
    process.env.CLOUDINARY_API_SECRET = 'completely_different_secret';
    const r2 = createSignedVideoUpload('user1');
    expect(r1.signature).not.toBe(r2.signature);
  });

  it('is deterministic for same user at same second', () => {
    // Call twice in the same second — signatures should match
    const r1 = createSignedVideoUpload('user1');
    const r2 = createSignedVideoUpload('user1');
    if (r1.timestamp === r2.timestamp) {
      expect(r1.signature).toBe(r2.signature);
    }
    // If timestamps differ (crossed a second boundary), both are still valid hex
    expect(r1.signature).toMatch(/^[0-9a-f]+$/);
    expect(r2.signature).toMatch(/^[0-9a-f]+$/);
  });
});
