<script lang="ts">
import {
  type ChildSnippet,
  composeChildProps,
  type PrimitiveState,
  stateAttributes,
} from '../internal/index.ts';
import type { ProgressRootProps } from './types.ts';

/**
 * Headless progress root: determinate and indeterminate `role="progressbar"`
 * with live value updates (APG).
 */
let {
  value = 0,
  max = 100,
  min = 0,
  child,
  children,
  ref = $bindable(null),
  class: className,
  ...rest
}: ProgressRootProps = $props();

const indeterminate = $derived(value === null);
const clamped = $derived(
  indeterminate
    ? undefined
    : Math.min(
        max,
        Math.max(min, typeof value === 'number' && Number.isFinite(value) ? value : min)
      )
);
const state = $derived(
  (indeterminate
    ? 'indeterminate'
    : (clamped as number) >= max
      ? 'complete'
      : 'loading') as PrimitiveState
);

const rootProps = $derived({
  role: 'progressbar' as const,
  'aria-valuemin': min,
  'aria-valuemax': max,
  ...(indeterminate || clamped === undefined ? {} : { 'aria-valuenow': clamped }),
  ...stateAttributes(state),
  'data-value': indeterminate || clamped === undefined ? undefined : String(clamped),
  'data-max': String(max),
  'data-min': String(min),
  class: typeof className === 'string' ? className : undefined,
  ...rest,
});
</script>

{#if child}
  {@const props = composeChildProps(rootProps, {})}
  {@render child({ props })}
{:else}
  <div bind:this={ref} {...rootProps}>
    {@render children?.()}
  </div>
{/if}
