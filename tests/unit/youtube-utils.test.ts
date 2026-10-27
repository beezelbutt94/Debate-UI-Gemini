import { describe, it, expect } from 'vitest';
import { normalizeHandle, computeAvgDaysBetween } from '@/lib/youtube';

// ---------------------------------------------------------------------------
// normalizeHandle
// ---------------------------------------------------------------------------

describe('normalizeHandle()', () => {
  it('returns a handle that already starts with @ unchanged', () => {
    expect(normalizeHandle('@MrBeast')).toBe('@MrBeast');
  });

  it('prepends @ to a bare handle', () => {
    expect(normalizeHandle('MrBeast')).toBe('@MrBeast');
  });

  it('trims leading and trailing whitespace before processing', () => {
    expect(normalizeHandle('  @creator  ')).toBe('@creator');
    expect(normalizeHandle('  creator  ')).toBe('@creator');
  });

  it('extracts the @handle from a full youtube.com URL', () => {
    expect(normalizeHandle('https://www.youtube.com/@PewDiePie')).toBe('@PewDiePie');
  });

  it('extracts the @handle from a youtube.com URL without www', () => {
    expect(normalizeHandle('https://youtube.com/@SomeChannel')).toBe('@SomeChannel');
  });

  it('handles a handle with dots (allowed in YouTube handles)', () => {
    expect(normalizeHandle('@some.creator')).toBe('@some.creator');
  });

  it('handles a handle with underscores', () => {
    expect(normalizeHandle('some_creator')).toBe('@some_creator');
  });

  it('handles a handle with hyphens', () => {
    expect(normalizeHandle('@some-channel')).toBe('@some-channel');
  });

  it('handles numeric-only handle', () => {
    expect(normalizeHandle('1234567')).toBe('@1234567');
  });
});

// ---------------------------------------------------------------------------
// computeAvgDaysBetween
// ---------------------------------------------------------------------------

describe('computeAvgDaysBetween()', () => {
  it('returns null for an empty array', () => {
    expect(computeAvgDaysBetween([])).toBeNull();
  });

  it('returns null for a single date (no gap to compute)', () => {
    expect(computeAvgDaysBetween(['2024-01-01T00:00:00.000Z'])).toBeNull();
  });

  it('returns 1 for two dates exactly 1 day apart', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00.000Z',
      '2024-01-02T00:00:00.000Z',
    ]);
    expect(result).toBeCloseTo(1, 5);
  });

  it('returns 7 for two dates exactly 7 days apart', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00.000Z',
      '2024-01-08T00:00:00.000Z',
    ]);
    expect(result).toBeCloseTo(7, 5);
  });

  it('computes the average for three evenly spaced dates', () => {
    // 3 dates, 2 gaps, each 2 days → avg = 2
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00.000Z',
      '2024-01-03T00:00:00.000Z',
      '2024-01-05T00:00:00.000Z',
    ]);
    expect(result).toBeCloseTo(2, 5);
  });

  it('sorts dates before computing so input order does not matter', () => {
    // Same three dates as above but in a different order
    const result = computeAvgDaysBetween([
      '2024-01-05T00:00:00.000Z',
      '2024-01-01T00:00:00.000Z',
      '2024-01-03T00:00:00.000Z',
    ]);
    expect(result).toBeCloseTo(2, 5);
  });

  it('handles uneven gaps — returns the true mean', () => {
    // Gaps: 1 day and 3 days → avg = 2
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00.000Z',
      '2024-01-02T00:00:00.000Z',
      '2024-01-05T00:00:00.000Z',
    ]);
    expect(result).toBeCloseTo(2, 5);
  });

  it('returns a positive number (days are always positive)', () => {
    const result = computeAvgDaysBetween([
      '2024-01-10T00:00:00.000Z',
      '2024-01-01T00:00:00.000Z',
    ]);
    expect(result).toBeGreaterThan(0);
  });

  it('handles fractional days correctly', () => {
    // 12-hour gap = 0.5 days
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00.000Z',
      '2024-01-01T12:00:00.000Z',
    ]);
    expect(result).toBeCloseTo(0.5, 5);
  });
});
