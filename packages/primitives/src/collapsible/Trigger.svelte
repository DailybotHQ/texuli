<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { collapsibleContext } from './context.ts';

type TriggerProps = HTMLButtonAttributes & {
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
};

let {
  child,
  children,
  disabled = false,
  ref = $bindable(null),
  ...rest
}: TriggerProps & RefProp = $props();

const context = collapsibleContext.get();
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'trigger',
  untrack(() => rest.id)
);
$effect(() => {
  context.claimId('trigger', rest.id);
  return () => context.claimId('trigger', undefined);
});
const effectiveDisabled = $derived(disabled || context.disabled);
const baseProps = $derived({
  type: 'button' as const,
  id: context.triggerId,
  disabled: effectiveDisabled,
  'aria-expanded': context.open,
  'aria-controls': context.contentId,
  'data-state': context.open ? 'open' : 'closed',
  'data-disabled': effectiveDisabled ? '' : undefined,
  onclick: () => {
    if (!effectiveDisabled) context.toggle();
  },
});
const triggerProps = $derived(composeChildProps(baseProps, rest as Partial<typeof baseProps>));
</script>

{#if child}
  {@render child({ props: triggerProps })}
{:else}
  <button bind:this={ref} {...triggerProps}>
    {@render children?.()}
  </button>
{/if}
