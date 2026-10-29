<script lang="ts">
import { Calendar, CalendarDate } from '../../src/calendar/index.ts';
import { DateRangePicker, provideDateRange } from '../../src/date-picker/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
let range = $state({ start: '2026-03-10' as string | null, end: '2026-03-12' as string | null });
let pending = $state(false);
provideDateRange({
  get start() {
    return range.start;
  },
  get end() {
    return range.end;
  },
  get pending() {
    return pending;
  },
  get message() {
    return '';
  },
  setStart(next) {
    range.start = next;
  },
  setEnd(next) {
    range.end = next;
  },
  pick(date) {
    pending = !pending;
    range = pending ? { start: date, end: null } : { start: range.start, end: date };
  },
});
const today = new CalendarDate(2026, 3, 10);
</script>

<Calendar.Root value={null} {today} defaultFocusedValue={today}>
  <DateRangePicker.Grid {...p('date-picker/RangeGrid')} bind:ref={refs['date-picker/RangeGrid']} />
</Calendar.Root>
