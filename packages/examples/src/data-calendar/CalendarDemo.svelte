<script lang="ts">
import {
  type CalendarChange,
  type CalendarMode,
  type CalendarSeries,
  type CalendarSlot,
  CalendarView,
} from '@texuli/data/calendar/view';

interface EventDetails {
  title: string;
  tone: 'primary' | 'info' | 'success' | 'warning';
}

let events = $state<CalendarSeries<EventDetails>[]>([
  {
    id: 'design-review',
    start: '2026-04-15T13:00:00Z',
    end: '2026-04-15T14:30:00Z',
    data: { title: 'Design review', tone: 'primary' },
  },
  {
    id: 'research-sync',
    start: '2026-04-15T13:30:00Z',
    end: '2026-04-15T14:00:00Z',
    data: { title: 'Research sync', tone: 'info' },
  },
  {
    id: 'team-lunch',
    start: '2026-04-15',
    end: '2026-04-16',
    allDay: true,
    data: { title: 'Team lunch', tone: 'success' },
  },
  {
    id: 'weekly-planning',
    start: '2026-04-13T15:00:00Z',
    end: '2026-04-13T16:00:00Z',
    timeZone: 'America/Los_Angeles',
    rule: { freq: 'weekly', count: 4 },
    data: { title: 'Weekly planning', tone: 'warning' },
  },
]);

let view = $state<CalendarMode>('week');
let selected = $state('Select an event to inspect it.');
let zone = $state('America/Los_Angeles');
let direction = $state<'ltr' | 'rtl'>('ltr');

/** A one-off event moves; a repeating one stores an override for that occurrence only. */
// The demo's clock: a fixed instant, so the "now" line and today never depend on the real time.
const NOW = '2026-04-15T13:50:00Z';
let created = 0;

/** An empty slot (or a date, all-day) becomes a new event. */
function create(slot: CalendarSlot): void {
  created += 1;
  const title = `New event ${created}`;
  events = [
    ...events,
    {
      id: `new-${created}`,
      start: slot.start,
      end: slot.end,
      allDay: slot.allDay,
      data: { title, tone: 'info' },
    },
  ];
  selected = `Created ${title} (${slot.start}).`;
}

function reschedule(change: CalendarChange<EventDetails>): void {
  events = events.map((series) => {
    if (series.id !== change.id) return series;
    if (!change.recurring) return { ...series, start: change.start, end: change.end };
    const overrides = {
      ...series.overrides,
      [change.occurrenceId]: { start: change.start, end: change.end },
    };
    return { ...series, overrides };
  });
  selected = `Moved ${change.occurrence.data?.title ?? 'event'} to ${change.start}.`;
}
</script>

<section class="tx-calendar-demo" data-example="data-calendar" aria-labelledby="calendar-demo-title">
  <header>
    <div><p class="eyebrow">CALENDAR / PORT MERIDIAN</p><h2 id="calendar-demo-title">Delivery calendar</h2><p>Overlapping sessions, an all-day event and a recurring meeting shown in the selected time zone. Drag an event, or focus it and press Space then the arrow keys (or Alt with an arrow key, or Shift+F10), to reschedule it within April; activate an empty slot or a date to add one.</p></div>
    <div class="controls">
      <label>Display zone<select aria-label="Display time zone" bind:value={zone}><option value="America/Los_Angeles">Pacific</option><option value="America/New_York">Eastern</option><option value="UTC">UTC</option></select></label>
      <label>Direction<select aria-label="Calendar direction" bind:value={direction}><option value="ltr">Left to right</option><option value="rtl">Right to left</option></select></label>
    </div>
  </header>
  <CalendarView {events} getTone={(occurrence) => occurrence.data?.tone ?? 'primary'} anchor="2026-04-15" now={NOW} bind:view locale="en-US" timeZone={zone} dir={direction} min="2026-04-01" max="2026-04-30" onChange={reschedule} onCreate={create} onOpen={(event) => (selected = `${event.data?.title ?? 'Event'} (${event.start})`)} />
  <p class="selected" role="status">{selected}</p>
</section>

<style>
  .tx-calendar-demo { display: grid; gap: .75rem; padding: 1rem; color: var(--tx-foreground, CanvasText); background: var(--tx-background, Canvas); }
  header { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 1rem; }
  h2 { margin: .15rem 0 .25rem; font-size: 1.25rem; }
  p { max-inline-size: 42rem; margin: 0; color: var(--tx-muted-foreground, GrayText); font-size: .875rem; }
  .eyebrow { color: var(--tx-primary, Highlight); font-size: .7rem; font-weight: 700; letter-spacing: .08em; }
  label { display: grid; gap: .25rem; font-size: .8rem; }
  select { border: 1px solid var(--tx-border, ButtonBorder); border-radius: .375rem; padding: .35rem; background: var(--tx-background, Canvas); color: inherit; }
  .selected { min-block-size: 1.25rem; }
  .controls { display: flex; flex-wrap: wrap; gap: .75rem; }
</style>
