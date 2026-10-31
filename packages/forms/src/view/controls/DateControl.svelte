<script lang="ts">
import { DatePicker } from 'texuli/date';
import type { SchemaFormControlProps } from './types.ts';

let { field, value, attrs, required, disabled, readOnly, onValue }: SchemaFormControlProps =
  $props();
</script>

<DatePicker
  {...attrs}
  label={field.label}
  name={field.name}
  value={typeof value === 'string' ? value : null}
  minValue={typeof field.min === 'string' ? field.min : undefined}
  maxValue={typeof field.max === 'string' ? field.max : undefined}
  {required}
  disabled={disabled || readOnly}
  onValueChange={(next) => onValue(next)}
/>
