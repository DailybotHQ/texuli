<script lang="ts">
import { monthGrid, parseIsoDate, type Weekday } from '../engines/calendar/index.ts';
import EventButton from './EventButton.svelte';
import type { CalendarFormats } from './model.ts';
import { eventsOnDate } from './model.ts';
import type { CalendarItem, CalendarLabels } from './types.ts';

let {
  anchor,
  today,
  focusDate,
  items,
  fmt,
  timeZone,
  weekStartsOn,
  labels,
  onOpen,
  onFocusDate,
  hintId,
  onCreateDay,
}: {
  anchor: string;
  today: string;
  focusDate: string;
  items: CalendarItem[];
  fmt: CalendarFormats;
  timeZone: string;
  weekStartsOn: Weekday;
  labels: CalendarLabels;
  onOpen?: (item: CalendarItem) => void;
  onFocusDate: (date: string) => void;
  hintId?: string;
  /** Set when activating a date (or an empty cell) creates an all-day event. */
  onCreateDay?: (date: string) => void;
} = $props();

const dayName = (date: string, count: number) =>
  `${fmt.longDate(date)}, ${labels.eventCount(count)}${onCreateDay ? `. ${labels.addsAllDayEvent}` : ''}`;

const weeks = $derived.by(() => {
  const { year, month } = parseIsoDate(anchor);
  return monthGrid(year, month, { weekStartsOn, today });
});
const weekdays = $derived(weeks[0]?.map((cell) => fmt.weekday(cell.date)) ?? []);
</script>

<div class="tx-calendar__weekdays" aria-hidden="true">
  {#each weekdays as weekday (weekday)}<span>{weekday}</span>{/each}
</div>
<div class="tx-calendar__month" role="grid" aria-label={fmt.monthTitle(anchor)} data-month-grid>
  {#each weeks as week, weekIndex (weekIndex)}
    <div class="tx-calendar__month-week" role="row">
      {#each week as cell (cell.date)}
        {@const dayItems = eventsOnDate(items, cell.date, timeZone)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -- the date button is the keyboard path. -->
        <div
          class:tx-calendar__outside={!cell.inMonth}
          class="tx-calendar__month-cell"
          role="gridcell"
          aria-label={`${fmt.longDate(cell.date)}, ${labels.eventCount(dayItems.length)}`}
          data-date={cell.date}
          onclick={(event) => {
            if (event.target === event.currentTarget) onCreateDay?.(cell.date);
          }}
        >
          <button
            type="button"
            class:tx-calendar__today={cell.date === today}
            class="tx-calendar__date"
            data-calendar-date={cell.date}
            data-focused={cell.date === focusDate || undefined}
            aria-current={cell.date === today ? 'date' : undefined}
            data-slot={onCreateDay ? cell.date : undefined}
            aria-label={dayName(cell.date, dayItems.length)}
            tabindex={cell.date === focusDate ? 0 : -1}
            onfocus={() => onFocusDate(cell.date)}
            onclick={() => onCreateDay?.(cell.date)}
          >{fmt.dayNumber(cell.date)}</button>
          {#each dayItems.slice(0, 3) as item (item.key)}
            <EventButton {item} {fmt} {labels} {timeZone} {hintId} compact {onOpen} />
          {/each}
          {#if dayItems.length > 3}
            <span class="tx-calendar__more" aria-label={labels.moreEvents(dayItems.length - 3)}>{labels.moreEvents(dayItems.length - 3)}</span>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .tx-calendar__weekdays, .tx-calendar__month-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .tx-calendar__weekdays { border-block-end: 1px solid var(--tx-border, ButtonBorder); color: var(--tx-muted-foreground, GrayText); font-size: .75rem; font-weight: 600; }
  .tx-calendar__weekdays span { padding-block: .4rem; padding-inline: .5rem; }
  .tx-calendar__month-week { min-block-size: 6rem; border-block-end: 1px solid var(--tx-border, ButtonBorder); }
  .tx-calendar__month-cell { display: flex; min-inline-size: 0; flex-direction: column; gap: .2rem; overflow: hidden; border-inline-end: 1px solid var(--tx-border, ButtonBorder); padding: .25rem; }
  .tx-calendar__outside { background: color-mix(in srgb, var(--tx-muted, Canvas) 45%, transparent); }
  .tx-calendar__date { align-self: start; min-inline-size: 1.75rem; min-block-size: 1.5rem; border-radius: 999px; padding: .2rem; color: inherit; text-align: center; font-size: .75rem; }
  .tx-calendar__date:focus-visible { outline: 2px solid var(--tx-ring, Highlight); outline-offset: 2px; }
  .tx-calendar__today { background: var(--tx-primary, Highlight); color: var(--tx-primary-foreground, HighlightText); }
  .tx-calendar__more { color: var(--tx-muted-foreground, GrayText); font-size: .7rem; }
  @media (max-width: 40rem) { .tx-calendar__month-week { min-block-size: 4.2rem; } .tx-calendar__month-cell { padding: .125rem; } }
  @media (forced-colors: active) { .tx-calendar__outside { background: Canvas; } .tx-calendar__today { outline: 2px solid Highlight; } }
</style>
