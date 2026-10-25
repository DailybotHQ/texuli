<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { contentBehavior } from './content-behavior.ts';
import { navigationMenuContext } from './context.ts';

let { ...rest }: HTMLAttributes<HTMLDivElement> = $props();
const context = navigationMenuContext.get();
context.viewport = true;
$effect(() => () => {
  context.viewport = false;
});

const entry = $derived(context.value ? context.contents.get(context.value) : undefined);
let size = $state({ width: 0, height: 0 });

// Expose the open content's size for animated resizing.
function measure(node: HTMLElement) {
  const view = node.ownerDocument.defaultView;
  if (!view || typeof view.ResizeObserver === 'undefined') return;
  const observer = new view.ResizeObserver(() => {
    size = { width: node.offsetWidth, height: node.offsetHeight };
  });
  observer.observe(node);
  return () => observer.disconnect();
}
</script>

<div
  data-state={entry ? 'open' : 'closed'}
  data-orientation={context.orientation}
  style:--tx-navigation-menu-viewport-width={`${size.width}px`}
  style:--tx-navigation-menu-viewport-height={`${size.height}px`}
  {...rest}
>
  {#if entry}
    {#key entry.id}
      <div
        id={entry.id}
        class={entry.class}
        data-state="open"
        data-motion={context.motion}
        aria-labelledby={context.triggerId(context.value)}
        role="group"
        {@attach contentBehavior(context, context.value)}
        {@attach measure}
      >
        {@render entry.children?.()}
      </div>
    {/key}
  {/if}
</div>
