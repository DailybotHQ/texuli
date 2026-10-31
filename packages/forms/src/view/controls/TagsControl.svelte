<script lang="ts">
import { TagsInput } from 'texuli/tags-color';
import type { SchemaFormControlProps } from './types.ts';

let { field, value, attrs, required, disabled, readOnly, labels, onValue }: SchemaFormControlProps =
  $props();
const strings = $derived(
  Array.isArray(value)
    ? (value as readonly unknown[]).filter((item): item is string => typeof item === 'string')
    : []
);
</script>

<TagsInput
  {...attrs}
  name={field.name}
  value={[...strings]}
  max={field.maxItems}
  {required}
  disabled={disabled || readOnly}
  placeholder={field.placeholder}
  inputLabel={labels.tagsInput}
  onValueChange={(next) => onValue(next)}
/>
