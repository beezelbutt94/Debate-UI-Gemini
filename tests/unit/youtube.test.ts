import { describe, it, expect } from 'vitest';
import { normalizeHandle, computeAvgDaysBetween } from '@/lib/youtube';

describe('normalizeHandle', () => {
  // bare handle without @
  it('adds @ to a bare handle', () => {
    expect(normalizeHandle('MrBeast')).toBe('@MrBeast');
  });

  it('keeps @ when already present', () => {
    expect(normalizeHandle('@MrBeast')).toBe('@MrBeast');
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeHandle('  MrBeast  ')).toBe('@MrBeast');
  });

  it('trims whitespace around an @-prefixed handle', () => {
    expect(normalizeHandle('  @MrBeast  ')).toBe('@MrBeast');
  });

  // full YouTube channel URLs
  it('extracts handle from a full youtube.com URL', () => {
    expect(normalizeHandle('https://www.youtube.com/@MrBeast')).toBe('@MrBeast');
  });

  it('extracts handle from a youtube.com URL without www', () => {
    expect(normalizeHandle('https://youtube.com/@TechChannel')).toBe('@TechChannel');
  });

  it('extracts handle with dots in the name from URL', () => {
    expect(normalizeHandle('https://www.youtube.com/@creator.name')).toBe('@creator.name');
  });

  it('extracts handle with dashes in the name from URL', () => {
    expect(normalizeHandle('https://www.youtube.com/@my-channel')).toBe('@my-channel');
  });

  it('does not double-prefix @', () => {
    const result = normalizeHandle('@user');
    expect(result).not.toContain('@@');
  });

  it('handles handle with numbers', () => {
    expect(normalizeHandle('creator123')).toBe('@creator123');
  });

  it('handles underscore in handle', () => {
    expect(normalizeHandle('my_channel')).toBe('@my_channel');
  });

  it('extracts @-handle from URL and does not strip the @', () => {
    const result = normalizeHandle('https://www.youtube.com/@SomeCreator');
    expect(result.startsWith('@')).toBe(true);
  });
});

describe('computeAvgDaysBetween', () => {
  it('returns null for an empty array', () => {
    expect(computeAvgDaysBetween([])).toBeNull();
  });

  it('returns null for a single date', () => {
    expect(computeAvgDaysBetween(['2024-01-01T00:00:00Z'])).toBeNull();
  });

  it('returns 1 for exactly 2 dates 1 day apart', () => {
    const dates = ['2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z'];
    expect(computeAvgDaysBetween(dates)).toBeCloseTo(1, 5);
  });

  it('returns 7 for dates spaced exactly 1 week apart', () => {
    const dates = ['2024-01-01T00:00:00Z', '2024-01-08T00:00:00Z'];
    expect(computeAvgDaysBetween(dates)).toBeCloseTo(7, 5);
  });

  it('computes average for 3 dates with gaps of 2 and 4 days → 3', () => {
    const dates = [
      '2024-01-01T00:00:00Z', // oldest
      '2024-01-03T00:00:00Z', // +2 days
      '2024-01-07T00:00:00Z', // +4 days
    ];
    expect(computeAvgDaysBetween(dates)).toBeCloseTo(3, 5);
  });

  it('handles dates given in unsorted (reverse) order correctly', () => {
    // sorted descending internally
    const dates = ['2024-01-07T00:00:00Z', '2024-01-01T00:00:00Z'];
    expect(computeAvgDaysBetween(dates)).toBeCloseTo(6, 5);
  });

  it('handles dates given in random order', () => {
    const dates = [
      '2024-01-05T00:00:00Z',
      '2024-01-01T00:00:00Z',
      '2024-01-09T00:00:00Z',
    ];
    // sorted desc: Jan 9, Jan 5, Jan 1 → gaps 4d + 4d → avg 4
    expect(computeAvgDaysBetween(dates)).toBeCloseTo(4, 5);
  });

  it('returns a positive number for valid multi-date arrays', () => {
    const dates = ['2024-01-01T00:00:00Z', '2024-01-10T00:00:00Z', '2024-01-20T00:00:00Z'];
    const result = computeAvgDaysBetween(dates);
    expect(result).toBeGreaterThan(0);
  });

  it('computes fractional days when uploads are hours apart', () => {
    const dates = [
      '2024-01-01T00:00:00Z',
      '2024-01-01T12:00:00Z', // 0.5 days later
    ];
    expect(computeAvgDaysBetween(dates)).toBeCloseTo(0.5, 5);
  });

  it('handles 15 equally-spaced dates (real world: one per day)', () => {
    const dates = Array.from({ length: 15 }, (_, i) => {
      const d = new Date('2024-01-01T00:00:00Z');
      d.setDate(d.getDate() + i);
      return d.toISOString();
    });
    expect(computeAvgDaysBetween(dates)).toBeCloseTo(1, 5);
  });
});
