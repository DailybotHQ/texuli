<script lang="ts">
import { localizeLabels } from '@texuli/core/i18n';
import type { CalendarDate } from '@texuli/date';
import type { Snippet } from 'svelte';
import { useMessages } from '../i18n/use-messages.ts';
import * as Popover from '../popover/index.ts';
import {
  type DateInvalidHandler,
  type DatePickerLabels,
  DEFAULT_DATE_PICKER_LABELS,
  focusTrigger,
  formatLongDate,
  orderedRange,
  provideRange,
  provideShell,
  rangeDays,
  rangeLimit,
  resolveDatePickerLabels,
  toCalendarDate,
} from './shared.ts';
import type { DateRange } from './types.ts';

interface Props {
  /** The range as `YYYY-MM-DD` strings (`bind:value`). */
  value?: DateRange;
  onValueChange?: (value: DateRange) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  locale?: string;
  minValue?: string;
  maxValue?: string;
  isDateUnavailable?: (date: CalendarDate) => boolean;
  disabled?: boolean;
  /** Close the dialog when the range is complete. Default `true`. */
  closeOnSelect?: boolean;
  /** The day marked as today (`YYYY-MM-DD`); when set, the clock is never read. */
  today?: string;
  /** First day of the week, `0` (Sunday) to `6`; default the locale's. */
  weekStartsOn?: number;
  /**
   * The longest range in days, both ends included. A longer pick or typed
   * end is refused: the value stays, `onInvalid(start/end, 'too-long')` runs
   * and the grid announces `labels.tooLong`.
   */
  maxDays?: number;
  /** Reports typed text that does not parse or is out of range, and refused ranges. */
  onInvalid?: DateInvalidHandler;
  labels?: Partial<DatePickerLabels>;
  children?: Snippet;
}

let {
  value = $bindable({ start: null, end: null }),
  onValueChange,
  open = $bindable(false),
  onOpenChange,
  locale = 'en-US',
  minValue,
  maxValue,
  isDateUnavailable,
  disabled = false,
  closeOnSelect = true,
  today,
  weekStartsOn,
  maxDays,
  onInvalid,
  labels,
  children,
}: Props = $props();
const msg = useMessages();

const text = $derived(
  resolveDatePickerLabels(
    labels,
    localizeLabels(msg, 'primitives.date-picker', DEFAULT_DATE_PICKER_LABELS)
  )
);
const uid = $props.id();
let pending = $state(false);
let message = $state('');

const valid = (iso: string | null) => (iso && toCalendarDate(iso) ? iso : null);

/** Clear first, then set, so the same refusal is read again. */
function announce(said: string): void {
  message = '';
  queueMicrotask(() => {
    message = said;
  });
}

/** Applies a range; `false` when it is longer than `maxDays` (and refused because of `side`). */
function commit(next: DateRange, side: 'start' | 'end'): boolean {
  const ordered = orderedRange(valid(next.start), valid(next.end));
  const limit = rangeLimit(maxDays);
  if (limit !== undefined && rangeDays(ordered.start, ordered.end) > limit) {
    announce(text.tooLong.split('{max}').join(String(limit)));
    onInvalid?.(`${ordered.start}/${ordered.end}`, 'too-long', { side });
    return false;
  }
  message = '';
  if (ordered.start === value.start && ordered.end === value.end) return true;
  value = ordered;
  onValueChange?.(ordered);
  return true;
}

provideRange({
  get start() {
    return value.start;
  },
  get end() {
    return value.end;
  },
  get pending() {
    return pending;
  },
  get message() {
    return message;
  },
  setStart(next) {
    commit({ start: next, end: value.end }, 'start');
  },
  setEnd(next) {
    commit({ start: value.start, end: next }, 'end');
  },
  pick(date) {
    if (!pending) {
      // First pick of a range: the start, with the end pending.
      pending = true;
      if (commit({ start: date, end: null }, 'start')) {
        // The end is still needed: say so (G109), with the start as a long date.
        announce(text.pickEnd(formatLongDate(date, locale) ?? date));
      }
      return;
    }
    // A range longer than maxDays is refused; the end stays pending.
    if (!commit({ start: value.start, end: date }, 'end')) return;
    pending = false;
    if (closeOnSelect) {
      open = false;
      focusTrigger(uid);
    }
  },
});

$effect(() => {
  // Closing (or reopening) never leaves a half-made pick in progress, nor its
  // announcement in the status region.
  if (!open) {
    pending = false;
    message = '';
  }
});

provideShell({
  id: uid,
  get open() {
    return open;
  },
  get locale() {
    return locale;
  },
  get labels() {
    return text;
  },
  get disabled() {
    return disabled;
  },
  get minValue() {
    return minValue;
  },
  get maxValue() {
    return maxValue;
  },
  get isDateUnavailable() {
    return isDateUnavailable;
  },
  get closeOnSelect() {
    return closeOnSelect;
  },
  get today() {
    return today;
  },
  get weekStartsOn() {
    return weekStartsOn;
  },
  get onInvalid() {
    return onInvalid;
  },
  get triggerLabel() {
    const start = formatLongDate(value.start, locale);
    const end = formatLongDate(value.end, locale);
    if (!start) return text.trigger;
    return text.triggerWithValue.split('{date}').join(end ? `${start} – ${end}` : start);
  },
  setOpen(next) {
    open = next;
    if (!next) focusTrigger(uid);
  },
});
</script>

<!--
  Non-modal: an outside press closes it and focus returns to the button
  explicitly (also in WebKit, which does not focus a clicked button).
-->
<Popover.Root bind:open side="bottom" align="start" sideOffset={4} {onOpenChange}>
  {@render children?.()}
</Popover.Root>
