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
  /**
   * Most columns the grid shows, however wide it gets (a whole number ≥ 1).
   * Columns still drop below `minItemWidth` on narrow containers.
   */
  maxColumns?: number;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let {
  ref = $bindable(null),
  minItemWidth = '16rem',
  gap = 'md',
  as = 'div',
  maxColumns,
  class: className,
  children,
  ...rest
}: Props = $props();

// Only allow simple CSS lengths so authors cannot inject declarations.
const SAFE_LENGTH = /^(?:\d*\.?\d+)(?:%|px|rem|em|ch|cqw|cqmin|cqmax)$/;
const safeMin = $derived(SAFE_LENGTH.test(minItemWidth.trim()) ? minItemWidth.trim() : '16rem');
const safeMax = $derived(
  maxColumns !== undefined && Number.isFinite(maxColumns) && maxColumns >= 1
    ? Math.floor(maxColumns)
    : undefined
);
// With a cap, each column is at least 1/maxColumns of the row (minus gaps),
// so auto-fill never makes more than `maxColumns` columns.
const columnMin = $derived(
  safeMax === undefined
    ? `min(100%, ${safeMin})`
    : `max(min(100%, ${safeMin}), calc((100% - ${safeMax - 1} * var(--tx-card-grid-gap)) / ${safeMax}))`
);
const gridStyle = $derived(`grid-template-columns: repeat(auto-fill, minmax(${columnMin}, 1fr))`);
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
  data-max-columns={safeMax}
  {...rest}
>
  {@render children?.()}
</svelte:element>
