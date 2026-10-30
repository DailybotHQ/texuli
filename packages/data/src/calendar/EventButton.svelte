<script lang="ts">
import { spanDates } from '../engines/calendar/index.ts';
import type { CalendarFormats } from './model.ts';
import type { CalendarItem, CalendarLabels } from './types.ts';

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
  class={`tx-calendar__event ${compact ? 'tx-calendar__event--compact' : ''}`}
  data-tone={item.tone}
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
  /*
   * Tones come from the token contract: a soft fill and a solid start bar per
   * tone, in light and dark. (They were utility classes, which render nothing
   * unless the host app ships that utility CSS, so every event was gray.)
   */
  .tx-calendar__event { --tx-event-accent: var(--tx-border-strong, var(--tx-border, ButtonBorder)); --tx-event-fill: var(--tx-muted, ButtonFace); display: block; min-inline-size: 0; overflow: hidden; border: var(--tx-border-width-thin) solid var(--tx-border, ButtonBorder); border-inline-start: 3px solid var(--tx-event-accent); border-radius: var(--tx-shape-radius-md); padding-block: calc(var(--tx-space-unit) * 0.8); padding-inline: calc(var(--tx-space-unit) * 1.6); background: var(--tx-event-fill); color: var(--tx-foreground, CanvasText); text-align: start; font: inherit; font-size: var(--tx-type-caption-size); line-height: 1.25; }
  .tx-calendar__event[data-tone="primary"] { --tx-event-accent: var(--tx-primary, Highlight); --tx-event-fill: var(--tx-primary-soft, color-mix(in oklab, var(--tx-primary, Highlight) 12%, var(--tx-background, Canvas))); }
  .tx-calendar__event[data-tone="info"] { --tx-event-accent: var(--tx-info, Highlight); --tx-event-fill: var(--tx-info-soft, color-mix(in oklab, var(--tx-info, Highlight) 12%, var(--tx-background, Canvas))); }
  .tx-calendar__event[data-tone="success"] { --tx-event-accent: var(--tx-success, Highlight); --tx-event-fill: var(--tx-success-soft, color-mix(in oklab, var(--tx-success, Highlight) 12%, var(--tx-background, Canvas))); }
  .tx-calendar__event[data-tone="warning"] { --tx-event-accent: var(--tx-warning, Highlight); --tx-event-fill: var(--tx-warning-soft, color-mix(in oklab, var(--tx-warning, Highlight) 12%, var(--tx-background, Canvas))); }
  .tx-calendar__event[data-tone="danger"] { --tx-event-accent: var(--tx-destructive, Mark); --tx-event-fill: var(--tx-destructive-soft, color-mix(in oklab, var(--tx-destructive, Mark) 12%, var(--tx-background, Canvas))); }
  .tx-calendar__event[data-movable] { cursor: grab; touch-action: none; }
  .tx-calendar__event:global([data-dragging]) { position: relative; z-index: 2; cursor: grabbing; opacity: .85; box-shadow: var(--tx-elevation-3); translate: var(--tx-calendar-drag-x, 0) var(--tx-calendar-drag-y, 0); }
  .tx-calendar__event[data-grabbed] { position: relative; z-index: 2; outline: 2px dashed var(--tx-ring, Highlight); outline-offset: 1px; }
  .tx-calendar__event:focus-visible { outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight); outline-offset: 2px; }
  .tx-calendar__event-title, .tx-calendar__event-time { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tx-calendar__event-title { font-weight: 600; }
  .tx-calendar__event-time { color: var(--tx-muted-foreground, GrayText); }
  .tx-calendar__event--compact { padding-block: calc(var(--tx-space-unit) * 0.4); }
  @media (forced-colors: active) { .tx-calendar__event:global([data-dragging]) { outline: 2px dashed CanvasText; } }
</style>
