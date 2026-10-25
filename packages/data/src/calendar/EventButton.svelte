<script lang="ts">
import { spanDates } from '../engines/calendar/index.ts';
import type { CalendarFormats } from './model.ts';
import type { CalendarItem, CalendarLabels } from './types.ts';
import { TONE_CLASSES } from './types.ts';

let {
  item,
  fmt,
  labels,
  timeZone,
  hintId,
  compact = false,
  onOpen,
}: {
  item: CalendarItem;
  fmt: CalendarFormats;
  labels: CalendarLabels;
  timeZone: string;
  /** Id of the element that explains how to move an event. */
  hintId?: string;
  compact?: boolean;
  onOpen?: (item: CalendarItem) => void;
} = $props();

const MOVE_SHORTCUTS = ['Alt', 'Control']
  .flatMap((modifier) =>
    ['Left', 'Right', 'Up', 'Down'].map((arrow) => `${modifier}+Arrow${arrow}`)
  )
  .concat('Shift+F10')
  .join(' ');
const time = $derived(fmt.span(item, labels.allDay));
// The visible text leads the name (WCAG 2.5.3 label in name): title and "recurring",
// then the date and time, then how to open it.
// All-day events read "Title, All day, <date>"; timed ones "Title, <date>, <time>".
const name = $derived(
  [
    item.title,
    item.recurring ? labels.recurring : '',
    item.allDay ? time : '',
    fmt.longDate(spanDates(item, timeZone).first),
    item.allDay ? '' : time,
    labels.openHint,
  ]
    .filter(Boolean)
    .join(', ')
);
</script>

<button
  type="button"
  class={`tx-calendar__event ${TONE_CLASSES[item.tone]} ${compact ? 'tx-calendar__event--compact' : ''}`}
  data-calendar-event={item.key}
  data-movable={item.movable || undefined}
  data-grabbed={item.grabbed || undefined}
  aria-pressed={item.grabbed || undefined}
  aria-label={name}
  aria-describedby={item.movable ? hintId : undefined}
  aria-keyshortcuts={item.movable ? MOVE_SHORTCUTS : undefined}
  onclick={() => onOpen?.(item)}
>
  <span class="tx-calendar__event-title">{item.title}</span>
  {#if item.recurring}<span class="tx-calendar__event-recurring">{labels.recurring}</span>{/if}
  {#if !compact}<span class="tx-calendar__event-time">{time}</span>{/if}
</button>

<style>
  .tx-calendar__event { display: block; min-inline-size: 0; overflow: hidden; border: 1px solid var(--tx-border, ButtonBorder); border-inline-start: 3px solid; border-radius: .375rem; padding-block: .2rem; padding-inline: .4rem; text-align: start; font: inherit; font-size: .75rem; line-height: 1.25; }
  .tx-calendar__event[data-movable] { cursor: grab; touch-action: none; }
  .tx-calendar__event:global([data-dragging]) { position: relative; z-index: 2; cursor: grabbing; opacity: .85; box-shadow: 0 4px 12px rgb(0 0 0 / .18); translate: var(--tx-calendar-drag-x, 0) var(--tx-calendar-drag-y, 0); }
  .tx-calendar__event[data-grabbed] { position: relative; z-index: 2; outline: 2px dashed var(--tx-ring, Highlight); outline-offset: 1px; }
  .tx-calendar__event:focus-visible { outline: 2px solid var(--tx-ring, Highlight); outline-offset: 2px; }
  .tx-calendar__event-title, .tx-calendar__event-time { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tx-calendar__event-title { font-weight: 600; }
  .tx-calendar__event-time { color: var(--tx-muted-foreground, GrayText); }
  .tx-calendar__event--compact { padding-block: .1rem; }
  @media (forced-colors: active) { .tx-calendar__event:global([data-dragging]) { outline: 2px dashed CanvasText; } }
</style>
