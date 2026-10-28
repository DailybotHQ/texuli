<script lang="ts">
import { Calendar, CalendarDate } from '../../src/calendar/index.ts';
import { DateRangePicker, provideDateRange } from '../../src/date-picker/index.ts';

/** A range grid outside a picker: the range state comes from `provideDateRange`. */
interface Props {
  onkeydown?: (event: KeyboardEvent) => void;
}

let { onkeydown }: Props = $props();
let start = $state<string | null>('2026-03-10');
let end = $state<string | null>('2026-03-12');

provideDateRange({
  get start() {
    return start;
  },
  get end() {
    return end;
  },
  pending: false,
  setStart(next) {
    start = next;
  },
  setEnd(next) {
    end = next;
  },
  pick() {},
});
</script>

<Calendar.Root
  value={null}
  defaultFocusedValue={new CalendarDate(2026, 3, 11)}
  today={new CalendarDate(2026, 3, 11)}
  locale="en-US"
>
  <DateRangePicker.Grid {onkeydown} />
</Calendar.Root>
