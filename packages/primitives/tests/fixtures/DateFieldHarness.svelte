<script lang="ts">
import { DateField, TimeField } from '@texuli/primitives/date-field';

let date = $state<string | null>('2024-02-29');
let time = $state<string | null>('17:05');
</script>

<output aria-label="Selected date">{date ?? ''}</output>
<output aria-label="Selected time">{time ?? ''}</output>
<DateField.Root bind:value={date} locale="en-US" label="Appointment date" name="date" />
<TimeField.Root bind:value={time} locale="en-US" label="Appointment time" name="time" />
