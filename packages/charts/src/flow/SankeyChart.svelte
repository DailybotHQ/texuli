<script lang="ts">
import { type ClassValue, cx } from 'texuli/cx';
import { fitChartWidth } from '../math/layout/fit-width.ts';
import FlowDataTable from './FlowDataTable.svelte';
import {
  type FlowChartLabels,
  flowChartLabels,
  flowColor,
  formatFlowValue,
  type SankeyLinkInput,
  type SankeyNodeInput,
  sankey,
} from './model.ts';

type Props = {
  title: string;
  description?: string;
  nodes: readonly SankeyNodeInput[];
  links: readonly SankeyLinkInput[];
  width?: number;
  height?: number;
  labels?: Partial<FlowChartLabels>;
  class?: ClassValue;
};

let {
  title,
  description: customDescription,
  nodes,
  links,
  width: preferredWidth = 640,
  height = 360,
  labels,
  class: className,
}: Props = $props();

const SANKEY_GUTTER = 16;

// Lays out at the figure's measured width, up to `width` (the preferred width).
let measuredWidth = $state(0);
const width = $derived(fitChartWidth(measuredWidth, preferredWidth));
const uid = $props.id();
const text = $derived(flowChartLabels(labels));
const graph = $derived.by(() => {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return { value: null, error: 'Chart width and height must be finite and greater than zero.' };
  }
  try {
    return {
      value: sankey(nodes, links, {
        // A 16-unit inline gutter: node labels sit inside the plot (first and
        // middle columns label to their end, the last column to its start).
        width: Math.max(40, width - 2 * SANKEY_GUTTER),
        height,
        nodeWidth: 14,
        nodePadding: 12,
      }),
      error: null,
    };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : String(error) };
  }
});
const summary = $derived(
  customDescription ?? `${title}: ${nodes.length} nodes and ${links.length} flows.`
);
const nodeName = (id: string) => nodes.find((node) => node.id === id)?.label ?? id;
</script>

<figure bind:clientWidth={measuredWidth} class={cx('flow-chart', className)}>
  <figcaption><h3>{title}</h3><p>{summary}</p></figcaption>
  {#if graph.value}
    <svg direction="ltr" class="flow-svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="{uid}-title" aria-describedby="{uid}-description">
      <title id="{uid}-title">{title}</title><desc id="{uid}-description">{summary}</desc>
      <g transform="translate({SANKEY_GUTTER} 0)">
        {#each graph.value.links as link, index (`${link.source}:${link.target}:${index}`)}
          <path data-flow="{link.source}>{link.target}" d={link.path} fill="none" stroke={flowColor(nodes.findIndex((node) => node.id === link.source))} stroke-width={Math.max(1, link.width)} stroke-opacity="0.45" />
        {/each}
        {#each graph.value.nodes as node, index (node.id)}
          <rect data-node={node.id} x={node.x0} y={node.y0} width={node.x1 - node.x0} height={Math.max(2, node.y1 - node.y0)} rx="2" fill={flowColor(index)} />
          <text x={node.depth === Math.max(0, ...graph.value.nodes.map((item) => item.depth)) ? node.x0 - 6 : node.x1 + 6} y={(node.y0 + node.y1) / 2} text-anchor={node.depth === Math.max(0, ...graph.value.nodes.map((item) => item.depth)) ? 'end' : 'start'} dominant-baseline="middle">{node.label ?? node.id}</text>
        {/each}
      </g>
    </svg>
    <FlowDataTable
      title={title}
      summary={text.tableSummary}
      headers={[text.from, text.to, text.value]}
      rows={links.map((link, index) => ({ id: `${link.source}:${link.target}:${index}`, cells: [nodeName(link.source), nodeName(link.target), link.value] }))}
    />
  {:else}
    <p role="alert">{graph.error}</p>
  {/if}
</figure>

<style>
  .flow-chart { color: var(--tx-foreground, CanvasText); margin: 0; max-inline-size: 100%; }
  figcaption h3 { font-size: 1rem; margin-block: 0; }
  figcaption p { color: var(--tx-muted-foreground, CanvasText); margin-block: 0.25rem 0.75rem; }
  .flow-svg { display: block; inline-size: 100%; max-block-size: 32rem; overflow: visible; }
  /* Token-sized labels: the chart lays out at its drawn width, so user units are pixels. */
  .flow-svg text { fill: var(--tx-foreground, CanvasText); font: var(--tx-font-size-xs, 0.75rem) var(--tx-font-sans, system-ui, sans-serif); }
  @media (forced-colors: active) { .flow-svg path { stroke: CanvasText; stroke-dasharray: 4 3; } .flow-svg rect { fill: Canvas; stroke: CanvasText; stroke-width: 2; } }
  @media (forced-colors: active) {
    figcaption h3, figcaption p { color: CanvasText; }
  }
</style>
