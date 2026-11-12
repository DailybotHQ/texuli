<script lang="ts">
import type { Snippet } from 'svelte';
import { type ClassValue, cx } from 'texuli/cx';

interface Props {
  title: string;
  value?: string | number;
  comparison?: string;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  loading?: boolean;
  empty?: boolean;
  emptyLabel?: string;
  sparkline?: Snippet;
  class?: ClassValue;
}

let {
  title,
  value,
  comparison,
  trend = 'flat',
  trendLabel,
  loading = false,
  empty = false,
  emptyLabel = 'No data for this period',
  sparkline,
  class: className,
}: Props = $props();

const trendGlyph = $derived(trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→');
const trendText = $derived(trend === 'up' ? 'Up' : trend === 'down' ? 'Down' : 'Flat');
</script>

<article class={cx('tx-metric-card', className)} aria-busy={loading} data-tx-component="data-metric-card" data-trend={trend}>
  <h3 class="tx-metric-card__title">{title}</h3>
  {#if loading}
    <p class="tx-metric-card__loading" role="status">Loading {title.toLowerCase()}</p>
  {:else if empty || value === undefined || value === null || value === ''}
    <p class="tx-metric-card__empty">{emptyLabel}</p>
  {:else}
    <p class="tx-metric-card__value">{value}</p>
    {#if comparison || trendLabel}
      <p class="tx-metric-card__comparison">
        {#if trendLabel}<span aria-hidden="true">{trendGlyph}</span><span class="tx-metric-card__sr">{trendText}:</span> {trendLabel}{/if}
        {#if comparison}<span>{comparison}</span>{/if}
      </p>
    {/if}
    {#if sparkline}<figure class="tx-metric-card__sparkline">{@render sparkline()}</figure>{/if}
  {/if}
</article>

<style>
  .tx-metric-card { display: grid; align-content: start; gap: var(--tx-space-2); min-inline-size: 0; padding: var(--tx-space-4); border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText); border-radius: var(--tx-shape-radius-lg); background: var(--tx-surface, Canvas); color: var(--tx-surface-foreground, CanvasText); }
  .tx-metric-card__title, .tx-metric-card__value, .tx-metric-card__comparison, .tx-metric-card__empty, .tx-metric-card__loading { margin: 0; }
  .tx-metric-card__title { font-size: var(--tx-type-label-size); font-weight: 600; }
  .tx-metric-card__value { font-size: clamp(var(--tx-font-size-2xl), 4vw, var(--tx-type-display-size)); font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .tx-metric-card__comparison, .tx-metric-card__empty, .tx-metric-card__loading { color: var(--tx-muted-foreground, GrayText); font-size: var(--tx-type-label-size); }
  .tx-metric-card__comparison { display: flex; flex-wrap: wrap; gap: var(--tx-space-1); }
  .tx-metric-card__sparkline { margin-block-start: var(--tx-space-1); max-inline-size: 12rem; }
  .tx-metric-card__loading { min-block-size: 2rem; }
  .tx-metric-card__sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  @media (prefers-reduced-motion: no-preference) { .tx-metric-card__loading { animation: tx-metric-pulse 1.4s ease-in-out infinite alternate; } }
  @keyframes tx-metric-pulse { to { opacity: 0.5; } }
</style>
