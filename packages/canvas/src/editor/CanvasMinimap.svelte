<script lang="ts">
// An overview of the whole canvas with the visible area outlined. Pointer
// only (press or drag to recenter); keyboard users zoom, fit and move by
// shape, so it stays out of the tab order and the accessibility tree.
import { screenToWorld } from '@texuli/drag/spatial';
import { shapeBounds, unionRects } from '../model/document.ts';
import type { CanvasController } from './controller.svelte.ts';

let {
  controller,
  width = 176,
  height = 120,
}: { controller: CanvasController; width?: number; height?: number } = $props();

const visible = $derived.by(() => {
  const a = screenToWorld({ x: 0, y: 0 }, controller.view);
  const b = screenToWorld(
    { x: controller.viewport.width, y: controller.viewport.height },
    controller.view
  );
  return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
});
const rects = $derived(
  controller.doc.shapes.map((shape) => ({ id: shape.id, ...shapeBounds(shape) }))
);
const content = $derived(unionRects([...rects, ...(visible.width > 0 ? [visible] : [])]));
const map = $derived.by(() => {
  const pad = 6;
  const scale = Math.min(
    (width - pad * 2) / Math.max(1, content.width),
    (height - pad * 2) / Math.max(1, content.height)
  );
  return {
    scale,
    x: pad + (width - pad * 2 - content.width * scale) / 2 - content.x * scale,
    y: pad + (height - pad * 2 - content.height * scale) / 2 - content.y * scale,
  };
});

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
  class="tx-canvas-minimap"
  aria-hidden="true"
  {width}
  {height}
  onpointerdown={(event) => {
    event.stopPropagation();
    dragging = true;
    (event.currentTarget as SVGSVGElement).setPointerCapture?.(event.pointerId);
    recenter(event);
  }}
  onpointermove={(event) => {
    if (dragging) recenter(event);
  }}
  onpointerup={() => (dragging = false)}
  onpointercancel={() => (dragging = false)}
>
  <g transform={`translate(${map.x} ${map.y}) scale(${map.scale})`}>
    {#each rects as r (r.id)}
      <rect class="tx-canvas-minimap__shape" x={r.x} y={r.y} width={Math.max(r.width, 1 / map.scale)} height={Math.max(r.height, 1 / map.scale)} />
    {/each}
    <rect class="tx-canvas-minimap__view" x={visible.x} y={visible.y} width={visible.width} height={visible.height} stroke-width={1.5 / map.scale} />
  </g>
</svg>

<style>
  @layer tx.components {
    .tx-canvas-minimap {
      position: absolute;
      inset-block-end: 0.5rem;
      inset-inline-end: 0.5rem;
      border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
      border-radius: var(--tx-shape-radius-md);
      background: var(--tx-surface, Canvas);
      cursor: pointer;
      touch-action: none;
    }

    .tx-canvas-minimap__shape {
      fill: var(--tx-muted-foreground, GrayText);
      opacity: 0.5;
    }

    .tx-canvas-minimap__view {
      fill: color-mix(in oklab, var(--tx-primary, Highlight) 10%, transparent);
      stroke: var(--tx-primary, Highlight);
    }

    @media (forced-colors: active) {
      .tx-canvas-minimap__view {
        stroke: Highlight;
      }
    }
  }
</style>
