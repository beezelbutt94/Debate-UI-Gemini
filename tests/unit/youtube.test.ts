import { describe, it, expect } from 'vitest';
import { normalizeHandle, computeAvgDaysBetween } from '@/lib/youtube';

// ── normalizeHandle ──────────────────────────────────────────────────────────

describe('normalizeHandle()', () => {
  it('adds @ to a bare username', () => {
    expect(normalizeHandle('MrBeast')).toBe('@MrBeast');
  });

  it('preserves existing @ prefix', () => {
    expect(normalizeHandle('@MrBeast')).toBe('@MrBeast');
  });

  it('does not double-add @', () => {
    const result = normalizeHandle('@creator');
    expect(result.startsWith('@')).toBe(true);
    expect(result).not.toContain('@@');
  });

  it('extracts handle from a full youtube.com URL', () => {
    expect(normalizeHandle('https://www.youtube.com/@MrBeast')).toBe('@MrBeast');
  });

  it('extracts handle from youtube.com URL without www', () => {
    expect(normalizeHandle('https://youtube.com/@SomeCreator')).toBe('@SomeCreator');
  });

  it('handles dotted handles from URL', () => {
    expect(normalizeHandle('https://www.youtube.com/@creator.name')).toBe('@creator.name');
  });

  it('handles handle with digits and dots', () => {
    expect(normalizeHandle('https://www.youtube.com/@creator123.foo')).toBe('@creator123.foo');
  });

  it('trims leading/trailing whitespace from input', () => {
    expect(normalizeHandle('  @creator  ')).toBe('@creator');
  });

  it('trims whitespace from bare handle and adds @', () => {
    expect(normalizeHandle('  creator  ')).toBe('@creator');
  });

  it('handles mixed-case URL pattern (case-insensitive match)', () => {
    expect(normalizeHandle('https://www.YouTube.com/@Upper')).toBe('@Upper');
  });
});

// ── computeAvgDaysBetween ────────────────────────────────────────────────────

describe('computeAvgDaysBetween()', () => {
  it('returns null for empty array', () => {
    expect(computeAvgDaysBetween([])).toBeNull();
  });

  it('returns null for single date (no gaps)', () => {
    expect(computeAvgDaysBetween(['2024-01-01T00:00:00Z'])).toBeNull();
  });

  it('computes 1-day gap for two consecutive days', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-02T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(1, 5);
  });

  it('computes 7-day gap for two dates a week apart', () => {
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-08T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(7, 5);
  });

  it('handles input in non-sorted order (function sorts internally)', () => {
    // Passing newest first vs oldest first should yield same result
    const ascending = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-03T00:00:00Z',
      '2024-01-07T00:00:00Z',
    ]);
    const descending = computeAvgDaysBetween([
      '2024-01-07T00:00:00Z',
      '2024-01-03T00:00:00Z',
      '2024-01-01T00:00:00Z',
    ]);
    expect(ascending).toBeCloseTo(descending!, 5);
  });

  it('computes average of unequal gaps correctly', () => {
    // Gaps: 2 days, 4 days → avg = 3 days
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-01-03T00:00:00Z',
      '2024-01-07T00:00:00Z',
    ]);
    expect(result).toBeCloseTo(3, 4);
  });

  it('handles large date ranges (months apart)', () => {
    // ~90 days apart
    const result = computeAvgDaysBetween([
      '2024-01-01T00:00:00Z',
      '2024-04-01T00:00:00Z',
    ]);
    expect(result).toBeGreaterThan(89);
    expect(result).toBeLessThan(92);
  });

  it('handles 15 dates spaced exactly 7 days apart', () => {
    const dates: string[] = [];
    for (let i = 0; i < 15; i++) {
      const d = new Date(2024, 0, 1 + i * 7);
      dates.push(d.toISOString());
    }
    const result = computeAvgDaysBetween(dates);
    expect(result).toBeCloseTo(7, 3);
  });

  it('returns a positive number for valid two-date input', () => {
    const result = computeAvgDaysBetween([
      '2024-03-01T00:00:00Z',
      '2024-03-05T00:00:00Z',
    ]);
    expect(result).toBeGreaterThan(0);
  });
});
