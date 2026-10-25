import {
  type CalendarView,
  type IsoDate,
  type Occurrence,
  parseInstant,
  parseIsoDate,
  spanDates,
} from '../engines/calendar/index.ts';

export type CalendarMode = CalendarView;

export const MODES: readonly CalendarMode[] = ['month', 'week', 'day', 'agenda'];

export const occurrenceDates = spanDates;

export function eventsOnDate<T extends Pick<Occurrence, 'start' | 'end' | 'allDay'>>(
  events: readonly T[],
  date: IsoDate,
  timeZone: string
): T[] {
  return events
    .filter((event) => {
      const range = occurrenceDates(event, timeZone);
      return range.first <= date && date <= range.last;
    })
    .sort(
      (a, b) =>
        Number(b.allDay) - Number(a.allDay) ||
        a.start.localeCompare(b.start) ||
        a.end.localeCompare(b.end)
    );
}

export function formatCalendar(locale: string, timeZone: string) {
  const inZone = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone });
  const utc = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
  const dateInstant = (date: IsoDate) => Date.parse(`${date}T12:00:00Z`);
  const time = inZone({ hour: 'numeric', minute: '2-digit' });
  const weekday = utc({ weekday: 'short' });
  const date = utc({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const month = utc({ month: 'long', year: 'numeric' });
  const shortDate = utc({ month: 'short', day: 'numeric' });
  const shortDateYear = utc({ month: 'short', day: 'numeric', year: 'numeric' });
  const hour = utc({ hour: 'numeric' });
  return {
    dayNumber: (value: IsoDate) => String(parseIsoDate(value).day),
    hour: (value: number) => hour.format(Date.UTC(2026, 0, 5, value)),
    weekday: (value: IsoDate) => weekday.format(dateInstant(value)),
    longDate: (value: IsoDate) => date.format(dateInstant(value)),
    monthTitle: (value: IsoDate) => month.format(dateInstant(value)),
    /**
     * "Apr 12 – Apr 18". The year is added when the range spans two years
     * ("Dec 28, 2026 – Jan 3, 2027") or is not `currentYear` ("Apr 12 – Apr 18, 2027"),
     * and always when `always` is set ("Apr 12 – Apr 18, 2026").
     */
    range: (from: IsoDate, to: IsoDate, currentYear?: number, always = false) => {
      const year = parseIsoDate(from).year;
      const spans = year !== parseIsoDate(to).year;
      const first = (spans ? shortDateYear : shortDate).format(dateInstant(from));
      const last = (
        always || spans || (currentYear !== undefined && year !== currentYear)
          ? shortDateYear
          : shortDate
      ).format(dateInstant(to));
      return `${first} – ${last}`;
    },
    time: (value: string) => time.format(parseInstant(value)),
    span: (event: Pick<Occurrence, 'start' | 'end' | 'allDay'>, allDayLabel: string) =>
      event.allDay
        ? allDayLabel
        : `${time.format(parseInstant(event.start))} – ${time.format(parseInstant(event.end))}`,
  };
}

export type CalendarFormats = ReturnType<typeof formatCalendar>;

/** "Wednesday, April 15, 2026, 1:00 PM – 2:00 PM": where a span sits, for names and announcements. */
export function describeWhen(
  fmt: CalendarFormats,
  span: Pick<Occurrence, 'start' | 'end' | 'allDay'>,
  allDayLabel: string,
  timeZone: string
): string {
  return `${fmt.longDate(spanDates(span, timeZone).first)}, ${fmt.span(span, allDayLabel)}`;
}
