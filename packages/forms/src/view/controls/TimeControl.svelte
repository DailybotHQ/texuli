<script lang="ts">
import { TimeField } from 'texuli/date';
import type { SchemaFormControlProps } from './types.ts';

let { field, value, attrs, required, disabled, readOnly, onValue }: SchemaFormControlProps =
  $props();
</script>

<TimeField
  {...attrs}
  label={field.label}
  name={field.name}
  value={typeof value === 'string' ? value : null}
  {required}
  disabled={disabled || readOnly}
  onValueChange={(next) => onValue(next)}
/>
