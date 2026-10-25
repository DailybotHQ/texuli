<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import { contentBehavior } from './content-behavior.ts';
import { navigationMenuContext, navigationMenuItemContext } from './context.ts';

interface ContentProps {
  /** Consumer id for the content; the trigger's `aria-controls` follows it. */
  id?: string;
  class?: string;
  children?: Snippet;
}

let { id, class: className, children }: ContentProps = $props();
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
  });
  return () => context.contents.delete(value);
});
</script>

{#if open && !context.viewport}
  <div
    id={context.contentId(item.value)}
    class={className}
    data-state="open"
    data-motion={context.motion}
    aria-labelledby={context.triggerId(item.value)}
    role="group"
    {@attach contentBehavior(context, item.value)}
  >
    {@render children?.()}
  </div>
{/if}
