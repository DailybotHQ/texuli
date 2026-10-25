<script lang="ts">
import { type ClassValue } from 'texuli/cx';
import AnnotationLayer from '../annotations/AnnotationLayer.svelte';
import {
  annotationInteractionSeries,
  type ChartAnnotation,
  projectAnnotations,
} from '../annotations/model.ts';
import Axis from '../axis/Axis.svelte';
import Legend from '../interaction/Legend.svelte';
import type { ChartFormatters } from '../interaction/model.ts';
import MatrixFrame from './MatrixFrame.svelte';
import MatrixPlot from './MatrixPlot.svelte';
import {
  createScatterLayout,
  formatMatrixNumber,
  type ScatterPoint,
  type ScatterSeries,
  scatterInteractionSeries,
} from './model.ts';

type Props = {
  title: string;
  description: string;
  points: readonly ScatterPoint[];
  series?: readonly ScatterSeries[];
  mode?: 'light' | 'dark';
  class?: ClassValue;
  width?: number;
  height?: number;
  /** Load the shared keyboard, tooltip and crosshair layer. Default false. */
  interactive?: boolean;
  /** Optional reference lines, bands, and callout points; max 100 per chart. */
  annotations?: readonly ChartAnnotation[];
};

let {
  title,
  description,
  points,
  series = [],
  mode = 'light',
  class: className = '',
  width = 640,
  height = 360,
  interactive = false,
  annotations = [],
}: Props = $props();

let hidden = $state(new Set<string>());

const margin = { top: 16, right: 16, bottom: 48, left: 56 };
const plot = $derived({
  x: margin.left,
  y: margin.top,
  width: width - margin.left - margin.right,
  height: height - margin.top - margin.bottom,
});
const formatters: ChartFormatters = {
  x: (value) => formatMatrixNumber(Number(value)),
  y: (value) => (value === null ? 'No value' : formatMatrixNumber(value)),
};
const layout = $derived(
  createScatterLayout(points, { width, height, margin, series, bubble: true })
);
const xAxisTicks = $derived(
  layout.xTicks.map((value) => ({ value, position: layout.xScale(value) - margin.left }))
);
const yAxisTicks = $derived(
  layout.yTicks.map((value) => ({ value, position: layout.yScale(value) - margin.top }))
);
const visiblePoints = $derived(
  layout.points.filter((point) => !hidden.has(point.seriesId ?? 'default'))
);
const legendItems = $derived(
  layout.series.map((item) => ({
    id: item.id,
    label: item.label,
    color: layout.points.find((point) => (point.seriesId ?? 'default') === item.id)?.color,
    symbol: 'circle' as const,
  }))
);
const renderedAnnotations = $derived(
  projectAnnotations(annotations, {
    plot,
    x: (value) => (typeof value === 'number' ? layout.xScale(value) : undefined),
    y: (value) => (typeof value === 'number' ? layout.yScale(value) : undefined),
  })
);
const interactionSeries = $derived(
  interactive
    ? [
        ...scatterInteractionSeries(layout),
        ...annotationInteractionSeries(
          renderedAnnotations,
          plot,
          layout.series.map((item) => item.id)
        ),
      ]
    : []
);
</script>

<MatrixFrame {title} {description} {mode} kind="bubble" class={className}>
  <MatrixPlot
    label="{title}. {description}"
    series={interactionSeries}
    {width}
    {height}
    {plot}
    {formatters}
    {interactive}
    {hidden}
  >
    <g transform="translate({margin.left} {margin.top})">
      <Axis
        orientation="y"
        ticks={yAxisTicks}
        length={plot.height}
        gridLength={plot.width}
      />
    </g>
    <g transform="translate({margin.left} {height - margin.bottom})">
      <Axis orientation="x" ticks={xAxisTicks} length={plot.width} />
    </g>
    <g aria-hidden="true">
      {#each visiblePoints as point (point.id)}
        <circle
          data-point={point.id}
          cx={point.cx}
          cy={point.cy}
          r={point.radius}
          fill={point.color}
          fill-opacity="0.55"
          stroke={point.color}
          stroke-width="1.25"
        >
          <title
            >{point.label}: x {formatMatrixNumber(point.x)}, y {formatMatrixNumber(point.y)}, size
            {formatMatrixNumber(point.r)}</title
          >
        </circle>
      {/each}
    </g>
    <AnnotationLayer annotations={renderedAnnotations} {plot} />
  </MatrixPlot>

  {#snippet legend()}
    {#if layout.series.length > 1}
      <Legend items={legendItems} {hidden} onchange={(next) => (hidden = next)} label="Chart series" />
    {/if}
  {/snippet}

  {#snippet table()}
    <details class="data-table">
      <summary>View data table</summary>
      <table>
        <caption>{title} data</caption>
        <thead>
          <tr>
            <th scope="col">Point</th>
            <th scope="col">Series</th>
            <th scope="col">X</th>
            <th scope="col">Y</th>
            <th scope="col">Size</th>
          </tr>
        </thead>
        <tbody>
          {#each visiblePoints as point (point.id)}
            <tr>
              <th scope="row">{point.label}</th>
              <td>{point.seriesId ?? '—'}</td>
              <td>{formatMatrixNumber(point.x)}</td>
              <td>{formatMatrixNumber(point.y)}</td>
              <td>{formatMatrixNumber(point.r)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </details>
  {/snippet}
</MatrixFrame>
