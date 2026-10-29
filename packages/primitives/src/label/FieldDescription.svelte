<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { fieldContext } from './context.ts';

/** Help text the control is described by while this part is mounted. */
type FieldDescriptionProps = HTMLAttributes<HTMLElement> & {
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
};

let { child, children, ref = $bindable(null), ...rest }: FieldDescriptionProps & RefProp = $props();
const field = fieldContext.get();
// A consumer id wins: the context records it, so every reference follows.
field.claimId(
  'description',
  untrack(() => rest.id)
);
$effect(() => {
  field.claimId('description', rest.id);
  return () => field.claimId('description', undefined);
});
$effect(() => field.registerDescription());

const partProps = $derived({ ...rest, id: field.descriptionId, 'data-field-description': '' });
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <p bind:this={ref} {...partProps}>{@render children?.()}</p>
{/if}
