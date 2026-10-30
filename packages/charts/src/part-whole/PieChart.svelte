<script lang="ts">
import Legend from '../interaction/Legend.svelte';
import { arcPath, pie } from '../math/shapes/arc.ts';
import {
  assertPartWholeChrome,
  centerTotalFits,
  formatPartWholeValue,
  type PartWholeDatum,
  type PartWholeTableLabels,
  partWholeColor,
} from './model.ts';
import PartWholeDataTable from './PartWholeDataTable.svelte';

type Props = {
  title: string;
  description: string;
  data: readonly PartWholeDatum[];
  labels: PartWholeTableLabels;
  size?: number;
  innerRatio?: number;
  padAngle?: number;
};

let {
  title,
  description,
  data,
  labels,
  size = 240,
  innerRatio = 0,
  padAngle = 0.01,
}: Props = $props();

$effect.pre(() => {
  assertPartWholeChrome(title, description);
});

const uid = $props.id();
const center = $derived(size / 2);
const radius = $derived(Math.max(0, size * 0.45));
const innerRadius = $derived(radius * Math.min(0.85, Math.max(0, innerRatio)));
const slices = $derived(
  pie(
    data.map((datum) => datum.value),
    { padAngle }
  )
);
const total = $derived(slices.reduce((sum, slice) => sum + slice.value, 0));
const rows = $derived(
  data.map((datum, index) => ({
    id: datum.id,
    label: datum.label,
    value: slices[index]?.value ?? 0,
  }))
);
const legendItems = $derived(
  data.map((datum, index) => ({
    id: datum.id,
    label: datum.label,
    color: partWholeColor(index),
    symbol: 'square' as const,
  }))
);
// The center total's font size, in the SVG's user units (0.8rem at the
// default 240 viewBox): like the gauge's labels, it scales with the chart,
// which keeps the fit check below exact.
const centerFontSize = $derived(size * 0.0533);
const totalText = $derived(formatPartWholeValue(total));
const showCenterTotal = $derived(
  innerRadius > 0 && centerTotalFits(totalText, innerRadius, centerFontSize)
);
</script>

<figure class="part-whole">
  <figcaption>
    <h3 id="{uid}-title">{title}</h3>
    <p id="{uid}-description">{description}</p>
  </figcaption>
  <svg
    direction="ltr"
    viewBox="0 0 {size} {size}"
    role="img"
    aria-labelledby="{uid}-title {uid}-description"
    class="chart"
  >
    <g transform="translate({center},{center})">
      {#each slices as slice (slice.index)}
        {@const datum = data[slice.index]}
        {#if datum}
          <path
            data-slice={datum.id}
            data-color-index={slice.index % 8}
            d={arcPath({
              innerRadius,
              outerRadius: radius,
              startAngle: slice.startAngle,
              endAngle: slice.endAngle,
              padAngle: slice.padAngle,
            })}
            fill={partWholeColor(slice.index)}
            stroke="var(--tx-background, Canvas)"
            stroke-width="2"
            aria-hidden="true"
          >
            <title>{datum.label}: {formatPartWholeValue(slice.value)}</title>
          </path>
        {/if}
      {/each}
      {#if showCenterTotal}
        <text class="center-total" x="0" y="0" font-size={centerFontSize} aria-hidden="true">{totalText}</text>
      {/if}
    </g>
  </svg>
  <Legend items={legendItems} label={labels.category} />
  <PartWholeDataTable {title} {labels} {rows} />
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
    inline-size: min(100%, 18rem);
    margin-inline: auto;
    overflow: visible;
  }

  .center-total {
    fill: var(--tx-foreground, CanvasText);
    /* Font size is the text's font-size attribute, in user units (CSS would override it). */
    font-variant-numeric: tabular-nums;
    text-anchor: middle;
    dominant-baseline: middle;
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
