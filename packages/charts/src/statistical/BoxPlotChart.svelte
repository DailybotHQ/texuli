<script lang="ts">
import { fitChartWidth } from '../math/layout/fit-width.ts';
import {
  createBoxLayout,
  formatStatNumber,
  type StatGroup,
  type StatTableLabels,
  statLabels,
} from './model.ts';

type Props = {
  title: string;
  description: string;
  groups: readonly StatGroup[];
  /** Tukey fence multiplier (default 1.5); `Infinity` draws whiskers to min and max. */
  whisker?: number;
  domain?: readonly [number, number];
  labels?: Partial<StatTableLabels>;
  width?: number;
  height?: number;
};

let {
  title,
  description,
  groups,
  whisker,
  domain,
  labels,
  width: preferredWidth = 640,
  height = 320,
}: Props = $props();

// Lays out at the figure's measured width, up to `width` (the preferred width).
let measuredWidth = $state(0);
const width = $derived(fitChartWidth(measuredWidth, preferredWidth));

const uid = $props.id();
const text = $derived(statLabels(labels));
const layout = $derived(
  createBoxLayout(groups, {
    width,
    height,
    ...(whisker === undefined ? {} : { whisker }),
    ...(domain === undefined ? {} : { domain }),
  })
);

$effect(() => {
  if (title.trim() === '') throw new TypeError('BoxPlotChart needs a non-empty title.');
  if (description.trim() === '') {
    throw new TypeError('BoxPlotChart needs an accessible description.');
  }
});
</script>

<figure bind:clientWidth={measuredWidth} class="statistical" data-kind="box">
  <figcaption>
    <h3 id="{uid}-heading">{title}</h3>
    <p id="{uid}-description">{description}</p>
  </figcaption>
  <svg
    direction="ltr"
    viewBox="0 0 {layout.width} {layout.height}"
    role="img"
    aria-labelledby="{uid}-title {uid}-svg-description"
  >
    <title id="{uid}-title">{title}</title>
    <desc id="{uid}-svg-description">{description}</desc>
    <g aria-hidden="true">
      {#each layout.ticks as tick (tick.value)}
        <line class="grid" x1={layout.plot.left} x2={layout.plot.right} y1={tick.position} y2={tick.position} />
        <text class="tick" x={layout.plot.left - 6} y={tick.position} text-anchor="end" dominant-baseline="middle">
          {formatStatNumber(tick.value)}
        </text>
      {/each}
      {#each layout.marks as mark (mark.id)}
        <g class="mark" data-group={mark.id}>
          <line class="whisker" x1={mark.center} x2={mark.center} y1={mark.upperWhisker} y2={mark.q3} />
          <line class="whisker" x1={mark.center} x2={mark.center} y1={mark.q1} y2={mark.lowerWhisker} />
          <line class="cap" x1={mark.center - mark.width / 4} x2={mark.center + mark.width / 4} y1={mark.upperWhisker} y2={mark.upperWhisker} />
          <line class="cap" x1={mark.center - mark.width / 4} x2={mark.center + mark.width / 4} y1={mark.lowerWhisker} y2={mark.lowerWhisker} />
          <rect class="box" x={mark.center - mark.width / 2} y={mark.q3} width={mark.width} height={Math.max(1, mark.q1 - mark.q3)}>
            <title>{mark.label}: {text.median} {formatStatNumber(mark.summary.median)}</title>
          </rect>
          <line class="median" x1={mark.center - mark.width / 2} x2={mark.center + mark.width / 2} y1={mark.median} y2={mark.median} />
          {#each mark.outliers as outlier, index (index)}
            <circle class="outlier" data-outlier cx={mark.center} cy={outlier.position} r="3" />
          {/each}
          <text class="category" x={mark.center} y={layout.plot.bottom + 20} text-anchor="middle">{mark.label}</text>
        </g>
      {/each}
    </g>
  </svg>
  <details class="data-table">
    <summary>{text.table}</summary>
    <table>
      <caption>{title} data</caption>
      <thead>
        <tr>
          <th scope="col">{text.group}</th>
          <th scope="col">{text.count}</th>
          <th scope="col">{text.min}</th>
          <th scope="col">{text.q1}</th>
          <th scope="col">{text.median}</th>
          <th scope="col">{text.q3}</th>
          <th scope="col">{text.max}</th>
        </tr>
      </thead>
      <tbody>
        {#each layout.marks as mark (mark.id)}
          <tr>
            <th scope="row">{mark.label}</th>
            <td>{mark.summary.count}</td>
            <td>{formatStatNumber(mark.summary.min)}</td>
            <td>{formatStatNumber(mark.summary.q1)}</td>
            <td>{formatStatNumber(mark.summary.median)}</td>
            <td>{formatStatNumber(mark.summary.q3)}</td>
            <td>{formatStatNumber(mark.summary.max)}</td>
          </tr>
        {/each}
        {#each layout.empty as group (group.id)}
          <tr><th scope="row">{group.label}</th><td>0</td><td colspan="5">—</td></tr>
        {/each}
      </tbody>
    </table>
  </details>
</figure>

<style>
  .statistical { color: var(--tx-foreground, CanvasText); margin: 0; max-inline-size: 100%; }
  figcaption h3 { font-size: 1rem; margin-block: 0; }
  figcaption p { color: var(--tx-muted-foreground, GrayText); margin-block: 0.25rem 0.75rem; }
  svg { display: block; inline-size: 100%; max-block-size: 22rem; overflow: visible; }
  .grid { stroke: var(--tx-chart-grid, var(--tx-border, GrayText)); stroke-dasharray: 2 3; }
  .tick, .category { fill: var(--tx-muted-foreground, GrayText); font-size: 0.75rem; }
  .box { fill: color-mix(in oklab, var(--tx-chart-1, Highlight) 28%, transparent); stroke: var(--tx-chart-1, Highlight); stroke-width: 1.5; }
  .whisker, .cap { stroke: var(--tx-chart-1, Highlight); stroke-width: 1.5; }
  .median { stroke: var(--tx-foreground, CanvasText); stroke-width: 2.5; }
  .outlier { fill: var(--tx-background, Canvas); stroke: var(--tx-chart-2, var(--tx-chart-1, Highlight)); stroke-width: 1.5; }
  .data-table { margin-block-start: 0.75rem; overflow-x: auto; }
  summary { cursor: pointer; min-block-size: 2.75rem; align-content: center; }
  table { border-collapse: collapse; inline-size: 100%; }
  th, td { border: 1px solid var(--tx-chart-grid, var(--tx-border, GrayText)); padding: 0.375rem 0.5rem; text-align: start; }
  @media (forced-colors: active) {
    figcaption p, .tick, .category { color: CanvasText; fill: CanvasText; }
    .box { fill: Canvas; stroke: Highlight; }
    .whisker, .cap, .median, .grid { stroke: CanvasText; }
    .outlier { fill: Canvas; stroke: Highlight; }
  }
</style>
