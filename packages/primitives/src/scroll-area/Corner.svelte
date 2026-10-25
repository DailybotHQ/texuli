<script lang="ts">
import { composeChildProps } from '../internal/child.ts';
import { overflowX, overflowY, scrollAreaContext } from './context.ts';
import type { ScrollAreaCornerProps } from './types.ts';

let {
  class: className,
  children,
  child,
  ...rest
}: ScrollAreaCornerProps & Record<string, unknown> = $props();

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

{#if shown}
  {#if child}
    {@render child({ props: composeChildProps(cornerProps, {}) })}
  {:else}
    <div {...cornerProps}>
      {@render children?.()}
    </div>
  {/if}
{/if}
