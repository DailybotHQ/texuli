import { describe, expect, it, vi } from 'vitest';
import {
  CalendarDate,
  createCalendar,
  daysBetween,
  getWeeksInMonth,
  localeWeekStart,
  parseDate,
  startOfWeek,
  today,
  weekStartDay,
} from '../src/index.ts';

describe('Gregorian date arithmetic', () => {
  it('validates ISO dates and clamps constructed dates', () => {
    expect(parseDate('2024-02-29').toString()).toBe('2024-02-29');
    expect(() => parseDate('2023-02-29')).toThrow(RangeError);
    expect(() => parseDate('0000-01-01')).toThrow(RangeError);
    expect(() => parseDate('2024-2-9')).toThrow(RangeError);
    expect(new CalendarDate(2023, 2, 31).toString()).toBe('2023-02-28');
  });

  it('handles leap years, month clamping, and day arithmetic across years 1–99', () => {
    expect(new CalendarDate(2024, 1, 31).add({ months: 1 }).toString()).toBe('2024-02-29');
    expect(new CalendarDate(2024, 2, 29).add({ years: 1 }).toString()).toBe('2025-02-28');
    expect(new CalendarDate(99, 12, 31).add({ days: 1 }).toString()).toBe('0100-01-01');
    expect(new CalendarDate(2024, 3, 1).subtract({ days: 1 }).toString()).toBe('2024-02-29');
    expect(new CalendarDate(2024, 2, 29).set({ year: 2023 }).toString()).toBe('2023-02-28');
  });

  it('uses locale week starts and counts the visible week rows', () => {
    const date = new CalendarDate(2024, 2, 15);
    expect(startOfWeek(date, 'en-US').toString()).toBe('2024-02-11');
    expect(startOfWeek(date, 'en-GB').toString()).toBe('2024-02-12');
    expect(startOfWeek(date, 'en-US', 'mon').toString()).toBe('2024-02-12');
    expect(getWeeksInMonth(date, 'en-US')).toBe(5);
    expect(getWeeksInMonth(new CalendarDate(2026, 2, 15), 'en-US')).toBe(4);
  });

  it('reports the locale week start as 0–6 and maps weekStartsOn numbers to days', () => {
    expect(localeWeekStart('en-US')).toBe(0);
    expect(localeWeekStart('en-GB')).toBe(1);
    expect(localeWeekStart('ar-EG')).toBe(6);
    expect(localeWeekStart('not a locale!')).toBe(0);
    expect(weekStartDay(1)).toBe('mon');
    expect(weekStartDay(0)).toBe('sun');
    for (const bad of [7, -1, 1.5, Number.NaN, undefined])
      expect(weekStartDay(bad)).toBeUndefined();
  });

  it('counts whole days between dates across months, leap days and DST', () => {
    expect(daysBetween(parseDate('2024-02-28'), parseDate('2024-03-01'))).toBe(2);
    expect(daysBetween(parseDate('2026-03-01'), parseDate('2026-03-31'))).toBe(30);
    expect(daysBetween(parseDate('2026-03-31'), parseDate('2026-03-01'))).toBe(-30);
    expect(daysBetween(parseDate('2025-12-31'), parseDate('2026-01-01'))).toBe(1);
  });

  it('reads today in the requested time zone', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-03-01T01:00:00Z'));
      expect(today('UTC').toString()).toBe('2026-03-01');
      expect(today('America/Bogota').toString()).toBe('2026-02-28');
    } finally {
      vi.useRealTimers();
    }
  });

  it('converts to midnight across time zones and DST boundaries', () => {
    expect(new CalendarDate(2026, 3, 8).toDate('UTC').toISOString()).toBe(
      '2026-03-08T00:00:00.000Z'
    );
    expect(new CalendarDate(2026, 3, 8).toDate('America/New_York').toISOString()).toBe(
      '2026-03-08T05:00:00.000Z'
    );
    expect(new CalendarDate(2026, 3, 9).toDate('America/New_York').toISOString()).toBe(
      '2026-03-09T04:00:00.000Z'
    );
  });

  it('rejects unsupported calendar identifiers explicitly', () => {
    expect(createCalendar('gregory').identifier).toBe('gregory');
    expect(() => createCalendar('buddhist' as 'gregory')).toThrow(RangeError);
  });
});
