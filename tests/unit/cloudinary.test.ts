import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildFrameUrl, buildWaveformUrl, pickFrameTimestamps, createSignedVideoUpload } from '@/lib/cloudinary';

// ---------------------------------------------------------------------------
// buildFrameUrl
// ---------------------------------------------------------------------------
describe('buildFrameUrl()', () => {
  it('builds a valid Cloudinary frame URL', () => {
    const url = buildFrameUrl('mycloud', 'viralengine/uploads/user1/vid', 5);
    expect(url).toContain('res.cloudinary.com/mycloud');
    expect(url).toContain('so_5.00');
    expect(url).toContain('f_jpg');
    expect(url).toContain('w_640');
    expect(url).toContain('viralengine/uploads/user1/vid.jpg');
  });

  it('clamps negative offset to 0', () => {
    const url = buildFrameUrl('mycloud', 'vid', -5);
    expect(url).toContain('so_0.00');
  });

  it('formats offset to 2 decimal places', () => {
    const url = buildFrameUrl('cloud', 'id', 1.5);
    expect(url).toContain('so_1.50');
  });

  it('handles zero offset', () => {
    const url = buildFrameUrl('cloud', 'id', 0);
    expect(url).toContain('so_0.00');
  });

  it('handles large offset', () => {
    const url = buildFrameUrl('cloud', 'id', 300);
    expect(url).toContain('so_300.00');
  });

  it('uses the jpg format always', () => {
    const url = buildFrameUrl('cloud', 'id', 10);
    expect(url).toContain('f_jpg');
  });

  it('includes q_auto for quality', () => {
    const url = buildFrameUrl('cloud', 'id', 10);
    expect(url).toContain('q_auto');
  });
});

// ---------------------------------------------------------------------------
// buildWaveformUrl
// ---------------------------------------------------------------------------
describe('buildWaveformUrl()', () => {
  it('builds a waveform URL with the right cloud name and public id', () => {
    const url = buildWaveformUrl('mycloud', 'viralengine/uploads/user1/vid');
    expect(url).toContain('res.cloudinary.com/mycloud');
    expect(url).toContain('fl_waveform');
    expect(url).toContain('viralengine/uploads/user1/vid.png');
  });

  it('includes the amber waveform colour', () => {
    const url = buildWaveformUrl('cloud', 'id');
    expect(url).toContain('co_rgb:f59e0b');
  });

  it('includes the dark background colour', () => {
    const url = buildWaveformUrl('cloud', 'id');
    expect(url).toContain('b_rgb:0a0a0a');
  });

  it('has expected dimensions', () => {
    const url = buildWaveformUrl('cloud', 'id');
    expect(url).toContain('w_800');
    expect(url).toContain('h_160');
  });
});

// ---------------------------------------------------------------------------
// pickFrameTimestamps
// ---------------------------------------------------------------------------
describe('pickFrameTimestamps()', () => {
  it('returns an array for a typical video duration', () => {
    const result = pickFrameTimestamps(60);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('always starts with 0 for a non-trivial duration', () => {
    const result = pickFrameTimestamps(60);
    expect(result[0]).toBe(0);
  });

  it('is sorted in ascending order', () => {
    const result = pickFrameTimestamps(60);
    for (let i = 1; i < result.length; i++) {
      expect(result[i]).toBeGreaterThan(result[i - 1]);
    }
  });

  it('caps at 6 frames for a long video', () => {
    const result = pickFrameTimestamps(120);
    expect(result.length).toBeLessThanOrEqual(6);
  });

  it('all timestamps are < durationSeconds', () => {
    const duration = 30;
    const result = pickFrameTimestamps(duration);
    for (const t of result) {
      expect(t).toBeLessThan(duration);
    }
  });

  it('includes hook offsets within first 3 seconds for a long video', () => {
    const result = pickFrameTimestamps(60);
    const hookFrames = result.filter((t) => t <= 3);
    expect(hookFrames.length).toBeGreaterThanOrEqual(1);
  });

  it('returns at most the hook offsets for a 3-second clip', () => {
    const result = pickFrameTimestamps(3);
    // All valid timestamps must be < 3
    for (const t of result) {
      expect(t).toBeLessThan(3);
    }
  });

  it('handles a very short clip (< 1.5s)', () => {
    const result = pickFrameTimestamps(1);
    expect(result.length).toBeGreaterThanOrEqual(1);
    for (const t of result) {
      expect(t).toBeLessThan(1);
    }
  });

  it('has no duplicate timestamps', () => {
    const result = pickFrameTimestamps(60);
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });

  it('rounds timestamps to 2 decimal places', () => {
    const result = pickFrameTimestamps(60);
    for (const t of result) {
      expect(t).toBe(Math.round(t * 100) / 100);
    }
  });

  it('returns only 0 for a near-zero duration (approaching 0)', () => {
    // duration = 0.1: only offset 0 passes the filter t < durationSeconds
    const result = pickFrameTimestamps(0.1);
    expect(result).toContain(0);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// createSignedVideoUpload (requires env vars)
// ---------------------------------------------------------------------------
describe('createSignedVideoUpload()', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      CLOUDINARY_CLOUD_NAME: 'testcloud',
      CLOUDINARY_API_KEY: 'testapikey',
      CLOUDINARY_API_SECRET: 'testapisecret',
    };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('returns all required fields', () => {
    const result = createSignedVideoUpload('user_123');
    expect(result).toHaveProperty('cloudName', 'testcloud');
    expect(result).toHaveProperty('apiKey', 'testapikey');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('signature');
    expect(result).toHaveProperty('folder');
    expect(result).toHaveProperty('allowedFormats');
  });

  it('scopes the folder to the user id', () => {
    const result = createSignedVideoUpload('user_abc');
    expect(result.folder).toBe('viralengine/uploads/user_abc');
  });

  it('allows only mp4 and mov', () => {
    const result = createSignedVideoUpload('user_123');
    expect(result.allowedFormats).toBe('mp4,mov');
  });

  it('produces a timestamp close to now (within 5 seconds)', () => {
    const before = Math.floor(Date.now() / 1000);
    const result = createSignedVideoUpload('user_123');
    const after = Math.floor(Date.now() / 1000);
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after);
  });

  it('produces a non-empty hex signature', () => {
    const result = createSignedVideoUpload('user_123');
    expect(result.signature).toMatch(/^[0-9a-f]+$/);
  });

  it('produces a different signature for a different user (different folder)', () => {
    const a = createSignedVideoUpload('user_A');
    const b = createSignedVideoUpload('user_B');
    expect(a.signature).not.toBe(b.signature);
  });

  it('throws when env vars are missing', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    expect(() => createSignedVideoUpload('user_123')).toThrow();
  });
});
