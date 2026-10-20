import { describe, it, expect } from 'vitest';
import { normalizeHandle, computeAvgDaysBetween } from '@/lib/youtube';

describe('normalizeHandle', () => {
  it('keeps @handle as-is', () => {
    expect(normalizeHandle('@MrBeast')).toBe('@MrBeast');
  });

  it('adds @ when missing', () => {
    expect(normalizeHandle('MrBeast')).toBe('@MrBeast');
  });

  it('extracts handle from full youtube.com URL', () => {
    expect(normalizeHandle('https://www.youtube.com/@MrBeast')).toBe('@MrBeast');
  });

  it('extracts handle from youtube.com URL without www', () => {
    expect(normalizeHandle('https://youtube.com/@creator')).toBe('@creator');
  });

  it('trims whitespace before processing', () => {
    expect(normalizeHandle('  @user  ')).toBe('@user');
  });

  it('trims whitespace and adds @ when missing', () => {
    expect(normalizeHandle('  user  ')).toBe('@user');
  });

  it('handles handle with dots and dashes', () => {
    expect(normalizeHandle('my.channel-name')).toBe('@my.channel-name');
  });

  it('handles @handle with dots', () => {
    expect(normalizeHandle('@my.channel')).toBe('@my.channel');
  });

  it('handles full URL with handle containing underscores', () => {
    expect(normalizeHandle('https://www.youtube.com/@my_channel')).toBe('@my_channel');
  });
});

describe('computeAvgDaysBetween', () => {
  it('returns null for empty array', () => {
    expect(computeAvgDaysBetween([])).toBeNull();
  });

  it('returns null for single date', () => {
    expect(computeAvgDaysBetween(['2024-01-01T00:00:00Z'])).toBeNull();
  });

  it('computes avg days for two dates exactly 7 days apart', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-08T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(7, 5);
  });

  it('computes avg days for two dates exactly 1 day apart', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-02T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(1, 5);
  });

  it('computes avg for three dates with uniform 7-day gaps', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-08T00:00:00Z',
      '2024-01-15T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(7, 5);
  });

  it('computes avg for non-uniform gaps', () => {
    // gaps: 3 days and 7 days → avg = 5
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-04T00:00:00Z',
      '2024-01-11T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(5, 5);
  });

  it('handles dates provided out of chronological order', () => {
    // Function sorts internally, so order should not matter
    const result1 = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-08T00:00:00Z',
    ]);
    const result2 = computeAvgDaysBetween([
      '2024-01-08T00:00:00Z',
      '2024-01-01T00:00:00Z',
    ]);
    expect(result1).toBeCloseTo(result2 as number, 5);
  });

  it('computes avg for many dates', () => {
    // 10 dates, each 2 days apart
    const dates: string[] = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date('2024-01-01T00:00:00Z');
      d.setDate(d.getDate() + i * 2);
      dates.push(d.toISOString());
    }
    const result = computeAvgDaysBetween(dates);
    expect(result).toBeCloseTo(2, 4);
  });

  it('returns a positive number when dates span multiple weeks', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-03-01T00:00:00Z',
    ]);
    expect(result).toBeGreaterThan(0);
  });

  it('returns a fractional number for sub-day gaps', () => {
    // 12 hours apart = 0.5 days
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-01T12:00:00Z',
    ]);
    expect(result).toBeCloseTo(0.5, 5);
  });
});
