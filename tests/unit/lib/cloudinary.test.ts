import { describe, it, expect } from 'vitest';
import { buildFrameUrl, buildWaveformUrl, pickFrameTimestamps } from '@/lib/cloudinary';

// ─── buildFrameUrl ────────────────────────────────────────────────────────────

describe('buildFrameUrl()', () => {
  it('constructs the expected Cloudinary on-the-fly transformation URL', () => {
    const url = buildFrameUrl('mycloudname', 'viralengine/uploads/user1/video', 3.5);
    expect(url).toBe(
      'https://res.cloudinary.com/mycloudname/video/upload/so_3.50,f_jpg,w_640,q_auto/viralengine/uploads/user1/video.jpg'
    );
  });

  it('formats offset to exactly 2 decimal places', () => {
    const url = buildFrameUrl('cloud', 'vid', 1);
    expect(url).toContain('so_1.00');
  });

  it('formats a fractional offset correctly', () => {
    const url = buildFrameUrl('cloud', 'vid', 1.5);
    expect(url).toContain('so_1.50');
  });

  it('clamps negative offsets to 0', () => {
    const url = buildFrameUrl('cloud', 'vid', -2);
    expect(url).toContain('so_0.00');
  });

  it('handles a zero offset', () => {
    const url = buildFrameUrl('cloud', 'vid', 0);
    expect(url).toContain('so_0.00');
  });

  it('uses .jpg extension', () => {
    expect(buildFrameUrl('c', 'v', 1)).toMatch(/\.jpg$/);
  });

  it('uses res.cloudinary.com host', () => {
    expect(buildFrameUrl('c', 'v', 1)).toMatch(/^https:\/\/res\.cloudinary\.com\//);
  });

  it('embeds the cloudName in the URL', () => {
    expect(buildFrameUrl('mycloud', 'v', 1)).toContain('/mycloud/');
  });

  it('embeds the publicId in the URL', () => {
    expect(buildFrameUrl('c', 'my/public/id', 1)).toContain('my/public/id');
  });
});

// ─── buildWaveformUrl ─────────────────────────────────────────────────────────

describe('buildWaveformUrl()', () => {
  it('constructs the expected Cloudinary waveform URL', () => {
    const url = buildWaveformUrl('mycloudname', 'viralengine/uploads/user1/video');
    expect(url).toBe(
      'https://res.cloudinary.com/mycloudname/video/upload/fl_waveform,co_rgb:f59e0b,b_rgb:0a0a0a,w_800,h_160/viralengine/uploads/user1/video.png'
    );
  });

  it('uses .png extension', () => {
    expect(buildWaveformUrl('c', 'v')).toMatch(/\.png$/);
  });

  it('uses res.cloudinary.com host', () => {
    expect(buildWaveformUrl('c', 'v')).toMatch(/^https:\/\/res\.cloudinary\.com\//);
  });

  it('includes the waveform flag', () => {
    expect(buildWaveformUrl('c', 'v')).toContain('fl_waveform');
  });

  it('embeds the cloudName', () => {
    expect(buildWaveformUrl('testcloud', 'v')).toContain('/testcloud/');
  });

  it('embeds the publicId', () => {
    expect(buildWaveformUrl('c', 'some/path/vid')).toContain('some/path/vid');
  });
});

// ─── pickFrameTimestamps ──────────────────────────────────────────────────────

describe('pickFrameTimestamps()', () => {
  it('returns an array', () => {
    expect(Array.isArray(pickFrameTimestamps(30))).toBe(true);
  });

  it('returns no more than 6 timestamps', () => {
    expect(pickFrameTimestamps(60).length).toBeLessThanOrEqual(6);
    expect(pickFrameTimestamps(120).length).toBeLessThanOrEqual(6);
  });

  it('all timestamps are less than the duration', () => {
    const duration = 30;
    const timestamps = pickFrameTimestamps(duration);
    for (const t of timestamps) {
      expect(t).toBeLessThan(duration);
    }
  });

  it('all timestamps are non-negative', () => {
    const timestamps = pickFrameTimestamps(30);
    for (const t of timestamps) {
      expect(t).toBeGreaterThanOrEqual(0);
    }
  });

  it('timestamps are in ascending order', () => {
    const timestamps = pickFrameTimestamps(60);
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
    }
  });

  it('always includes a hook frame (t < 3s) for videos longer than 3s', () => {
    const timestamps = pickFrameTimestamps(30);
    expect(timestamps.some((t) => t < 3)).toBe(true);
  });

  it('handles a very short video (1 second)', () => {
    const timestamps = pickFrameTimestamps(1);
    expect(timestamps.length).toBeGreaterThan(0);
    for (const t of timestamps) {
      expect(t).toBeLessThan(1);
    }
  });

  it('handles a very short video (2 seconds)', () => {
    const timestamps = pickFrameTimestamps(2);
    for (const t of timestamps) {
      expect(t).toBeLessThan(2);
    }
  });

  it('handles a very short video (3 seconds exactly)', () => {
    const timestamps = pickFrameTimestamps(3);
    for (const t of timestamps) {
      expect(t).toBeLessThan(3);
    }
  });

  it('contains no duplicate timestamps', () => {
    const timestamps = pickFrameTimestamps(60);
    const unique = new Set(timestamps);
    expect(unique.size).toBe(timestamps.length);
  });

  it('returns timestamps rounded to 2 decimal places', () => {
    const timestamps = pickFrameTimestamps(60);
    for (const t of timestamps) {
      expect(t).toBe(Math.round(t * 100) / 100);
    }
  });

  it('returns 6 timestamps for a long video (120s)', () => {
    expect(pickFrameTimestamps(120).length).toBe(6);
  });

  it('starts at 0 for any video', () => {
    expect(pickFrameTimestamps(30)[0]).toBe(0);
    expect(pickFrameTimestamps(5)[0]).toBe(0);
  });
});
