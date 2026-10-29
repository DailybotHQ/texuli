<script lang="ts">
import { Calendar, CalendarDate } from '../../src/calendar/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
const today = new CalendarDate(2026, 3, 10);
</script>

<Calendar.Root {today} defaultFocusedValue={today} {...p('calendar/Root')} bind:ref={refs['calendar/Root']}>
  <Calendar.PrevButton {...p('calendar/PrevButton')} bind:ref={refs['calendar/PrevButton']} />
  <Calendar.Heading {...p('calendar/Heading')} bind:ref={refs['calendar/Heading']} />
  <Calendar.NextButton {...p('calendar/NextButton')} bind:ref={refs['calendar/NextButton']} />
  <Calendar.Grid {...p('calendar/Grid')} bind:ref={refs['calendar/Grid']} />
</Calendar.Root>
