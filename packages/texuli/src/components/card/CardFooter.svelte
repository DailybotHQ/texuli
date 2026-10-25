<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import './card.css';

type Props = HTMLAttributes<HTMLDivElement> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let { ref = $bindable(null), class: className, children, ...rest }: Props = $props();
</script>

<div bind:this={ref}
  class={cx('tx-card__footer', className)}
  data-tx-card-footer
  {...rest}
>
  {@render children?.()}
</div>
