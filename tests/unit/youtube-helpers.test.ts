import { describe, it, expect } from 'vitest';

/**
 * Re-implementation of the private helpers from lib/youtube.ts so we can
 * unit-test their logic without modifying the production module's exports.
 * These mirror the exact algorithm in lib/youtube.ts and serve as
 * correctness documentation.
 */

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

function normalizeHandle(rawHandle: string): string {
  const trimmed = rawHandle.trim();
  const fromUrl = trimmed.match(/youtube\.com\/(@[\w.-]+)/i);
  const handle = fromUrl ? fromUrl[1] : trimmed;
  return handle.startsWith('@') ? handle : `@${handle}`;
}

describe('computeAvgDaysBetween()', () => {
  it('returns null for an empty array', () => {
    expect(computeAvgDaysBetween([])).toBeNull();
  });

  it('returns null for a single date', () => {
    expect(computeAvgDaysBetween(['2024-01-01T00:00:00Z'])).toBeNull();
  });

  it('computes 7 days for two dates one week apart', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-08T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(7, 5);
  });

  it('computes 1 day for two dates one day apart', () => {
    const result = computeAvgDaysBetween([
      '2024-06-01T00:00:00Z',
      '2024-06-02T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(1, 5);
  });

  it('computes correct average for three evenly spaced dates', () => {
    // 2 gaps of 7 days each → avg = 7
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-08T00:00:00Z',
      '2024-01-15T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(7, 5);
  });

  it('works regardless of input order (sorts internally)', () => {
    const r1 = computeAvgDaysBetween([
      '2024-01-15T00:00:00Z',
      '2024-01-01T00:00:00Z',
      '2024-01-08T00:00:00Z',
    ]);
    const r2 = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-08T00:00:00Z',
      '2024-01-15T00:00:00Z',
    ]);
    expect(r1).toBeCloseTo(r2!, 5);
  });

  it('computes average for uneven gaps', () => {
    // Gap1 = 3 days, Gap2 = 10 days → avg = 6.5 days
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-04T00:00:00Z',
      '2024-01-14T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(6.5, 4);
  });

  it('handles dates far apart (months)', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-07-01T00:00:00Z',
    ]);
    // ~181 days for a non-leap year
    expect(result!).toBeGreaterThan(180);
    expect(result!).toBeLessThan(183);
  });

  it('returns a positive number for valid dates', () => {
    const result = computeAvgDaysBetween([
      '2023-12-31T00:00:00Z',
      '2024-01-01T00:00:00Z',
    ]);
    expect(result!).toBeGreaterThan(0);
  });

  it('handles many dates (15 items)', () => {
    const dates = Array.from({ length: 15 }, (_, i) => {
      const d = new Date('2024-01-01T00:00:00Z');
      d.setDate(d.getDate() + i * 7);
      return d.toISOString();
    });
    const result = computeAvgDaysBetween(dates);
    expect(result).toBeCloseTo(7, 4);
  });
});

describe('normalizeHandle()', () => {
  it('adds @ to a bare handle', () => {
    expect(normalizeHandle('MrBeast')).toBe('@MrBeast');
  });

  it('keeps existing @ prefix', () => {
    expect(normalizeHandle('@MrBeast')).toBe('@MrBeast');
  });

  it('does not double the @ sign', () => {
    const result = normalizeHandle('@creator');
    expect(result).toBe('@creator');
    expect(result.startsWith('@@')).toBe(false);
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeHandle('  creator  ')).toBe('@creator');
  });

  it('extracts handle from a full youtube URL', () => {
    expect(normalizeHandle('https://www.youtube.com/@MrBeast')).toBe('@MrBeast');
  });

  it('extracts handle from youtube URL without www', () => {
    expect(normalizeHandle('https://youtube.com/@someCreator')).toBe('@someCreator');
  });

  it('always returns a string starting with @', () => {
    const inputs = ['user', '@user', 'https://www.youtube.com/@user', '  user  '];
    for (const input of inputs) {
      expect(normalizeHandle(input).startsWith('@')).toBe(true);
    }
  });

  it('preserves dots and hyphens in handle', () => {
    expect(normalizeHandle('my.channel-name')).toBe('@my.channel-name');
  });

  it('preserves dots from URL-extracted handle', () => {
    expect(normalizeHandle('https://youtube.com/@my.channel')).toBe('@my.channel');
  });
});
