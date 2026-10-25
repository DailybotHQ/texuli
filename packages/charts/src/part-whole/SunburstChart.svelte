<script lang="ts">
import Legend from '../interaction/Legend.svelte';
import { sunburst } from '../math/layout/sunburst.ts';
import { arcPath } from '../math/shapes/arc.ts';
import {
  formatPartWholeValue,
  type PartWholeTableLabels,
  type PartWholeTree,
  partWholeColor,
  treeTableRows,
} from './model.ts';
import PartWholeDataTable from './PartWholeDataTable.svelte';

type Props = {
  title: string;
  description: string;
  root: PartWholeTree;
  labels: PartWholeTableLabels;
  size?: number;
  innerRatio?: number;
  padAngle?: number;
};

let {
  title,
  description,
  root,
  labels,
  size = 240,
  innerRatio = 0.24,
  padAngle = 0.008,
}: Props = $props();

const uid = $props.id();
const center = $derived(size / 2);
const radius = $derived(Math.max(0, size * 0.48));
const arcs = $derived(
  sunburst(root, { radius, innerRadius: radius * Math.min(0.75, Math.max(0, innerRatio)) })
);
const visibleArcs = $derived(arcs.filter((arc) => arc.depth > 0 && arc.value > 0));
const rows = $derived(treeTableRows(root));
const legendItems = $derived(
  visibleArcs.map((arc, index) => ({
    id: `${arc.id}-${arc.depth}`,
    label: arc.label ?? arc.id,
    color: partWholeColor(index),
    symbol: 'square' as const,
  }))
);
</script>

<figure class="part-whole">
  <figcaption>
    <h3>{title}</h3>
    <p>{description}</p>
  </figcaption>
  <svg
    direction="ltr"
    viewBox="0 0 {size} {size}"
    role="img"
    aria-labelledby="{uid}-title {uid}-description"
    class="chart"
  >
    <title id="{uid}-title">{title}</title>
    <desc id="{uid}-description">{description}</desc>
    <g transform="translate({center},{center})">
      {#each visibleArcs as arc, index (`${arc.id}-${arc.depth}`)}
        {@const label = arc.label ?? arc.id}
        <path
          data-segment={arc.id}
          data-depth={arc.depth}
          data-color-index={index % 8}
          d={arcPath({
            innerRadius: arc.y0,
            outerRadius: arc.y1,
            startAngle: arc.x0 + Math.PI / 2,
            endAngle: arc.x1 + Math.PI / 2,
            padAngle,
          })}
          fill={partWholeColor(index)}
          stroke="var(--tx-background, Canvas)"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <title>{label}: {formatPartWholeValue(arc.value)}</title>
        </path>
      {/each}
    </g>
  </svg>
  <Legend items={legendItems} label="Chart categories" />
  <PartWholeDataTable {title} {labels} {rows} />
</figure>

<style>
  .part-whole {
    color: var(--tx-foreground, CanvasText);
    margin: 0;
    max-inline-size: 100%;
  }

  figcaption h3 {
    font-size: 1rem;
    margin-block: 0;
  }

  figcaption p {
    color: var(--tx-muted-foreground, CanvasText);
    margin-block: 0.25rem 0.75rem;
  }

  .chart {
    display: block;
    inline-size: min(100%, 18rem);
    margin-inline: auto;
    overflow: visible;
  }

  @media (forced-colors: active) {
    .chart path {
      stroke: Canvas;
      stroke-width: 3;
    }
  }
  @media (forced-colors: active) {
    figcaption h3, figcaption p { color: CanvasText; }
  }
</style>
