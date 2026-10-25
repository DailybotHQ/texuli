<script lang="ts">
import { type ClassValue, cx } from 'texuli/cx';
import FlowDataTable from './FlowDataTable.svelte';
import {
  type FlowChartLabels,
  flowChartLabels,
  flowColor,
  formatFlowValue,
  type NetworkLinkInput,
  type NetworkNodeInput,
  networkLayout,
} from './model.ts';

type Props = {
  title: string;
  description?: string;
  nodes: readonly NetworkNodeInput[];
  links: readonly NetworkLinkInput[];
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
  width = 480,
  height = 360,
  labels,
  class: className,
}: Props = $props();
const uid = $props.id();
const text = $derived(flowChartLabels(labels));
const graph = $derived.by(() => {
  try {
    return { value: networkLayout(nodes, links, width, height), error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : String(error) };
  }
});
const summary = $derived(
  customDescription ?? `${title}: ${nodes.length} nodes and ${links.length} connections.`
);
const nodeName = (id: string) => nodes.find((node) => node.id === id)?.label ?? id;
</script>

<figure class={cx('flow-chart', className)}>
  <figcaption><h3>{title}</h3><p>{summary}</p></figcaption>
  {#if graph.value}
    <svg direction="ltr" class="flow-svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="{uid}-title" aria-describedby="{uid}-description">
      <title id="{uid}-title">{title}</title><desc id="{uid}-description">{summary}</desc>
      {#each graph.value.links as link, index (`${link.source}:${link.target}:${index}`)}
        <path data-connection="{link.source}>{link.target}" d={link.path} fill="none" stroke={flowColor(index)} stroke-width={Math.max(1, Math.min(8, link.value ?? 1))} stroke-opacity="0.55" />
      {/each}
      {#each graph.value.nodes as node, index (node.id)}
        <circle data-node={node.id} cx={node.x} cy={node.y} r={node.radius} fill={flowColor(index)} />
        <text x={node.x} y={node.y + node.radius + 14} text-anchor="middle">{node.label ?? node.id}</text>
      {/each}
    </svg>
    <FlowDataTable
      title={title}
      summary={text.tableSummary}
      headers={[text.from, text.to, text.value]}
      rows={links.map((link, index) => ({ id: `${link.source}:${link.target}:${index}`, cells: [nodeName(link.source), nodeName(link.target), link.value ?? 1] }))}
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
  .flow-svg text { fill: var(--tx-foreground, CanvasText); font: 16px var(--tx-font-sans, system-ui, sans-serif); }
  @media (forced-colors: active) { .flow-svg path { stroke: CanvasText; stroke-dasharray: 4 3; } .flow-svg circle { fill: Canvas; stroke: CanvasText; stroke-width: 2; } }
  @media (forced-colors: active) {
    figcaption h3, figcaption p { color: CanvasText; }
  }
</style>
