<script lang="ts">
import { untrack } from 'svelte';
import {
  type IsoDate,
  layoutDay,
  nowMinute,
  slotMinuteAt,
  timedSlot,
} from '../engines/calendar/index.ts';
import EventButton from './EventButton.svelte';
import type { CalendarFormats } from './model.ts';
import type { CalendarItem, CalendarLabels } from './types.ts';

let {
  dates,
  focusDate,
  items,
  fmt,
  timeZone,
  labels,
  onOpen,
  onFocusDate,
  hintId,
  nowMs,
  slotMinute = 9 * 60,
  slotMinutes = 15,
  onCreateDay,
  onCreateAt,
  scrollToHour = 8,
}: {
  dates: IsoDate[];
  focusDate: IsoDate;
  items: CalendarItem[];
  fmt: CalendarFormats;
  timeZone: string;
  labels: CalendarLabels;
  onOpen?: (item: CalendarItem) => void;
  onFocusDate: (date: IsoDate) => void;
  hintId?: string;
  /** The clock's instant: the "now" line is drawn on its date. */
  nowMs?: number;
  /** The focused empty slot's minute (on `focusDate`). */
  slotMinute?: number;
  slotMinutes?: number;
  /** Set when activating a date heading or an empty all-day cell creates an all-day event. */
  onCreateDay?: (date: IsoDate) => void;
  /** Set when activating an empty slot creates a timed event. */
  onCreateAt?: (date: IsoDate, minute: number) => void;
  /** The hour the grid opens at when today's "now" line is not in view. */
  scrollToHour?: number;
} = $props();

const REM_PER_MINUTE = 3 / 60;
const slotTime = $derived(fmt.time(timedSlot(focusDate, slotMinute, timeZone).start));

/** A click on the column itself (not on an event or the slot) creates at that slot. */
function createFromPointer(event: MouseEvent, date: IsoDate): void {
  if (!onCreateAt || (event.target as HTMLElement).closest('[data-calendar-event], [data-slot]'))
    return;
  const column = event.currentTarget as HTMLElement;
  const box = column.getBoundingClientRect();
  onCreateAt(date, slotMinuteAt(event.clientY - box.top, box.height, slotMinutes));
}

/**
 * Where the grid opens: an hour above the "now" line when it is in range,
 * else `scrollToHour`. Read once, when the grid mounts.
 */
const openMinute = $derived.by(() => {
  for (const date of dates) {
    const minute = nowMs === undefined ? null : nowMinute(nowMs, date, timeZone);
    if (minute !== null) return Math.max(0, minute - 60);
  }
  return Math.min(23, Math.max(0, Math.floor(scrollToHour))) * 60;
});

/**
 * Scrolls before the first paint, with no smooth behavior (so nothing moves
 * after the grid shows and reduced motion is respected), and never focuses.
 */
function openAt(scroller: HTMLElement): void {
  const grid = scroller.firstElementChild as HTMLElement | null;
  const top = ((grid?.offsetHeight ?? 0) / (24 * 60)) * untrack(() => openMinute);
  scroller.scrollTo?.({ top, behavior: 'instant' });
}

const hours = Array.from({ length: 24 }, (_, hour) => hour);
const allDay = $derived(
  dates.map((date) => items.filter((item) => item.allDay && item.start <= date && date < item.end))
);
const timed = $derived(dates.map((date) => layoutDay(items, { date, timeZone })));
</script>

<!--
  One horizontal scroller for the day headings and the time grid, so on a
  narrow screen they scroll together (the grid used to scroll under fixed
  headings, which then named the wrong days).
-->
<div class="tx-calendar__time-view" style={`--tx-calendar-columns: ${dates.length}`} data-time-view>
<div class="tx-calendar__time-header" style={`--tx-calendar-columns: ${dates.length}`}>
  <span aria-hidden="true"></span>
  {#each dates as date (date)}
    <button
      type="button"
      class="tx-calendar__day-heading"
      data-calendar-date={date}
      data-slot={onCreateDay ? date : undefined}
      aria-label={`${fmt.weekday(date)} ${fmt.dayNumber(date)}, ${fmt.longDate(date)}${onCreateDay ? `. ${labels.addsAllDayEvent}` : ''}`}
      aria-current={date === focusDate ? 'date' : undefined}
      tabindex={date === focusDate ? 0 : -1}
      onfocus={() => onFocusDate(date)}
      onclick={() => onCreateDay?.(date)}
    >{fmt.weekday(date)} <strong>{fmt.dayNumber(date)}</strong></button>
  {/each}
  <span class="tx-calendar__all-day-label">{labels.allDay}</span>
  {#each dates as date, index (date)}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -- the date heading is the keyboard path. -->
    <div
      class="tx-calendar__all-day"
      data-allday={date}
      onclick={(event) => {
        if (event.target === event.currentTarget) onCreateDay?.(date);
      }}
    >
      {#each allDay[index] ?? [] as item (item.key)}<EventButton {item} {fmt} {labels} {timeZone} {hintId} compact {onOpen} />{/each}
    </div>
  {/each}
</div>
<div class="tx-calendar__scroller" data-time-scroller data-open-minute={openMinute} {@attach openAt}>
  <div class="tx-calendar__time-grid" style={`--tx-calendar-columns: ${dates.length}`} data-columns={dates.length}>
    <div class="tx-calendar__hours" aria-hidden="true">
      {#each hours as hour (hour)}<span>{hour === 0 ? '' : fmt.hour(hour)}</span>{/each}
    </div>
    {#each dates as date, index (date)}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -- the focused slot is the keyboard path. -->
      <section class="tx-calendar__day-column" aria-label={fmt.longDate(date)} data-day-column={date} onclick={(event) => createFromPointer(event, date)}>
        {#if nowMs !== undefined}
          {@const minute = nowMinute(nowMs, date, timeZone)}
          {#if minute !== null}<span class="tx-calendar__now" data-now-line aria-hidden="true" style={`inset-block-start: ${minute * REM_PER_MINUTE}rem`}></span>{/if}
        {/if}
        {#if onCreateAt && date === focusDate}
          <button
            type="button"
            class="tx-calendar__slot"
            style={`inset-block-start: ${slotMinute * REM_PER_MINUTE}rem; block-size: ${slotMinutes * REM_PER_MINUTE}rem`}
            data-slot={date}
            data-focused
            data-minute={slotMinute}
            aria-label={`${labels.emptySlot(`${fmt.longDate(date)}, ${slotTime}`)}. ${labels.addsEvent}`}
            onclick={() => onCreateAt(date, slotMinute)}
          ></button>
        {/if}
        {#each hours as hour (hour)}<span class="tx-calendar__hour-line" style={`--tx-hour: ${hour}`} aria-hidden="true"></span>{/each}
        {#each timed[index] ?? [] as layout (layout.event.id)}
          {@const item = items.find((candidate) => candidate.key === layout.event.id)}
          {#if item}
            <div
              class="tx-calendar__positioned-event"
              style={`inset-block-start: ${(layout.startMinute / 60) * 3}rem; block-size: ${Math.max(0.75, ((layout.endMinute - layout.startMinute) / 60) * 3)}rem; inset-inline-start: ${(layout.column / layout.columnCount) * 100}%; inline-size: calc(${100 / layout.columnCount}% - .15rem)`}
              data-continues-before={layout.continuesBefore || undefined}
              data-continues-after={layout.continuesAfter || undefined}
            ><EventButton {item} {fmt} {labels} {timeZone} {hintId} compact {onOpen} /></div>
          {/if}
        {/each}
      </section>
    {/each}
  </div>
</div>
</div>

<style>
  .tx-calendar__time-header, .tx-calendar__time-grid { display: grid; grid-template-columns: 3.5rem repeat(var(--tx-calendar-columns), minmax(0, 1fr)); }
  .tx-calendar__time-header { border-block-end: 1px solid var(--tx-border, ButtonBorder); }
  .tx-calendar__day-heading { border: 0; background: transparent; padding: .5rem .25rem; text-align: center; color: var(--tx-muted-foreground, GrayText); font: inherit; font-size: .75rem; }
  .tx-calendar__day-heading strong { color: var(--tx-foreground, CanvasText); }
  .tx-calendar__all-day-label { padding: .4rem; color: var(--tx-muted-foreground, GrayText); font-size: .7rem; }
  .tx-calendar__all-day { display: grid; min-block-size: 2rem; align-content: start; gap: .2rem; border-inline-start: 1px solid var(--tx-border, ButtonBorder); padding: .2rem; }
  .tx-calendar__scroller { max-block-size: min(36rem, 65vh); overflow: auto; }
  .tx-calendar__time-grid { min-block-size: 72rem; }
  .tx-calendar__hours { display: grid; grid-template-rows: repeat(24, 3rem); color: var(--tx-muted-foreground, GrayText); font-size: .65rem; text-align: end; }
  .tx-calendar__hours span { padding-inline-end: .35rem; transform: translateY(-.45em); }
  .tx-calendar__day-column { position: relative; min-inline-size: 0; border-inline-start: 1px solid var(--tx-border, ButtonBorder); background-image: repeating-linear-gradient(to bottom, transparent 0, transparent calc(3rem - 1px), var(--tx-border, ButtonBorder) calc(3rem - 1px), var(--tx-border, ButtonBorder) 3rem); }
  .tx-calendar__now { position: absolute; z-index: 1; inset-inline: 0; block-size: 2px; background: var(--tx-destructive, Highlight); pointer-events: none; }
  .tx-calendar__now::before { position: absolute; inset-inline-start: -.3rem; inset-block-start: -.25rem; inline-size: .55rem; block-size: .55rem; border-radius: 999px; background: inherit; content: ''; }
  .tx-calendar__slot { position: absolute; inset-inline: .1rem; border: 1px dashed transparent; border-radius: .25rem; background: transparent; padding: 0; }
  .tx-calendar__slot:focus-visible { border-color: var(--tx-ring, Highlight); background: color-mix(in srgb, var(--tx-primary, Highlight) 8%, transparent); outline: 2px solid var(--tx-ring, Highlight); outline-offset: 0; }
  .tx-calendar__positioned-event { position: absolute; overflow: hidden; padding-inline: .05rem; }
  .tx-calendar__positioned-event :global(.tx-calendar__event) { block-size: 100%; inline-size: 100%; }
  .tx-calendar__time-view { display: grid; min-inline-size: 0; overflow-x: auto; }
  /* Phones: each day keeps a readable 5.5rem column and the view scrolls sideways. */
  @media (max-width: 40rem) { .tx-calendar__time-header, .tx-calendar__time-grid { min-inline-size: calc(3.5rem + var(--tx-calendar-columns) * 5.5rem); } }
  @media (forced-colors: active) { .tx-calendar__now { background: Highlight; } .tx-calendar__day-column { background-image: repeating-linear-gradient(to bottom, transparent 0, transparent calc(3rem - 1px), CanvasText calc(3rem - 1px), CanvasText 3rem); } }
</style>
