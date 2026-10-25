<script lang="ts">
import {
  type CalendarChange,
  type CalendarMode,
  type CalendarSlot,
  CalendarView,
} from '../../src/calendar/index.ts';
import type { CalendarSeries, Occurrence } from '../../src/engines/calendar/index.ts';

interface Details {
  title: string;
  locked?: boolean;
}

let {
  initial,
  view = 'week',
  readOnly = false,
  min,
  max,
  apply = true,
  onChange,
  onOpen,
  onCreate,
  now,
  anchor = '2026-04-15',
  today = now === undefined ? '2026-04-15' : undefined,
  move = true,
  showYear,
  scrollToHour,
}: {
  initial: CalendarSeries<Details>[];
  view?: CalendarMode;
  readOnly?: boolean;
  min?: string;
  max?: string;
  /** Write the change back into `events`, the way a consumer would. */
  apply?: boolean;
  onChange?: (change: CalendarChange<Details>) => void;
  onOpen?: (occurrence: Occurrence<Details>) => void;
  onCreate?: (slot: CalendarSlot) => void;
  now?: string;
  anchor?: string;
  today?: string;
  /** Pass `onChange` to the calendar (false: a display-only calendar). */
  move?: boolean;
  showYear?: 'auto' | 'always';
  scrollToHour?: number;
} = $props();

// svelte-ignore state_referenced_locally -- the harness owns its events after the first render.
let events = $state(initial);
// svelte-ignore state_referenced_locally -- seed once; the calendar binds it.
let mode = $state<CalendarMode>(view);

function change(next: CalendarChange<Details>): void {
  onChange?.(next);
  if (apply)
    events = events.map((series) =>
      series.id === next.id ? { ...series, start: next.start, end: next.end } : series
    );
}
</script>

<CalendarView
  {events}
  {anchor}
  {today}
  {now}
  {onCreate}
  {showYear}
  {scrollToHour}
  timeZone="UTC"
  bind:view={mode}
  {readOnly}
  {min}
  {max}
  canMove={(occurrence) => !occurrence.data?.locked}
  onChange={move ? change : undefined}
  {onOpen}
/>
