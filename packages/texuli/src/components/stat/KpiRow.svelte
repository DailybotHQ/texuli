<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import './stat.css';

type Props = HTMLAttributes<HTMLElement> & {
  /** Accessible name for the group of tiles. */
  label: string;
  /** Minimum tile width before the grid adds a column (CSS length). */
  minItemWidth?: string;
};

let { label, minItemWidth = '12rem', class: className, children, ...rest }: Props = $props();

// Only allow simple CSS lengths so authors cannot inject declarations.
const SAFE_LENGTH = /^(?:\d*\.?\d+)(?:%|px|rem|em|ch|cqw|cqmin|cqmax)$/;
const safeMin = $derived(SAFE_LENGTH.test(minItemWidth.trim()) ? minItemWidth.trim() : '12rem');
const rowStyle = $derived(`--tx-kpi-row-min: ${safeMin}`);
</script>

<section
  class={cx('tx-kpi-row', className)}
  style={rowStyle}
  aria-label={label}
  data-tx-kpi-row
  {...rest}
>
  {@render children?.()}
</section>
