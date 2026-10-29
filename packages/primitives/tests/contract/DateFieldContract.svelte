<script lang="ts">
import { DateField, TimeField } from '../../src/date-field/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<DateField.Root locale="en-US" value="2026-03-10" {...p('date-field/DateField')} bind:ref={refs['date-field/DateField']} />
<TimeField.Root locale="en-US" value="09:30" {...p('date-field/TimeField')} bind:ref={refs['date-field/TimeField']} />
