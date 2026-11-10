<script lang="ts">
import { Checkbox } from 'texuli/choice';
import type { SchemaFormControlProps } from './types.ts';

let { field, value, attrs, disabled, readOnly, onValue }: SchemaFormControlProps = $props();
const selected = $derived(
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
);

function toggle(option: string, checked: boolean): void {
  const next = checked
    ? [...selected.filter((item) => item !== option), option]
    : selected.filter((item) => item !== option);
  onValue(field.options?.map((item) => item.value).filter((item) => next.includes(item)) ?? next);
}
</script>

<div class="tx-forms__choices" id={attrs.id as string | undefined}>
  {#each field.options ?? [] as option, index (option.value)}
    <Checkbox
      id={index === 0 ? `${String(attrs.id)}-first` : undefined}
      label={option.label}
      description={option.description}
      checked={selected.includes(option.value)}
      disabled={disabled || readOnly}
      aria-invalid={attrs['aria-invalid'] as 'true' | undefined}
      aria-describedby={attrs['aria-describedby'] as string | undefined}
      onCheckedChange={(checked) => toggle(option.value, checked)}
    />
  {/each}
</div>
