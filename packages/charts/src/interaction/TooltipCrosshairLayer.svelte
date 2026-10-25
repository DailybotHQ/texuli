<script lang="ts">
import type { Rect } from '../math/types.ts';
import type { ChartCrosshair, PlotPoint, TooltipRow } from './model.ts';
import Tooltip from './Tooltip.svelte';
import './interaction.css';

let {
  point,
  rows,
  plot,
  width,
  height,
  color,
  xLabel,
  crosshair = 'x',
  orientation = 'x',
  activePoint,
  tooltip = true,
  dismissed = false,
}: {
  point: PlotPoint;
  rows: readonly TooltipRow[];
  plot: Rect;
  width: number;
  height: number;
  color: string;
  xLabel: string;
  crosshair?: ChartCrosshair;
  orientation?: 'x' | 'y';
  activePoint?: PlotPoint;
  tooltip?: boolean;
  dismissed?: boolean;
} = $props();

const vertical = $derived(crosshair === 'xy' || (crosshair === 'x' && orientation === 'x'));
const horizontal = $derived(crosshair === 'xy' || (crosshair === 'x' && orientation === 'y'));
</script>

<svg
  direction="ltr"
  aria-hidden="true"
  class="tx-chart-overlay"
  viewBox="0 0 {width} {height}"
  preserveAspectRatio="xMidYMid meet"
  data-tooltip-crosshair-layer=""
>
  {#if vertical}
    <line
      aria-hidden="true"
      data-crosshair="x"
      x1={point.x}
      x2={point.x}
      y1={plot.y}
      y2={plot.y + plot.height}
      class="tx-chart-crosshair"
    />
  {/if}
  {#if horizontal}
    <line
      aria-hidden="true"
      data-crosshair="y"
      x1={plot.x}
      x2={plot.x + plot.width}
      y1={point.y}
      y2={point.y}
      class="tx-chart-crosshair"
    />
  {/if}
  <circle
    aria-hidden="true"
    data-chart-hover-point=""
    cx={point.x}
    cy={point.y}
    r="4.5"
    fill={color}
    class="tx-chart-hover-dot"
  />
  {#if activePoint && activePoint.y !== null}
    <circle
      aria-hidden="true"
      data-active-point=""
      cx={activePoint.x}
      cy={activePoint.y}
      r="7"
      fill="none"
      class="tx-chart-active-ring"
    />
  {/if}
</svg>

{#if tooltip && !dismissed && rows.length > 0}
  <Tooltip anchor={{ x: point.x, y: point.y ?? plot.y }} bounds={{ width, height }}>
    <p class="tx-chart-tooltip__x">{xLabel}</p>
    <ul class="tx-chart-tooltip__list">
      {#each rows as row (row.id)}
        <li class="tx-chart-tooltip__row" class:tx-chart-tooltip__row--current={row.current}>
          <span class="tx-chart-tooltip__label">
            <span class="tx-chart-tooltip__swatch" style={`background-color: ${row.color}`}></span>
            {row.label}
          </span>
          <span class="tx-chart-tooltip__value">{row.value}</span>
        </li>
      {/each}
    </ul>
  </Tooltip>
{/if}
