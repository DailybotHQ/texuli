<script lang="ts">
import { directionOf } from '@texuli/core/dir-locale';
import {
  type CalendarDate,
  type CalendarIdentifier,
  today as clockToday,
  createCalendar,
  type DayOfWeek,
  getLocalTimeZone,
  getWeeksInMonth,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  toCalendar,
  weekStartDay,
} from '@texuli/date';
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { type CalendarContextValue, provideCalendarContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onchange'> & {
  value?: CalendarDate | null;
  defaultValue?: CalendarDate | null;
  focusedValue?: CalendarDate;
  defaultFocusedValue?: CalendarDate;
  locale?: string;
  calendar?: CalendarIdentifier;
  /** First day of the week, `0` (Sunday) to `6` (Saturday); default the locale's. */
  weekStartsOn?: number;
  /**
   * The day marked as today (and the starting day when nothing is selected).
   * When given, the calendar never reads the clock: pass a simulated or
   * server-provided day for deterministic rendering.
   */
  today?: CalendarDate;
  minValue?: CalendarDate;
  maxValue?: CalendarDate;
  isDateUnavailable?: (date: CalendarDate) => boolean;
  isDateDisabled?: (date: CalendarDate) => boolean;
  disabled?: boolean;
  readOnly?: boolean;
  previousLabel?: string;
  nextLabel?: string;
  onValueChange?: (value: CalendarDate) => void;
  /** The focused day moved (arrow keys, paging, a pick, the month buttons). */
  onFocusedValueChange?: (value: CalendarDate) => void;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
} & RefProp;

let {
  value = $bindable(),
  defaultValue = null,
  focusedValue = $bindable(),
  defaultFocusedValue,
  locale = 'en-US',
  calendar: calendarId = 'gregory',
  weekStartsOn,
  today: todayValue,
  minValue,
  maxValue,
  isDateUnavailable,
  isDateDisabled,
  disabled = false,
  readOnly = false,
  previousLabel = 'Previous month',
  nextLabel = 'Next month',
  onValueChange,
  onFocusedValueChange,
  child,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const calendar = $derived(createCalendar(calendarId));
const firstDayOfWeek = $derived<DayOfWeek | undefined>(weekStartDay(weekStartsOn));
/** Today: the `today` prop when given (the clock is never read then), else the local day. */
function currentDay(): CalendarDate {
  return todayValue ?? clockToday(getLocalTimeZone());
}
const controlledValue = value !== undefined;
const initialDate = untrack(() =>
  toCalendar(defaultFocusedValue ?? value ?? defaultValue ?? currentDay(), calendar)
);
// svelte-ignore state_referenced_locally -- initial focus seeds the uncontrolled calendar once.
let localFocusedValue = $state(untrack(() => firstEnabledFocus(initialDate)));
// svelte-ignore state_referenced_locally -- initial selection seeds uncontrolled mode once.
let localValue = $state(defaultValue ? toCalendar(defaultValue, calendar) : null);
const currentValue = $derived(controlledValue && value ? toCalendar(value, calendar) : localValue);
const currentFocus = $derived(
  focusedValue ? toCalendar(focusedValue, calendar) : localFocusedValue
);
const visibleMonth = $derived(startOfMonth(currentFocus));

function isUnavailable(date: CalendarDate): boolean {
  return Boolean(isDateUnavailable?.(date) || isDateDisabled?.(date));
}

function isDisabledDate(date: CalendarDate): boolean {
  return (
    disabled ||
    (minValue !== undefined && date.compare(toCalendar(minValue, calendar)) < 0) ||
    (maxValue !== undefined && date.compare(toCalendar(maxValue, calendar)) > 0) ||
    isUnavailable(date)
  );
}

/**
 * The day the calendar starts on (APG date picker): the requested day (the
 * selected date, else today) when it is enabled; else the first enabled day
 * of its month; else the next enabled day after it. A grid always keeps a
 * focusable day this way, unless every day is disabled.
 */
function firstEnabledFocus(date: CalendarDate): CalendarDate {
  if (!isDisabledDate(date)) return date;
  for (let day = startOfMonth(date); day.month === date.month; day = day.add({ days: 1 })) {
    if (!isDisabledDate(day)) return day;
  }
  let day = date;
  for (let count = 0; count < 370; count += 1) {
    day = day.add({ days: 1 });
    if (!isDisabledDate(day)) return day;
  }
  return date;
}

function updateFocus(date: CalendarDate): void {
  if (isDisabledDate(date)) return;
  const changed = currentFocus.compare(date) !== 0;
  if (focusedValue !== undefined) focusedValue = date;
  else localFocusedValue = date;
  if (changed) onFocusedValueChange?.(date);
}

function updateValue(date: CalendarDate): void {
  if (readOnly || isDisabledDate(date)) return;
  updateFocus(date);
  if (controlledValue) value = date;
  else localValue = date;
  onValueChange?.(date);
}

const monthLabel = $derived(
  new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    calendar: calendarId,
    timeZone: 'UTC',
  }).format(visibleMonth.toDate('UTC'))
);
// One formatter per locale and calendar, not one per day cell on every render.
const dayNumberFormat = $derived(new Intl.NumberFormat(locale, { useGrouping: false }));
const dayLabelFormat = $derived(
  new Intl.DateTimeFormat(locale, { dateStyle: 'full', calendar: calendarId, timeZone: 'UTC' })
);
const weekdays = $derived.by(() => {
  const weekStart = startOfWeek(visibleMonth, locale, firstDayOfWeek);
  const short = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const full = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
  return Array.from({ length: 7 }, (_, index) => {
    const date = weekStart.add({ days: index });
    const nativeDate = date.toDate('UTC');
    return { short: short.format(nativeDate), full: full.format(nativeDate) };
  });
});
const weeks = $derived.by(() => {
  const weekCount = getWeeksInMonth(visibleMonth, locale, firstDayOfWeek);
  const first = startOfWeek(visibleMonth, locale, firstDayOfWeek);
  return Array.from({ length: weekCount }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => first.add({ days: week * 7 + day }))
  );
});

function shiftMonth(amount: number): void {
  const nextMonth = currentFocus.add({ months: amount });
  const candidate = nextMonth.set({
    day: Math.min(currentFocus.day, nextMonth.calendar.getDaysInMonth(nextMonth)),
  });
  if (minValue) {
    const min = toCalendar(minValue, calendar);
    if (
      startOfMonth(candidate)
        .add({ days: startOfMonth(candidate).calendar.getDaysInMonth(startOfMonth(candidate)) - 1 })
        .compare(min) < 0
    )
      return;
    if (candidate.compare(min) < 0) {
      updateFocus(min);
      return;
    }
  }
  if (maxValue && candidate.compare(toCalendar(maxValue, calendar)) > 0) {
    updateFocus(toCalendar(maxValue, calendar));
    return;
  }
  updateFocus(candidate);
}

function canShift(amount: number): boolean {
  if (disabled) return false;
  const candidate = visibleMonth.add({ months: amount });
  const start = startOfMonth(candidate);
  const last = start.add({ days: start.calendar.getDaysInMonth(start) - 1 });
  return (
    !(minValue && last.compare(toCalendar(minValue, calendar)) < 0) &&
    !(maxValue && start.compare(toCalendar(maxValue, calendar)) > 0)
  );
}

function findEnabled(start: CalendarDate, delta: number): CalendarDate {
  let candidate = start;
  for (let count = 0; count < 370; count += 1) {
    candidate = candidate.add({ days: delta });
    if (
      (minValue && candidate.compare(toCalendar(minValue, calendar)) < 0) ||
      (maxValue && candidate.compare(toCalendar(maxValue, calendar)) > 0)
    )
      return currentFocus;
    if (!isDisabledDate(candidate)) return candidate;
  }
  return currentFocus;
}

function handleGridKeydown(event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey || disabled || readOnly) return;
  const grid = event.currentTarget as HTMLElement;
  const rtl = directionOf(grid) === 'rtl';
  let target: CalendarDate | undefined;
  switch (event.key) {
    case 'ArrowLeft':
      target = findEnabled(currentFocus, rtl ? 1 : -1);
      break;
    case 'ArrowRight':
      target = findEnabled(currentFocus, rtl ? -1 : 1);
      break;
    case 'ArrowUp':
      target = findEnabled(currentFocus, -7);
      break;
    case 'ArrowDown':
      target = findEnabled(currentFocus, 7);
      break;
    case 'Home': {
      const start = startOfWeek(currentFocus, locale, firstDayOfWeek);
      target = findEnabled(start.add({ days: -1 }), 1);
      break;
    }
    case 'End': {
      const end = startOfWeek(currentFocus, locale, firstDayOfWeek).add({ days: 7 });
      target = findEnabled(end, -1);
      break;
    }
    case 'PageUp':
      target = currentFocus.add(event.shiftKey ? { years: -1 } : { months: -1 });
      break;
    case 'PageDown':
      target = currentFocus.add(event.shiftKey ? { years: 1 } : { months: 1 });
      break;
    default:
      return;
  }
  event.preventDefault();
  if (!target || isDisabledDate(target))
    target = findEnabled(currentFocus, event.key === 'ArrowUp' ? -1 : 1);
  if (target && target !== currentFocus) {
    updateFocus(target);
    queueMicrotask(() => {
      const selector = `[data-calendar-date="${CSS.escape(target.toString())}"]`;
      const next = grid.querySelector<HTMLElement>(selector);
      next?.focus({ preventScroll: true });
    });
  }
}

const context: CalendarContextValue = {
  get value() {
    return currentValue;
  },
  get focusedValue() {
    return currentFocus;
  },
  get locale() {
    return locale;
  },
  get monthLabel() {
    return monthLabel;
  },
  get previousLabel() {
    return previousLabel;
  },
  get nextLabel() {
    return nextLabel;
  },
  get isReadOnly() {
    return readOnly;
  },
  get weekdays() {
    return weekdays;
  },
  get weeks() {
    return weeks;
  },
  get canPrevious() {
    return canShift(-1);
  },
  get canNext() {
    return canShift(1);
  },
  isOutsideMonth(date) {
    return !isSameMonth(date, visibleMonth);
  },
  isSelected(date) {
    return currentValue?.compare(date) === 0;
  },
  isToday(date) {
    return date.compare(toCalendar(currentDay(), calendar)) === 0;
  },
  isDisabled: isDisabledDate,
  dateLabel(date) {
    return dayLabelFormat.format(date.toDate('UTC'));
  },
  dayNumber(date) {
    return dayNumberFormat.format(date.day);
  },
  focus: updateFocus,
  select: updateValue,
  previous() {
    if (canShift(-1)) shiftMonth(-1);
  },
  next() {
    if (canShift(1)) shiftMonth(1);
  },
  keydown: handleGridKeydown,
};
provideCalendarContext(context);

const rootProps = $derived({
  ...rest,
  'data-tx-calendar-root': '',
  'data-disabled': disabled ? '' : undefined,
});
</script>

{#if child}
  {@render child({ props: rootProps })}
{:else}
  <div bind:this={ref} {...rootProps}>{@render children?.()}</div>
{/if}
