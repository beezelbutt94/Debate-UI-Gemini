import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildFrameUrl, buildWaveformUrl, pickFrameTimestamps, createSignedVideoUpload } from '@/lib/cloudinary';

describe('buildFrameUrl', () => {
  it('builds correct URL with integer offset', () => {
    expect(buildFrameUrl('mycloudname', 'viralengine/uploads/u1/vid', 5)).toBe(
      'https://res.cloudinary.com/mycloudname/video/upload/so_5.00,f_jpg,w_640,q_auto/viralengine/uploads/u1/vid.jpg'
    );
  });

  it('builds correct URL with fractional offset (2 decimal places)', () => {
    expect(buildFrameUrl('mycloudname', 'some/path', 1.5)).toBe(
      'https://res.cloudinary.com/mycloudname/video/upload/so_1.50,f_jpg,w_640,q_auto/some/path.jpg'
    );
  });

  it('clamps negative offset to 0', () => {
    expect(buildFrameUrl('mycloudname', 'path/vid', -3)).toBe(
      'https://res.cloudinary.com/mycloudname/video/upload/so_0.00,f_jpg,w_640,q_auto/path/vid.jpg'
    );
  });

  it('handles zero offset', () => {
    expect(buildFrameUrl('cn', 'pub', 0)).toContain('so_0.00');
  });

  it('returns a URL ending with .jpg', () => {
    expect(buildFrameUrl('cn', 'pub/id', 2)).toMatch(/\.jpg$/);
  });
});

describe('buildWaveformUrl', () => {
  it('returns a URL with the correct transformation', () => {
    const url = buildWaveformUrl('mycloudname', 'viralengine/uploads/u1/vid');
    expect(url).toContain('fl_waveform');
    expect(url).toContain('mycloudname');
    expect(url).toMatch(/\.png$/);
  });

  it('embeds the public ID', () => {
    const publicId = 'viralengine/uploads/u1/vid';
    expect(buildWaveformUrl('cn', publicId)).toContain(publicId);
  });

  it('uses amber colour co_rgb:f59e0b', () => {
    expect(buildWaveformUrl('cn', 'pub')).toContain('co_rgb:f59e0b');
  });

  it('uses dark background b_rgb:0a0a0a', () => {
    expect(buildWaveformUrl('cn', 'pub')).toContain('b_rgb:0a0a0a');
  });
});

describe('pickFrameTimestamps', () => {
  it('returns at most 6 frames', () => {
    const frames = pickFrameTimestamps(120);
    expect(frames.length).toBeLessThanOrEqual(6);
  });

  it('always starts near 0 for normal videos', () => {
    const frames = pickFrameTimestamps(30);
    expect(frames[0]).toBe(0);
  });

  it('includes a frame at or near 1.5s for a 30s video', () => {
    const frames = pickFrameTimestamps(30);
    expect(frames.some((t) => t >= 1 && t <= 2)).toBe(true);
  });

  it('includes a frame at or near 3s for a 30s video', () => {
    const frames = pickFrameTimestamps(30);
    expect(frames.some((t) => t >= 2.5 && t <= 3.5)).toBe(true);
  });

  it('all timestamps are non-negative', () => {
    const frames = pickFrameTimestamps(60);
    expect(frames.every((t) => t >= 0)).toBe(true);
  });

  it('all timestamps are less than video duration', () => {
    const dur = 45;
    const frames = pickFrameTimestamps(dur);
    expect(frames.every((t) => t < dur)).toBe(true);
  });

  it('frames are in ascending order', () => {
    const frames = pickFrameTimestamps(90);
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]).toBeGreaterThanOrEqual(frames[i - 1]);
    }
  });

  it('has no duplicate timestamps', () => {
    const frames = pickFrameTimestamps(60);
    const unique = new Set(frames);
    expect(unique.size).toBe(frames.length);
  });

  it('returns [0] for a very short video (< 1.5s)', () => {
    const frames = pickFrameTimestamps(1);
    expect(frames).toContain(0);
    expect(frames.every((t) => t < 1)).toBe(true);
  });

  it('handles exactly 3s video', () => {
    const frames = pickFrameTimestamps(3);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((t) => t < 3)).toBe(true);
  });

  it('returns 6 frames for a long video (120s)', () => {
    expect(pickFrameTimestamps(120).length).toBe(6);
  });

  it('timestamps are rounded to 2 decimal places', () => {
    const frames = pickFrameTimestamps(77);
    frames.forEach((t) => {
      expect(Math.round(t * 100) / 100).toBe(t);
    });
  });
});

describe('createSignedVideoUpload', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CLOUDINARY_CLOUD_NAME: 'testcloud',
      CLOUDINARY_API_KEY: 'testkey',
      CLOUDINARY_API_SECRET: 'testsecret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns the correct cloudName', () => {
    expect(createSignedVideoUpload('user1').cloudName).toBe('testcloud');
  });

  it('returns the correct apiKey', () => {
    expect(createSignedVideoUpload('user1').apiKey).toBe('testkey');
  });

  it('returns allowed_formats mp4,mov', () => {
    expect(createSignedVideoUpload('user1').allowedFormats).toBe('mp4,mov');
  });

  it('returns a folder scoped to the userId', () => {
    expect(createSignedVideoUpload('user42').folder).toBe('viralengine/uploads/user42');
  });

  it('returns a numeric timestamp close to now', () => {
    const before = Math.floor(Date.now() / 1000) - 1;
    const { timestamp } = createSignedVideoUpload('user1');
    const after = Math.floor(Date.now() / 1000) + 1;
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('returns a non-empty hex signature', () => {
    const { signature } = createSignedVideoUpload('user1');
    expect(signature).toMatch(/^[0-9a-f]{40,64}$/);
  });

  it('produces the same signature for same params (deterministic)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const a = createSignedVideoUpload('user1');
    const b = createSignedVideoUpload('user1');
    expect(a.signature).toBe(b.signature);
  });

  it('produces different signatures for different userIds', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const a = createSignedVideoUpload('user1');
    const b = createSignedVideoUpload('user2');
    expect(a.signature).not.toBe(b.signature);
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
});
