/**
 * Empty-slot and clock helpers for calendar views: the slot a click or the
 * keyboard targets for a new event, roving focus across slots, and where the
 * "now" line sits. Pure: the view passes the clock's instant in, nothing here
 * reads the system clock.
 */
import {
  addDays,
  dayBounds,
  type IsoDate,
  parseIsoDate,
  toIso,
  wallTime,
  zonedInstant,
} from './dates.ts';

export const MINUTES_PER_DAY = 1440;

/** What a view's `onCreate` receives: a timed slot, or a day (all-day, `end` exclusive). */
export interface CalendarSlot {
  date: IsoDate;
  start: string;
  end: string;
  allDay: boolean;
}

/** A timed slot starting `minute` (wall clock) into `date` in `timeZone`, lasting `duration` minutes. */
export function timedSlot(
  date: IsoDate,
  minute: number,
  timeZone: string,
  duration = 60
): CalendarSlot {
  const { year, month, day } = parseIsoDate(date);
  const start = zonedInstant(
    { year, month, day, hour: Math.floor(minute / 60), minute: minute % 60, second: 0 },
    timeZone
  );
  return { date, start: toIso(start), end: toIso(start + duration * 60_000), allDay: false };
}

/** An all-day slot for `date`. */
export function daySlot(date: IsoDate): CalendarSlot {
  return { date, start: date, end: addDays(date, 1), allDay: true };
}

/** The slot-aligned minute under a pointer `offset` pixels into a day column `height` pixels tall. */
export function slotMinuteAt(offset: number, height: number, slotMinutes: number): number {
  if (height <= 0) return 0;
  const minute = Math.floor(((offset / height) * MINUTES_PER_DAY) / slotMinutes) * slotMinutes;
  return Math.min(MINUTES_PER_DAY - slotMinutes, Math.max(0, minute));
}

/**
 * The focused slot after moving by `days` and `minutes`, wrapping into the
 * previous or next day past midnight.
 */
export function stepSlot(
  focus: { date: IsoDate; minute: number },
  days: number,
  minutes: number
): { date: IsoDate; minute: number } {
  let date = addDays(focus.date, days);
  let minute = focus.minute + minutes;
  while (minute < 0) {
    minute += MINUTES_PER_DAY;
    date = addDays(date, -1);
  }
  while (minute >= MINUTES_PER_DAY) {
    minute -= MINUTES_PER_DAY;
    date = addDays(date, 1);
  }
  return { date, minute };
}

/** Wall-clock minutes into `date` of `instant` in `timeZone`, or null when it is another day. */
export function nowMinute(instant: number, date: IsoDate, timeZone: string): number | null {
  const { start, end } = dayBounds(date, timeZone);
  if (instant < start || instant >= end) return null;
  const wall = wallTime(instant, timeZone);
  return wall.hour * 60 + wall.minute;
}
