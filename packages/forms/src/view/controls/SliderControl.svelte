<script lang="ts">
import { Slider } from 'texuli/slider';
import type { SchemaFormControlProps } from './types.ts';

let { field, value, attrs, disabled, readOnly, onValue }: SchemaFormControlProps = $props();
const min = $derived(typeof field.min === 'number' ? field.min : 0);
</script>

<Slider
  {...attrs}
  name={field.name}
  value={typeof value === 'number' ? value : min}
  {min}
  max={typeof field.max === 'number' ? field.max : 100}
  step={field.step ?? 1}
  thumbLabel={field.label}
  showValue
  disabled={disabled || readOnly}
  onValueChange={(next) => onValue(Array.isArray(next) ? next[0] : next)}
/>
