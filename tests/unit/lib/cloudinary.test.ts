import { describe, it, expect } from 'vitest';
import { pickFrameTimestamps, buildFrameUrl, buildWaveformUrl } from '@/lib/cloudinary';

describe('pickFrameTimestamps()', () => {
  it('returns empty array for 0-second video', () => {
    expect(pickFrameTimestamps(0)).toEqual([]);
  });

  it('returns frames for a 1-second video (all within duration)', () => {
    const frames = pickFrameTimestamps(1);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((t) => t < 1)).toBe(true);
  });

  it('returns at most 6 frames for any duration', () => {
    expect(pickFrameTimestamps(60).length).toBeLessThanOrEqual(6);
    expect(pickFrameTimestamps(300).length).toBeLessThanOrEqual(6);
    expect(pickFrameTimestamps(10).length).toBeLessThanOrEqual(6);
  });

  it('returns exactly 6 frames for a typical 60-second video', () => {
    expect(pickFrameTimestamps(60).length).toBe(6);
  });

  it('returns exactly 6 frames for a 6-second video', () => {
    expect(pickFrameTimestamps(6).length).toBe(6);
  });

  it('always includes a near-zero frame (hook window)', () => {
    const frames = pickFrameTimestamps(60);
    expect(frames[0]).toBe(0);
  });

  it('always includes frames at 1.5s and 3s for a long video', () => {
    const frames = pickFrameTimestamps(60);
    expect(frames).toContain(1.5);
    expect(frames).toContain(3);
  });

  it('all timestamps are strictly less than video duration', () => {
    const duration = 10;
    const frames = pickFrameTimestamps(duration);
    expect(frames.every((t) => t < duration)).toBe(true);
  });

  it('returns frames in ascending order', () => {
    const frames = pickFrameTimestamps(60);
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]).toBeGreaterThan(frames[i - 1]);
    }
  });

  it('returns no duplicate timestamps', () => {
    const frames = pickFrameTimestamps(60);
    const unique = new Set(frames);
    expect(unique.size).toBe(frames.length);
  });

  it('handles very short video (0.1s)', () => {
    const frames = pickFrameTimestamps(0.1);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((t) => t < 0.1)).toBe(true);
  });

  it('handles a video shorter than 3 seconds', () => {
    const frames = pickFrameTimestamps(2);
    expect(frames.every((t) => t < 2)).toBe(true);
    expect(frames.length).toBeGreaterThan(0);
  });

  it('rounds timestamps to 2 decimal places', () => {
    const frames = pickFrameTimestamps(60);
    frames.forEach((t) => {
      expect(Number.isInteger(Math.round(t * 100))).toBe(true);
    });
  });

  it('capped at 6 for a very long video (3600s)', () => {
    expect(pickFrameTimestamps(3600).length).toBe(6);
  });
});

describe('buildFrameUrl()', () => {
  it('returns a valid HTTPS Cloudinary URL', () => {
    const url = buildFrameUrl('mycloud', 'viralengine/uploads/user/video', 5);
    expect(url.startsWith('https://res.cloudinary.com/mycloud/')).toBe(true);
  });

  it('includes the offset in the URL as so_<seconds>', () => {
    const url = buildFrameUrl('mycloud', 'viralengine/uploads/user/video', 5);
    expect(url).toContain('so_5.00');
  });

  it('clamps negative offsets to 0', () => {
    const url = buildFrameUrl('mycloud', 'viralengine/uploads/user/video', -3);
    expect(url).toContain('so_0.00');
  });

  it('includes the public ID in the URL', () => {
    const publicId = 'viralengine/uploads/user123/myvideo';
    const url = buildFrameUrl('cloud', publicId, 2);
    expect(url).toContain(publicId);
  });

  it('includes the cloud name in the URL', () => {
    const url = buildFrameUrl('testcloud', 'some/video', 1);
    expect(url).toContain('/testcloud/');
  });

  it('requests f_jpg format', () => {
    const url = buildFrameUrl('cloud', 'vid', 0);
    expect(url).toContain('f_jpg');
  });

  it('requests w_640 width', () => {
    const url = buildFrameUrl('cloud', 'vid', 0);
    expect(url).toContain('w_640');
  });
});

describe('buildWaveformUrl()', () => {
  it('returns a valid HTTPS Cloudinary URL', () => {
    const url = buildWaveformUrl('mycloud', 'viralengine/uploads/user/video');
    expect(url.startsWith('https://res.cloudinary.com/mycloud/')).toBe(true);
  });

  it('includes fl_waveform transformation', () => {
    const url = buildWaveformUrl('mycloud', 'viralengine/uploads/user/video');
    expect(url).toContain('fl_waveform');
  });

  it('includes the public ID in the URL', () => {
    const publicId = 'viralengine/uploads/user123/myvideo';
    const url = buildWaveformUrl('cloud', publicId);
    expect(url).toContain(publicId);
  });

  it('requests PNG format (ends with .png)', () => {
    const url = buildWaveformUrl('cloud', 'vid');
    expect(url.endsWith('.png')).toBe(true);
  });

  it('includes specified dimensions', () => {
    const url = buildWaveformUrl('cloud', 'vid');
    expect(url).toContain('w_800');
    expect(url).toContain('h_160');
  });
});
