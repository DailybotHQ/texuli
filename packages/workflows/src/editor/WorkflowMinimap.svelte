<script lang="ts">
import { screenToWorld } from '@texuli/drag/spatial';
import type { WorkflowController } from './controller.svelte.ts';
import { boundsOfBoxes, fitInto, sizeOf } from './geometry.ts';
import { formatLabel } from './labels.ts';

/**
 * An overview of the whole graph with the visible area outlined. Pointer
 * only (press or drag to recenter the view); keyboard users have fit, zoom
 * and spatial focus, so it stays out of the tab order.
 */
let {
  controller,
  width = 192,
  height = 128,
}: { controller: WorkflowController; width?: number; height?: number } = $props();

const visible = $derived.by(() => {
  const { width: w, height: h } = controller.viewport;
  const a = screenToWorld({ x: 0, y: 0 }, controller.view);
  const b = screenToWorld({ x: w, y: h }, controller.view);
  return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
});
// Rest positions from the graph, not the live scene: a drag preview does not redraw the minimap.
const rects = $derived(
  controller.graph.nodes.map((node) => {
    const size = sizeOf(node, controller.nodeSize);
    return {
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width: size.width,
      height: size.height,
    };
  })
);
const content = $derived(boundsOfBoxes([...rects, ...(visible.width > 0 ? [visible] : [])]));
const map = $derived(fitInto(content, width, height));

let dragging = false;

function recenter(event: PointerEvent): void {
  const svg = event.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const wx = (event.clientX - rect.left - map.x) / map.scale;
  const wy = (event.clientY - rect.top - map.y) / map.scale;
  const { zoom } = controller.view;
  controller.setView({
    x: controller.viewport.width / 2 - wx * zoom,
    y: controller.viewport.height / 2 - wy * zoom,
    zoom,
  });
}
</script>

<svg
  class="tx-workflow-minimap"
  role="img"
  aria-label={formatLabel(controller.labels.minimap)}
  {width}
  {height}
  viewBox={`0 0 ${width} ${height}`}
  onpointerdown={(event) => {
    event.stopPropagation();
    dragging = true;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    recenter(event);
  }}
  onpointermove={(event) => {
    if (dragging) recenter(event);
  }}
  onpointerup={() => {
    dragging = false;
  }}
  onpointercancel={() => {
    dragging = false;
  }}
>
  <g transform={`translate(${map.x} ${map.y}) scale(${map.scale})`}>
    {#each rects as box (box.id)}
      <rect
        class="tx-workflow-minimap__node"
        data-selected={controller.selection.has(box.id) || undefined}
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        rx="6"
      />
    {/each}
    {#if visible.width > 0}
      <rect
        class="tx-workflow-minimap__view"
        x={visible.x}
        y={visible.y}
        width={visible.width}
        height={visible.height}
        vector-effect="non-scaling-stroke"
      />
    {/if}
  </g>
</svg>

<style>
  @layer tx.components {
    .tx-workflow-minimap {
      position: absolute;
      inset-block-end: 0.5rem;
      inset-inline-end: 0.5rem;
      background: var(--tx-surface, Canvas);
      border: 1px solid var(--tx-border, CanvasText);
      border-radius: var(--tx-radius-md, 0.5rem);
      cursor: pointer;
      touch-action: none;
    }

    .tx-workflow-minimap__node {
      fill: var(--tx-muted-foreground, GrayText);
    }

    .tx-workflow-minimap__node[data-selected] {
      fill: var(--tx-primary, Highlight);
    }

    .tx-workflow-minimap__view {
      fill: color-mix(in oklab, var(--tx-primary, Highlight) 10%, transparent);
      stroke: var(--tx-primary, Highlight);
      stroke-width: 1.5;
    }

    @media (forced-colors: active) {
      .tx-workflow-minimap__node {
        fill: CanvasText;
      }

      .tx-workflow-minimap__view {
        fill: none;
        stroke: Highlight;
      }
    }
  }
</style>
