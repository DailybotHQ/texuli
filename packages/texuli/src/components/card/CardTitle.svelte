<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import './card.css';

type Props = HTMLAttributes<HTMLHeadingElement> & {
  /** Heading level so card titles fit the page outline. */
  level?: 2 | 3 | 4 | 5 | 6;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let { ref = $bindable(null), class: className, level = 3, children, ...rest }: Props = $props();
</script>

<svelte:element
  bind:this={ref}
  this={`h${level}`}
  class={cx('tx-card__title', className)}
  data-tx-card-title
  {...rest}
>
  {@render children?.()}
</svelte:element>
