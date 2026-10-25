<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import './card.css';

type Props = HTMLAttributes<HTMLParagraphElement> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let { ref = $bindable(null), class: className, children, ...rest }: Props = $props();
</script>

<p bind:this={ref}
  class={cx('tx-card__description', className)}
  data-tx-card-description
  {...rest}
>
  {@render children?.()}
</p>
