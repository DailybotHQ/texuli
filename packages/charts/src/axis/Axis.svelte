<script lang="ts" generics="T extends string | number">
import { type AxisFormatter, type AxisTick, formatAxisValue } from './model.ts';
import './axis.css';

let {
  orientation,
  ticks,
  length,
  gridLength = 0,
  format,
  tickSize = 4,
  labelOffset = 18,
}: {
  orientation: 'x' | 'y';
  ticks: readonly AxisTick<T>[];
  length: number;
  /** Draw grid lines from a y axis toward the plot, or upward from an x axis. */
  gridLength?: number;
  format?: AxisFormatter<T>;
  tickSize?: number;
  labelOffset?: number;
} = $props();
</script>

<g class="tx-chart-axis grid" data-chart-axis={orientation} aria-hidden="true">
  {#if orientation === 'x'}
    <line class="tx-chart-axis__domain" x1="0" x2={length} y1="0" y2="0" />
    {#each ticks as tick, index (`${tick.position}:${index}`)}
      {#if gridLength > 0}
        <line
          class="tx-chart-axis__grid"
          x1={tick.position}
          x2={tick.position}
          y1="0"
          y2={-gridLength}
        />
      {/if}
      <line
        class="tx-chart-axis__tick"
        x1={tick.position}
        x2={tick.position}
        y1="0"
        y2={tickSize}
      />
      <text x={tick.position} y={tickSize + labelOffset} text-anchor="middle">
        {format ? format(tick.value, index) : formatAxisValue(tick.value)}
      </text>
    {/each}
  {:else}
    <line class="tx-chart-axis__domain" x1="0" x2="0" y1="0" y2={length} />
    {#each ticks as tick, index (`${tick.position}:${index}`)}
      {#if gridLength > 0}
        <line
          class="tx-chart-axis__grid"
          x1="0"
          x2={gridLength}
          y1={tick.position}
          y2={tick.position}
        />
      {/if}
      <line
        class="tx-chart-axis__tick"
        x1="0"
        x2={-tickSize}
        y1={tick.position}
        y2={tick.position}
      />
      <text x={-tickSize - 8} y={tick.position} text-anchor="end" dominant-baseline="middle">
        {format ? format(tick.value, index) : formatAxisValue(tick.value)}
      </text>
    {/each}
  {/if}
</g>

