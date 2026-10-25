<script lang="ts">
import { untrack } from 'svelte';
import type { HTMLInputAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import { controlAttributes } from './attributes.ts';
import { fieldContext } from './context.ts';

/**
 * The field control. Without `child` it renders an `<input>` (bind `value`);
 * with `child` it hands the wiring to any control: `<textarea>`, `<select>`
 * or another primitive's trigger. The field's id, description, error,
 * `aria-invalid`, required and disabled state stay authoritative. A consumer
 * `id` is kept, and the label and references follow it.
 */
type FieldControlProps = HTMLInputAttributes & {
  child?: ChildSnippet<Record<string, unknown>>;
};

let {
  child,
  value = $bindable(),
  'aria-describedby': describedBy,
  ...rest
}: FieldControlProps = $props();
const field = fieldContext.get();
// A consumer id wins: the context records it, so every reference follows.
field.claimId(
  'control',
  untrack(() => rest.id)
);
$effect(() => {
  field.claimId('control', rest.id);
  return () => field.claimId('control', undefined);
});

const wiring = $derived(controlAttributes(field, describedBy ?? undefined));
// The field's wiring wins over same-named author props; an author's own
// `disabled` or `required` still applies when the field does not set it.
const controlProps = $derived({
  ...rest,
  ...wiring,
  disabled: wiring.disabled ?? rest.disabled,
  required: wiring.required ?? rest.required,
});
</script>

{#if child}
  {@render child({ props: controlProps })}
{:else}
  <input {...controlProps} bind:value />
{/if}
