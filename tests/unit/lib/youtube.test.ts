import { describe, it, expect } from 'vitest';
import { normalizeHandle, computeAvgDaysBetween } from '@/lib/youtube';

describe('normalizeHandle()', () => {
  it('prefixes @ to a bare handle', () => {
    expect(normalizeHandle('mkbhd')).toBe('@mkbhd');
  });

  it('keeps existing @ prefix', () => {
    expect(normalizeHandle('@mkbhd')).toBe('@mkbhd');
  });

  it('extracts handle from a full youtube.com/@handle URL', () => {
    expect(normalizeHandle('https://www.youtube.com/@mkbhd')).toBe('@mkbhd');
  });

  it('extracts handle from youtube.com/@handle URL without www', () => {
    expect(normalizeHandle('https://youtube.com/@MrBeast')).toBe('@MrBeast');
  });

  it('extracts handle containing dots from URL', () => {
    expect(normalizeHandle('https://www.youtube.com/@some.creator')).toBe('@some.creator');
  });

  it('extracts handle containing hyphens from URL', () => {
    expect(normalizeHandle('https://www.youtube.com/@my-channel-name')).toBe('@my-channel-name');
  });

  it('extracts handle containing underscores from URL', () => {
    expect(normalizeHandle('https://www.youtube.com/@channel_name')).toBe('@channel_name');
  });

  it('trims surrounding whitespace before processing', () => {
    expect(normalizeHandle('  mkbhd  ')).toBe('@mkbhd');
  });

  it('trims whitespace from a URL', () => {
    expect(normalizeHandle('  https://www.youtube.com/@mkbhd  ')).toBe('@mkbhd');
  });

  it('trims whitespace from an already-prefixed handle', () => {
    expect(normalizeHandle('  @mkbhd  ')).toBe('@mkbhd');
  });

  it('handles handle with uppercase letters', () => {
    expect(normalizeHandle('LinusTechTips')).toBe('@LinusTechTips');
  });

  it('handles a URL with query parameters after the handle', () => {
    // The regex captures only the @handle segment, not beyond
    const result = normalizeHandle('https://www.youtube.com/@creator?sub=1');
    expect(result).toBe('@creator');
  });

  it('prefixes @ when the input looks like a plain name with no URL structure', () => {
    expect(normalizeHandle('veritasium')).toBe('@veritasium');
  });

  it('does not double-prefix a handle that already starts with @', () => {
    expect(normalizeHandle('@already')).toBe('@already');
    expect(normalizeHandle('@already').startsWith('@@')).toBe(false);
  });

  it('handles a numeric-only handle', () => {
    expect(normalizeHandle('123456')).toBe('@123456');
  });
});

describe('computeAvgDaysBetween()', () => {
  it('returns null for empty array', () => {
    expect(computeAvgDaysBetween([])).toBeNull();
  });

  it('returns null for a single date', () => {
    expect(computeAvgDaysBetween(['2024-01-01T00:00:00Z'])).toBeNull();
  });

  it('computes 7 days for two dates exactly one week apart', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-08T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(7, 5);
  });

  it('computes 1 day for two dates exactly 24 hours apart', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-02T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(1, 5);
  });

  it('computes correct average for three evenly-spaced dates (7 days each)', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-08T00:00:00Z',
      '2024-01-15T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(7, 5);
  });

  it('computes correct average for unevenly-spaced dates', () => {
    // gaps: 2 days and 8 days → avg = 5 days
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-03T00:00:00Z',
      '2024-01-11T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(5, 5);
  });

  it('returns a positive number regardless of input order', () => {
    // Sorted descending should give the same result as ascending
    const asc = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-08T00:00:00Z',
    ]);
    const desc = computeAvgDaysBetween([
      '2024-01-08T00:00:00Z',
      '2024-01-01T00:00:00Z',
    ]);
    expect(asc).toBeCloseTo(desc!, 5);
    expect(asc).toBeGreaterThan(0);
  });

  it('returns a positive number for randomly-ordered dates', () => {
    const dates = [
      '2024-03-15T00:00:00Z',
      '2024-01-01T00:00:00Z',
      '2024-02-10T00:00:00Z',
      '2024-04-20T00:00:00Z',
    ];
    const result = computeAvgDaysBetween(dates);
    expect(result).toBeGreaterThan(0);
  });

  it('computes 0.5 days for two dates 12 hours apart', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-01T12:00:00Z',
    ]);
    expect(result).toBeCloseTo(0.5, 5);
  });

  it('handles 15 dates (playlist max) without throwing', () => {
    const dates = Array.from({ length: 15 }, (_, i) => {
      const d = new Date('2024-01-01T00:00:00Z');
      d.setDate(d.getDate() + i * 7);
      return d.toISOString();
    });
    const result = computeAvgDaysBetween(dates);
    expect(result).toBeCloseTo(7, 4);
  });

  it('computes correctly for dates spanning multiple years', () => {
    const result = computeAvgDaysBetween([
      '2023-01-01T00:00:00Z',
      '2024-01-01T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(365, 0);
  });

  it('never returns NaN or Infinity for valid input', () => {
    const dates = ['2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z'];
    const result = computeAvgDaysBetween(dates);
    expect(Number.isFinite(result!)).toBe(true);
  });

  it('result is a number (not null) when at least 2 dates are provided', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-10T00:00:00Z',
    ]);
    expect(result).not.toBeNull();
    expect(typeof result).toBe('number');
  });
});
