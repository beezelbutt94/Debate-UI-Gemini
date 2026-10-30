/**
 * Tests for pure computation helpers in lib/youtube.ts.
 *
 * normalizeHandle and computeAvgDaysBetween are not exported, so we
 * re-implement them here verbatim to test the logic independently of
 * the network calls (fetchYoutubeChannelSnapshot requires a live API key).
 *
 * If either internal function changes, this file's copy must be updated too.
 */
import { describe, it, expect } from 'vitest';

// ── normalizeHandle (copied from lib/youtube.ts) ──────────────────────────
function normalizeHandle(rawHandle: string): string {
  const trimmed = rawHandle.trim();
  const fromUrl = trimmed.match(/youtube\.com\/(@[\w.-]+)/i);
  const handle = fromUrl ? fromUrl[1] : trimmed;
  return handle.startsWith('@') ? handle : `@${handle}`;
}

// ── computeAvgDaysBetween (copied from lib/youtube.ts) ───────────────────
function computeAvgDaysBetween(publishedAtDates: string[]): number | null {
  if (publishedAtDates.length < 2) return null;

  const sorted = [...publishedAtDates]
    .map((d) => new Date(d).getTime())
    .sort((a, b) => b - a);

  let totalGapMs = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    totalGapMs += sorted[i] - sorted[i + 1];
  }

  return totalGapMs / (sorted.length - 1) / (1000 * 60 * 60 * 24);
}

// ──────────────────────────────────────────────────────────
// normalizeHandle
// ──────────────────────────────────────────────────────────
describe('normalizeHandle()', () => {
  it('adds @ when the bare handle has none', () => {
    expect(normalizeHandle('mkbhd')).toBe('@mkbhd');
  });

  it('preserves existing @ prefix', () => {
    expect(normalizeHandle('@mkbhd')).toBe('@mkbhd');
  });

  it('strips leading and trailing whitespace', () => {
    expect(normalizeHandle('  mkbhd  ')).toBe('@mkbhd');
  });

  it('extracts handle from full youtube.com URL', () => {
    expect(normalizeHandle('https://www.youtube.com/@MrBeast')).toBe('@MrBeast');
  });

  it('extracts handle from URL without www', () => {
    expect(normalizeHandle('https://youtube.com/@veritasium')).toBe('@veritasium');
  });

  it('handles handles with dots', () => {
    expect(normalizeHandle('some.channel')).toBe('@some.channel');
  });

  it('handles handles with hyphens', () => {
    expect(normalizeHandle('some-channel')).toBe('@some-channel');
  });

  it('handles handles with underscores', () => {
    expect(normalizeHandle('some_channel')).toBe('@some_channel');
  });

  it('handles double @ by just returning it (already starts with @)', () => {
    // The regex doesn't produce @@, but the logic is: if it starts with @, keep it
    expect(normalizeHandle('@already')).toBe('@already');
  });
});

// ──────────────────────────────────────────────────────────
// computeAvgDaysBetween
// ──────────────────────────────────────────────────────────
describe('computeAvgDaysBetween()', () => {
  it('returns null for an empty array', () => {
    expect(computeAvgDaysBetween([])).toBeNull();
  });

  it('returns null for a single date', () => {
    expect(computeAvgDaysBetween(['2024-01-01T00:00:00Z'])).toBeNull();
  });

  it('computes exactly 1 day between two consecutive dates', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-02T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(1, 5);
  });

  it('computes exactly 7 days between dates one week apart', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-08T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(7, 5);
  });

  it('computes correct average for three equally-spaced dates', () => {
    // Gaps: 1 day, 1 day → avg = 1
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-02T00:00:00Z',
      '2024-01-03T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(1, 5);
  });

  it('sorts dates descending before computing (order should not matter)', () => {
    // Unsorted input: same as sorted above
    const sorted = computeAvgDaysBetween([
      '2024-01-03T00:00:00Z',
      '2024-01-01T00:00:00Z',
      '2024-01-02T00:00:00Z',
    ]);
    const inOrder = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-02T00:00:00Z',
      '2024-01-03T00:00:00Z',
    ]);
    expect(sorted).toBeCloseTo(inOrder as number, 10);
  });

  it('computes average for unequal gaps', () => {
    // Gaps: 3 days, 1 day → avg = 2
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-04T00:00:00Z',
      '2024-01-05T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(2, 5);
  });

  it('handles fractional days (12-hour gap = 0.5 days)', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-01T12:00:00Z',
    ]);
    expect(result).toBeCloseTo(0.5, 5);
  });

  it('does not mutate the input array', () => {
    const dates = ['2024-01-03T00:00:00Z', '2024-01-01T00:00:00Z'];
    const copy = [...dates];
    computeAvgDaysBetween(dates);
    expect(dates).toEqual(copy);
  });
});
