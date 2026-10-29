<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import { composeHandlers } from '../internal/handlers.ts';
import type { RefProp } from '../internal/ref.ts';
import { getCalendarContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLTableElement>, 'children'> & {
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
} & RefProp;
let { child, children, ref = $bindable(null), ...rest }: Props = $props();
const calendar = getCalendarContext();
const partProps = $derived({
  ...rest,
  role: 'grid' as const,
  'aria-label': rest['aria-label'] ?? calendar.monthLabel,
  'data-tx-calendar-grid': '',
  onkeydown: composeHandlers(rest.onkeydown, calendar.keydown),
});
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <table bind:this={ref} {...partProps}>
    <thead>
      <tr>
        {#each calendar.weekdays as weekday}
          <th scope="col" role="columnheader" aria-label={weekday.full}>{weekday.short}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each calendar.weeks as week (week[0]?.toString())}
        <tr>
          {#each week as date (date.toString())}
            {@const outside = calendar.isOutsideMonth(date)}
            {@const dateDisabled = outside || calendar.isDisabled(date)}
            <td role="gridcell" aria-selected={calendar.isSelected(date) ? 'true' : undefined}>
              <button
                type="button"
                data-calendar-date={date.toString()}
                data-outside-month={outside ? '' : undefined}
                data-selected={calendar.isSelected(date) ? '' : undefined}
                data-today={calendar.isToday(date) ? '' : undefined}
                aria-label={calendar.dateLabel(date)}
                aria-current={calendar.isToday(date) ? 'date' : undefined}
                aria-disabled={dateDisabled || calendar.isReadOnly ? 'true' : undefined}
                disabled={dateDisabled}
                tabindex={!dateDisabled && calendar.focusedValue.compare(date) === 0 ? 0 : -1}
                onclick={() => calendar.select(date)}
              >
                {calendar.dayNumber(date)}
              </button>
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
  {@render children?.()}
{/if}
