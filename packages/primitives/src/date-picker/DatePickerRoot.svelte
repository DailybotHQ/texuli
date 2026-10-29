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
  provideShell,
  provideSingle,
  resolveDatePickerLabels,
  toCalendarDate,
} from './shared.ts';

interface Props {
  /** The date as `YYYY-MM-DD` (`bind:value`), or `null`. */
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  /** Whether the calendar dialog is open (`bind:open`). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  locale?: string;
  /** Inclusive bounds as `YYYY-MM-DD`. */
  minValue?: string;
  maxValue?: string;
  isDateUnavailable?: (date: CalendarDate) => boolean;
  disabled?: boolean;
  /** Close the dialog when a day is chosen. Default `true`. */
  closeOnSelect?: boolean;
  /** The day marked as today (`YYYY-MM-DD`); when set, the clock is never read. */
  today?: string;
  /** First day of the week, `0` (Sunday) to `6`; default the locale's. */
  weekStartsOn?: number;
  /** Reports typed text that does not parse or is out of range. */
  onInvalid?: DateInvalidHandler;
  labels?: Partial<DatePickerLabels>;
  children?: Snippet;
}

let {
  value = $bindable(null),
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

function setValue(next: string | null): void {
  const clean = next && toCalendarDate(next) ? next : null;
  if (clean === value) return;
  value = clean;
  onValueChange?.(clean);
}

provideSingle({
  get value() {
    return value;
  },
  setValue,
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
    const long = formatLongDate(value, locale);
    return long ? text.triggerWithValue.split('{date}').join(long) : text.trigger;
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
