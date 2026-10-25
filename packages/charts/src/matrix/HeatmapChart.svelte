<script lang="ts">
import { type ClassValue } from 'texuli/cx';
import AnnotationLayer from '../annotations/AnnotationLayer.svelte';
import {
  annotationInteractionSeries,
  type ChartAnnotation,
  projectAnnotations,
} from '../annotations/model.ts';
import Axis from '../axis/Axis.svelte';
import type { ChartFormatters } from '../interaction/model.ts';
import MatrixFrame from './MatrixFrame.svelte';
import MatrixPlot from './MatrixPlot.svelte';
import {
  createHeatmapLayout,
  formatMatrixNumber,
  type HeatmapCell,
  heatmapFill,
  heatmapInteractionSeries,
} from './model.ts';

type Props = {
  title: string;
  description: string;
  cells: readonly HeatmapCell[];
  mode?: 'light' | 'dark';
  class?: ClassValue;
  width?: number;
  height?: number;
  /** Load the shared keyboard, tooltip and crosshair layer. Default false. */
  interactive?: boolean;
  /** Optional category reference lines, bands, and callout points; max 100. */
  annotations?: readonly ChartAnnotation[];
};

let {
  title,
  description,
  cells,
  mode = 'light',
  class: className = '',
  width = 640,
  height = 360,
  interactive = false,
  annotations = [],
}: Props = $props();

const margin = { top: 16, right: 16, bottom: 48, left: 80 };
const plot = $derived({
  x: margin.left,
  y: margin.top,
  width: width - margin.left - margin.right,
  height: height - margin.top - margin.bottom,
});
const formatters: ChartFormatters = {
  x: (value) => String(value),
  y: (value) => (value === null ? 'No value' : formatMatrixNumber(value)),
};

const layout = $derived(createHeatmapLayout(cells, width, height, margin));
const xAxisTicks = $derived(
  layout.xKeys.map((value) => ({
    value,
    position: (layout.xBand(value) ?? margin.left) + layout.xBand.bandwidth() / 2 - margin.left,
  }))
);
const yAxisTicks = $derived(
  layout.yKeys.map((value) => ({
    value,
    position: (layout.yBand(value) ?? margin.top) + layout.yBand.bandwidth() / 2 - margin.top,
  }))
);
const renderedAnnotations = $derived(
  projectAnnotations(annotations, {
    plot,
    x: (value) => {
      if (typeof value !== 'string' || !layout.xKeys.includes(value)) return undefined;
      return (layout.xBand(value) ?? margin.left) + layout.xBand.bandwidth() / 2;
    },
    y: (value) => {
      if (typeof value !== 'string' || !layout.yKeys.includes(value)) return undefined;
      return (layout.yBand(value) ?? margin.top) + layout.yBand.bandwidth() / 2;
    },
  })
);
const interactionSeries = $derived(
  interactive
    ? [
        ...heatmapInteractionSeries(layout),
        ...annotationInteractionSeries(renderedAnnotations, plot, layout.yKeys),
      ]
    : []
);
</script>

<MatrixFrame {title} {description} {mode} kind="heatmap" class={className}>
  <MatrixPlot
    label="{title}. {description}"
    series={interactionSeries}
    {width}
    {height}
    {plot}
    {formatters}
    {interactive}
  >
    <g transform="translate({margin.left} {margin.top})">
      <Axis orientation="y" ticks={yAxisTicks} length={plot.height} />
    </g>
    <g transform="translate({margin.left} {height - margin.bottom})">
      <Axis orientation="x" ticks={xAxisTicks} length={plot.width} />
    </g>
    <g aria-hidden="true">
      {#each layout.cells as cell (cell.id)}
        <rect
          data-cell={cell.id}
          x={cell.xPos}
          y={cell.yPos}
          width={cell.width}
          height={cell.height}
          fill={heatmapFill(cell.t)}
          rx="2"
        >
          <title>{cell.x} · {cell.y}: {formatMatrixNumber(cell.value)}</title>
        </rect>
      {/each}
    </g>
    <AnnotationLayer annotations={renderedAnnotations} {plot} />
  </MatrixPlot>

  {#snippet table()}
    <details class="data-table">
      <summary>View data table</summary>
      <table>
        <caption>{title} data</caption>
        <thead>
          <tr>
            <th scope="col">Row</th>
            <th scope="col">Column</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {#each layout.cells as cell (cell.id)}
            <tr>
              <th scope="row">{cell.y}</th>
              <td>{cell.x}</td>
              <td>{formatMatrixNumber(cell.value)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </details>
  {/snippet}
</MatrixFrame>
