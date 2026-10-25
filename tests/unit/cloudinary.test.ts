import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildFrameUrl, buildWaveformUrl, pickFrameTimestamps } from '../../lib/cloudinary.ts';

describe('buildFrameUrl()', () => {
  test('builds a valid Cloudinary frame extraction URL', () => {
    const url = buildFrameUrl('mycloud', 'viralengine/uploads/user1/video', 5);
    assert.ok(url.startsWith('https://res.cloudinary.com/mycloud/'), url);
    assert.ok(url.includes('so_5.00'), url);
    assert.ok(url.includes('f_jpg'), url);
    assert.ok(url.includes('w_640'), url);
    assert.ok(url.endsWith('.jpg'), url);
  });

  test('formats offset to 2 decimal places', () => {
    const url = buildFrameUrl('cloud', 'vid', 3.141592);
    assert.ok(url.includes('so_3.14'), url);
  });

  test('clamps negative offset to 0', () => {
    const url = buildFrameUrl('cloud', 'vid', -5);
    assert.ok(url.includes('so_0.00'), url);
  });

  test('handles zero offset', () => {
    const url = buildFrameUrl('cloud', 'vid', 0);
    assert.ok(url.includes('so_0.00'), url);
  });

  test('encodes the public_id in the URL path', () => {
    const url = buildFrameUrl('cloud', 'viralengine/uploads/user/myvideo', 1.5);
    assert.ok(url.includes('viralengine/uploads/user/myvideo'), url);
  });

  test('includes q_auto for automatic quality', () => {
    const url = buildFrameUrl('cloud', 'vid', 2);
    assert.ok(url.includes('q_auto'), url);
  });
});

describe('buildWaveformUrl()', () => {
  test('builds a valid Cloudinary waveform URL', () => {
    const url = buildWaveformUrl('mycloud', 'viralengine/uploads/user1/video');
    assert.ok(url.startsWith('https://res.cloudinary.com/mycloud/'), url);
    assert.ok(url.includes('fl_waveform'), url);
    assert.ok(url.endsWith('.png'), url);
  });

  test('includes amber color for waveform line', () => {
    const url = buildWaveformUrl('cloud', 'vid');
    assert.ok(url.includes('co_rgb:f59e0b'), url);
  });

  test('includes dark background color', () => {
    const url = buildWaveformUrl('cloud', 'vid');
    assert.ok(url.includes('b_rgb:0a0a0a'), url);
  });

  test('specifies width 800 and height 160', () => {
    const url = buildWaveformUrl('cloud', 'vid');
    assert.ok(url.includes('w_800'), url);
    assert.ok(url.includes('h_160'), url);
  });

  test('encodes the public_id in the URL path', () => {
    const url = buildWaveformUrl('cloud', 'viralengine/uploads/user/myvideo');
    assert.ok(url.includes('viralengine/uploads/user/myvideo'), url);
  });
});

describe('pickFrameTimestamps()', () => {
  test('returns an array', () => {
    const result = pickFrameTimestamps(30);
    assert.ok(Array.isArray(result));
  });

  test('always starts with 0 for any video longer than 0 seconds', () => {
    const result = pickFrameTimestamps(10);
    assert.equal(result[0], 0);
  });

  test('returns at most 6 timestamps', () => {
    const result = pickFrameTimestamps(120);
    assert.ok(result.length <= 6, `Expected <= 6, got ${result.length}`);
  });

  test('returns exactly 6 frames for a 30-second video', () => {
    const result = pickFrameTimestamps(30);
    assert.equal(result.length, 6);
  });

  test('returns exactly 6 frames for a 60-second video', () => {
    const result = pickFrameTimestamps(60);
    assert.equal(result.length, 6);
  });

  test('all timestamps are less than durationSeconds', () => {
    const duration = 20;
    const result = pickFrameTimestamps(duration);
    for (const t of result) {
      assert.ok(t < duration, `Timestamp ${t} exceeds duration ${duration}`);
    }
  });

  test('timestamps are in ascending order', () => {
    const result = pickFrameTimestamps(30);
    for (let i = 1; i < result.length; i++) {
      assert.ok(result[i] > result[i - 1], `Not sorted at index ${i}: ${result[i - 1]} >= ${result[i]}`);
    }
  });

  test('timestamps are unique (no duplicates)', () => {
    const result = pickFrameTimestamps(30);
    const unique = new Set(result);
    assert.equal(unique.size, result.length);
  });

  test('includes near-start hook frame at 0 seconds', () => {
    const result = pickFrameTimestamps(15);
    assert.ok(result.includes(0), `Expected 0 in ${result}`);
  });

  test('includes 1.5-second hook frame for videos longer than 1.5s', () => {
    const result = pickFrameTimestamps(15);
    assert.ok(result.includes(1.5), `Expected 1.5 in ${result}`);
  });

  test('includes 3-second hook frame for videos longer than 3s', () => {
    const result = pickFrameTimestamps(10);
    assert.ok(result.includes(3), `Expected 3 in ${result}`);
  });

  test('handles very short video (1 second) gracefully', () => {
    const result = pickFrameTimestamps(1);
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
    for (const t of result) {
      assert.ok(t < 1, `Timestamp ${t} should be < 1`);
    }
  });

  test('handles very short video (0.5 seconds)', () => {
    const result = pickFrameTimestamps(0.5);
    assert.ok(Array.isArray(result));
    for (const t of result) {
      assert.ok(t < 0.5, `Timestamp ${t} should be < 0.5`);
    }
  });

  test('handles long video (600 seconds) with at most 6 frames', () => {
    const result = pickFrameTimestamps(600);
    assert.ok(result.length <= 6);
    for (const t of result) {
      assert.ok(t < 600);
    }
  });

  test('timestamps are rounded to 2 decimal places', () => {
    const result = pickFrameTimestamps(30);
    for (const t of result) {
      // Check that it's rounded to 2 decimal places (difference from rounded is < epsilon)
      assert.ok(Math.abs(t - Math.round(t * 100) / 100) < 1e-9, `${t} is not rounded to 2dp`);
    }
  });

  test('for a 10-second video: returns 6 frames', () => {
    const result = pickFrameTimestamps(10);
    assert.equal(result.length, 6);
    assert.deepEqual(result.slice(0, 3), [0, 1.5, 3]);
  });
});
