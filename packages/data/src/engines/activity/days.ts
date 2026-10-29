import { dateIn, daysBetween, type IsoDate, parseIsoDate } from '../calendar/dates.ts';

export interface DayGroup<T> {
  /** The civil date in the time zone (`2026-10-19`). */
  day: IsoDate;
  /** "Today", "Yesterday", "Monday", "Oct 12" or "Oct 12, 2025". */
  label: string;
  items: T[];
}

export interface DayGroupOptions<T> {
  at: (item: T) => string | number | Date;
  /** The runtime clock's now (`runtime.clock.now()`), never the wall clock. */
  now: string | number | Date;
  timeZone?: string;
  locale?: string;
}

const checked = new Map<string, boolean>();
/** True when `Intl.DateTimeFormat` accepts the option (memoized per value). */
function accepted(key: string, make: () => unknown): boolean {
  let ok = checked.get(key);
  if (ok === undefined) {
    try {
      make();
      ok = true;
    } catch {
      ok = false;
    }
    if (checked.size > 256) checked.clear();
    checked.set(key, ok);
  }
  return ok;
}

/**
 * The time zone to format in: `timeZone` when the runtime knows it, else
 * `UTC`. Blueprints pass free strings, and `Intl` throws a RangeError on an
 * unknown zone.
 */
function zoneOrUtc(timeZone: unknown): string {
  return typeof timeZone === 'string' &&
    accepted(`z:${timeZone}`, () => new Intl.DateTimeFormat('en-US', { timeZone }))
    ? timeZone
    : 'UTC';
}

/** The locale to format in: `locale` when it is a valid tag, else `en-US`. */
function localeOrDefault(locale: unknown): string {
  return typeof locale === 'string' &&
    accepted(`l:${locale}`, () => new Intl.DateTimeFormat(locale))
    ? locale
    : 'en-US';
}

const instant = (value: string | number | Date) =>
  value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);

/** A day's label relative to `today`. */
export function dayLabel(day: IsoDate, today: IsoDate, requestedLocale = 'en-US'): string {
  const locale = localeOrDefault(requestedLocale);
  const diff = daysBetween(day, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  const { year, month, day: date } = parseIsoDate(day);
  const utc = new Date(Date.UTC(year, month - 1, date));
  if (diff > 1 && diff < 7)
    return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(utc);
  const sameYear = year === parseIsoDate(today).year;
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(utc);
}

/**
 * Groups items by civil day in `timeZone`, keeping their order (pass them
 * newest first for a feed). Items with an invalid time are left out. An
 * unknown `timeZone` falls back to UTC and an invalid `locale` to `en-US`.
 */
export function groupByDay<T>(items: readonly T[], options: DayGroupOptions<T>): DayGroup<T>[] {
  const timeZone = zoneOrUtc(options.timeZone ?? 'UTC');
  const today = dateIn(instant(options.now), timeZone);
  const groups: DayGroup<T>[] = [];
  const byDay = new Map<IsoDate, DayGroup<T>>();
  for (const item of items) {
    const ms = instant(options.at(item));
    if (!Number.isFinite(ms)) continue;
    const day = dateIn(ms, timeZone);
    let group = byDay.get(day);
    if (!group) {
      group = { day, label: dayLabel(day, today, options.locale), items: [] };
      byDay.set(day, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/**
 * "Today, 3:04 PM", "Monday, 9:30 AM" or "Oct 12, 9:30 AM", in `timeZone`
 * relative to `now`. An unknown `timeZone` falls back to UTC and an invalid
 * `locale` to `en-US`.
 */
export function whenLabel(
  at: string | number | Date,
  options: { now: string | number | Date; timeZone?: string; locale?: string }
): string {
  const ms = instant(at);
  if (!Number.isFinite(ms)) return '';
  const timeZone = zoneOrUtc(options.timeZone ?? 'UTC');
  const day = dateIn(ms, timeZone);
  const today = dateIn(instant(options.now), timeZone);
  const time = new Intl.DateTimeFormat(localeOrDefault(options.locale ?? 'en-US'), {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(ms);
  return `${dayLabel(day, today, options.locale)}, ${time}`;
}
