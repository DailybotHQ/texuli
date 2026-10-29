<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { Calendar } from '../calendar/index.ts';
import type { RefProp } from '../internal/ref.ts';
import RangeGrid from './RangeGrid.svelte';
import { getRange, getShell, toCalendarDate } from './shared.ts';

let { ref = $bindable(null), ...rest }: Omit<HTMLAttributes<HTMLDivElement>, 'children'> & RefProp =
  $props();
const shell = getShell();
const range = getRange();
const start = $derived(toCalendarDate(range.start));
const min = $derived(toCalendarDate(shell.minValue));
const max = $derived(toCalendarDate(shell.maxValue));
const todayDate = $derived(toCalendarDate(shell.today));
</script>

<div bind:this={ref} {...rest} data-tx-date-picker-calendar>
  <!-- The calendar supplies navigation and focus; the range grid owns selection. -->
  <Calendar.Root
    value={null}
    {...start ? { defaultFocusedValue: start } : {}}
    locale={shell.locale}
    {...todayDate ? { today: todayDate } : {}}
    {...shell.weekStartsOn !== undefined ? { weekStartsOn: shell.weekStartsOn } : {}}
    {...min ? { minValue: min } : {}}
    {...max ? { maxValue: max } : {}}
    {...shell.isDateUnavailable ? { isDateUnavailable: shell.isDateUnavailable } : {}}
    disabled={shell.disabled}
    previousLabel={shell.labels.previousMonth}
    nextLabel={shell.labels.nextMonth}
  >
    <div data-tx-date-picker-header>
      <Calendar.PrevButton><span aria-hidden="true">‹</span></Calendar.PrevButton>
      <Calendar.Heading />
      <Calendar.NextButton><span aria-hidden="true">›</span></Calendar.NextButton>
    </div>
    <RangeGrid />
  </Calendar.Root>
</div>
