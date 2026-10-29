<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { contentBehavior } from './content-behavior.ts';
import { navigationMenuContext, navigationMenuItemContext } from './context.ts';

type ContentProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> & {
  /** Consumer id for the content; the trigger's `aria-controls` follows it. */
  id?: string;
  class?: string;
  children?: Snippet;
} & RefProp;

let { id, class: className, children, ref = $bindable(null), ...rest }: ContentProps = $props();

// The element renders here or in the Viewport; either way `ref` follows it.
function bindRef(node: HTMLElement): () => void {
  ref = node;
  return () => {
    if (ref === node) ref = null;
  };
}
const context = navigationMenuContext.get();
const item = navigationMenuItemContext.get();
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'content',
  untrack(() => item.value),
  untrack(() => id)
);
$effect(() => {
  const value = item.value;
  context.claimId('content', value, id);
  return () => context.claimId('content', value, undefined);
});
const open = $derived(context.value === item.value);

// With a Viewport, the content is registered and the viewport renders it.
$effect(() => {
  if (!context.viewport) return;
  const value = item.value;
  context.contents.set(value, {
    id: context.contentId(value),
    class: className,
    children,
    attributes: rest,
    attach: bindRef,
  });
  return () => context.contents.delete(value);
});
</script>

{#if open && !context.viewport}
  <div
    {...rest}
    id={context.contentId(item.value)}
    class={className}
    data-state="open"
    data-motion={context.motion}
    aria-labelledby={context.triggerId(item.value)}
    role="group"
    {@attach contentBehavior(context, item.value)}
    {@attach bindRef}
  >
    {@render children?.()}
  </div>
{/if}
