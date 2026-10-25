<script lang="ts">
import type { Snippet } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import './dashboard.css';

/**
 * Analytics / KPI widget grid for use inside a dashboard screen.
 * Auto-fit columns from `columns` and `minItem`; logical CSS; RTL-safe.
 */

type Props = {
  /** Preferred column count at full width (1–4). */
  columns?: 1 | 2 | 3 | 4;
  /** Minimum preferred item width in CSS pixels. */
  minItem?: number;
  /** Gap length (CSS). */
  gap?: string;
  /** Dense spacing. */
  dense?: boolean;
  /** Named region landmark when the grid has a meaningful title. */
  label?: string;
  children: Snippet;
  class?: ClassValue;
};

let {
  columns = 3,
  minItem = 280,
  gap = '1rem',
  dense = false,
  label,
  children,
  class: className,
}: Props = $props();

const safeColumns = $derived(Math.min(4, Math.max(1, Math.floor(columns))) as 1 | 2 | 3 | 4);
const safeMinItem = $derived(Math.max(120, Math.floor(minItem)));
</script>

<div
  class={cx('tx-analytics-grid', dense && 'tx-analytics-grid--dense', className)}
  data-tx-analytics-grid
  data-columns={safeColumns}
  data-dense={dense ? 'true' : 'false'}
  role={label ? 'region' : undefined}
  aria-label={label}
  style:--tx-analytics-columns={safeColumns}
  style:--tx-analytics-min="{safeMinItem}px"
  style:--tx-analytics-gap={gap}
>
  <div class="tx-analytics-grid__items">
    {@render children()}
  </div>
</div>
