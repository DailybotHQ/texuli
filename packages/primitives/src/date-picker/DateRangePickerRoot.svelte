<script lang="ts">
import type { CalendarDate } from '@internationalized/date';
import type { Snippet } from 'svelte';
import * as Popover from '../popover/index.ts';
import {
  type DatePickerLabels,
  focusTrigger,
  formatLongDate,
  orderedRange,
  provideRange,
  provideShell,
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
  labels,
  children,
}: Props = $props();

const text = $derived(resolveDatePickerLabels(labels));
const uid = $props.id();
let pending = $state(false);

const valid = (iso: string | null) => (iso && toCalendarDate(iso) ? iso : null);

function commit(next: DateRange): void {
  const ordered = orderedRange(valid(next.start), valid(next.end));
  if (ordered.start === value.start && ordered.end === value.end) return;
  value = ordered;
  onValueChange?.(ordered);
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
  setStart(next) {
    commit({ start: next, end: value.end });
  },
  setEnd(next) {
    commit({ start: value.start, end: next });
  },
  pick(date) {
    if (!pending) {
      // First pick of a range: the start, with the end pending.
      pending = true;
      commit({ start: date, end: null });
      return;
    }
    pending = false;
    commit({ start: value.start, end: date });
    if (closeOnSelect) {
      open = false;
      focusTrigger(uid);
    }
  },
});

$effect(() => {
  // Closing (or reopening) never leaves a half-made pick in progress.
  if (!open) pending = false;
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
