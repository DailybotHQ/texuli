<script lang="ts" generics="D">
import type { Snippet } from 'svelte';
import type { ChartFormatters, PlotSeries } from '../interaction/model.ts';
import type { Rect } from '../math/types.ts';

let {
  label,
  series,
  width,
  height,
  plot,
  formatters,
  interactive = false,
  hidden = new Set<string>(),
  children,
}: {
  label: string;
  series: readonly PlotSeries<D>[];
  width: number;
  height: number;
  plot: Rect;
  formatters: ChartFormatters;
  interactive?: boolean;
  hidden?: ReadonlySet<string>;
  children: Snippet;
} = $props();

const interactionModule = $derived(
  interactive
    ? import('../interaction/InteractivePlot.svelte').then((module) => module.default)
    : null
);
</script>

{#snippet staticPlot()}
  <svg
    direction="ltr"
    viewBox="0 0 {width} {height}"
    role="img"
    aria-label={label}
    preserveAspectRatio="xMidYMid meet"
    data-matrix-static-plot=""
  >
    {@render children()}
  </svg>
{/snippet}

{#if interactive && interactionModule}
  {#await interactionModule}
    {@render staticPlot()}
  {:then InteractivePlot}
    <InteractivePlot
      {label}
      {series}
      {width}
      {height}
      {plot}
      {formatters}
      {hidden}
      crosshair="xy"
    >
      {@render children()}
    </InteractivePlot>
  {/await}
{:else}
  {@render staticPlot()}
{/if}
