<script lang="ts">
import { untrack } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { getDialogContext } from './context.ts';

type Props = Omit<HTMLButtonAttributes, 'children'> & {
  children?: import('svelte').Snippet;
  child?: ChildSnippet<Record<string, unknown>>;
} & RefProp;
type ButtonClickEvent = Parameters<NonNullable<HTMLButtonAttributes['onclick']>>[0];

let { children, child, onclick, type = 'button', ref = $bindable(null), ...rest }: Props = $props();
const context = getDialogContext();
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'trigger',
  untrack(() => rest.id)
);
$effect(() => {
  context.claimId('trigger', rest.id);
  return () => context.claimId('trigger', undefined);
});

function register(node: HTMLButtonElement): () => void {
  context.registerTrigger(node);
  return () => context.registerTrigger(undefined);
}

function handleClick(event: ButtonClickEvent): void {
  onclick?.(event);
  if (event.defaultPrevented || rest.disabled) return;
  context.toggle(event);
}

const triggerProps = $derived({
  ...rest,
  id: context.triggerId,
  type,
  'aria-haspopup': 'dialog' as const,
  'aria-expanded': context.open,
  'aria-controls': context.contentId,
  'data-state': context.open ? 'open' : 'closed',
  onclick: handleClick,
});
</script>

{#if child}
  {@render child({ props: triggerProps })}
{:else}
  <button bind:this={ref} {...triggerProps} {@attach register}>
    {@render children?.()}
  </button>
{/if}
