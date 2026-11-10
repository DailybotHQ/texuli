<script lang="ts">
import { Checkbox } from 'texuli/choice';
import type { SchemaFormControlProps } from './types.ts';

let { field, value, attrs, required, disabled, readOnly, onValue }: SchemaFormControlProps =
  $props();
</script>

<Checkbox
  {...attrs}
  label={field.label}
  description={field.description}
  checked={value === true}
  {required}
  disabled={disabled || readOnly}
  onCheckedChange={(checked) => onValue(checked)}
/>
