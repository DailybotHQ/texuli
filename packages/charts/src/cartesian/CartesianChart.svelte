<script lang="ts">
import { type ClassValue } from 'texuli/cx';
import AnnotationLayer from '../annotations/AnnotationLayer.svelte';
import {
  annotationInteractionSeries,
  assertCartesianAnnotations,
  type ChartAnnotation,
  projectAnnotations,
} from '../annotations/model.ts';
import Axis from '../axis/Axis.svelte';
import CanvasRenderer from '../canvas/CanvasRenderer.svelte';
import {
  type CanvasRendererMode,
  type CanvasSeries,
  downsampleCanvasPoints,
  useCanvas,
} from '../canvas/model.ts';
import type { BrushRange, ChartFormatters, DomainPair, PlotSeries } from '../interaction/model.ts';
import { bandScale, extent, linearScale, stack, ticks } from '../math/index.ts';
import { fitChartWidth } from '../math/layout/fit-width.ts';
import {
  assertCartesianSeries,
  type CartesianDomain,
  type CartesianKind,
  type CartesianPoint,
  type CartesianSeries,
  createCartesianLayout,
  lineCoordinates,
  toInteractionSeries,
  windowCartesianSeries,
  xDomain,
} from './model.ts';

interface Props {
  kind: CartesianKind;
  title: string;
  description: string;
  series: readonly CartesianSeries[];
  mode?: 'light' | 'dark';
  class?: ClassValue;
  renderer?: CanvasRendererMode;
  /** When false, skip InteractivePlot (static image only). Default true. */
  interactive?: boolean;
  /** Optional reference lines, bands, and callout points; max 100 per chart. */
  annotations?: readonly ChartAnnotation[];
  /** Opt-in brush: pixel → domain. */
  brushInvert?: (pixel: number) => number;
  fullDomain?: DomainPair;
  visibleDomain?: CartesianDomain;
  onzoom?: (domain: DomainPair) => void;
  onbrush?: (domain: DomainPair, pixels: BrushRange) => void;
  onselect?: (selection: {
    seriesId: string;
    index: number;
    x: number | string;
    y: number | null;
  }) => void;
}

let {
  kind,
  title,
  description,
  series,
  mode = 'light',
  class: className = '',
  renderer = 'auto',
  interactive = true,
  annotations = [],
  brushInvert,
  fullDomain,
  visibleDomain,
  onzoom,
  onbrush,
  onselect,
}: Props = $props();

const id = $props.id();
// Laid out at the figure's measured width (up to 640), so text and margins keep
// their pixel size on phones instead of shrinking with a fixed viewBox.
let measuredWidth = $state(0);
const width = $derived(fitChartWidth(measuredWidth, 640));
const height = 320;
const margin = { top: 18, right: 18, bottom: 48, left: 58 };
const innerWidth = $derived(width - margin.left - margin.right);
const plotRect = $derived({
  x: margin.left,
  y: margin.top,
  width: innerWidth,
  height: height - margin.top - margin.bottom,
});

let tableOpen = $state(false);
let hidden = $state(new Set<string>());

const formatters: ChartFormatters = {
  x: (value) => display(value),
  y: (value) => display(value),
};

const visibleSeries = $derived(series.filter((item) => !hidden.has(item.id)));

// Fail fast on bad props so hosts catch invalid charts before paint.
$effect.pre(() => {
  if (title.trim() === '') throw new TypeError('Cartesian charts need a non-empty title.');
  if (description.trim() === '') {
    throw new TypeError('Cartesian charts need an accessible description.');
  }
  assertCartesianSeries(series);
  assertCartesianAnnotations(annotations);
});

const model = $derived.by(() => {
  assertCartesianSeries(series);
  const active = visibleSeries.length > 0 ? visibleSeries : series;
  assertCartesianSeries(active);
  const allKeys = xDomain(active);
  const renderedSeries = visibleDomain ? windowCartesianSeries(active, visibleDomain) : active;
  const keys = xDomain(renderedSeries);
  const keyIndex = new Map(keys.map((key, index) => [key, index]));
  const pointCount = active.reduce((sum, item) => sum + item.points.length, 0);
  const canvasEnabled = useCanvas(renderer, pointCount);
  const categories = keys.map(String);
  const stackedMode = kind === 'stacked-bar' || (kind === 'area' && active.length > 1);
  const layout = createCartesianLayout(
    renderedSeries,
    width,
    height,
    kind === 'area' && stackedMode
  );
  const category = bandScale({
    domain: categories,
    range: [margin.left, width - margin.right],
    paddingInner: 0.18,
    paddingOuter: 0.1,
  });
  const band = category.bandwidth();
  const visibleXScale = visibleDomain
    ? linearScale({
        domain: visibleDomain,
        range: [margin.left, width - margin.right],
        nice: false,
      })
    : null;
  const rows = renderedSeries.map((item) => {
    const values = new Map(item.points.map((point) => [point.x, point.y]));
    return keys.map((key) => values.get(key) ?? null);
  });
  const stackSpans =
    kind === 'stacked-bar' || (kind === 'area' && stackedMode)
      ? stack(rows, { offset: 'diverging' })
      : rows.map((row) => row.map((value) => [0, value ?? 0] as const));
  const yValues =
    kind === 'stacked-bar' || (kind === 'area' && stackedMode)
      ? stackSpans.flat().flat()
      : rows.flat().filter((value): value is number => value !== null);
  const domain = extent(yValues) ?? [0, 1];
  const includeZero = kind !== 'line';
  const yDomain: readonly [number, number] = includeZero
    ? [Math.min(0, domain[0]), Math.max(0, domain[1])]
    : domain;
  const yScale = linearScale({
    domain:
      yDomain[0] === yDomain[1] ? [Math.min(yDomain[0], 0), Math.max(yDomain[1], 1)] : yDomain,
    range: [height - margin.bottom, margin.top],
    nice: true,
  });
  const yTicks = ticks(yScale.domain[0], yScale.domain[1], 5);
  const xPosition = (key: number | string) => {
    if (visibleXScale && typeof key === 'number') return visibleXScale(key);
    const start = category(String(key));
    return (start ?? margin.left) + band / 2;
  };
  const markBandWidth = (index: number) => {
    if (!visibleXScale) return band;
    const current = keys[index];
    if (typeof current !== 'number') return band;
    const distances = [keys[index - 1], keys[index + 1]]
      .filter((key): key is number => typeof key === 'number')
      .map((key) => Math.abs(xPosition(key) - xPosition(current)))
      .filter((distance) => distance > 0);
    return Math.max(1, Math.min(...distances, innerWidth));
  };
  const chartLayout = {
    ...layout,
    xPosition,
    yPosition: (value: number) => yScale(value),
    baseline: yScale(0),
  };
  const lineSeries = kind === 'combo' ? renderedSeries.slice(1) : renderedSeries;
  const visibleLineSeries =
    kind === 'line' || kind === 'area' || kind === 'combo' ? lineSeries : [];
  const linePaths = canvasEnabled
    ? []
    : visibleLineSeries.map((item) => {
        const sourceIndex = renderedSeries.indexOf(item);
        const coords =
          kind === 'area'
            ? lineCoordinates(chartLayout, sourceIndex, true)
            : lineCoordinates(chartLayout, sourceIndex);
        const originalIndex = series.findIndex((s) => s.id === item.id);
        return {
          id: item.id,
          color:
            item.color ??
            `var(--chart-${((originalIndex >= 0 ? originalIndex : sourceIndex) % 8) + 1})`,
          ...coords,
        };
      });
  const grouped = kind === 'bar' && renderedSeries.length > 1;
  const groupSize = grouped ? Math.max(1, renderedSeries.length) : 1;
  const barSeries = kind === 'combo' ? renderedSeries.slice(0, 1) : renderedSeries;
  const bars =
    canvasEnabled || (kind !== 'bar' && kind !== 'stacked-bar' && kind !== 'combo')
      ? []
      : barSeries.flatMap((item) => {
          const seriesIndex = renderedSeries.indexOf(item);
          const originalIndex = series.findIndex((s) => s.id === item.id);
          return item.points.flatMap((point) => {
            if (point.y === null) return [];
            const index = keyIndex.get(point.x) ?? 0;
            const categoryStart = category(categories[index] as string) ?? margin.left;
            const markBand = markBandWidth(index);
            const slot = grouped ? groupedBarSlot(markBand, groupSize, seriesIndex) : null;
            const groupOffset = slot ? slot.offset : 0;
            const x = visibleXScale
              ? xPosition(point.x) - markBand / 2 + groupOffset
              : categoryStart + groupOffset;
            const span = stackSpans[seriesIndex]?.[index] ?? [0, point.y];
            const y0 = yScale(span[0]);
            const y1 = yScale(span[1]);
            return [
              {
                id: `${item.id}-${index}`,
                seriesIndex,
                x,
                y: Math.min(y0, y1),
                width: slot ? slot.width : markBand * 0.72,
                height: Math.max(0, Math.abs(y1 - y0)),
                color:
                  item.color ??
                  `var(--chart-${((originalIndex >= 0 ? originalIndex : seriesIndex) % 8) + 1})`,
              },
            ];
          });
        });
  const canvasX = (key: number | string): number => {
    if (visibleXScale && typeof key === 'number') {
      return Math.max(margin.left, Math.min(width - margin.right, visibleXScale(key)));
    }
    const start = category(String(key));
    return (start ?? margin.left) + category.bandwidth() / 2;
  };
  const canvasSeries: CanvasSeries[] = renderedSeries.map((item, seriesIndex) => {
    const originalIndex = series.findIndex((s) => s.id === item.id);
    return {
      id: item.id,
      label: item.label,
      color:
        item.color ??
        `var(--chart-${((originalIndex >= 0 ? originalIndex : seriesIndex) % 8) + 1})`,
      points: item.points.map((point: CartesianPoint) => {
        const index = keyIndex.get(point.x) ?? 0;
        const span = stackSpans[seriesIndex]?.[index] ?? [0, point.y ?? 0];
        const y0 = chartLayout.yPosition(span[0]);
        const y1 = point.y === null ? null : chartLayout.yPosition(span[1]);
        const isBar =
          kind === 'bar' || kind === 'stacked-bar' || (kind === 'combo' && seriesIndex === 0);
        if (!isBar) return { x: canvasX(point.x), y: y1, y0 };
        const categoryStart = category(categories[index] as string) ?? margin.left;
        const markBand = markBandWidth(index);
        const slot =
          kind === 'bar' && renderedSeries.length > 1
            ? groupedBarSlot(markBand, renderedSeries.length, seriesIndex)
            : null;
        const barBase = yScale(span[0]);
        const barEnd = yScale(span[1]);
        return {
          x: canvasX(point.x),
          y: y1,
          y0,
          bar: {
            y: Math.min(barBase, barEnd),
            x:
              (visibleXScale ? canvasX(point.x) - markBand / 2 : categoryStart) +
              (slot ? slot.offset : 0),
            width: slot ? slot.width : markBand * 0.72,
            height: Math.abs(barEnd - barBase),
          },
        };
      }),
    };
  });
  const visibleKeys = visibleDomain
    ? [
        ...new Set([
          visibleDomain[0],
          ...keys.filter(
            (key): key is number =>
              typeof key === 'number' && key >= visibleDomain[0] && key <= visibleDomain[1]
          ),
          visibleDomain[1],
        ]),
      ]
    : keys;
  const tickKeys =
    visibleKeys.length > 8
      ? Array.from(
          { length: 6 },
          (_, index) =>
            visibleKeys[Math.round((index * (visibleKeys.length - 1)) / 5)] as number | string
        )
      : visibleKeys;
  const xAxisTicks = tickKeys.map((value, index) => ({
    value,
    position:
      (visibleXScale
        ? xPosition(value)
        : (category(String(value)) ??
            margin.left + (index / Math.max(1, tickKeys.length - 1)) * innerWidth) +
          (category(String(value)) === undefined ? 0 : category.bandwidth() / 2)) - margin.left,
  }));
  const yAxisTicks = yTicks.map((value) => ({ value, position: yScale(value) - margin.top }));
  const pointLookups = series.map(
    (item) => new Map(item.points.map((point) => [point.x, point.y]))
  );
  // Dense canvas series keep keyboard/tooltip exploration on a downsampled
  // point set so 100k+ source points never freeze the interaction layer.
  const interactionSeries: PlotSeries[] = canvasEnabled
    ? canvasSeries.map((item) => ({
        id: item.id,
        label: item.label,
        color: item.color,
        points: downsampleCanvasPoints(
          item.points.map((point) => ({
            x: point.x,
            y: point.y,
            y0: point.y0,
          })),
          Math.max(64, Math.floor(width / 2))
        ).map((point) => ({
          x: point.x,
          y: point.y,
          xValue: point.x,
          yValue: point.y,
        })),
      }))
    : toInteractionSeries(renderedSeries, {
        keys,
        xPosition,
        yPosition: (value) => yScale(value),
        stackSpans,
        kind,
      });
  const tableKeys =
    keys.length > 48
      ? Array.from(
          { length: 24 },
          (_, index) => keys[Math.round((index * (keys.length - 1)) / 23)] as number | string
        )
      : keys;
  const tableSeries: PlotSeries[] = series.map((item) => ({
    id: item.id,
    label: item.label,
    points: tableKeys.map((key) => {
      const yValue =
        item.points.find((point) => point.x === key)?.y ??
        pointLookups[series.indexOf(item)]?.get(key) ??
        null;
      return { x: 0, y: 0, xValue: key, yValue };
    }),
  }));
  // Prefer full x extent for opt-in zoom when host does not pass fullDomain.
  const defaultDomain: DomainPair =
    typeof allKeys[0] === 'number' && typeof allKeys[allKeys.length - 1] === 'number'
      ? [Number(allKeys[0]), Number(allKeys[allKeys.length - 1])]
      : [0, allKeys.length - 1];
  const renderedAnnotations = projectAnnotations(annotations, {
    plot: plotRect,
    x: (value) => (keys.includes(value) ? xPosition(value) : undefined),
    y: (value) => (typeof value === 'number' ? yScale(value) : undefined),
  });
  return {
    keys,
    tickKeys,
    xAxisTicks,
    yAxisTicks,
    categories,
    category,
    yScale,
    yTicks,
    linePaths,
    bars,
    canvasSeries,
    pointLookups,
    useCanvas: canvasEnabled,
    interactionSeries,
    renderedAnnotations,
    annotationSeries: annotationInteractionSeries(
      renderedAnnotations,
      plotRect,
      interactionSeries.map((item) => item.id)
    ),
    tableSeries,
    defaultDomain,
    legendItems: series.map((item, index) => ({
      id: item.id,
      label: item.label,
      color: item.color ?? `var(--chart-${(index % 8) + 1})`,
      symbol:
        kind === 'line'
          ? ('line' as const)
          : kind === 'area'
            ? ('area' as const)
            : kind === 'combo'
              ? index === 0
                ? ('bar' as const)
                : ('line' as const)
              : ('bar' as const),
    })),
  };
});

function display(value: number | string | null): string {
  if (value === null) return 'No value';
  return typeof value === 'number'
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
    : value;
}

/**
 * One grouped-bar geometry for both renderers: the category band splits into
 * `count + 0.2` slots (the fraction is the group's side padding) and each bar
 * fills 88% of its slot. Canvas marks reuse the SVG numbers, so a chart keeps
 * its shape when it crosses the canvas point threshold.
 */
function groupedBarSlot(
  markBand: number,
  count: number,
  seriesIndex: number
): { offset: number; width: number } {
  const slot = markBand / (count + 0.2);
  return { offset: seriesIndex * slot, width: slot * 0.88 };
}

const interactionModules = $derived(
  interactive
    ? Promise.all([
        import('../interaction/InteractivePlot.svelte'),
        import('../interaction/Legend.svelte'),
        import('../interaction/TableToggle.svelte'),
        import('../interaction/ChartTable.svelte'),
      ]).then(([plot, legend, toggle, table]) => ({
        InteractivePlot: plot.default,
        Legend: legend.default,
        TableToggle: toggle.default,
        ChartTable: table.default,
      }))
    : null
);
</script>

<figure
  class="chart {className}"
  data-kind={kind}
  data-mode={mode}
  data-interactive={interactive ? 'true' : undefined}
  aria-labelledby="{id}-title"
  aria-describedby="{id}-description"
>
  <figcaption>
    <h2 id="{id}-title">{title}</h2>
    <p id="{id}-description">{description}</p>
  </figcaption>
  <!-- Zero-height width probe: it tracks the figure width, and the chart re-laying out (its height) never re-notifies it. -->
  <div class="tx-chart-width-probe" aria-hidden="true" bind:clientWidth={measuredWidth}></div>

  {#if interactive && interactionModules}
    {#await interactionModules}
      <!-- Keep a named graphics region while the interaction chunk loads (SVG or canvas). -->
      <div class="plot">
        <svg
          direction="ltr"
          viewBox="0 0 {width} {height}"
          role="img"
          aria-labelledby="{id}-title"
          aria-describedby="{id}-description"
          preserveAspectRatio="xMidYMid meet"
          data-chart-pending=""
        >
          <title>{title}</title>
        </svg>
      </div>
    {:then I}
      {#if series.length > 1}
        <I.Legend
          items={model.legendItems}
          {hidden}
          onchange={(next) => (hidden = next)}
          label="{title} series"
        />
      {/if}
      <div class="plot">
        <I.InteractivePlot
          label={title}
          labelledBy="{id}-title"
          describedBy="{id}-description"
          series={[...model.interactionSeries, ...model.annotationSeries]}
          {hidden}
          {width}
          {height}
          plot={plotRect}
          {formatters}
          crosshair="x"
          {brushInvert}
          fullDomain={fullDomain ?? model.defaultDomain}
          {onzoom}
          {onbrush}
          onselect={(selection) => {
            if (selection.series.pointer === false) return;
            const point = selection.series.points[selection.index];
            const sourceIndex = visibleDomain
              ? (series
                  .find((item) => item.id === selection.series.id)
                  ?.points.findIndex((sourcePoint) => sourcePoint.x === point?.xValue) ?? -1)
              : selection.index;
            onselect?.({
              seriesId: selection.series.id,
              index: sourceIndex >= 0 ? sourceIndex : selection.index,
              x: point?.xValue ?? '',
              y: point?.yValue ?? null,
            });
          }}
        >
          {#snippet children()}
            <defs>
              <clipPath id="{id}-plot-clip">
                <rect
                  x={margin.left}
                  y={margin.top}
                  width={innerWidth}
                  height={height - margin.top - margin.bottom}
                />
              </clipPath>
            </defs>
            <g transform="translate({margin.left} {margin.top})">
              <Axis
                orientation="y"
                ticks={model.yAxisTicks}
                length={plotRect.height}
                gridLength={plotRect.width}
              />
            </g>
            <g transform="translate({margin.left} {height - margin.bottom})">
              <Axis
                orientation="x"
                ticks={model.xAxisTicks}
                length={plotRect.width}
              />
            </g>
            {#if !model.useCanvas && (kind === 'bar' || kind === 'stacked-bar' || kind === 'combo')}
              <g aria-hidden="true" clip-path="url(#{id}-plot-clip)">
                {#each model.bars as bar (bar.id)}
                  <rect
                    data-series={visibleSeries[bar.seriesIndex]?.id}
                    x={bar.x}
                    y={bar.y}
                    width={bar.width}
                    height={bar.height}
                    fill={bar.color}
                  />
                {/each}
              </g>
            {/if}
            {#each model.linePaths as path (path.id)}
              <g data-series={path.id} aria-hidden="true" clip-path="url(#{id}-plot-clip)">
                {#if kind === 'area' && path.area}
                  <path d={path.area} fill={path.color} fill-opacity="0.22" stroke="none" />
                {/if}
                <path
                  data-line={path.id}
                  d={path.line}
                  fill="none"
                  stroke={path.color}
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </g>
            {/each}
            <AnnotationLayer annotations={model.renderedAnnotations} plot={plotRect} />
          {/snippet}
        </I.InteractivePlot>
        {#if model.useCanvas}
          <div class="canvas-layer" aria-hidden="true">
            <CanvasRenderer kind={kind} series={model.canvasSeries} {width} {height} />
          </div>
        {/if}
      </div>
      <div class="footer">
        <I.TableToggle bind:open={tableOpen} />
      </div>
      {#if tableOpen}
        <I.ChartTable
          series={model.tableSeries}
          {formatters}
          caption="{title} data"
        />
      {/if}
    {/await}
  {:else}
    <div class="plot">
      <svg
        direction="ltr"
        viewBox="0 0 {width} {height}"
        role="img"
        aria-labelledby="{id}-title"
        aria-describedby="{id}-description"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <clipPath id="{id}-plot-clip">
            <rect
              x={margin.left}
              y={margin.top}
              width={innerWidth}
              height={height - margin.top - margin.bottom}
            />
          </clipPath>
        </defs>
        <g transform="translate({margin.left} {margin.top})">
          <Axis
            orientation="y"
            ticks={model.yAxisTicks}
            length={plotRect.height}
            gridLength={plotRect.width}
          />
        </g>
        <g transform="translate({margin.left} {height - margin.bottom})">
          <Axis
            orientation="x"
            ticks={model.xAxisTicks}
            length={plotRect.width}
          />
        </g>
        {#if !model.useCanvas && (kind === 'bar' || kind === 'stacked-bar' || kind === 'combo')}
          <g aria-hidden="true" clip-path="url(#{id}-plot-clip)">
            {#each model.bars as bar (bar.id)}
              <rect
                data-series={visibleSeries[bar.seriesIndex]?.id}
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                fill={bar.color}
              />
            {/each}
          </g>
        {/if}
        {#each model.linePaths as path (path.id)}
          <g data-series={path.id} aria-hidden="true" clip-path="url(#{id}-plot-clip)">
            {#if kind === 'area' && path.area}
              <path d={path.area} fill={path.color} fill-opacity="0.22" stroke="none" />
            {/if}
            <path
              data-line={path.id}
              d={path.line}
              fill="none"
              stroke={path.color}
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </g>
        {/each}
        <AnnotationLayer annotations={model.renderedAnnotations} plot={plotRect} />
      </svg>
      {#if model.useCanvas}
        <div class="canvas-layer" aria-hidden="true">
          <CanvasRenderer kind={kind} series={model.canvasSeries} {width} {height} />
        </div>
      {/if}
    </div>
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
    font-size: 1rem;
    margin-block: 0;
  }

  figcaption p {
    /* Fallback keeps WCAG AA on light surfaces when tokens are unset. */
    color: var(--tx-muted-foreground, #575757);
    margin-block: 0.25rem 0.75rem;
  }
  .chart[data-mode='dark'] figcaption p {
    color: var(--tx-muted-foreground, #c8cdd4);
  }
  .plot {
    position: relative;
  }
  .canvas-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .plot :global(svg) {
    display: block;
    inline-size: 100%;
    overflow: visible;
  }
  .footer {
    margin-block-start: 0.5rem;
  }
  /*
   * Forced colors keep the series palette, as part-whole charts do: painting
   * every mark CanvasText made series indistinguishable and left the legend
   * colors matching nothing. Bars get Canvas separators so stacked segments
   * and grouped bars stay apart.
   */
  @media (forced-colors: active) {
    .plot :global(svg rect[data-series]) {
      stroke: Canvas;
      stroke-width: 1.5;
    }
  }
  @media (forced-colors: active) {
    figcaption p { color: CanvasText; }
  }
</style>
