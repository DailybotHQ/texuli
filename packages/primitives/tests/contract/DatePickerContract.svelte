<script lang="ts">
import { DatePicker, DateRangePicker } from '../../src/date-picker/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs, variant = 'single' }: HarnessProps = $props();
</script>

{#if variant === 'single'}
  <DatePicker.Root open value="2026-03-10" today="2026-03-10">
    <DatePicker.Field label="Due" {...p('date-picker/DatePickerField')} bind:ref={refs['date-picker/DatePickerField']} />
    <DatePicker.Trigger {...p('date-picker/Trigger')} bind:ref={refs['date-picker/Trigger']}>Pick</DatePicker.Trigger>
    <DatePicker.Content {...p('date-picker/Content')} bind:ref={refs['date-picker/Content']}>
      <DatePicker.Calendar {...p('date-picker/DatePickerCalendar')} bind:ref={refs['date-picker/DatePickerCalendar']} />
    </DatePicker.Content>
  </DatePicker.Root>
{:else}
  <DateRangePicker.Root open value={{ start: '2026-03-10', end: '2026-03-12' }} today="2026-03-10">
    <DateRangePicker.Field label="Stay" {...p('date-picker/DateRangePickerField')} bind:ref={refs['date-picker/DateRangePickerField']} />
    <DateRangePicker.Trigger>Pick</DateRangePicker.Trigger>
    <DateRangePicker.Content>
      <DateRangePicker.Calendar {...p('date-picker/DateRangePickerCalendar')} bind:ref={refs['date-picker/DateRangePickerCalendar']} />
    </DateRangePicker.Content>
  </DateRangePicker.Root>
{/if}
