<script lang="ts">
import { CalendarDate } from '@texuli/primitives/calendar';
import { Calendar, DatePicker, DateRangePicker } from 'texuli/date';

// A fixed "today" keeps the presets and captures deterministic. Fictional data only.
const today = '2026-03-15';
let day = $state<string | null>('2026-03-12');
let due = $state<string | null>('2026-03-20');
let empty = $state<string | null>(null);
let stay = $state({ start: '2026-03-09', end: '2026-03-15' } as {
  start: string | null;
  end: string | null;
});
const holiday = (date: CalendarDate) => date.compare(new CalendarDate(2026, 3, 18)) === 0;
</script>

<section class="demo" data-example="texuli-date" aria-labelledby="date-title">
  <h2 id="date-title">Dates</h2>

  <h3>Calendar</h3>
  <Calendar
    bind:value={day}
    label="Delivery day"
    minValue="2026-03-02"
    maxValue="2026-03-27"
    isDateUnavailable={holiday}
  />

  <h3>Date pickers</h3>
  <div class="row">
    <DatePicker label="Due date" bind:value={due} description="Shown on the invoice." />
    <DatePicker label="Start date" bind:value={empty} size="sm" required />
  </div>
  <div class="row">
    <DatePicker label="Renewal" value="2026-02-30" error="Choose a real date." />
    <DatePicker label="Signed on" value="2026-01-08" disabled />
  </div>

  <h3>Range with presets</h3>
  <DateRangePicker label="Report period" bind:value={stay} presets {today} description="Up to 90 days." />

  <h3>Right to left</h3>
  <div dir="rtl" lang="ar">
    <Calendar
      value="2026-03-12"
      locale="ar-EG"
      label="يوم التسليم"
      previousLabel="الشهر السابق"
      nextLabel="الشهر التالي"
      size="sm"
    />
  </div>
</section>

<style>
  .demo {
    box-sizing: border-box;
    min-inline-size: 0;
    max-inline-size: min(100%, 40rem);
    display: grid;
    gap: 1rem;
    padding: 1rem;
  }
  .demo h2,
  .demo h3 {
    margin: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
</style>
