<script lang="ts">
import { type CalendarDate, Calendar as Primitive } from '@texuli/primitives/calendar';
import {
  type DateInvalidHandler,
  type DateRange,
  DateRangePicker,
  DEFAULT_DATE_PICKER_LABELS,
  orderedRange,
  provideDateRange,
  rangeDays,
  rangeLimit,
  toCalendarDate,
} from '@texuli/primitives/date-picker';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { type DateSize, dateCalendarClass } from './variants.ts';
import './date.css';

/**
 * A styled calendar on the owned APG Calendar: a heading with previous and
 * next buttons, and the day grid. The value is a `YYYY-MM-DD` string. Pass
 * `range` (`{ start, end }`) for range mode: the span is highlighted
 * (`aria-selected` on every day, start and end marked) and two picks choose
 * a new range.
 */
interface OwnProps {
  /** `bind:value`: the selected day as `YYYY-MM-DD`, or `null`. */
  value?: string | null;
  onValueChange?: (value: string) => void;
  /**
   * The day the calendar opens on (`YYYY-MM-DD`), so it shows that month with
   * nothing selected. Default: the selection (or the range start), else today.
   */
  defaultFocusedValue?: string;
  /**
   * `bind:focusedValue`: the focused day (`YYYY-MM-DD`), which sets the month
   * shown. Setting it moves the calendar; arrows, paging and the month
   * buttons write it back.
   */
  focusedValue?: string;
  /** The focused day moved (`YYYY-MM-DD`). */
  onFocusedValueChange?: (value: string) => void;
  locale?: string;
  minValue?: string;
  maxValue?: string;
  isDateUnavailable?: (date: CalendarDate) => boolean;
  /** The day marked as today (`YYYY-MM-DD`); when set, the clock is never read. */
  today?: string;
  /** First day of the week, `0` (Sunday) to `6` (Saturday); default the locale's. */
  weekStartsOn?: number;
  /** `bind:range`: range mode, highlighting `{ start, end }` (`YYYY-MM-DD`). */
  range?: DateRange;
  onRangeChange?: (range: DateRange) => void;
  /** Range mode: the longest range in days, both ends included; longer picks are refused and announced. */
  maxDays?: number;
  /** Range mode: a refused range (`start/end`, `'too-long'`). */
  onInvalid?: DateInvalidHandler;
  /** Announced when a range is too long (`{max}` is the limit). */
  tooLongLabel?: string;
  disabled?: boolean;
  readOnly?: boolean;
  size?: DateSize;
  previousLabel?: string;
  nextLabel?: string;
  /** Accessible name of the calendar region. */
  label?: string;
  class?: ClassValue;
}

type Props = OwnProps &
  Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps | 'children'> & {
    /** The rendered calendar root (bindable). */
    ref?: HTMLElement | null;
  };

let {
  value = $bindable(null),
  onValueChange,
  defaultFocusedValue,
  focusedValue = $bindable(),
  onFocusedValueChange,
  locale = 'en-US',
  minValue,
  maxValue,
  isDateUnavailable,
  today,
  weekStartsOn,
  range = $bindable(),
  onRangeChange,
  maxDays,
  onInvalid,
  tooLongLabel = DEFAULT_DATE_PICKER_LABELS.tooLong,
  disabled = false,
  readOnly = false,
  size = 'md',
  previousLabel: previousLabelProp,
  nextLabel: nextLabelProp,
  label,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const previousLabel = $derived(
  previousLabelProp ?? msg('texuli.calendar.previous-label', 'Previous month')
);
const nextLabel = $derived(nextLabelProp ?? msg('texuli.calendar.next-label', 'Next month'));

const selected = $derived(toCalendarDate(value));
const min = $derived(toCalendarDate(minValue));
const max = $derived(toCalendarDate(maxValue));
const todayDate = $derived(toCalendarDate(today));
const rangeMode = $derived(range !== undefined);
const rangeStart = $derived(toCalendarDate(range?.start));
const focusStart = $derived(
  toCalendarDate(defaultFocusedValue) ?? (rangeMode ? rangeStart : selected)
);
const focusedDate = $derived(toCalendarDate(focusedValue));
let pending = $state(false);
let message = $state('');

function announce(said: string): void {
  message = '';
  queueMicrotask(() => {
    message = said;
  });
}

function commitRange(next: DateRange, side: 'start' | 'end'): boolean {
  const ordered = orderedRange(next.start, next.end);
  const limit = rangeLimit(maxDays);
  if (limit !== undefined && rangeDays(ordered.start, ordered.end) > limit) {
    announce(tooLongLabel.split('{max}').join(String(limit)));
    onInvalid?.(`${ordered.start}/${ordered.end}`, 'too-long', { side });
    return false;
  }
  message = '';
  if (ordered.start === range?.start && ordered.end === range?.end) return true;
  range = ordered;
  onRangeChange?.(ordered);
  return true;
}

provideDateRange({
  get start() {
    return range?.start ?? null;
  },
  get end() {
    return range?.end ?? null;
  },
  get pending() {
    return pending;
  },
  get message() {
    return message;
  },
  setStart(next) {
    commitRange({ start: next, end: range?.end ?? null }, 'start');
  },
  setEnd(next) {
    commitRange({ start: range?.start ?? null, end: next }, 'end');
  },
  pick(date) {
    if (!pending) {
      pending = true;
      commitRange({ start: date, end: null }, 'start');
      return;
    }
    if (commitRange({ start: range?.start ?? null, end: date }, 'end')) pending = false;
  },
});
</script>

<Primitive.Root
  bind:ref
  class={dateCalendarClass({ size, class: cx(className) })}
  role="group"
  aria-label={label}
  {...rest}
  value={rangeMode ? null : selected}
  {...focusStart ? { defaultFocusedValue: focusStart } : {}}
  {...focusedDate ? { focusedValue: focusedDate } : {}}
  onFocusedValueChange={(date: CalendarDate) => {
    const next = date.toString();
    if (next === focusedValue) return;
    focusedValue = next;
    onFocusedValueChange?.(next);
  }}
  {locale}
  {...todayDate ? { today: todayDate } : {}}
  {...weekStartsOn !== undefined ? { weekStartsOn } : {}}
  {...min ? { minValue: min } : {}}
  {...max ? { maxValue: max } : {}}
  {...isDateUnavailable ? { isDateUnavailable } : {}}
  {disabled}
  {readOnly}
  {previousLabel}
  {nextLabel}
  onValueChange={(date) => {
    value = date.toString();
    onValueChange?.(value);
  }}
>
  <div class="tx-date-calendar__header">
    <Primitive.PrevButton class="tx-date-calendar__nav"><span aria-hidden="true">‹</span></Primitive.PrevButton>
    <Primitive.Heading class="tx-date-calendar__heading" />
    <Primitive.NextButton class="tx-date-calendar__nav"><span aria-hidden="true">›</span></Primitive.NextButton>
  </div>
  {#if rangeMode}
    <DateRangePicker.Grid class="tx-date-calendar__grid" />
  {:else}
    <Primitive.Grid class="tx-date-calendar__grid" />
  {/if}
</Primitive.Root>
