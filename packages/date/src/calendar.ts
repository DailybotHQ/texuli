/** The date-only Gregorian operations used by Texuli's calendar surfaces. */
export type CalendarIdentifier = 'gregory';
export type DayOfWeek = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface DateDuration {
  readonly years?: number;
  readonly months?: number;
  readonly weeks?: number;
  readonly days?: number;
}

export interface DateFields {
  readonly year?: number;
  readonly month?: number;
  readonly day?: number;
}

const DAY_MS = 86_400_000;
const WEEK_DAYS: readonly DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function integer(value: number, field: string): number {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${field} must be a safe integer.`);
  return value;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function daysInMonth(year: number, month: number): number {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

function utcDate(year: number, month: number, day: number): Date {
  const result = new Date(0);
  result.setUTCFullYear(year, month - 1, day);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function fromUtcDate(date: Date): CalendarDate {
  const year = date.getUTCFullYear();
  if (year < 1 || year > 9999) throw new RangeError('Calendar date is outside years 1–9999.');
  return new CalendarDate(year, date.getUTCMonth() + 1, date.getUTCDate());
}

/** A date without a clock time or time zone. Invalid fields are constrained. */
export class CalendarDate {
  readonly calendar = new GregorianCalendar();
  readonly era = 'AD';
  readonly year: number;
  readonly month: number;
  readonly day: number;

  constructor(year: number, month: number, day: number) {
    this.year = clamp(integer(year, 'year'), 1, 9999);
    this.month = clamp(integer(month, 'month'), 1, 12);
    this.day = clamp(integer(day, 'day'), 1, daysInMonth(this.year, this.month));
  }

  copy(): CalendarDate {
    return new CalendarDate(this.year, this.month, this.day);
  }

  add(duration: DateDuration): CalendarDate {
    const year = this.year + integer(duration.years ?? 0, 'years');
    const totalMonths = year * 12 + this.month - 1 + integer(duration.months ?? 0, 'months');
    const nextYear = Math.floor(totalMonths / 12);
    const nextMonth = (((totalMonths % 12) + 12) % 12) + 1;
    if (nextYear < 1 || nextYear > 9999)
      throw new RangeError('Calendar date is outside years 1–9999.');
    const next = utcDate(nextYear, nextMonth, Math.min(this.day, daysInMonth(nextYear, nextMonth)));
    const offset = integer(duration.weeks ?? 0, 'weeks') * 7 + integer(duration.days ?? 0, 'days');
    integer(offset, 'days');
    next.setUTCDate(next.getUTCDate() + offset);
    return fromUtcDate(next);
  }

  subtract(duration: DateDuration): CalendarDate {
    return this.add({
      years: -(duration.years ?? 0),
      months: -(duration.months ?? 0),
      weeks: -(duration.weeks ?? 0),
      days: -(duration.days ?? 0),
    });
  }

  set(fields: DateFields): CalendarDate {
    return new CalendarDate(
      fields.year ?? this.year,
      fields.month ?? this.month,
      fields.day ?? this.day
    );
  }

  compare(other: CalendarDate): number {
    return this.year - other.year || this.month - other.month || this.day - other.day;
  }

  /** Convert to midnight in the requested zone. Texuli renders dates in UTC. */
  toDate(timeZone: string): Date {
    if (timeZone === 'UTC') return utcDate(this.year, this.month, this.day);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    });
    const wallTime = (date: Date): number => {
      const fields = Object.fromEntries(
        formatter.formatToParts(date).map((part) => [part.type, part.value])
      );
      const wall = utcDate(Number(fields.year), Number(fields.month), Number(fields.day));
      wall.setUTCHours(Number(fields.hour), Number(fields.minute), Number(fields.second));
      return wall.getTime();
    };
    const midnight = utcDate(this.year, this.month, this.day).getTime();
    let instant = midnight;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const correction = midnight - wallTime(new Date(instant));
      if (correction === 0) break;
      instant += correction;
    }
    return new Date(instant);
  }

  toString(): string {
    return `${String(this.year).padStart(4, '0')}-${String(this.month).padStart(2, '0')}-${String(this.day).padStart(2, '0')}`;
  }
}

export class GregorianCalendar {
  readonly identifier = 'gregory';

  getDaysInMonth(date: CalendarDate): number {
    return daysInMonth(date.year, date.month);
  }
}

export function createCalendar(identifier: CalendarIdentifier): GregorianCalendar {
  if (identifier !== 'gregory') throw new RangeError(`Unsupported calendar: ${identifier}`);
  return new GregorianCalendar();
}

export function toCalendar(date: CalendarDate, _calendar: GregorianCalendar): CalendarDate {
  return date;
}

export function parseDate(value: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError('Expected an ISO date in YYYY-MM-DD format.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month))
    throw new RangeError('Invalid Gregorian date.');
  return new CalendarDate(year, month, day);
}

export function getLocalTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function today(timeZone: string): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date());
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new CalendarDate(Number(fields.year), Number(fields.month), Number(fields.day));
}

export function startOfMonth(date: CalendarDate): CalendarDate {
  return date.set({ day: 1 });
}

export function isSameMonth(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month;
}

type WeekInfoLocale = Intl.Locale & {
  getWeekInfo?: () => { firstDay: number };
  weekInfo?: { firstDay: number };
};

/**
 * The first day of the week for `locale` as a number, `0` (Sunday) to `6`
 * (Saturday), from `Intl.Locale` week info; Sunday when the runtime has no
 * week info. Pass it as a calendar's `weekStartsOn` default.
 */
export function localeWeekStart(locale: string): number {
  // TypeScript's Intl declarations still omit getWeekInfo in the configured lib.
  let firstDay: number | undefined;
  try {
    const intlLocale = new Intl.Locale(locale) as WeekInfoLocale;
    firstDay = intlLocale.getWeekInfo?.().firstDay ?? intlLocale.weekInfo?.firstDay;
  } catch {
    firstDay = undefined;
  }
  // Week info numbers Monday 1 to Sunday 7.
  return typeof firstDay === 'number' && Number.isInteger(firstDay) ? firstDay % 7 : 0;
}

/** A `weekStartsOn` number (`0` Sunday to `6` Saturday) as a `DayOfWeek`; `undefined` for anything else. */
export function weekStartDay(weekStartsOn: number | undefined): DayOfWeek | undefined {
  if (weekStartsOn === undefined || !Number.isInteger(weekStartsOn)) return undefined;
  return WEEK_DAYS[weekStartsOn];
}

function firstDayOfWeek(locale: string): DayOfWeek {
  return WEEK_DAYS[localeWeekStart(locale)] ?? 'sun';
}

/** Whole days from `start` to `end` (negative when `end` is earlier). */
export function daysBetween(start: CalendarDate, end: CalendarDate): number {
  return Math.round(
    (utcDate(end.year, end.month, end.day).getTime() -
      utcDate(start.year, start.month, start.day).getTime()) /
      DAY_MS
  );
}

export function startOfWeek(
  date: CalendarDate,
  locale: string,
  firstDay?: DayOfWeek
): CalendarDate {
  const start = WEEK_DAYS.indexOf(firstDay ?? firstDayOfWeek(locale));
  const weekday = utcDate(date.year, date.month, date.day).getUTCDay();
  return date.add({ days: -((weekday - start + 7) % 7) });
}

export function getWeeksInMonth(date: CalendarDate, locale: string, firstDay?: DayOfWeek): number {
  const first = startOfWeek(startOfMonth(date), locale, firstDay);
  const last = startOfWeek(date.set({ day: daysInMonth(date.year, date.month) }), locale, firstDay);
  return (
    Math.round((last.toDate('UTC').getTime() - first.toDate('UTC').getTime()) / (7 * DAY_MS)) + 1
  );
}
