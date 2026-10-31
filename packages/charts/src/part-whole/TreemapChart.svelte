<script lang="ts">
import Legend from '../interaction/Legend.svelte';
import { treemap } from '../math/layout/treemap.ts';
import {
  assertPartWholeChrome,
  formatPartWholeValue,
  type PartWholeTableLabels,
  type PartWholeTree,
  partWholeColor,
  partWholeTableLabels,
  treeTableRows,
} from './model.ts';
import PartWholeDataTable from './PartWholeDataTable.svelte';

type Props = {
  title: string;
  description: string;
  root: PartWholeTree;
  /** Table and legend labels; a missing or blank one keeps its default. */
  labels: Partial<PartWholeTableLabels>;
  width?: number;
  height?: number;
  padding?: number;
};

let { title, description, root, labels, width = 640, height = 360, padding = 2 }: Props = $props();
const tableLabels = $derived(partWholeTableLabels(labels));

$effect.pre(() => {
  assertPartWholeChrome(title, description);
});

const uid = $props.id();
const rects = $derived(treemap(root, { width, height, padding }));
const leaves = $derived(rects.filter((rect) => rect.leaf && rect.value > 0));
const rows = $derived(treeTableRows(root));
const legendItems = $derived(
  leaves.map((rect, index) => ({
    id: rect.id,
    label: rect.label ?? rect.id,
    color: partWholeColor(index),
    symbol: 'square' as const,
  }))
);
</script>

<figure class="part-whole">
  <figcaption>
    <h3 id="{uid}-title">{title}</h3>
    <p id="{uid}-description">{description}</p>
  </figcaption>
  <svg
    direction="ltr"
    viewBox="0 0 {width} {height}"
    role="img"
    aria-labelledby="{uid}-title {uid}-description"
    class="chart"
  >
    <title>{title}</title>
    <desc>{description}</desc>
    {#each leaves as rect, index (rect.id)}
      {@const label = rect.label ?? rect.id}
      <rect
        data-cell={rect.id}
        data-color-index={index % 8}
        x={rect.x0}
        y={rect.y0}
        width={Math.max(0, rect.x1 - rect.x0)}
        height={Math.max(0, rect.y1 - rect.y0)}
        fill={partWholeColor(index)}
        stroke="var(--tx-background, Canvas)"
        stroke-width="2"
        aria-hidden="true"
      >
        <title>{label}: {formatPartWholeValue(rect.value)}</title>
      </rect>
    {/each}
  </svg>
  <Legend items={legendItems} label={tableLabels.category} />
  <PartWholeDataTable {title} labels={tableLabels} {rows} />
</figure>

<style>
  .part-whole {
    color: var(--tx-foreground, CanvasText);
    margin: 0;
    max-inline-size: 100%;
  }

  figcaption h3 {
    font-size: var(--tx-type-body-size);
    margin-block: 0;
  }

  figcaption p {
    color: var(--tx-muted-foreground, CanvasText);
    margin-block: var(--tx-space-1) var(--tx-space-3);
  }

  .chart {
    display: block;
    inline-size: 100%;
    max-block-size: 22rem;
  }

  @media (forced-colors: active) {
    .chart rect {
      stroke: Canvas;
      stroke-width: 3;
    }
  }
  @media (forced-colors: active) {
    figcaption h3, figcaption p { color: CanvasText; }
  }
</style>
