<script lang="ts">
// DatePicker and DateRangePicker scenario: @texuli/primitives/date-picker.
import { DatePicker, type DateRange, DateRangePicker } from '@texuli/primitives/date-picker';
import { behaviorEvent } from '../../harness/client/events.ts';

let due = $state<string | null>('2026-03-15');
let stay = $state<DateRange>({ start: null, end: null });
// The empty range opens on today: pin it so the range row never depends on
// the clock (a range started on the last days of a month spills into the
// next month, which one grid cannot show).
</script>

<section class="behavior-date-picker" dir="ltr">
  <div class="behavior-row">
    <DatePicker.Root
      bind:value={due}
      locale="en-US"
      onValueChange={(next) => behaviorEvent('valueChange', next)}
      labels={{ trigger: 'Choose due date', triggerWithValue: 'Choose due date', dialog: 'Due date calendar' }}
    >
      <DatePicker.Field label="Due date" />
      <DatePicker.Trigger>📅</DatePicker.Trigger>
      <DatePicker.Content class="behavior-calendar" data-behavior-layer>
        <DatePicker.Calendar />
      </DatePicker.Content>
    </DatePicker.Root>
  </div>
  <div class="behavior-row">
    <DateRangePicker.Root
      bind:value={stay}
      locale="en-US"
      today="2026-03-10"
      onValueChange={(next) => behaviorEvent('rangeChange', `${next.start}/${next.end}`)}
      labels={{ trigger: 'Choose stay dates', triggerWithValue: 'Choose stay dates', dialog: 'Stay calendar' }}
    >
      <DateRangePicker.Field label="Stay" />
      <DateRangePicker.Trigger>📅</DateRangePicker.Trigger>
      <DateRangePicker.Content class="behavior-calendar" data-behavior-range-layer>
        <DateRangePicker.Calendar />
      </DateRangePicker.Content>
    </DateRangePicker.Root>
  </div>
  <output data-behavior-due>{due ?? ''}</output>
  <output data-behavior-stay>{stay.start ?? ''}/{stay.end ?? ''}</output>
</section>

<style>
  .behavior-date-picker {
    display: grid;
    gap: 1rem;
  }
  .behavior-row {
    display: flex;
    gap: 0.5rem;
    align-items: end;
  }
  :global(.behavior-calendar) {
    padding: 0.5rem;
    border: 1px solid CanvasText;
    background: Canvas;
    color: CanvasText;
  }
</style>
