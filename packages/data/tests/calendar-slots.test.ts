import { describe, expect, it } from 'vitest';
import { formatCalendar } from '../src/calendar/model.ts';
import {
  daySlot,
  nowMinute,
  slotMinuteAt,
  stepSlot,
  timedSlot,
} from '../src/engines/calendar/index.ts';

describe('calendar slots and clock', () => {
  it('builds timed slots in the view zone and all-day slots with an exclusive end', () => {
    expect(timedSlot('2026-04-15', 9 * 60, 'UTC')).toEqual({
      date: '2026-04-15',
      start: '2026-04-15T09:00:00.000Z',
      end: '2026-04-15T10:00:00.000Z',
      allDay: false,
    });
    // 09:30 in Los Angeles (PDT, UTC-7), 30 minutes long.
    expect(timedSlot('2026-04-15', 9 * 60 + 30, 'America/Los_Angeles', 30)).toMatchObject({
      start: '2026-04-15T16:30:00.000Z',
      end: '2026-04-15T17:00:00.000Z',
    });
    expect(daySlot('2026-12-31')).toEqual({
      date: '2026-12-31',
      start: '2026-12-31',
      end: '2027-01-01',
      allDay: true,
    });
  });

  it('snaps a pointer offset to a slot and keeps it inside the day', () => {
    expect(slotMinuteAt(600, 1440, 15)).toBe(600);
    expect(slotMinuteAt(614, 1440, 15)).toBe(600);
    expect(slotMinuteAt(300, 720, 30)).toBe(600);
    expect(slotMinuteAt(-20, 1440, 15)).toBe(0);
    expect(slotMinuteAt(5000, 1440, 15)).toBe(1425);
    expect(slotMinuteAt(10, 0, 15)).toBe(0);
  });

  it('steps the focused slot by days and minutes, wrapping past midnight', () => {
    expect(stepSlot({ date: '2026-04-15', minute: 600 }, 1, 15)).toEqual({
      date: '2026-04-16',
      minute: 615,
    });
    expect(stepSlot({ date: '2026-04-15', minute: 0 }, 0, -15)).toEqual({
      date: '2026-04-14',
      minute: 1425,
    });
    expect(stepSlot({ date: '2026-04-15', minute: 1425 }, 0, 15)).toEqual({
      date: '2026-04-16',
      minute: 0,
    });
  });

  it('places now on its own date only, in wall-clock minutes', () => {
    const at = Date.parse('2026-04-15T13:30:00Z');
    expect(nowMinute(at, '2026-04-15', 'UTC')).toBe(810);
    expect(nowMinute(at, '2026-04-16', 'UTC')).toBeNull();
    expect(nowMinute(at, '2026-04-15', 'America/New_York')).toBe(570);
    // Late evening in Los Angeles is already the next UTC day.
    expect(nowMinute(Date.parse('2026-04-16T02:00:00Z'), '2026-04-15', 'America/Los_Angeles')).toBe(
      19 * 60
    );
  });

  it('adds the year to range titles that span years or are not the current year', () => {
    const fmt = formatCalendar('en-US', 'UTC');
    expect(fmt.range('2026-04-12', '2026-04-18', 2026)).toBe('Apr 12 – Apr 18');
    expect(fmt.range('2026-04-12', '2026-04-18')).toBe('Apr 12 – Apr 18');
    expect(fmt.range('2026-04-12', '2026-04-18', 2025)).toBe('Apr 12 – Apr 18, 2026');
    expect(fmt.range('2026-12-27', '2027-01-02', 2026)).toBe('Dec 27, 2026 – Jan 2, 2027');
    // always: the year on every range, current year included.
    expect(fmt.range('2026-05-31', '2026-06-06', 2026, true)).toBe('May 31 – Jun 6, 2026');
    expect(fmt.range('2026-12-27', '2027-01-02', 2026, true)).toBe('Dec 27, 2026 – Jan 2, 2027');
  });
});
