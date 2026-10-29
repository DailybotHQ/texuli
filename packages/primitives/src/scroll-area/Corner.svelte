<script lang="ts">
import { composeChildProps } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { overflowX, overflowY, scrollAreaContext } from './context.ts';
import type { ScrollAreaCornerProps } from './types.ts';

let {
  class: className,
  children,
  child,
  forceMount = false,
  ref = $bindable(null),
  ...rest
}: RefProp & ScrollAreaCornerProps & Record<string, unknown> = $props();

const context = scrollAreaContext.get();
const shown = $derived(overflowX(context.metrics) && overflowY(context.metrics));

const cornerProps = $derived({
  ...rest,
  class: typeof className === 'string' ? className : undefined,
  'data-tx-scroll-area-corner': '',
  'data-state': shown ? 'visible' : 'hidden',
  'aria-hidden': 'true' as const,
  hidden: shown ? undefined : true,
});
</script>

{#if shown || forceMount}
  {#if child}
    {@render child({ props: composeChildProps(cornerProps, {}) })}
  {:else}
    <div bind:this={ref} {...cornerProps}>
      {@render children?.()}
    </div>
  {/if}
{/if}
