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
        {#if trendLabel}<span aria-label={trend}>{trendGlyph}</span> {trendLabel}{/if}
        {#if comparison}<span>{comparison}</span>{/if}
      </p>
    {/if}
    {#if sparkline}<figure class="tx-metric-card__sparkline">{@render sparkline()}</figure>{/if}
  {/if}
</article>

<style>
  .tx-metric-card { display: grid; align-content: start; gap: 0.45rem; min-inline-size: 0; padding: 1rem; border: 1px solid var(--tx-border, #888); border-radius: 0.75rem; background: var(--tx-surface, Canvas); color: var(--tx-text, CanvasText); }
  .tx-metric-card__title, .tx-metric-card__value, .tx-metric-card__comparison, .tx-metric-card__empty, .tx-metric-card__loading { margin: 0; }
  .tx-metric-card__title { font-size: 0.875rem; font-weight: 600; }
  .tx-metric-card__value { font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .tx-metric-card__comparison, .tx-metric-card__empty, .tx-metric-card__loading { color: var(--tx-muted-foreground, #555); font-size: 0.875rem; }
  .tx-metric-card__comparison { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .tx-metric-card__sparkline { margin: 0.25rem 0 0; max-inline-size: 12rem; }
  .tx-metric-card__loading { min-block-size: 2rem; }
  @media (prefers-reduced-motion: no-preference) { .tx-metric-card__loading { animation: tx-metric-pulse 1.4s ease-in-out infinite alternate; } }
  @keyframes tx-metric-pulse { to { opacity: 0.5; } }
</style>
