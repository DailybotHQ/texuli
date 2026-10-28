<script lang="ts">
import { CalendarView } from '@texuli/data/calendar/view';
import { getPlayerInteraction } from '../context.ts';

/** `data-calendar`: events from plain JSON; the view is bindable. */
interface Event {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  tone?: string;
}

let {
  label,
  events,
  view = 'week',
  anchor,
  timeZone = 'UTC',
  locale = 'en-US',
  readOnly = false,
  txPath,
}: {
  label: string;
  events: readonly Event[];
  view?: 'month' | 'week' | 'day' | 'agenda';
  anchor?: string;
  timeZone?: string;
  locale?: string;
  readOnly?: boolean;
  txPath?: string;
} = $props();

const interaction = getPlayerInteraction();
let series = $state.raw<
  {
    id: string;
    start: string;
    end: string;
    allDay?: boolean;
    data: { title: string; tone?: string };
  }[]
>([]);
$effect.pre(() => {
  series = events.map((event) => ({
    id: event.id,
    start: event.start,
    end: event.end,
    ...(event.allDay ? { allDay: true } : {}),
    data: { title: event.title, ...(event.tone ? { tone: event.tone } : {}) },
  }));
});
let shown = $state<'month' | 'week' | 'day' | 'agenda'>('week');
$effect.pre(() => {
  shown = view;
});
let lastView: string | undefined;
$effect(() => {
  const current = shown;
  if (lastView !== undefined && current !== lastView && txPath !== undefined) {
    interaction?.write(txPath, 'view', current);
    interaction?.dispatch(txPath, 'change', { value: current });
  }
  lastView = current;
});
// Without a valid anchor the calendar opens on today.
const anchorDate = $derived(
  anchor && !Number.isNaN(Date.parse(anchor))
    ? anchor.slice(0, 10)
    : new Date().toISOString().slice(0, 10)
);
const tones = new Set(['primary', 'info', 'success', 'warning', 'danger', 'neutral']);
</script>

<CalendarView
  events={series}
  {label}
  bind:view={shown}
  anchor={anchorDate}
  {timeZone}
  {locale}
  {readOnly}
  getTitle={(occurrence) => String((occurrence.data as { title?: unknown } | undefined)?.title ?? '')}
  getTone={(occurrence) => {
    const tone = (occurrence.data as { tone?: unknown } | undefined)?.tone;
    return typeof tone === 'string' && tones.has(tone) ? (tone as never) : 'primary';
  }}
  onOpen={(occurrence) => {
    if (txPath !== undefined) interaction?.dispatch(txPath, 'select', { value: occurrence.seriesId });
  }}
  onChange={(change) => {
    series = series.map((entry) => (entry.id === change.id ? { ...entry, start: change.start, end: change.end } : entry));
    if (txPath !== undefined) interaction?.dispatch(txPath, 'move', { value: change.id });
  }}
/>
