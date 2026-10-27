<script lang="ts">
import { addDays, daysBetween } from '../engines/calendar/index.ts';
import EventButton from './EventButton.svelte';
import type { CalendarFormats } from './model.ts';
import { eventsOnDate } from './model.ts';
import type { CalendarItem, CalendarLabels } from './types.ts';

let {
  startDate,
  endDate,
  focusDate,
  items,
  fmt,
  timeZone,
  labels,
  onOpen,
  onFocusDate,
  hintId,
  onCreateDay,
}: {
  startDate: string;
  endDate: string;
  focusDate: string;
  items: CalendarItem[];
  fmt: CalendarFormats;
  timeZone: string;
  labels: CalendarLabels;
  onOpen?: (item: CalendarItem) => void;
  onFocusDate: (date: string) => void;
  hintId?: string;
  /** Set when activating a date creates an all-day event. */
  onCreateDay?: (date: string) => void;
} = $props();

const days = $derived.by(() =>
  Array.from({ length: Math.max(0, daysBetween(startDate, endDate)) }, (_, index) => {
    const date = addDays(startDate, index);
    return { date, items: eventsOnDate(items, date, timeZone) };
  })
);
// Day heading ids carry the instance id, so two calendars on one page never
// share them (a duplicated id would label every section with the first one's
// headings).
const uid = $props.id();
</script>

<div class="tx-calendar__agenda" data-agenda>
  {#if days.every((day) => day.items.length === 0)}<p class="tx-calendar__empty">{labels.empty}</p>{/if}
  {#each days as day (day.date)}
    <section class="tx-calendar__agenda-day" aria-labelledby={`${uid}-agenda-${day.date}`}>
      <h3 id={`${uid}-agenda-${day.date}`} class="tx-calendar__agenda-heading">
        <button
          type="button"
          data-calendar-date={day.date}
          data-slot={onCreateDay ? day.date : undefined}
          aria-label={onCreateDay ? `${fmt.longDate(day.date)}. ${labels.addsAllDayEvent}` : undefined}
          aria-current={day.date === focusDate ? 'date' : undefined}
          tabindex={day.date === focusDate ? 0 : -1}
          onfocus={() => onFocusDate(day.date)}
          onclick={() => onCreateDay?.(day.date)}
        >{fmt.longDate(day.date)}</button>
      </h3>
      {#if day.items.length}
        <ul>
          {#each day.items as item (item.key)}<li><EventButton {item} {fmt} {labels} {timeZone} {hintId} {onOpen} /></li>{/each}
        </ul>
      {:else}<p class="tx-calendar__empty">{labels.empty}</p>{/if}
    </section>
  {/each}
</div>

<style>
  .tx-calendar__agenda { display: grid; gap: 1rem; padding: 1rem; }
  .tx-calendar__agenda-day { display: grid; gap: .5rem; }
  .tx-calendar__agenda-heading { margin: 0; font-size: .9rem; font-weight: 650; }
  .tx-calendar__agenda-heading button { border: 0; background: transparent; padding: 0; color: inherit; font: inherit; text-align: start; }
  .tx-calendar__agenda-heading button:focus-visible { outline: 2px solid var(--tx-ring, Highlight); outline-offset: 2px; }
  ul { display: grid; gap: .35rem; margin: 0; padding: 0; list-style: none; }
  .tx-calendar__empty { margin: 0; color: var(--tx-muted-foreground, GrayText); font-size: .875rem; }
</style>
