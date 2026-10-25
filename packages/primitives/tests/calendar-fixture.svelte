<script lang="ts">
import type { CalendarDate as CalendarDateType, CalendarIdentifier } from '@internationalized/date';
import { Calendar, CalendarDate } from '../src/calendar/index.ts';

let {
  maxValue = new CalendarDate(2024, 3, 20),
  calendar,
  locale,
  weekStartsOn,
  dir,
  defaultFocusedValue = new CalendarDate(2024, 2, 15),
  onValueChange,
}: {
  maxValue?: CalendarDateType;
  calendar?: CalendarIdentifier;
  locale?: string;
  weekStartsOn?: number;
  dir?: 'ltr' | 'rtl';
  defaultFocusedValue?: CalendarDateType;
  onValueChange?: (date: CalendarDateType) => void;
} = $props();

let value = $state<CalendarDate | null>(new CalendarDate(2024, 2, 15));
let events = $state(0);
</script>

<Calendar.Root
  bind:value
  {defaultFocusedValue}
  minValue={new CalendarDate(2024, 2, 10)}
  {maxValue}
  {calendar}
  {locale}
  {weekStartsOn}
  {dir}
  isDateUnavailable={(date) => date.compare(new CalendarDate(2024, 2, 16)) === 0}
  onValueChange={(date) => {
    events += 1;
    onValueChange?.(date);
  }}
  aria-label="Appointment date"
>
  <div>
    <Calendar.PrevButton>Previous</Calendar.PrevButton>
    <Calendar.Heading />
    <Calendar.NextButton>Next</Calendar.NextButton>
  </div>
  <Calendar.Grid />
  <output data-events>{events}</output>
</Calendar.Root>
