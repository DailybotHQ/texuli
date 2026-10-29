<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { CARD_GAPS, type CardGridGap, type CardGridGapValue, cardGridClass } from './variants.ts';
import './card.css';

type Props = HTMLAttributes<HTMLElement> & {
  /** Minimum card width before the grid adds a column (CSS length). */
  minItemWidth?: string;
  /**
   * Space between cards: a step (`none`, `xs`, `sm`, `md`, `lg`, `xl`), a CSS
   * length (`0.75rem`, `12px`, `0`) or a custom property name
   * (`--my-gutter`, used as `var(--my-gutter)`). Anything else falls back
   * to `md`.
   */
  gap?: CardGridGapValue;
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
  style: callerStyle,
  children,
  ...rest
}: Props = $props();

/** Steps beyond the `sm`/`md`/`lg` classes, set inline. */
const GAP_STEPS: Record<string, string> = { none: '0', xs: '0.25rem', xl: '2rem' };
// A plain CSS length or a custom property name: never a declaration break.
const SAFE_GAP = /^(?:0|\d*\.?\d+(?:px|rem|em|ch|%|vw|vh|vi|vb|cqw|cqh|cqi|cqb|cqmin|cqmax))$/;
const CUSTOM_PROPERTY = /^--[A-Za-z0-9_-]+$/;
const isClassGap = (value: string): value is CardGridGap =>
  (CARD_GAPS as readonly string[]).includes(value);
const gapText = $derived(typeof gap === 'string' ? gap.trim() : 'md');
const gapClass = $derived<CardGridGap>(isClassGap(gapText) ? gapText : 'md');
const gapValue = $derived(
  isClassGap(gapText)
    ? undefined
    : (GAP_STEPS[gapText] ??
        (SAFE_GAP.test(gapText)
          ? gapText
          : CUSTOM_PROPERTY.test(gapText)
            ? `var(${gapText})`
            : undefined))
);

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
// The caller's `style` joins the grid's own declarations (it never replaces
// the column template); a caller declaration still wins where both set one.
const gridStyle = $derived(
  [
    `grid-template-columns: repeat(auto-fill, minmax(${columnMin}, 1fr))`,
    gapValue === undefined ? undefined : `--tx-card-grid-gap: ${gapValue}`,
    typeof callerStyle === 'string' && callerStyle.trim() ? callerStyle.trim() : undefined,
  ]
    .filter(Boolean)
    .join('; ')
);
</script>

<svelte:element
  bind:this={ref}
  this={as}
  class={cardGridClass({
    gap: gapClass,
    class: className,
  })}
  style={gridStyle}
  data-tx-card-grid
  data-max-columns={safeMax}
  {...rest}
>
  {@render children?.()}
</svelte:element>
