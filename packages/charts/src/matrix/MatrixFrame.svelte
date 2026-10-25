<script lang="ts">
import type { Snippet } from 'svelte';
import { type ClassValue } from 'texuli/cx';

type Props = {
  title: string;
  description: string;
  mode?: 'light' | 'dark';
  kind: string;
  class?: ClassValue;
  legend?: Snippet;
  table?: Snippet;
  children?: Snippet;
  /** The figure's measured width (bindable), for charts that lay out to fit it. */
  measuredWidth?: number;
};

let {
  title,
  description,
  mode = 'light',
  kind,
  class: className = '',
  legend,
  table,
  children,
  measuredWidth = $bindable(0),
}: Props = $props();

const id = $props.id();

$effect(() => {
  if (title.trim() === '') throw new TypeError('Matrix charts need a non-empty title.');
  if (description.trim() === '') {
    throw new TypeError('Matrix charts need an accessible description.');
  }
});
</script>

<figure
  bind:clientWidth={measuredWidth}
  class="chart {className}"
  data-kind={kind}
  data-mode={mode}
  data-tx-matrix=""
  aria-labelledby="{id}-title"
  aria-describedby="{id}-description"
>
  <figcaption>
    <h2 id="{id}-title">{title}</h2>
    <p id="{id}-description">{description}</p>
  </figcaption>
  {@render children?.()}
  {#if legend}
    {@render legend()}
  {/if}
  {#if table}
    {@render table()}
  {/if}
</figure>

<style>
  .chart {
    margin: 0;
    --chart-1: var(--tx-chart-1, #2166ac);
    --chart-2: var(--tx-chart-2, #b35806);
    --chart-3: var(--tx-chart-3, #1b7837);
    --chart-4: var(--tx-chart-4, #762a83);
    --chart-5: var(--tx-chart-5, #d73027);
    --chart-6: var(--tx-chart-6, #018571);
    --chart-7: var(--tx-chart-7, #5e3c99);
    --chart-8: var(--tx-chart-8, #a6611a);
    color: var(--tx-foreground, CanvasText);
    font: inherit;
    inline-size: 100%;
    min-inline-size: 0;
  }

  .chart[data-mode='dark'] {
    --chart-1: var(--tx-chart-1, #6baed6);
    --chart-2: var(--tx-chart-2, #fd8d3c);
    --chart-3: var(--tx-chart-3, #74c476);
    --chart-4: var(--tx-chart-4, #9e9ac8);
    --chart-5: var(--tx-chart-5, #fb6a4a);
    --chart-6: var(--tx-chart-6, #41b6c4);
    --chart-7: var(--tx-chart-7, #bcbddc);
    --chart-8: var(--tx-chart-8, #fdae6b);
  }

  figcaption h2 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
    font-weight: 600;
  }

  figcaption p {
    margin: 0 0 0.75rem;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.875rem;
  }

  .chart :global(svg[data-matrix-static-plot]) {
    display: block;
    inline-size: 100%;
    overflow: visible;
  }

  .chart :global(.grid line) {
    stroke: var(--tx-chart-grid, var(--tx-border, #aab2bd));
    stroke-dasharray: 3 4;
  }

  .chart :global(.grid text) {
    fill: var(--tx-chart-axis, var(--tx-muted-foreground, GrayText));
    font-size: 11px;
  }

  .chart :global(.legend) {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.25rem;
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
  }

  .chart :global(.legend li) {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  .chart :global(.legend svg) {
    inline-size: 0.75rem;
    block-size: 0.75rem;
    flex: none;
  }

  .chart :global(.data-table) {
    margin-block-start: 0.75rem;
  }

  .chart :global(.data-table summary) {
    cursor: pointer;
    min-block-size: 2.75rem;
    align-content: center;
  }

  .chart :global(table) {
    border-collapse: collapse;
    inline-size: 100%;
  }

  .chart :global(th),
  .chart :global(td) {
    border: 1px solid var(--tx-chart-grid, var(--tx-border, GrayText));
    padding: 0.375rem 0.5rem;
    text-align: start;
  }

  @media (forced-colors: active) {
    .chart :global(.grid line) {
      stroke: CanvasText;
    }
    .chart :global(.grid text) {
      fill: CanvasText;
    }
    .chart :global(svg rect),
    .chart :global(svg circle) {
      stroke: CanvasText;
    }
  }
  @media (forced-colors: active) {
    figcaption p { color: CanvasText; }
  }
</style>
