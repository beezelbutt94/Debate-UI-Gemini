import { describe, it, expect } from 'vitest';
import { normalizeHandle, computeAvgDaysBetween } from '@/lib/youtube';

describe('normalizeHandle', () => {
  it('preserves a bare @handle', () => {
    expect(normalizeHandle('@MrBeast')).toBe('@MrBeast');
  });

  it('adds @ to a handle without it', () => {
    expect(normalizeHandle('MrBeast')).toBe('@MrBeast');
  });

  it('trims leading/trailing whitespace before processing', () => {
    expect(normalizeHandle('  MrBeast  ')).toBe('@MrBeast');
  });

  it('trims whitespace from @handle', () => {
    expect(normalizeHandle('  @MrBeast  ')).toBe('@MrBeast');
  });

  it('extracts @handle from a full youtube.com URL', () => {
    expect(normalizeHandle('https://www.youtube.com/@MrBeast')).toBe('@MrBeast');
  });

  it('extracts @handle from youtube.com URL without www', () => {
    expect(normalizeHandle('https://youtube.com/@TechChannel')).toBe('@TechChannel');
  });

  it('preserves dots in handles extracted from URLs', () => {
    expect(normalizeHandle('https://www.youtube.com/@Channel.Name')).toBe('@Channel.Name');
  });

  it('preserves hyphens in handles extracted from URLs', () => {
    expect(normalizeHandle('https://www.youtube.com/@channel-name')).toBe('@channel-name');
  });

  it('handles bare handle with underscores', () => {
    expect(normalizeHandle('my_channel')).toBe('@my_channel');
  });

  it('does not double-add @ for handles already prefixed', () => {
    expect(normalizeHandle('@already')).toBe('@already');
  });

  it('case-insensitive URL match', () => {
    // The regex uses /i so both cases should work
    expect(normalizeHandle('https://www.YOUTUBE.COM/@CaseTest')).toBe('@CaseTest');
  });
});

describe('computeAvgDaysBetween', () => {
  it('returns null for an empty array', () => {
    expect(computeAvgDaysBetween([])).toBeNull();
  });

  it('returns null for a single date', () => {
    expect(computeAvgDaysBetween(['2024-01-01T00:00:00Z'])).toBeNull();
  });

  it('returns 1 for two dates exactly 1 day apart', () => {
    const d1 = '2024-01-01T00:00:00.000Z';
    const d2 = '2024-01-02T00:00:00.000Z';
    const result = computeAvgDaysBetween([d1, d2]);
    expect(result).toBeCloseTo(1, 5);
  });

  it('returns 7 for two dates 7 days apart', () => {
    const d1 = '2024-01-01T00:00:00.000Z';
    const d2 = '2024-01-08T00:00:00.000Z';
    const result = computeAvgDaysBetween([d1, d2]);
    expect(result).toBeCloseTo(7, 5);
  });

  it('correctly averages three equally-spaced dates (every 3 days)', () => {
    const dates = [
      '2024-01-01T00:00:00.000Z',
      '2024-01-04T00:00:00.000Z',
      '2024-01-07T00:00:00.000Z',
    ];
    const result = computeAvgDaysBetween(dates);
    expect(result).toBeCloseTo(3, 5);
  });

  it('handles dates given in non-chronological order (sorts them)', () => {
    const dates = [
      '2024-01-08T00:00:00.000Z', // latest
      '2024-01-01T00:00:00.000Z', // earliest
    ];
    const result = computeAvgDaysBetween(dates);
    expect(result).toBeCloseTo(7, 5);
  });

  it('handles dates at different times of day (not just midnight)', () => {
    const d1 = '2024-01-01T12:00:00.000Z';
    const d2 = '2024-01-02T12:00:00.000Z';
    const result = computeAvgDaysBetween([d1, d2]);
    expect(result).toBeCloseTo(1, 5);
  });

  it('returns a positive number for valid dates', () => {
    const dates = ['2024-01-01T00:00:00.000Z', '2024-01-15T00:00:00.000Z'];
    expect(computeAvgDaysBetween(dates)!).toBeGreaterThan(0);
  });

  it('correctly averages unevenly spaced dates', () => {
    // Gaps: 2 days, 4 days → avg 3 days
    const dates = [
      '2024-01-01T00:00:00.000Z',
      '2024-01-03T00:00:00.000Z',
      '2024-01-07T00:00:00.000Z',
    ];
    const result = computeAvgDaysBetween(dates);
    expect(result).toBeCloseTo(3, 5);
  });

  it('handles large numbers of dates efficiently', () => {
    const base = new Date('2024-01-01T00:00:00.000Z').getTime();
    const dates = Array.from({ length: 15 }, (_, i) =>
      new Date(base + i * 86400000).toISOString()
    );
    const result = computeAvgDaysBetween(dates);
    expect(result).toBeCloseTo(1, 5);
  });
});
