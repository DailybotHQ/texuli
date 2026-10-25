<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { getCalendarContext } from '../calendar/context.ts';
import { getRange, inRange } from './shared.ts';

/**
 * The calendar grid for a range: the calendar's keyboard model, with
 * `aria-selected` on every day of the range. While the end is pending, the
 * range previews to the hovered or focused day.
 */
let { ...rest }: Omit<HTMLAttributes<HTMLTableElement>, 'children'> = $props();
const calendar = getCalendarContext();
const range = getRange();
let hovered = $state<string | null>(null);

const previewEnd = $derived(
  range.pending ? (hovered ?? calendar.focusedValue.toString()) : range.end
);
const bounds = $derived.by(() => {
  const start = range.start;
  const end = previewEnd;
  if (!start || !end) return { start, end: start };
  return start <= end ? { start, end } : { start: end, end: start };
});
</script>

<table
  {...rest}
  role="grid"
  aria-label={rest['aria-label'] ?? calendar.monthLabel}
  aria-multiselectable="true"
  data-tx-calendar-grid
  data-tx-range-grid
  onkeydown={calendar.keydown}
>
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
          {@const iso = date.toString()}
          {@const outside = calendar.isOutsideMonth(date)}
          {@const dateDisabled = outside || calendar.isDisabled(date)}
          {@const isStart = iso === bounds.start}
          {@const isEnd = iso === bounds.end}
          {@const within = inRange(iso, bounds.start, bounds.end)}
          {@const chosen = !range.pending && within}
          <td role="gridcell" aria-selected={chosen || (range.pending && iso === range.start) ? 'true' : undefined}>
            <button
              type="button"
              data-calendar-date={iso}
              data-outside-month={outside ? '' : undefined}
              data-today={calendar.isToday(date) ? '' : undefined}
              data-range-start={isStart && bounds.start ? '' : undefined}
              data-range-end={isEnd && bounds.end && !range.pending ? '' : undefined}
              data-in-range={within ? '' : undefined}
              data-preview={range.pending && within ? '' : undefined}
              aria-label={calendar.dateLabel(date)}
              aria-current={calendar.isToday(date) ? 'date' : undefined}
              aria-disabled={dateDisabled || calendar.isReadOnly ? 'true' : undefined}
              disabled={dateDisabled}
              tabindex={!dateDisabled && calendar.focusedValue.compare(date) === 0 ? 0 : -1}
              onpointerenter={() => (hovered = iso)}
              onpointerleave={() => (hovered = null)}
              onclick={() => {
                if (dateDisabled || calendar.isReadOnly) return;
                calendar.focus(date);
                range.pick(iso);
              }}
            >
              {calendar.dayNumber(date)}
            </button>
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>
