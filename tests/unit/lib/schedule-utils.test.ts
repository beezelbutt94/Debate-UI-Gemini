import { describe, it, expect, vi, afterEach } from 'vitest';
import { DAY_INDEX, nextOccurrence } from '@/lib/schedule-utils';
import type { CalendarSlot } from '@/lib/types';

describe('DAY_INDEX', () => {
  it('sunday maps to 0', () => expect(DAY_INDEX.sunday).toBe(0));
  it('monday maps to 1', () => expect(DAY_INDEX.monday).toBe(1));
  it('tuesday maps to 2', () => expect(DAY_INDEX.tuesday).toBe(2));
  it('wednesday maps to 3', () => expect(DAY_INDEX.wednesday).toBe(3));
  it('thursday maps to 4', () => expect(DAY_INDEX.thursday).toBe(4));
  it('friday maps to 5', () => expect(DAY_INDEX.friday).toBe(5));
  it('saturday maps to 6', () => expect(DAY_INDEX.saturday).toBe(6));

  it('covers all 7 days', () => {
    expect(Object.keys(DAY_INDEX)).toHaveLength(7);
  });
});

describe('nextOccurrence()', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper: pin "now" to a specific UTC moment, run the function, unpin.
  function pinNow(isoString: string, fn: () => void) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(isoString));
    fn();
    vi.useRealTimers();
  }

  it('returns a Date in the future', () => {
    const result = nextOccurrence('monday', '10:00');
    expect(result.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns a Date on the requested weekday', () => {
    const days: CalendarSlot['day_of_week'][] = [
      'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
    ];
    for (const day of days) {
      const result = nextOccurrence(day, '09:00');
      expect(result.getDay()).toBe(DAY_INDEX[day]);
    }
  });

  it('sets the correct hour and minute', () => {
    pinNow('2026-11-09T00:00:00.000Z', () => {
      const result = nextOccurrence('tuesday', '14:30');
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });
  });

  it('returns seconds and milliseconds reset to zero', () => {
    const result = nextOccurrence('friday', '08:00');
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('skips today if the time has already passed', () => {
    // Pin to Monday 2026-11-09 at 15:00 UTC
    pinNow('2026-11-09T15:00:00.000Z', () => {
      // Monday at 10:00 has already passed today → next Monday
      const result = nextOccurrence('monday', '10:00');
      const dayDiff = Math.round(
        (result.getTime() - new Date('2026-11-09T15:00:00.000Z').getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(dayDiff).toBeGreaterThan(0);
    });
  });

  it('returns today if the time has not yet passed', () => {
    // Pin to Monday 2026-11-09 at 08:00 UTC
    pinNow('2026-11-09T08:00:00.000Z', () => {
      const result = nextOccurrence('monday', '10:00');
      const now = new Date('2026-11-09T08:00:00.000Z');
      const diffHours = (result.getTime() - now.getTime()) / (1000 * 60 * 60);
      // Should be ~2 hours ahead, not ~170 hours (a full week) ahead
      expect(diffHours).toBeLessThan(24);
      expect(diffHours).toBeGreaterThan(0);
    });
  });

  it('result is at most 8 days in the future', () => {
    const result = nextOccurrence('wednesday', '12:00');
    const maxMs = 8 * 24 * 60 * 60 * 1000;
    expect(result.getTime() - Date.now()).toBeLessThanOrEqual(maxMs);
  });

  it('handles midnight (00:00)', () => {
    const result = nextOccurrence('thursday', '00:00');
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('handles end of day (23:59)', () => {
    const result = nextOccurrence('saturday', '23:59');
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
  });

  it('never returns a date in the past', () => {
    const days: CalendarSlot['day_of_week'][] = [
      'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
    ];
    const times = ['00:00', '06:00', '12:00', '18:00', '23:59'];
    for (const day of days) {
      for (const time of times) {
        const result = nextOccurrence(day, time);
        expect(result.getTime()).toBeGreaterThan(Date.now());
      }
    }
  });

  it('handles single-digit hour strings without leading zero', () => {
    // time_local format is "HH:MM" but let's verify split(':').map(Number) handles "9:05"
    pinNow('2026-11-09T00:00:00.000Z', () => {
      const result = nextOccurrence('tuesday', '9:05');
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(5);
    });
  });

  it('returns valid dates across two consecutive days with the same weekday', () => {
    // Pinned to Saturday 2026-11-07 at 20:00 UTC
    pinNow('2026-11-07T20:00:00.000Z', () => {
      const result = nextOccurrence('saturday', '10:00');
      // Saturday at 10:00 has passed → next Saturday (7 days later)
      expect(result.getDay()).toBe(6);
      expect(result.getTime()).toBeGreaterThan(new Date('2026-11-07T20:00:00.000Z').getTime());
    });
  });
});
