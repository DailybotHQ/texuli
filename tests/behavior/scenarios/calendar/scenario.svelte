<script lang="ts">
import { Calendar, CalendarDate } from '@texuli/primitives/calendar';
import { behaviorEvent } from '../../harness/client/events.ts';

let value = $state<CalendarDate | null>(new CalendarDate(2024, 7, 15));
</script>

<section dir="ltr" data-calendar-behavior>
  <Calendar.Root
    bind:value
    defaultFocusedValue={new CalendarDate(2024, 7, 15)}
    minValue={new CalendarDate(2024, 7, 5)}
    maxValue={new CalendarDate(2024, 8, 20)}
    isDateUnavailable={(date) => date.compare(new CalendarDate(2024, 7, 20)) === 0}
    onValueChange={(next) => behaviorEvent('valueChange', next.toString())}
  >
    <div class="calendar-toolbar">
      <Calendar.PrevButton>Previous month</Calendar.PrevButton>
      <Calendar.Heading />
      <Calendar.NextButton>Next month</Calendar.NextButton>
    </div>
    <Calendar.Grid />
  </Calendar.Root>
</section>

<style>
  .calendar-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  :global([data-calendar-behavior] table) {
    border-collapse: collapse;
  }
  :global([data-calendar-behavior] th),
  :global([data-calendar-behavior] td) {
    min-inline-size: 2.5rem;
    padding: 0.25rem;
    text-align: center;
  }
  :global([data-calendar-behavior] button) {
    min-inline-size: 2rem;
    min-block-size: 2rem;
  }
</style>
