<script lang="ts">
import '../table/grid.css';
import Axis from '../axis/Axis.svelte';
import { fitChartWidth } from '../math/layout/fit-width.ts';
import {
  createHistogramLayout,
  formatHistogramRange,
  type HistogramTableLabels,
  histogramLabels,
} from './model.ts';

type Props = {
  title: string;
  description: string;
  values: readonly (number | null)[];
  thresholds?: readonly number[];
  binCount?: number;
  domain?: readonly [number, number];
  labels?: Partial<HistogramTableLabels>;
  width?: number;
  height?: number;
};

let {
  title,
  description,
  values,
  thresholds,
  binCount,
  domain,
  labels,
  width: preferredWidth = 640,
  height = 320,
}: Props = $props();

// Lays out at the figure's measured width, up to `width` (the preferred width).
let measuredWidth = $state(0);
const width = $derived(fitChartWidth(measuredWidth, preferredWidth));

const uid = $props.id();
const text = $derived(histogramLabels(labels));
const layout = $derived(
  createHistogramLayout(values, {
    width,
    height,
    ...(thresholds === undefined ? {} : { thresholds }),
    ...(binCount === undefined ? {} : { count: binCount }),
    ...(domain === undefined ? {} : { domain }),
  })
);

$effect(() => {
  if (title.trim() === '') throw new TypeError('HistogramChart needs a non-empty title.');
  if (description.trim() === '') {
    throw new TypeError('HistogramChart needs an accessible description.');
  }
});
</script>

<figure class="histogram" data-kind="histogram">
  <figcaption>
    <h3 id="{uid}-heading">{title}</h3>
    <p id="{uid}-description">{description}</p>
  </figcaption>
  <!-- Zero-height width probe: it tracks the figure width, and the chart re-laying out (its height) never re-notifies it. -->
  <div class="tx-chart-width-probe" aria-hidden="true" bind:clientWidth={measuredWidth}></div>
  <svg
    direction="ltr"
    viewBox="0 0 {layout.width} {layout.height}"
    role="img"
    aria-labelledby="{uid}-title {uid}-svg-description"
  >
    <title id="{uid}-title">{title}</title>
    <desc id="{uid}-svg-description">{description}</desc>
    <g transform="translate(36 16)">
      <Axis
        orientation="y"
        ticks={layout.yTicks}
        length={layout.baseline - 16}
        gridLength={layout.width - 52}
      />
    </g>
    <g transform="translate(36 {layout.baseline})">
      <Axis orientation="x" ticks={layout.xTicks} length={layout.width - 52} />
    </g>
    {#each layout.bars as bar (`${bar.x0}:${bar.x1}`)}
      <rect
        data-bin="{bar.x0}:{bar.x1}"
        x={bar.x}
        y={bar.y}
        width={bar.width}
        height={bar.height}
        aria-hidden="true"
      >
        <title>{formatHistogramRange(bar.x0, bar.x1)}: {bar.count}</title>
      </rect>
    {/each}
  </svg>
  <details class="tx-chart-data">
    <summary>{text.table}</summary>
    <table>
      <caption>{title} data</caption>
      <thead><tr><th scope="col">{text.range}</th><th scope="col">{text.count}</th></tr></thead>
      <tbody>
        {#each layout.bars as bar (`${bar.x0}:${bar.x1}`)}
          <tr><th scope="row">{formatHistogramRange(bar.x0, bar.x1)}</th><td>{bar.count}</td></tr>
        {/each}
      </tbody>
    </table>
  </details>
</figure>

<style>
  .histogram { color: var(--tx-foreground, CanvasText); margin: 0; max-inline-size: 100%; }
  figcaption h3 { font-size: var(--tx-type-body-size); margin-block: 0; }
  figcaption p { color: var(--tx-muted-foreground, GrayText); margin-block: var(--tx-space-1) var(--tx-space-3); }
  svg { display: block; inline-size: 100%; max-block-size: 22rem; }
  rect { fill: var(--tx-chart-1, var(--tx-primary, Highlight)); }
  @media (forced-colors: active) {
    figcaption p { color: CanvasText; }
    rect { fill: Highlight; stroke: CanvasText; }
  }
</style>
