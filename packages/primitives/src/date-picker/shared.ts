import { type CalendarDate, parseDate } from '@texuli/date';
import { getContext, setContext } from 'svelte';

/** A canonical `YYYY-MM-DD` string as a `CalendarDate`, or `null` when empty or invalid. */
export function toCalendarDate(iso: string | null | undefined): CalendarDate | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  try {
    return parseDate(iso);
  } catch {
    return null;
  }
}

/** A range in order: a `start` after `end` is swapped. */
export function orderedRange(
  start: string | null,
  end: string | null
): { start: string | null; end: string | null } {
  if (start && end && start > end) return { start: end, end: start };
  return { start, end };
}

/** Whether `date` lies within `[start, end]` (ISO strings compare in calendar order). */
export function inRange(date: string, start: string | null, end: string | null): boolean {
  return start !== null && end !== null && date >= start && date <= end;
}

/** Every visible or announced string of the pickers. Pass translations to override. */
export interface DatePickerLabels {
  /** Trigger name without a value, and with one (`{date}` is the formatted value). */
  trigger: string;
  triggerWithValue: string;
  /** The dialog's accessible name. */
  dialog: string;
  previousMonth: string;
  nextMonth: string;
  /** Range fields. */
  start: string;
  end: string;
}

export const DEFAULT_DATE_PICKER_LABELS: Readonly<DatePickerLabels> = /* @__PURE__ */ Object.freeze(
  {
    trigger: 'Choose date',
    triggerWithValue: 'Choose date, selected date is {date}',
    dialog: 'Choose date',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    start: 'Start date',
    end: 'End date',
  }
);

export function resolveDatePickerLabels(
  overrides: Partial<DatePickerLabels> = {}
): DatePickerLabels {
  const labels = { ...DEFAULT_DATE_PICKER_LABELS };
  for (const key of Object.keys(labels) as (keyof DatePickerLabels)[]) {
    const value = overrides[key];
    if (typeof value === 'string') labels[key] = value;
  }
  return labels;
}

/** A long, localized date for names (`Sunday, March 15, 2026`). */
export function formatLongDate(iso: string | null, locale: string): string | null {
  const date = toCalendarDate(iso);
  if (!date) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(
    date.toDate('UTC')
  );
}

/** What both pickers share with their Trigger, Content and Calendar parts. */
export interface PickerShell {
  /** Ties the Trigger to its Root, so focus can return to it. */
  readonly id: string;
  readonly open: boolean;
  readonly locale: string;
  readonly labels: DatePickerLabels;
  readonly disabled: boolean;
  readonly minValue: string | undefined;
  readonly maxValue: string | undefined;
  readonly isDateUnavailable: ((date: CalendarDate) => boolean) | undefined;
  /** The trigger's accessible name (it says the current value). */
  readonly triggerLabel: string;
  readonly closeOnSelect: boolean;
  /** Opens or closes; closing from a choice returns focus to the trigger. */
  setOpen(next: boolean): void;
}

/**
 * Returns focus to a picker's trigger after it closes from a choice. The
 * popover's own restore runs only on Escape and outside presses; a closed
 * dialog must never leave focus on the page body.
 */
export function focusTrigger(id: string): void {
  queueMicrotask(() => {
    const trigger = document.querySelector<HTMLElement>(
      `[data-tx-date-picker-trigger="${CSS.escape(id)}"]`
    );
    trigger?.focus({ preventScroll: true });
  });
}

const SHELL = Symbol('texuli.date-picker');

export function provideShell(shell: PickerShell): void {
  setContext(SHELL, shell);
}

export function getShell(): PickerShell {
  const shell = getContext<PickerShell | undefined>(SHELL);
  if (!shell)
    throw new Error(
      'Date picker parts must be used inside DatePicker.Root or DateRangePicker.Root'
    );
  return shell;
}

/** Single-date state. */
export interface SingleState {
  readonly value: string | null;
  setValue(next: string | null): void;
}

/** Range state: a pick sets the start, the next one the end. */
export interface RangeState {
  readonly start: string | null;
  readonly end: string | null;
  /** A start was picked and the end is pending. */
  readonly pending: boolean;
  setStart(next: string | null): void;
  setEnd(next: string | null): void;
  pick(date: string): void;
}

const SINGLE = Symbol('texuli.date-picker.single');
const RANGE = Symbol('texuli.date-picker.range');

export const provideSingle = (state: SingleState) => setContext(SINGLE, state);
export const provideRange = (state: RangeState) => setContext(RANGE, state);

export function getSingle(): SingleState {
  const state = getContext<SingleState | undefined>(SINGLE);
  if (!state) throw new Error('DatePicker parts must be used inside DatePicker.Root');
  return state;
}

export function getRange(): RangeState {
  const state = getContext<RangeState | undefined>(RANGE);
  if (!state) throw new Error('DateRangePicker parts must be used inside DateRangePicker.Root');
  return state;
}
