<script lang="ts">
import { DatePicker } from '../../../src/date-picker/index.ts';
</script>

<DatePicker.Root locale="en-US">
  <DatePicker.Field label="Due date" />
  <DatePicker.Trigger id="due-trigger">Pick</DatePicker.Trigger>
  <DatePicker.Content id="due-calendar">
    <DatePicker.Calendar />
  </DatePicker.Content>
</DatePicker.Root>
