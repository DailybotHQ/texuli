<script lang="ts">
import type { CalendarDate } from '@texuli/date';
import { DatePicker, type DateRange, DateRangePicker } from '../../src/date-picker/index.ts';

interface Props {
  value?: string | null;
  range?: DateRange;
  open?: boolean;
  rangeOpen?: boolean;
  minValue?: string;
  maxValue?: string;
  isDateUnavailable?: (date: CalendarDate) => boolean;
  closeOnSelect?: boolean;
  labels?: Record<string, string>;
}

let {
  value = $bindable('2026-03-15'),
  range = $bindable({ start: null, end: null }),
  open = $bindable(false),
  rangeOpen = $bindable(false),
  minValue,
  maxValue,
  isDateUnavailable,
  closeOnSelect = true,
  labels = {},
}: Props = $props();
</script>

<DatePicker.Root
  bind:value
  bind:open
  locale="en-US"
  {...minValue ? { minValue } : {}}
  {...maxValue ? { maxValue } : {}}
  {...isDateUnavailable ? { isDateUnavailable } : {}}
  {closeOnSelect}
  {labels}
>
  <DatePicker.Field label="Due date" name="due" />
  <DatePicker.Trigger>Pick</DatePicker.Trigger>
  <DatePicker.Content>
    <DatePicker.Calendar />
  </DatePicker.Content>
</DatePicker.Root>

<DateRangePicker.Root
  bind:value={range}
  bind:open={rangeOpen}
  locale="en-US"
  labels={{ trigger: 'Choose stay', triggerWithValue: 'Choose stay, {date}', dialog: 'Choose stay dates' }}
>
  <DateRangePicker.Field label="Stay" startName="from" endName="to" />
  <DateRangePicker.Trigger>Pick range</DateRangePicker.Trigger>
  <DateRangePicker.Content>
    <DateRangePicker.Calendar />
  </DateRangePicker.Content>
</DateRangePicker.Root>

<output data-testid="state">{JSON.stringify({ value, range, open, rangeOpen })}</output>
