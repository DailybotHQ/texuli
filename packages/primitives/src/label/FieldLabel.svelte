<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLLabelAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { fieldDataAttributes } from './attributes.ts';
import { fieldContext } from './context.ts';
import LabelRoot from './LabelRoot.svelte';

/** The field's label: `for` the field control, with its own id (a consumer `id` wins). */
type FieldLabelProps = Omit<HTMLLabelAttributes, 'for'> & {
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
};

let { child, children, ref = $bindable(null), ...rest }: FieldLabelProps & RefProp = $props();
const field = fieldContext.get();
// A consumer id wins: the context records it, so every reference follows.
field.claimId(
  'label',
  untrack(() => rest.id)
);
$effect(() => {
  field.claimId('label', rest.id);
  return () => field.claimId('label', undefined);
});
</script>

<LabelRoot bind:ref {...rest} for={field.controlId} id={field.labelId} {...fieldDataAttributes(field)} {child} {children} />
