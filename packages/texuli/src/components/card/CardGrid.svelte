<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { type CardGridGap, cardGridClass } from './variants.ts';
import './card.css';

type Props = HTMLAttributes<HTMLElement> & {
  /** Minimum card width before the grid adds a column (CSS length). */
  minItemWidth?: string;
  gap?: CardGridGap;
  /** Use `ul` when children are list items. */
  as?: 'div' | 'ul' | 'section';
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let {
  ref = $bindable(null),
  minItemWidth = '16rem',
  gap = 'md',
  as = 'div',
  class: className,
  children,
  ...rest
}: Props = $props();

// Only allow simple CSS lengths so authors cannot inject declarations.
const SAFE_LENGTH = /^(?:\d*\.?\d+)(?:%|px|rem|em|ch|cqw|cqmin|cqmax)$/;
const safeMin = $derived(SAFE_LENGTH.test(minItemWidth.trim()) ? minItemWidth.trim() : '16rem');
const gridStyle = $derived(
  `grid-template-columns: repeat(auto-fill, minmax(min(100%, ${safeMin}), 1fr))`
);
</script>

<svelte:element
  bind:this={ref}
  this={as}
  class={cardGridClass({
    gap,
    class: className,
  })}
  style={gridStyle}
  data-tx-card-grid
  {...rest}
>
  {@render children?.()}
</svelte:element>
