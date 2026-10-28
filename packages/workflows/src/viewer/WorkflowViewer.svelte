<script lang="ts">
import { safeHref, safeImageSrc } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';
import {
  buildScene,
  type FlowDirection,
  type NodeSize,
  type TextDirection,
} from '../editor/geometry.ts';
import {
  formatLabel,
  resolveWorkflowLabels,
  type WorkflowLabelsOverrides,
} from '../editor/labels.ts';
import NodeBody from '../editor/NodeBody.svelte';
import type { WorkflowNodeContext } from '../editor/types.ts';
import type { NodeTypeRegistry } from '../model/registry.ts';
import type { WorkflowGraph, WorkflowNode } from '../model/types.ts';

/**
 * A read-only workflow: nodes are a list (each says where it connects),
 * edges are drawn behind them. It scales down to fit its width, never up.
 * No editing code ships with it.
 */
interface Props {
  graph: WorkflowGraph;
  registry: NodeTypeRegistry;
  /** Accessible name. Default: the `viewer` label. */
  label?: string;
  flow?: FlowDirection;
  dir?: TextDirection;
  nodeSize?: (node: WorkflowNode) => NodeSize;
  node?: Snippet<[WorkflowNodeContext]>;
  labels?: WorkflowLabelsOverrides;
  class?: string;
}

let {
  graph,
  registry,
  label,
  flow = 'LR',
  dir = 'ltr',
  nodeSize,
  node: nodeSnippet,
  labels: overrides = {},
  class: className = '',
}: Props = $props();

const PAD = 16;
const labels = $derived(resolveWorkflowLabels(overrides));
const scene = $derived(
  buildScene(graph, registry, { flow, dir, ...(nodeSize ? { nodeSize } : {}) })
);
const width = $derived(scene.bounds.width + PAD * 2);
const height = $derived(scene.bounds.height + PAD * 2);
const dx = $derived(PAD - scene.bounds.x);
const dy = $derived(PAD - scene.bounds.y);
let available = $state(0);
const scale = $derived(available > 0 ? Math.min(1, available / Math.max(1, width)) : 1);
const uid = $props.id();

const connections = $derived.by(() => {
  const out = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const text = formatLabel(labels.viewerConnection, {
      node: '',
      port:
        registry.port(graph.nodes.find((n) => n.id === edge.from.node)?.type ?? '', edge.from.port)
          ?.label ?? edge.from.port,
      target: name(edge.to.node),
    }).trim();
    const list = out.get(edge.from.node);
    if (list) list.push(text);
    else out.set(edge.from.node, [text]);
  }
  return out;
});

function name(id: string): string {
  const found = graph.nodes.find((candidate) => candidate.id === id);
  return found ? found.label || registry.get(found.type)?.label || found.type : id;
}

function context(node: WorkflowNode): WorkflowNodeContext {
  return {
    node,
    spec: registry.get(node.type),
    selected: false,
    focused: true,
    readonly: true,
    safeHref: (value) => safeHref(value, 'untrusted'),
    safeImageSrc: (value) => safeImageSrc(value, 'untrusted'),
  };
}
</script>

<figure class={['tx-workflow-viewer', className]} aria-labelledby={`${uid}-caption`} bind:clientWidth={available} dir={dir}>
  <figcaption id={`${uid}-caption`} class="tx-workflow-viewer__caption">{label ?? formatLabel(labels.viewer)}</figcaption>
  <div class="tx-workflow-viewer__frame" style:block-size={`${height * scale}px`}>
    <!-- World coordinates are physical; the stage is scaled as a whole. -->
    <div class="tx-workflow-viewer__stage" style:width={`${width}px`} style:height={`${height}px`} style:transform={`scale(${scale})`}>
      <svg class="tx-workflow-viewer__edges" aria-hidden="true" {width} {height} viewBox={`0 0 ${width} ${height}`}>
        <g transform={`translate(${dx} ${dy})`}>
          {#each scene.edges as item (item.edge.id)}
            <path d={item.path} />
          {/each}
        </g>
      </svg>
      <ul class="tx-workflow-viewer__nodes">
        {#each graph.nodes as item (item.id)}
          {@const box = scene.boxes.get(item.id)}
          {#if box}
            <li
              class="tx-workflow-viewer__node"
              data-category={registry.get(item.type)?.category}
              style={`left:${box.x + dx}px;top:${box.y + dy}px;width:${box.width}px;height:${box.height}px`}
            >
              {#if nodeSnippet}
                {@render nodeSnippet(context(item))}
              {:else}
                <NodeBody item={context(item)} />
              {/if}
              {#if connections.get(item.id)?.length}
                <span class="tx-workflow-viewer__sr">{connections.get(item.id)?.join('; ')}</span>
              {/if}
            </li>
          {/if}
        {/each}
      </ul>
    </div>
  </div>
</figure>

<style>
  @layer tx.components {
    .tx-workflow-viewer {
      margin: 0;
      color: var(--tx-foreground, CanvasText);
    }

    .tx-workflow-viewer__caption,
    .tx-workflow-viewer__sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .tx-workflow-viewer__frame {
      position: relative;
      overflow: hidden;
    }

    .tx-workflow-viewer__stage {
      position: absolute;
      inset-block-start: 0;
      inset-inline-start: 0;
      transform-origin: 0 0;
      direction: ltr;
    }

    .tx-workflow-viewer__edges {
      position: absolute;
      inset: 0;
    }

    .tx-workflow-viewer__edges path {
      fill: none;
      stroke: var(--tx-muted-foreground, GrayText);
      stroke-width: 2;
    }

    .tx-workflow-viewer__nodes {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tx-workflow-viewer__node {
      position: absolute;
      box-sizing: border-box;
      padding: 0.5rem 0.75rem;
      background: var(--tx-surface, Canvas);
      border: 1px solid var(--tx-border, CanvasText);
      border-inline-start: 4px solid var(--tx-workflow-accent, var(--tx-primary, CanvasText));
      border-radius: var(--tx-radius-md, 0.5rem);
      overflow: hidden;
    }

    @media (forced-colors: active) {
      .tx-workflow-viewer__edges path {
        stroke: CanvasText;
      }
    }
  }
</style>
