<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { Calendar } from '../calendar/index.ts';
import { getShell, getSingle, toCalendarDate } from './shared.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** Replaces the default header (previous, heading, next) and grid. */
  children?: Snippet;
};

let { children, ...rest }: Props = $props();
const shell = getShell();
const single = getSingle();
const selected = $derived(toCalendarDate(single.value));
const min = $derived(toCalendarDate(shell.minValue));
const max = $derived(toCalendarDate(shell.maxValue));
</script>

<div {...rest} data-tx-date-picker-calendar>
  <Calendar.Root
    value={selected}
    {...selected ? { defaultFocusedValue: selected } : {}}
    locale={shell.locale}
    {...min ? { minValue: min } : {}}
    {...max ? { maxValue: max } : {}}
    {...shell.isDateUnavailable ? { isDateUnavailable: shell.isDateUnavailable } : {}}
    disabled={shell.disabled}
    previousLabel={shell.labels.previousMonth}
    nextLabel={shell.labels.nextMonth}
    onValueChange={(date) => {
      single.setValue(date.toString());
      if (shell.closeOnSelect) shell.setOpen(false);
    }}
  >
    {#if children}
      {@render children()}
    {:else}
      <div data-tx-date-picker-header>
        <Calendar.PrevButton><span aria-hidden="true">‹</span></Calendar.PrevButton>
        <Calendar.Heading />
        <Calendar.NextButton><span aria-hidden="true">›</span></Calendar.NextButton>
      </div>
      <Calendar.Grid />
    {/if}
  </Calendar.Root>
</div>
