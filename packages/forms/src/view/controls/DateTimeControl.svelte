<script lang="ts">
import { DatePicker, TimeField } from 'texuli/date';
import type { SchemaFormControlProps } from './types.ts';

/*
 * A local date and time (`YYYY-MM-DDTHH:MM`) as a DatePicker and a TimeField
 * side by side. Each is named by the field label and its own part ("Starts
 * Date", "Starts Time"). The value is set once both parts are there; a
 * half-filled answer reads as empty.
 */

let { field, value, attrs, required, disabled, readOnly, labels, onValue }: SchemaFormControlProps =
  $props();

const id = $derived(String(attrs.id ?? field.name));
const text = $derived(typeof value === 'string' && value.length === 16 ? value : '');
let date = $state<string | null>(null);
let time = $state<string | null>(null);

// An outside value (a default, a reset, a restored draft) fills both parts.
$effect(() => {
  if (text) {
    date = text.slice(0, 10);
    time = text.slice(11);
  } else if (value === null && date !== null && time !== null) {
    date = null;
    time = null;
  }
});

function update(nextDate: string | null, nextTime: string | null): void {
  date = nextDate;
  time = nextTime;
  onValue(nextDate && nextTime ? `${nextDate}T${nextTime}` : null);
}

const bound = (edge: unknown) => (typeof edge === 'string' ? edge.slice(0, 10) : undefined);
const { id: _id, ...shared } = $derived(attrs);
</script>

<div class="tx-forms__datetime" data-tx-forms-datetime="">
  <span class="tx-forms__visually-hidden" id={`${id}-date-label`}>{labels.date}</span>
  <span class="tx-forms__visually-hidden" id={`${id}-time-label`}>{labels.time}</span>
  <DatePicker
    {...shared}
    id={id}
    aria-labelledby={`${id}-label ${id}-date-label`}
    label={labels.date}
    name={`${field.name}-date`}
    value={date}
    minValue={bound(field.min)}
    maxValue={bound(field.max)}
    {required}
    disabled={disabled || readOnly}
    onValueChange={(next) => update(next, time)}
  />
  <TimeField
    {...shared}
    id={`${id}-time`}
    aria-labelledby={`${id}-label ${id}-time-label`}
    label={labels.time}
    name={`${field.name}-time`}
    value={time}
    {required}
    disabled={disabled || readOnly}
    onValueChange={(next) => update(date, next)}
  />
</div>
