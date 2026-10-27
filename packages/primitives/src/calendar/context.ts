import type { CalendarDate } from '@texuli/date';
import { getContext, setContext } from 'svelte';

export const CALENDAR_CONTEXT = Symbol('texuli.calendar');

export interface CalendarContextValue {
  readonly value: CalendarDate | null;
  readonly focusedValue: CalendarDate;
  readonly locale: string;
  readonly monthLabel: string;
  readonly previousLabel: string;
  readonly nextLabel: string;
  readonly weekdays: readonly { short: string; full: string }[];
  readonly weeks: readonly (readonly CalendarDate[])[];
  readonly canPrevious: boolean;
  readonly canNext: boolean;
  isOutsideMonth(date: CalendarDate): boolean;
  isSelected(date: CalendarDate): boolean;
  isToday(date: CalendarDate): boolean;
  isDisabled(date: CalendarDate): boolean;
  isReadOnly: boolean;
  dateLabel(date: CalendarDate): string;
  /** The day of the month in the locale's digits (it must match the day's name). */
  dayNumber(date: CalendarDate): string;
  focus(date: CalendarDate): void;
  select(date: CalendarDate): void;
  previous(): void;
  next(): void;
  keydown(event: KeyboardEvent): void;
}

export function provideCalendarContext(value: CalendarContextValue): void {
  setContext(CALENDAR_CONTEXT, value);
}

export function getCalendarContext(): CalendarContextValue {
  const value = getContext<CalendarContextValue | undefined>(CALENDAR_CONTEXT);
  if (!value) throw new Error('Calendar parts must be used inside Calendar.Root');
  return value;
}
