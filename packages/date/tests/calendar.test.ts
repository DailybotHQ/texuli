import { describe, expect, it, vi } from 'vitest';
import {
  CalendarDate,
  createCalendar,
  getWeeksInMonth,
  parseDate,
  startOfWeek,
  today,
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
