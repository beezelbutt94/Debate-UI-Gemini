import type { CalendarSlot } from '@/lib/types';

export const DAY_INDEX: Record<CalendarSlot['day_of_week'], number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Next occurrence of a weekday + "HH:MM" within the coming 7 days
 * (today counts if the time hasn't passed yet). No per-user timezone is
 * stored in this schema yet, so this resolves against the server's own
 * clock (UTC in a typical deployment) -- a real limitation, not hidden:
 * see docs/VIRALENGINE_ROADMAP.md.
 */
export function nextOccurrence(dayOfWeek: CalendarSlot['day_of_week'], timeLocal: string): Date {
  const [hours, minutes] = timeLocal.split(':').map(Number);
  const now = new Date();
  const targetDay = DAY_INDEX[dayOfWeek];

  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hours || 0, minutes || 0, 0, 0);
    if (candidate.getDay() === targetDay && candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }
  // Fallback: shouldn't happen (a full week is checked above), but never
  // return an invalid date.
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}
