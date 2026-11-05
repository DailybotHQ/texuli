<script lang="ts">
import { type CalendarMode, type CalendarSeries, CalendarView } from '@texuli/data/calendar/view';

interface Booking {
  title: string;
  room: string;
  tone: 'primary' | 'info' | 'success' | 'warning';
}

const booking = (
  id: string,
  day: string,
  from: string,
  to: string,
  title: string,
  room: string,
  tone: Booking['tone']
): CalendarSeries<Booking> => ({
  id,
  start: `2026-11-${day}T${from}:00Z`,
  end: `2026-11-${day}T${to}:00Z`,
  data: { title, room, tone },
});

const events: CalendarSeries<Booking>[] = [
  booking('kickoff', '03', '09:00', '10:00', 'Kickoff', 'Atlas', 'primary'),
  booking('roadmap', '05', '09:00', '09:30', 'Roadmap', 'Atlas', 'primary'),
  booking('pairing', '05', '10:00', '11:00', 'Pairing', 'Birch', 'info'),
  booking('interview', '05', '13:00', '14:00', 'Interview', 'Cedar', 'success'),
  booking('retro', '05', '15:00', '16:00', 'Retro', 'Atlas', 'warning'),
  booking('demo', '05', '16:30', '17:00', 'Demo', 'Birch', 'info'),
  booking('standup', '12', '09:00', '09:15', 'Standup', 'Birch', 'info'),
  booking('review', '12', '14:00', '15:00', 'Design review', 'Cedar', 'primary'),
  booking('planning', '12', '15:30', '16:30', 'Planning', 'Atlas', 'warning'),
  booking('offsite', '19', '10:00', '12:00', 'Offsite prep', 'Cedar', 'success'),
  {
    id: 'launch',
    start: '2026-11-24',
    end: '2026-11-25',
    allDay: true,
    data: { title: 'Launch day', room: 'Everywhere', tone: 'success' },
  },
];

let view = $state<CalendarMode>('month');
let anchor = $state('2026-11-05');
let status = $state('Choose "more events" on a busy day to open it.');

function openDay(date: string): void {
  anchor = date;
  view = 'day';
  status = `Showing every event on ${date}.`;
}
</script>

<section class="tx-calendar-month-demo" data-example="data-calendar-month" aria-labelledby="calendar-month-demo-title">
  <header>
    <p class="eyebrow">CALENDAR / ROOM BOOKINGS</p>
    <h2 id="calendar-month-demo-title">Room bookings</h2>
    <p>Each chip shows its room through the event snippet. Two bookings fit a day; "more events" opens that day.</p>
  </header>
  <CalendarView
    {events}
    {anchor}
    today="2026-11-05"
    bind:view
    timeZone="UTC"
    getTone={(occurrence) => occurrence.data?.tone ?? 'primary'}
    maxEventsPerDay={2}
    onMoreEvents={openDay}
    onOpen={(occurrence) => (status = `${occurrence.data?.title ?? 'Booking'} in ${occurrence.data?.room ?? 'a room'}.`)}
  >
    {#snippet event(item, { compact, time })}
      <span class="booking">
        <span class="booking__title">{item.title}</span>
        <span class="booking__meta">{item.data?.room}{compact ? '' : ` · ${time}`}</span>
      </span>
    {/snippet}
  </CalendarView>
  <p class="status" role="status">{status}</p>
</section>

<style>
  .tx-calendar-month-demo { display: grid; gap: .75rem; padding: 1rem; color: var(--tx-foreground, CanvasText); background: var(--tx-background, Canvas); }
  h2 { margin: .15rem 0 .25rem; font-size: 1.25rem; }
  p { max-inline-size: 42rem; margin: 0; color: var(--tx-muted-foreground, GrayText); font-size: .875rem; }
  .eyebrow { color: var(--tx-primary, Highlight); font-size: .7rem; font-weight: 700; letter-spacing: .08em; }
  .booking { display: grid; min-inline-size: 0; }
  .booking__title, .booking__meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .booking__title { font-weight: 600; }
  .booking__meta { color: var(--tx-muted-foreground, GrayText); font-size: .65rem; }
  .status { min-block-size: 1.25rem; }
</style>
