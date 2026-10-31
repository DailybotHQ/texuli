<script lang="ts">
import { RadioGroup } from 'texuli/choice';
import type { SchemaFormControlProps } from './types.ts';

let { field, value, attrs, required, disabled, readOnly, onValue }: SchemaFormControlProps =
  $props();
</script>

<RadioGroup
  {...attrs}
  name={field.name}
  value={typeof value === 'string' ? value : ''}
  items={field.options ?? []}
  {required}
  disabled={disabled || readOnly}
  onValueChange={(next) => onValue(next)}
/>
