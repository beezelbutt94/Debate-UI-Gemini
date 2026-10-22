import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildFrameUrl, buildWaveformUrl, pickFrameTimestamps, createSignedVideoUpload } from '@/lib/cloudinary';

describe('buildFrameUrl', () => {
  it('builds a frame URL at the given offset', () => {
    const url = buildFrameUrl('mycloud', 'viralengine/uploads/user1/vid', 3);
    expect(url).toBe('https://res.cloudinary.com/mycloud/video/upload/so_3.00,f_jpg,w_640,q_auto/viralengine/uploads/user1/vid.jpg');
  });

  it('clamps negative offsets to 0', () => {
    const url = buildFrameUrl('mycloud', 'my/video', -5);
    expect(url).toContain('so_0.00');
  });

  it('formats offset to 2 decimal places', () => {
    expect(buildFrameUrl('mycloud', 'v', 1.5)).toContain('so_1.50');
    expect(buildFrameUrl('mycloud', 'v', 0)).toContain('so_0.00');
    expect(buildFrameUrl('mycloud', 'v', 10)).toContain('so_10.00');
  });

  it('encodes the cloud name and public id directly in the path', () => {
    const url = buildFrameUrl('testcloud', 'my/public/id', 2.75);
    expect(url).toContain('testcloud');
    expect(url).toContain('my/public/id');
  });
});

describe('buildWaveformUrl', () => {
  it('builds a waveform PNG URL', () => {
    const url = buildWaveformUrl('mycloud', 'viralengine/uploads/user1/vid');
    expect(url).toBe(
      'https://res.cloudinary.com/mycloud/video/upload/fl_waveform,co_rgb:f59e0b,b_rgb:0a0a0a,w_800,h_160/viralengine/uploads/user1/vid.png'
    );
  });

  it('ends with .png', () => {
    expect(buildWaveformUrl('c', 'v').endsWith('.png')).toBe(true);
  });

  it('includes the waveform transformation flag', () => {
    expect(buildWaveformUrl('c', 'v')).toContain('fl_waveform');
  });
});

describe('pickFrameTimestamps', () => {
  it('always includes timestamps near 0 and 3s for a long video', () => {
    const ts = pickFrameTimestamps(60);
    expect(ts[0]).toBe(0);
    expect(ts.some((t) => t <= 3)).toBe(true);
  });

  it('returns at most 6 timestamps', () => {
    expect(pickFrameTimestamps(120).length).toBeLessThanOrEqual(6);
    expect(pickFrameTimestamps(30).length).toBeLessThanOrEqual(6);
  });

  it('returns timestamps in ascending order', () => {
    const ts = pickFrameTimestamps(90);
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]).toBeGreaterThan(ts[i - 1]);
    }
  });

  it('returns no duplicates', () => {
    const ts = pickFrameTimestamps(60);
    expect(new Set(ts).size).toBe(ts.length);
  });

  it('keeps all timestamps strictly less than duration', () => {
    const duration = 10;
    const ts = pickFrameTimestamps(duration);
    ts.forEach((t) => expect(t).toBeLessThan(duration));
  });

  it('handles a very short video (< 3s)', () => {
    const ts = pickFrameTimestamps(2);
    expect(ts.length).toBeGreaterThan(0);
    ts.forEach((t) => expect(t).toBeLessThan(2));
  });

  it('handles exactly 3 seconds', () => {
    const ts = pickFrameTimestamps(3);
    expect(ts.length).toBeGreaterThan(0);
    ts.forEach((t) => expect(t).toBeLessThan(3));
  });

  it('for a 60s video, includes a frame well past the hook (beyond 3s)', () => {
    const ts = pickFrameTimestamps(60);
    expect(ts.some((t) => t > 3)).toBe(true);
  });

  it('returns at most 6 frames even for a very long video', () => {
    expect(pickFrameTimestamps(3600).length).toBeLessThanOrEqual(6);
  });
});

describe('createSignedVideoUpload', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = 'testcloud';
    process.env.CLOUDINARY_API_KEY = 'testkey';
    process.env.CLOUDINARY_API_SECRET = 'testsecret';
    delete process.env.CLOUDINARY_SIGNATURE_ALGORITHM;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('returns expected shape', () => {
    const result = createSignedVideoUpload('user-42');
    expect(result.cloudName).toBe('testcloud');
    expect(result.apiKey).toBe('testkey');
    expect(typeof result.timestamp).toBe('number');
    expect(typeof result.signature).toBe('string');
    expect(result.folder).toBe('viralengine/uploads/user-42');
    expect(result.allowedFormats).toBe('mp4,mov');
  });

  it('generates a signature that is a non-empty hex string', () => {
    const { signature } = createSignedVideoUpload('user-1');
    expect(/^[0-9a-f]+$/i.test(signature)).toBe(true);
  });

  it('timestamp is within a few seconds of now', () => {
    const { timestamp } = createSignedVideoUpload('u');
    const now = Math.floor(Date.now() / 1000);
    expect(Math.abs(timestamp - now)).toBeLessThan(5);
  });

  it('scopes folder to the given userId', () => {
    expect(createSignedVideoUpload('abc123').folder).toBe('viralengine/uploads/abc123');
    expect(createSignedVideoUpload('xyz').folder).toBe('viralengine/uploads/xyz');
  });

  it('throws when env vars are missing', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    expect(() => createSignedVideoUpload('u')).toThrow(/CLOUDINARY/);
  });

  it('uses sha256 when CLOUDINARY_SIGNATURE_ALGORITHM=sha256', () => {
    process.env.CLOUDINARY_SIGNATURE_ALGORITHM = 'sha256';
    // Just verify it does not throw and produces a valid hex signature
    const { signature } = createSignedVideoUpload('user-sha256');
    expect(/^[0-9a-f]+$/i.test(signature)).toBe(true);
  });
});
