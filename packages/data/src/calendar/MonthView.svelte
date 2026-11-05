<script lang="ts">
import type { Snippet } from 'svelte';
import { monthGrid, parseIsoDate, type Weekday } from '../engines/calendar/index.ts';
import EventButton from './EventButton.svelte';
import type { CalendarFormats } from './model.ts';
import { eventsOnDate } from './model.ts';
import type { CalendarEventContext, CalendarItem, CalendarLabels } from './types.ts';

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
  event,
  maxEventsPerDay = 3,
  onMoreEvents,
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
  event?: Snippet<[CalendarItem, CalendarEventContext]>;
  /** Chips shown per day before the "more events" entry. */
  maxEventsPerDay?: number;
  /** Set when the "more events" entry is a button. */
  onMoreEvents?: (date: string) => void;
} = $props();

// Whole and non-negative (Infinity shows every event); NaN keeps the default.
const shown = $derived(
  Number.isNaN(maxEventsPerDay) ? 3 : Math.max(0, Math.floor(maxEventsPerDay))
);

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
        <!-- No aria-label: the cell is named by its content, which leads with the date button
             ("<date>, <n> events") and then the event chips (WCAG 2.5.3 label in name). -->
        <div
          class:tx-calendar__outside={!cell.inMonth}
          class="tx-calendar__month-cell"
          role="gridcell"
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
          {#each dayItems.slice(0, shown) as item (item.key)}
            <EventButton {item} {fmt} {labels} {timeZone} {hintId} compact view="month" content={event} {onOpen} />
          {/each}
          {#if dayItems.length > shown}
            {@const hidden = dayItems.length - shown}
            {#if onMoreEvents}
              <button type="button" class="tx-calendar__more" data-calendar-more={cell.date} aria-label={labels.moreEventsOn(hidden, fmt.monthDay(cell.date))} onclick={() => onMoreEvents(cell.date)}>{labels.moreEvents(hidden)}</button>
            {:else}
              <span class="tx-calendar__more" aria-label={labels.moreEvents(hidden)}>{labels.moreEvents(hidden)}</span>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .tx-calendar__weekdays, .tx-calendar__month-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .tx-calendar__weekdays { border-block-end: var(--tx-border-width-thin) solid var(--tx-border, ButtonBorder); color: var(--tx-muted-foreground, GrayText); font-size: var(--tx-type-caption-size); font-weight: 600; }
  .tx-calendar__weekdays span { padding-block: calc(var(--tx-space-unit) * 1.6); padding-inline: var(--tx-space-2); }
  .tx-calendar__month-week { min-block-size: 6rem; border-block-end: var(--tx-border-width-thin) solid var(--tx-border, ButtonBorder); }
  .tx-calendar__month-cell { display: flex; min-inline-size: 0; flex-direction: column; gap: calc(var(--tx-space-unit) * 0.8); overflow: hidden; border-inline-end: var(--tx-border-width-thin) solid var(--tx-border, ButtonBorder); padding: var(--tx-space-1); }
  .tx-calendar__outside { background: color-mix(in srgb, var(--tx-muted, Canvas) 45%, transparent); }
  /* Reset the browser's button look (border, fill, font) so the date follows the tokens. */
  .tx-calendar__date { align-self: start; min-inline-size: 1.75rem; min-block-size: 1.5rem; border: 0; border-radius: var(--tx-shape-radius-full); background: transparent; padding: calc(var(--tx-space-unit) * 0.8); color: inherit; text-align: center; font: inherit; font-size: var(--tx-type-caption-size); line-height: 1; }
  .tx-calendar__date:focus-visible { outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight); outline-offset: 2px; }
  .tx-calendar__today { background: var(--tx-primary, Highlight); color: var(--tx-primary-foreground, HighlightText); }
  .tx-calendar__more { color: var(--tx-muted-foreground, GrayText); font-size: .7rem; }
  button.tx-calendar__more { align-self: start; min-block-size: 1.5rem; border: 0; border-radius: var(--tx-shape-radius-sm); background: transparent; padding-inline: calc(var(--tx-space-unit) * 0.8); font-family: inherit; font-weight: 600; text-align: start; cursor: pointer; }
  button.tx-calendar__more:hover { background: var(--tx-muted, ButtonFace); color: var(--tx-foreground, CanvasText); }
  button.tx-calendar__more:focus-visible { outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight); outline-offset: 2px; }
  @media (max-width: 40rem) { .tx-calendar__month-week { min-block-size: 4.2rem; } .tx-calendar__month-cell { padding: calc(var(--tx-space-unit) * 0.5); } }
  @media (forced-colors: active) { .tx-calendar__outside { background: Canvas; } .tx-calendar__today { outline: 2px solid Highlight; } }
</style>
