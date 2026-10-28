<script lang="ts">
import { safeHref, safeImageSrc } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';
import type { NodeTypeSpec, WorkflowNode } from '../model/types.ts';
import type { ConnectState } from './controller.svelte.ts';
import type { Box, PortPlacement } from './geometry.ts';
import { formatLabel, type WorkflowLabels } from './labels.ts';
import NodeBody from './NodeBody.svelte';
import type { WorkflowNodeContext } from './types.ts';

/**
 * One node on the canvas: a focusable group with its body and port buttons.
 * Its own component, so a change to one node (a move, a selection) updates
 * only that node.
 */
interface Props {
  node: WorkflowNode;
  spec: NodeTypeSpec | undefined;
  box: Box;
  ports: readonly PortPlacement[];
  selected: boolean;
  tabbable: boolean;
  dragging: boolean;
  connections: number;
  connect: ConnectState | null;
  readonly: boolean;
  labels: WorkflowLabels;
  roleDescription: string;
  uid: string;
  helpId: string;
  body?: Snippet<[WorkflowNodeContext]>;
  onnodedown: (event: PointerEvent, id: string) => void;
  onportdown: (event: PointerEvent, node: string, port: string) => void;
  onportclick: (node: string, port: string) => void;
}

let {
  node,
  spec,
  box,
  ports,
  selected,
  tabbable,
  dragging,
  connections,
  connect,
  readonly,
  labels,
  roleDescription,
  uid,
  helpId,
  body,
  onnodedown,
  onportdown,
  onportclick,
}: Props = $props();

const name = $derived(node.label || spec?.label || node.type);
const summaryId = $derived(`${uid}-n-${node.id}`);
const context: WorkflowNodeContext = $derived({
  node,
  spec,
  selected,
  focused: tabbable,
  readonly,
  safeHref: (value) => safeHref(value, 'untrusted'),
  safeImageSrc: (value) => safeImageSrc(value, 'untrusted'),
});
const candidates = $derived(
  new Set(
    connect?.candidates.filter((target) => target.node === node.id).map((target) => target.port) ??
      []
  )
);
const specPorts = $derived(new Map((spec?.ports ?? []).map((port) => [port.id, port])));
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -- a node is a focusable group (roving tab stop) holding its ports. -->
<div
  class="tx-workflow-node"
  data-wf-node={node.id}
  data-category={spec?.category}
  data-selected={selected || undefined}
  data-dragging={dragging || undefined}
  role="group"
  aria-roledescription={roleDescription}
  aria-label={name}
  aria-describedby={`${summaryId} ${helpId}`}
  tabindex={tabbable ? 0 : -1}
  style={`left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px`}
  onpointerdown={(event) => onnodedown(event, node.id)}
>
  <span id={summaryId} class="tx-workflow-node__sr"
    >{formatLabel(labels.nodeSummary, { type: spec?.label ?? node.type, count: connections })}{selected
      ? ` ${formatLabel(labels.nodeSelected)}.`
      : ''}</span
  >
  <div class="tx-workflow-node__body">
    {#if body}
      {@render body(context)}
    {:else}
      <NodeBody item={context} />
    {/if}
  </div>
  {#each ports as place (place.port)}
    {@const port = specPorts.get(place.port)}
    {@const candidate = candidates.has(place.port)}
    {@const source = connect?.source.node === node.id && connect.source.port === place.port}
    <button
      type="button"
      class="tx-workflow-port"
      data-wf-port={place.port}
      data-wf-port-node={node.id}
      data-direction={place.direction}
      data-side={place.side}
      data-candidate={candidate || undefined}
      data-source={source || undefined}
      style={`left:${place.point.x - box.x}px;top:${place.point.y - box.y}px`}
      tabindex={tabbable || candidate || source ? 0 : -1}
      aria-label={formatLabel(place.direction === 'in' ? labels.inputPort : labels.outputPort, {
        port: port?.label ?? place.port,
        node: name,
      })}
      aria-disabled={readonly || undefined}
      onpointerdown={(event) => onportdown(event, node.id, place.port)}
      onclick={() => onportclick(node.id, place.port)}
    ><span class="tx-workflow-port__dot"></span></button>
  {/each}
</div>

<style>
  @layer tx.components {
    .tx-workflow-node {
      position: absolute;
      box-sizing: border-box;
      padding: 0.5rem 0.75rem;
      background: var(--tx-surface, Canvas);
      border: 1px solid var(--tx-border, CanvasText);
      border-inline-start: 4px solid var(--tx-workflow-accent, var(--tx-primary, CanvasText));
      border-radius: var(--tx-radius-md, 0.5rem);
      box-shadow: var(--tx-shadow-soft, none);
      cursor: grab;
      touch-action: none;
      user-select: none;
    }

    .tx-workflow-node[data-selected] {
      outline: 2px solid var(--tx-primary, Highlight);
      outline-offset: 2px;
    }

    .tx-workflow-node[data-dragging] {
      cursor: grabbing;
      opacity: 0.9;
      /* The canvas sets the drag offset once per frame for every dragged node. */
      translate: var(--tx-workflow-drag-x, 0) var(--tx-workflow-drag-y, 0);
    }

    .tx-workflow-node:focus-visible,
    .tx-workflow-port:focus-visible {
      outline: 3px solid var(--tx-ring, Highlight);
      outline-offset: 2px;
    }

    .tx-workflow-node__sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .tx-workflow-node__body {
      block-size: 100%;
      overflow: hidden;
    }

    .tx-workflow-port {
      position: absolute;
      inline-size: 24px;
      block-size: 24px;
      margin: -12px 0 0 -12px;
      padding: 0;
      display: grid;
      place-items: center;
      background: transparent;
      border: 0;
      border-radius: 50%;
      cursor: crosshair;
      touch-action: none;
    }

    .tx-workflow-port__dot {
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      background: var(--tx-surface, Canvas);
      border: 2px solid var(--tx-muted-foreground, CanvasText);
    }

    .tx-workflow-port[data-direction='out'] .tx-workflow-port__dot {
      background: var(--tx-muted-foreground, CanvasText);
    }

    .tx-workflow-port[data-candidate] .tx-workflow-port__dot {
      border-color: var(--tx-primary, Highlight);
      box-shadow: 0 0 0 3px color-mix(in oklab, var(--tx-primary, Highlight) 35%, transparent);
    }

    .tx-workflow-port[data-source] .tx-workflow-port__dot {
      background: var(--tx-primary, Highlight);
      border-color: var(--tx-primary, Highlight);
    }

    @media (prefers-reduced-motion: no-preference) {
      .tx-workflow-node:not([data-dragging]) {
        transition: box-shadow 120ms ease;
      }
    }

    @media (forced-colors: active) {
      .tx-workflow-node {
        border-color: CanvasText;
      }

      .tx-workflow-node[data-selected],
      .tx-workflow-node:focus-visible,
      .tx-workflow-port:focus-visible {
        outline-color: Highlight;
      }

      .tx-workflow-port[data-candidate] .tx-workflow-port__dot,
      .tx-workflow-port[data-source] .tx-workflow-port__dot {
        border-color: Highlight;
      }
    }
  }
</style>
