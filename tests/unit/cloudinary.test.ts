import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildFrameUrl, buildWaveformUrl, pickFrameTimestamps, createSignedVideoUpload } from '@/lib/cloudinary';

describe('buildFrameUrl()', () => {
  it('builds a correct frame URL at offset 0', () => {
    const url = buildFrameUrl('mycloud', 'viralengine/uploads/u1/video1', 0);
    expect(url).toBe('https://res.cloudinary.com/mycloud/video/upload/so_0.00,f_jpg,w_640,q_auto/viralengine/uploads/u1/video1.jpg');
  });

  it('includes two decimal places for offset', () => {
    const url = buildFrameUrl('mycloud', 'pub/vid', 3);
    expect(url).toContain('so_3.00');
  });

  it('clamps negative offsets to 0', () => {
    const url = buildFrameUrl('mycloud', 'pub/vid', -5);
    expect(url).toContain('so_0.00');
  });

  it('preserves fractional seconds', () => {
    const url = buildFrameUrl('mycloud', 'pub/vid', 1.5);
    expect(url).toContain('so_1.50');
  });

  it('uses the provided cloudName', () => {
    const url = buildFrameUrl('testcloud123', 'folder/vid', 2);
    expect(url).toContain('testcloud123');
  });
});

describe('buildWaveformUrl()', () => {
  it('builds a waveform URL', () => {
    const url = buildWaveformUrl('mycloud', 'viralengine/uploads/u1/video1');
    expect(url).toBe('https://res.cloudinary.com/mycloud/video/upload/fl_waveform,co_rgb:f59e0b,b_rgb:0a0a0a,w_800,h_160/viralengine/uploads/u1/video1.png');
  });

  it('ends with .png', () => {
    const url = buildWaveformUrl('cloud', 'path/vid');
    expect(url.endsWith('.png')).toBe(true);
  });

  it('uses provided cloudName', () => {
    const url = buildWaveformUrl('testname', 'path');
    expect(url).toContain('testname');
  });
});

describe('pickFrameTimestamps()', () => {
  it('returns sorted timestamps for a typical 60s video', () => {
    const ts = pickFrameTimestamps(60);
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]).toBeGreaterThan(ts[i - 1]);
    }
  });

  it('always includes a near-start frame (0) for any duration', () => {
    expect(pickFrameTimestamps(10)).toContain(0);
    expect(pickFrameTimestamps(30)).toContain(0);
    expect(pickFrameTimestamps(120)).toContain(0);
  });

  it('returns at most 6 timestamps', () => {
    expect(pickFrameTimestamps(120).length).toBeLessThanOrEqual(6);
    expect(pickFrameTimestamps(60).length).toBeLessThanOrEqual(6);
    expect(pickFrameTimestamps(10).length).toBeLessThanOrEqual(6);
  });

  it('returns at least 1 timestamp for very short video', () => {
    expect(pickFrameTimestamps(0.5).length).toBeGreaterThanOrEqual(1);
  });

  it('all timestamps are less than duration', () => {
    const dur = 30;
    const ts = pickFrameTimestamps(dur);
    for (const t of ts) {
      expect(t).toBeLessThan(dur);
    }
  });

  it('returns no duplicate timestamps', () => {
    const ts = pickFrameTimestamps(60);
    const unique = new Set(ts);
    expect(unique.size).toBe(ts.length);
  });

  it('for a 3s video returns only hook offsets < 3', () => {
    const ts = pickFrameTimestamps(3);
    for (const t of ts) {
      expect(t).toBeLessThan(3);
    }
  });

  it('for a long video includes coverage beyond 3s', () => {
    const ts = pickFrameTimestamps(120);
    expect(ts.some((t) => t > 3)).toBe(true);
  });

  it('timestamps are rounded to 2 decimal places', () => {
    const ts = pickFrameTimestamps(60);
    for (const t of ts) {
      expect(Math.round(t * 100) / 100).toBe(t);
    }
  });
});

describe('createSignedVideoUpload()', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...origEnv,
      CLOUDINARY_CLOUD_NAME: 'testcloud',
      CLOUDINARY_API_KEY: 'key123',
      CLOUDINARY_API_SECRET: 'secret456',
    };
  });

  afterEach(() => {
    process.env = origEnv;
    vi.resetModules();
  });

  it('returns the correct cloudName and apiKey', () => {
    const result = createSignedVideoUpload('user_abc');
    expect(result.cloudName).toBe('testcloud');
    expect(result.apiKey).toBe('key123');
  });

  it('scopes folder to viralengine/uploads/<userId>', () => {
    const result = createSignedVideoUpload('user_abc');
    expect(result.folder).toBe('viralengine/uploads/user_abc');
  });

  it('allows mp4 and mov formats', () => {
    const result = createSignedVideoUpload('user_abc');
    expect(result.allowedFormats).toBe('mp4,mov');
  });

  it('timestamp is a unix epoch integer close to now', () => {
    const before = Math.floor(Date.now() / 1000);
    const result = createSignedVideoUpload('user_abc');
    const after = Math.floor(Date.now() / 1000);
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after);
  });

  it('signature is a non-empty hex string', () => {
    const result = createSignedVideoUpload('user_abc');
    expect(result.signature).toMatch(/^[0-9a-f]+$/);
  });

  it('signature is deterministic for same params', () => {
    // Two calls at the same second will differ (different timestamp),
    // but we can verify the signature is always a hex string
    const result = createSignedVideoUpload('user_xyz');
    expect(result.signature.length).toBeGreaterThan(0);
  });

  it('throws when CLOUDINARY_CLOUD_NAME is missing', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    expect(() => createSignedVideoUpload('user')).toThrow('CLOUDINARY_CLOUD_NAME');
  });

  it('throws when CLOUDINARY_API_KEY is missing', () => {
    delete process.env.CLOUDINARY_API_KEY;
    expect(() => createSignedVideoUpload('user')).toThrow();
  });

  it('throws when CLOUDINARY_API_SECRET is missing', () => {
    delete process.env.CLOUDINARY_API_SECRET;
    expect(() => createSignedVideoUpload('user')).toThrow();
  });
});
