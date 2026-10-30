<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { type FeedbackSize, skeletonClass } from './variants.ts';
import './feedback.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = HTMLAttributes<HTMLDivElement> & {
  /** Height preset for text-like bars. */
  size?: FeedbackSize;
  /** Round avatar-style placeholder. */
  circle?: boolean;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let {
  ref = $bindable(null),
  size: sizeProp,
  circle = false,
  class: className,
  ...rest
}: Props = $props();
const txDefaults = designDefaults('skeleton');
const size = $derived(withDefault(sizeProp, txDefaults().size, 'md'));
</script>

<div bind:this={ref}
  class={skeletonClass({
    size,
    class: cx(circle && 'tx-skeleton--circle', className),
  })}
  aria-hidden="true"
  data-tx-skeleton
  data-size={size}
  data-circle={circle ? 'true' : undefined}
  {...rest}
></div>
