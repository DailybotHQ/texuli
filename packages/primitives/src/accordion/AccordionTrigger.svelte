<script lang="ts">
import { untrack } from 'svelte';
import { itemContext, partAttributes } from './context.ts';
import type { AccordionTriggerProps } from './types.ts';

let { child, children, ref = $bindable(null), onclick, ...rest }: AccordionTriggerProps = $props();

const item = itemContext.get();
// A consumer id wins: the context records it, so every reference follows.
item.claimId(
  'trigger',
  untrack(() => rest.id)
);
$effect(() => {
  item.claimId('trigger', rest.id);
  return () => item.claimId('trigger', undefined);
});

function handleClick(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
  (onclick as ((e: MouseEvent) => void) | undefined)?.(event);
  if (event.defaultPrevented || item.disabled) return;
  item.toggle();
}

const partProps = $derived({
  ...rest,
  ...partAttributes(item),
  type: 'button' as const,
  id: item.triggerId,
  'aria-expanded': item.open ? ('true' as const) : ('false' as const),
  'aria-controls': item.contentId,
  // APG: the open panel of a non-collapsible accordion cannot be closed.
  'aria-disabled': item.open && !item.canClose ? ('true' as const) : undefined,
  disabled: item.disabled || undefined,
  'data-tx-accordion-trigger': '',
  onclick: handleClick,
});
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <button bind:this={ref} {...partProps}>{@render children?.()}</button>
{/if}
