import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildFrameUrl, buildWaveformUrl, pickFrameTimestamps, createSignedVideoUpload } from '@/lib/cloudinary';

// ─── buildFrameUrl ─────────────────────────────────────────────────────────

describe('buildFrameUrl()', () => {
  it('builds a valid Cloudinary frame URL', () => {
    const url = buildFrameUrl('mycloudname', 'viralengine/uploads/user1/vid', 5.0);
    expect(url).toBe(
      'https://res.cloudinary.com/mycloudname/video/upload/so_5.00,f_jpg,w_640,q_auto/viralengine/uploads/user1/vid.jpg'
    );
  });

  it('formats fractional seconds to 2 decimal places', () => {
    const url = buildFrameUrl('cn', 'pub/id', 1.5);
    expect(url).toContain('so_1.50');
  });

  it('floors negative offsets to 0', () => {
    const url = buildFrameUrl('cn', 'pub/id', -1);
    expect(url).toContain('so_0.00');
  });

  it('uses 0.00 for offset = 0', () => {
    const url = buildFrameUrl('cn', 'pub/id', 0);
    expect(url).toContain('so_0.00');
  });

  it('includes cloud name in URL', () => {
    expect(buildFrameUrl('mycloud', 'id', 1)).toContain('mycloud');
  });

  it('includes public_id in URL', () => {
    expect(buildFrameUrl('cn', 'my/public/id', 1)).toContain('my/public/id');
  });

  it('ends with .jpg', () => {
    expect(buildFrameUrl('cn', 'id', 2)).toMatch(/\.jpg$/);
  });

  it('handles large offsets', () => {
    const url = buildFrameUrl('cn', 'id', 3600);
    expect(url).toContain('so_3600.00');
  });

  it('format=jpg and width=640', () => {
    const url = buildFrameUrl('cn', 'id', 1);
    expect(url).toContain('f_jpg');
    expect(url).toContain('w_640');
  });
});

// ─── buildWaveformUrl ──────────────────────────────────────────────────────

describe('buildWaveformUrl()', () => {
  it('builds a valid Cloudinary waveform URL', () => {
    const url = buildWaveformUrl('mycloudname', 'viralengine/uploads/user1/vid');
    expect(url).toBe(
      'https://res.cloudinary.com/mycloudname/video/upload/fl_waveform,co_rgb:f59e0b,b_rgb:0a0a0a,w_800,h_160/viralengine/uploads/user1/vid.png'
    );
  });

  it('includes fl_waveform transformation', () => {
    expect(buildWaveformUrl('cn', 'id')).toContain('fl_waveform');
  });

  it('ends with .png', () => {
    expect(buildWaveformUrl('cn', 'id')).toMatch(/\.png$/);
  });

  it('uses the correct amber color (f59e0b)', () => {
    expect(buildWaveformUrl('cn', 'id')).toContain('co_rgb:f59e0b');
  });

  it('uses the correct dark background (0a0a0a)', () => {
    expect(buildWaveformUrl('cn', 'id')).toContain('b_rgb:0a0a0a');
  });

  it('has w_800 and h_160', () => {
    const url = buildWaveformUrl('cn', 'id');
    expect(url).toContain('w_800');
    expect(url).toContain('h_160');
  });

  it('includes cloud name', () => {
    expect(buildWaveformUrl('specialcloud', 'id')).toContain('specialcloud');
  });
});

// ─── pickFrameTimestamps ───────────────────────────────────────────────────

describe('pickFrameTimestamps()', () => {
  it('always starts near 0 for any duration', () => {
    const ts = pickFrameTimestamps(60);
    expect(ts[0]).toBe(0);
  });

  it('returns sorted timestamps', () => {
    const ts = pickFrameTimestamps(60);
    const sorted = [...ts].sort((a, b) => a - b);
    expect(ts).toEqual(sorted);
  });

  it('returns at most 6 timestamps for long videos', () => {
    expect(pickFrameTimestamps(600).length).toBeLessThanOrEqual(6);
  });

  it('returns at most 6 timestamps for short videos', () => {
    expect(pickFrameTimestamps(5).length).toBeLessThanOrEqual(6);
  });

  it('returns no timestamp >= duration', () => {
    const duration = 30;
    const ts = pickFrameTimestamps(duration);
    ts.forEach((t) => expect(t).toBeLessThan(duration));
  });

  it('includes a hook frame in 0-3s window for a typical video', () => {
    const ts = pickFrameTimestamps(60);
    const hookFrames = ts.filter((t) => t <= 3);
    expect(hookFrames.length).toBeGreaterThan(0);
  });

  it('handles a very short 1-second video without exceeding duration', () => {
    const ts = pickFrameTimestamps(1);
    ts.forEach((t) => expect(t).toBeLessThan(1));
  });

  it('handles a 3-second video', () => {
    const ts = pickFrameTimestamps(3);
    expect(ts.length).toBeGreaterThan(0);
    ts.forEach((t) => expect(t).toBeLessThan(3));
  });

  it('deduplicates timestamps', () => {
    const ts = pickFrameTimestamps(60);
    const unique = new Set(ts);
    expect(ts.length).toBe(unique.size);
  });

  it('spreads timestamps across a long video', () => {
    const ts = pickFrameTimestamps(120);
    // Should have frames beyond the 3s hook zone
    const lateFrames = ts.filter((t) => t > 3);
    expect(lateFrames.length).toBeGreaterThan(0);
  });

  it('handles 10-second video', () => {
    const ts = pickFrameTimestamps(10);
    expect(ts.length).toBeGreaterThan(0);
    ts.forEach((t) => expect(t).toBeLessThan(10));
  });

  it('gives exactly 3 hook offsets (0, 1.5, 3) for a 60s video', () => {
    const ts = pickFrameTimestamps(60);
    expect(ts).toContain(0);
    expect(ts).toContain(1.5);
    expect(ts).toContain(3);
  });

  it('rounds timestamps to 2 decimal places', () => {
    const ts = pickFrameTimestamps(60);
    ts.forEach((t) => {
      const rounded = Math.round(t * 100) / 100;
      expect(t).toBe(rounded);
    });
  });
});

// ─── createSignedVideoUpload ───────────────────────────────────────────────

describe('createSignedVideoUpload()', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CLOUDINARY_CLOUD_NAME: 'testcloud',
      CLOUDINARY_API_KEY: 'test-api-key',
      CLOUDINARY_API_SECRET: 'test-api-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns the cloud name from env', () => {
    const result = createSignedVideoUpload('user123');
    expect(result.cloudName).toBe('testcloud');
  });

  it('returns the api key from env', () => {
    const result = createSignedVideoUpload('user123');
    expect(result.apiKey).toBe('test-api-key');
  });

  it('returns allowed formats mp4,mov', () => {
    const result = createSignedVideoUpload('user123');
    expect(result.allowedFormats).toBe('mp4,mov');
  });

  it('returns the correct folder with userId', () => {
    const result = createSignedVideoUpload('user-abc');
    expect(result.folder).toBe('viralengine/uploads/user-abc');
  });

  it('returns a unix timestamp within 5 seconds of now', () => {
    const before = Math.floor(Date.now() / 1000);
    const result = createSignedVideoUpload('user123');
    const after = Math.floor(Date.now() / 1000);
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after + 1);
  });

  it('returns a non-empty signature string', () => {
    const result = createSignedVideoUpload('user123');
    expect(typeof result.signature).toBe('string');
    expect(result.signature.length).toBeGreaterThan(0);
  });

  it('signature is a hex string', () => {
    const result = createSignedVideoUpload('user123');
    expect(result.signature).toMatch(/^[0-9a-f]+$/);
  });

  it('signature is 40 hex chars when using default SHA-1 algorithm', () => {
    // SIGNATURE_ALGORITHM is set at module load time; default is sha1 → 40 hex chars
    const result = createSignedVideoUpload('user123');
    expect(result.signature.length).toBe(40);
  });

  it('throws when CLOUDINARY_CLOUD_NAME is missing', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    expect(() => createSignedVideoUpload('user123')).toThrow('CLOUDINARY_CLOUD_NAME');
  });

  it('throws when CLOUDINARY_API_KEY is missing', () => {
    delete process.env.CLOUDINARY_API_KEY;
    expect(() => createSignedVideoUpload('user123')).toThrow('CLOUDINARY_API_KEY');
  });

  it('throws when CLOUDINARY_API_SECRET is missing', () => {
    delete process.env.CLOUDINARY_API_SECRET;
    expect(() => createSignedVideoUpload('user123')).toThrow('CLOUDINARY_API_SECRET');
  });

  it('produces different signatures for different users (folder differs)', () => {
    const a = createSignedVideoUpload('user-a');
    const b = createSignedVideoUpload('user-b');
    expect(a.signature).not.toBe(b.signature);
  });


});
