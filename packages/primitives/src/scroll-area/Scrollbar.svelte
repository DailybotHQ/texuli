<script lang="ts">
import { composeChildProps } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { scrollAreaContext } from './context.ts';
import type { ScrollAreaOrientation, ScrollAreaScrollbarProps } from './types.ts';

let {
  orientation,
  forceMount = false,
  class: className,
  children,
  child,
  ref = $bindable(null),
  ...rest
}: RefProp & ScrollAreaScrollbarProps & Record<string, unknown> = $props();

const context = scrollAreaContext.get();
const shown = $derived(forceMount || context.scrollbarVisible(orientation));

const scrollbarProps = $derived({
  ...rest,
  class: typeof className === 'string' ? className : undefined,
  'data-tx-scroll-area-scrollbar': '',
  'data-orientation': orientation as ScrollAreaOrientation,
  'data-state': shown ? 'visible' : 'hidden',
  // Decorative chrome; viewport owns keyboard and AT scrolling.
  'aria-hidden': 'true' as const,
  hidden: shown ? undefined : true,
});
</script>

{#if shown || forceMount}
  {#if child}
    {@render child({ props: composeChildProps(scrollbarProps, {}) })}
  {:else}
    <div bind:this={ref} {...scrollbarProps}>
      {@render children?.()}
    </div>
  {/if}
{/if}
