import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';

// We import the pure functions directly; createSignedVideoUpload and
// fetchVideoResource require env vars / network, so we test them separately.
import {
  buildFrameUrl,
  buildWaveformUrl,
  pickFrameTimestamps,
  createSignedVideoUpload,
} from '@/lib/cloudinary';

// ── buildFrameUrl ─────────────────────────────────────────────────────────────

describe('buildFrameUrl()', () => {
  it('returns a valid URL string', () => {
    const url = buildFrameUrl('mycloudname', 'viralengine/uploads/u1/video', 3);
    expect(() => new URL(url)).not.toThrow();
  });

  it('includes the cloud name in the host', () => {
    expect(buildFrameUrl('mycloudname', 'vid/test', 5)).toContain('mycloudname');
  });

  it('includes so_ offset transformation', () => {
    expect(buildFrameUrl('c', 'vid/test', 2.5)).toContain('so_2.50');
  });

  it('clamps negative offset to 0', () => {
    expect(buildFrameUrl('c', 'vid/test', -5)).toContain('so_0.00');
  });

  it('includes f_jpg format', () => {
    expect(buildFrameUrl('c', 'vid', 1)).toContain('f_jpg');
  });

  it('includes w_640 width', () => {
    expect(buildFrameUrl('c', 'vid', 1)).toContain('w_640');
  });

  it('appends .jpg extension', () => {
    expect(buildFrameUrl('c', 'my/public_id', 1)).toMatch(/\.jpg$/);
  });

  it('includes the public_id in the path', () => {
    expect(buildFrameUrl('c', 'viralengine/uploads/u42/myvid', 1)).toContain(
      'viralengine/uploads/u42/myvid'
    );
  });

  it('rounds offset to 2 decimal places', () => {
    expect(buildFrameUrl('c', 'vid', 1.5678)).toContain('so_1.57');
  });
});

// ── buildWaveformUrl ──────────────────────────────────────────────────────────

describe('buildWaveformUrl()', () => {
  it('returns a valid URL string', () => {
    const url = buildWaveformUrl('mycloudname', 'viralengine/uploads/u1/video');
    expect(() => new URL(url)).not.toThrow();
  });

  it('includes fl_waveform transformation', () => {
    expect(buildWaveformUrl('c', 'vid')).toContain('fl_waveform');
  });

  it('includes the amber brand color', () => {
    expect(buildWaveformUrl('c', 'vid')).toContain('co_rgb:f59e0b');
  });

  it('includes the dark background color', () => {
    expect(buildWaveformUrl('c', 'vid')).toContain('b_rgb:0a0a0a');
  });

  it('includes w_800 width', () => {
    expect(buildWaveformUrl('c', 'vid')).toContain('w_800');
  });

  it('includes h_160 height', () => {
    expect(buildWaveformUrl('c', 'vid')).toContain('h_160');
  });

  it('appends .png extension', () => {
    expect(buildWaveformUrl('c', 'my/public_id')).toMatch(/\.png$/);
  });

  it('includes the cloud name', () => {
    expect(buildWaveformUrl('testcloud', 'vid')).toContain('testcloud');
  });
});

// ── pickFrameTimestamps ───────────────────────────────────────────────────────

describe('pickFrameTimestamps()', () => {
  it('returns an array', () => {
    expect(Array.isArray(pickFrameTimestamps(30))).toBe(true);
  });

  it('includes 0 (start frame) for a long video', () => {
    expect(pickFrameTimestamps(30)).toContain(0);
  });

  it('all timestamps are non-negative', () => {
    pickFrameTimestamps(60).forEach((t) => expect(t).toBeGreaterThanOrEqual(0));
  });

  it('all timestamps are strictly less than duration', () => {
    const duration = 20;
    pickFrameTimestamps(duration).forEach((t) => expect(t).toBeLessThan(duration));
  });

  it('returns at most 6 timestamps', () => {
    expect(pickFrameTimestamps(120).length).toBeLessThanOrEqual(6);
  });

  it('timestamps are sorted in ascending order', () => {
    const ts = pickFrameTimestamps(30);
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]).toBeGreaterThan(ts[i - 1]);
    }
  });

  it('returns no duplicates', () => {
    const ts = pickFrameTimestamps(30);
    expect(new Set(ts).size).toBe(ts.length);
  });

  it('covers the hook window (includes offset ≤ 3s) for videos > 3s', () => {
    const ts = pickFrameTimestamps(30);
    const hookCoverage = ts.filter((t) => t <= 3);
    expect(hookCoverage.length).toBeGreaterThanOrEqual(1);
  });

  it('handles a very short 1-second video without throwing', () => {
    expect(() => pickFrameTimestamps(1)).not.toThrow();
  });

  it('handles very short video: all timestamps within duration', () => {
    pickFrameTimestamps(1).forEach((t) => expect(t).toBeLessThan(1));
  });

  it('returns exactly 6 frames for a long video', () => {
    expect(pickFrameTimestamps(120).length).toBe(6);
  });

  it('timestamp values are rounded to 2 decimal places', () => {
    pickFrameTimestamps(30).forEach((t) => {
      expect(Math.abs(t - Math.round(t * 100) / 100)).toBeLessThan(1e-10);
    });
  });

  it('handles a 3-second video', () => {
    const ts = pickFrameTimestamps(3);
    expect(ts.length).toBeGreaterThan(0);
    ts.forEach((t) => expect(t).toBeLessThan(3));
  });
});

// ── createSignedVideoUpload (env-var-gated) ───────────────────────────────────

describe('createSignedVideoUpload()', () => {
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
  });

  it('returns cloudName, apiKey, timestamp, signature, folder, allowedFormats', () => {
    const result = createSignedVideoUpload('user123');
    expect(result).toHaveProperty('cloudName', 'testcloud');
    expect(result).toHaveProperty('apiKey', 'testkey');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('signature');
    expect(result).toHaveProperty('folder');
    expect(result).toHaveProperty('allowedFormats');
  });

  it('scopes the folder to the user ID', () => {
    expect(createSignedVideoUpload('user123').folder).toContain('user123');
  });

  it('allowedFormats includes mp4', () => {
    expect(createSignedVideoUpload('u1').allowedFormats).toContain('mp4');
  });

  it('allowedFormats includes mov', () => {
    expect(createSignedVideoUpload('u1').allowedFormats).toContain('mov');
  });

  it('timestamp is close to now (within 5 seconds)', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(Math.abs(createSignedVideoUpload('u1').timestamp - now)).toBeLessThanOrEqual(5);
  });

  it('signature is a hex string', () => {
    expect(createSignedVideoUpload('u1').signature).toMatch(/^[0-9a-f]+$/);
  });

  it('throws when CLOUDINARY_CLOUD_NAME is missing', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    expect(() => createSignedVideoUpload('u1')).toThrow();
  });

  it('throws when CLOUDINARY_API_KEY is missing', () => {
    delete process.env.CLOUDINARY_API_KEY;
    expect(() => createSignedVideoUpload('u1')).toThrow();
  });

  it('throws when CLOUDINARY_API_SECRET is missing', () => {
    delete process.env.CLOUDINARY_API_SECRET;
    expect(() => createSignedVideoUpload('u1')).toThrow();
  });

  it('produces a valid SHA-1 signature by default', () => {
    const { folder, allowedFormats, timestamp, signature } = createSignedVideoUpload('u1');
    const params = { allowed_formats: allowedFormats, folder, timestamp };
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k as keyof typeof params]}`)
      .join('&');
    const expected = createHash('sha1').update(sorted + 'testsecret').digest('hex');
    expect(signature).toBe(expected);
  });

  it('signature length is consistent with SHA-1 hex output (40 chars) by default', () => {
    // SIGNATURE_ALGORITHM is a module-level const resolved at import time,
    // so only the default (sha1) path is testable without module re-init.
    // SHA-1 hex digest is always 40 chars; SHA-256 would be 64.
    const { signature } = createSignedVideoUpload('u1');
    expect(signature.length).toBe(40);
  });
});
