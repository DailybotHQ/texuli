<script lang="ts">
import {
  createPackLayout,
  formatPackValue,
  type PackTableLabels,
  type PackTree,
  packColor,
  packLabels,
} from './model.ts';

type Props = {
  title: string;
  description: string;
  root: PackTree;
  labels?: Partial<PackTableLabels>;
  width?: number;
  height?: number;
  padding?: number;
};

let { title, description, root, labels, width = 640, height = 420, padding = 2 }: Props = $props();

const uid = $props.id();
const text = $derived(packLabels(labels));
const safeWidth = $derived(Number.isFinite(width) ? Math.max(120, width) : 640);
const safeHeight = $derived(Number.isFinite(height) ? Math.max(120, height) : 420);
const circles = $derived(createPackLayout(root, { width: safeWidth, height: safeHeight, padding }));
const leaves = $derived(circles.filter((circle) => circle.leaf));

$effect(() => {
  if (title.trim() === '') throw new TypeError('PackChart needs a non-empty title.');
  if (description.trim() === '') throw new TypeError('PackChart needs an accessible description.');
});
</script>

<figure class="pack" data-kind="pack">
  <figcaption>
    <h3>{title}</h3>
    <p>{description}</p>
  </figcaption>
  <svg
    direction="ltr"
    viewBox="0 0 {safeWidth} {safeHeight}"
    role="img"
    aria-labelledby="{uid}-title {uid}-description"
  >
    <title id="{uid}-title">{title}</title>
    <desc id="{uid}-description">{description}</desc>
    {#each circles.filter((circle) => !circle.leaf) as circle (circle.id)}
      <circle
        data-group={circle.id}
        cx={circle.x}
        cy={circle.y}
        r={circle.r}
        fill="none"
        stroke="var(--tx-chart-grid, var(--tx-border, GrayText))"
        aria-hidden="true"
      />
    {/each}
    {#each leaves as circle, index (circle.id)}
      {@const label = circle.label ?? circle.id}
      <circle
        data-circle={circle.id}
        cx={circle.x}
        cy={circle.y}
        r={circle.r}
        fill={packColor(index)}
        stroke="var(--tx-background, Canvas)"
        stroke-width="2"
        aria-hidden="true"
      >
        <title>{label}: {formatPackValue(circle.value)}</title>
      </circle>
    {/each}
  </svg>
  <details class="data-table">
    <summary>{text.table}</summary>
    <table>
      <caption>{title} data</caption>
      <thead><tr><th scope="col">{text.category}</th><th scope="col">{text.value}</th></tr></thead>
      <tbody>
        {#each circles as circle (circle.id)}
          <tr>
            <th scope="row" data-depth={Math.min(circle.depth, 6)}>{circle.label ?? circle.id}</th>
            <td>{formatPackValue(circle.value)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </details>
</figure>

<style>
  .pack { color: var(--tx-foreground, CanvasText); margin: 0; max-inline-size: 100%; }
  figcaption h3 { font-size: 1rem; margin-block: 0; }
  figcaption p { color: var(--tx-muted-foreground, GrayText); margin-block: 0.25rem 0.75rem; }
  svg { display: block; inline-size: 100%; max-block-size: 26rem; }
  .data-table { margin-block-start: 0.75rem; }
  summary { cursor: pointer; min-block-size: 2.75rem; align-content: center; }
  table { border-collapse: collapse; inline-size: 100%; }
  th, td { border: 1px solid var(--tx-chart-grid, var(--tx-border, GrayText)); padding: 0.375rem 0.5rem; text-align: start; }
  th[scope='row'][data-depth='1'] { padding-inline-start: 1.5rem; }
  th[scope='row'][data-depth='2'] { padding-inline-start: 2.5rem; }
  th[scope='row'][data-depth='3'] { padding-inline-start: 3.5rem; }
  th[scope='row'][data-depth='4'] { padding-inline-start: 4.5rem; }
  th[scope='row'][data-depth='5'] { padding-inline-start: 5.5rem; }
  th[scope='row'][data-depth='6'] { padding-inline-start: 6.5rem; }
  @media (forced-colors: active) {
    figcaption p { color: CanvasText; }
    svg circle { fill: Canvas; stroke: CanvasText; }
    svg circle[data-circle] { fill: Highlight; }
  }
</style>
