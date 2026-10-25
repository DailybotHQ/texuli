<script lang="ts">
import {
  createEcdfLayout,
  ecdfQuantileRows,
  formatStatNumber,
  formatStatShare,
  type StatGroup,
  type StatTableLabels,
  statLabels,
} from './model.ts';

type Props = {
  title: string;
  description: string;
  series: readonly StatGroup[];
  domain?: readonly [number, number];
  labels?: Partial<StatTableLabels>;
  width?: number;
  height?: number;
};

let { title, description, series, domain, labels, width = 640, height = 320 }: Props = $props();

const uid = $props.id();
const text = $derived(statLabels(labels));
const layout = $derived(
  createEcdfLayout(series, {
    width,
    height,
    ...(domain === undefined ? {} : { domain }),
  })
);

$effect(() => {
  if (title.trim() === '') throw new TypeError('EcdfChart needs a non-empty title.');
  if (description.trim() === '') {
    throw new TypeError('EcdfChart needs an accessible description.');
  }
});
</script>

<figure class="statistical" data-kind="ecdf">
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
      {#each layout.shareTicks as tick (tick.value)}
        <line class="grid" x1={layout.plot.left} x2={layout.plot.right} y1={tick.position} y2={tick.position} />
        <text class="tick" x={layout.plot.left - 6} y={tick.position} text-anchor="end" dominant-baseline="middle">
          {formatStatShare(tick.value)}
        </text>
      {/each}
      {#each layout.ticks as tick (tick.value)}
        <text class="tick" x={tick.position} y={layout.plot.bottom + 20} text-anchor="middle">
          {formatStatNumber(tick.value)}
        </text>
      {/each}
      {#each layout.marks as mark, index (mark.id)}
        <path
          class="step"
          data-series={mark.id}
          d={mark.path}
          style:--ecdf-color="var(--tx-chart-{(index % 8) + 1}, Highlight)"
        >
          <title>{mark.label}</title>
        </path>
      {/each}
    </g>
  </svg>
  {#if layout.marks.length > 1}
    <ul class="legend">
      {#each layout.marks as mark, index (mark.id)}
        <li style:--ecdf-color="var(--tx-chart-{(index % 8) + 1}, Highlight)">{mark.label}</li>
      {/each}
    </ul>
  {/if}
  <details class="data-table">
    <summary>{text.table}</summary>
    <table>
      <caption>{title} data</caption>
      <thead>
        <tr>
          <th scope="col">{text.group}</th>
          <th scope="col">{text.cumulative}</th>
          <th scope="col">{text.value}</th>
        </tr>
      </thead>
      <tbody>
        {#each layout.marks as mark (mark.id)}
          {#each ecdfQuantileRows(mark) as row (row.share)}
            <tr>
              <th scope="row">{mark.label}</th>
              <td>{formatStatShare(row.share)}</td>
              <td>{formatStatNumber(row.value)}</td>
            </tr>
          {/each}
        {/each}
        {#each layout.empty as group (group.id)}
          <tr><th scope="row">{group.label}</th><td colspan="2">—</td></tr>
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
  .tick { fill: var(--tx-muted-foreground, GrayText); font-size: 0.75rem; }
  .step { fill: none; stroke: var(--ecdf-color); stroke-width: 2; stroke-linejoin: round; }
  .legend { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; list-style: none; margin: 0.5rem 0 0; padding: 0; font-size: 0.875rem; }
  .legend li { display: inline-flex; align-items: center; gap: 0.375rem; }
  .legend li::before { content: ''; inline-size: 1rem; block-size: 0.1875rem; background: var(--ecdf-color); }
  .data-table { margin-block-start: 0.75rem; overflow-x: auto; }
  summary { cursor: pointer; min-block-size: 2.75rem; align-content: center; }
  table { border-collapse: collapse; inline-size: 100%; }
  th, td { border: 1px solid var(--tx-chart-grid, var(--tx-border, GrayText)); padding: 0.375rem 0.5rem; text-align: start; }
  @media (forced-colors: active) {
    figcaption p, .tick { color: CanvasText; fill: CanvasText; }
    .step { stroke: Highlight; }
    .grid { stroke: CanvasText; }
    .legend li::before { background: Highlight; forced-color-adjust: none; }
  }
</style>
