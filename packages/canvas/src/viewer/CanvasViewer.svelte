<script lang="ts">
// A read-only canvas: the content fitted into an SVG image, and the same
// shapes and connectors as a visually hidden list in reading order, so a
// screen reader gets the structure the picture shows. Used by the player
// host and by document embeds; lighter than the editor.
import type { HrefTrust } from '@texuli/core/url-policy';
import type { HTMLAttributes } from 'svelte/elements';
import {
  type CanvasLabelOverrides,
  formatCanvasLabel,
  resolveCanvasLabels,
} from '../editor/labels.ts';
import ShapeView from '../editor/ShapeView.svelte';
import { routeConnector } from '../model/connectors.ts';
import { canvasBounds, indexShapes, readingOrder, shapeName } from '../model/document.ts';
import { dashArray, PALETTE_TOKENS, resolvePaint } from '../model/paint.ts';
import type { CanvasDocument } from '../model/types.ts';

interface Props extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** A validated canvas (`validateCanvas` or `loadUntrustedCanvas`). */
  canvas: CanvasDocument;
  /** Accessible name (default: the canvas title). */
  label?: string;
  trust?: HrefTrust;
  resolveImage?: (ref: string) => string | null | undefined;
  dir?: 'ltr' | 'rtl';
  labels?: CanvasLabelOverrides;
  /** Space around the content in world units (default 24). */
  padding?: number;
  /** The root element (`bind:ref`). */
  ref?: HTMLElement | null;
  class?: string;
}

let {
  canvas,
  label,
  trust = 'untrusted',
  resolveImage,
  dir = 'ltr',
  labels,
  padding = 24,
  ref = $bindable(null),
  class: className = '',
  ...rest
}: Props = $props();

const uid = $props.id();
const L = $derived(resolveCanvasLabels(labels));
const name = $derived(label ?? canvas.meta?.title ?? formatCanvasLabel(L.canvas));
const box = $derived.by(() => {
  const b = canvasBounds(canvas);
  return {
    x: b.x - padding,
    y: b.y - padding,
    width: Math.max(1, b.width + padding * 2),
    height: Math.max(1, b.height + padding * 2),
  };
});
const index = $derived(indexShapes(canvas));
const lookup = $derived(new Map([...index].map(([id, entry]) => [id, entry.shape])));
const routes = $derived(
  canvas.connectors.flatMap((connector) => {
    const route = routeConnector(connector, lookup);
    return route ? [{ connector, route, style: resolvePaint(connector, 'connector') }] : [];
  })
);
const kindOf = (type: string) => formatCanvasLabel(L.kinds[type] ?? type);
const describe = (id: string) => {
  const shape = lookup.get(id);
  if (!shape) return id;
  const text = shapeName(shape);
  return text ? `${text} (${kindOf(shape.type)})` : kindOf(shape.type);
};
const items = $derived(
  readingOrder(canvas, dir).map((id) => ({
    id,
    text: describe(id),
    level: (() => {
      let level = 0;
      let parent = index.get(id)?.parent ?? null;
      while (parent) {
        level += 1;
        parent = index.get(parent.id)?.parent ?? null;
      }
      return level;
    })(),
  }))
);
const links = $derived(
  canvas.connectors.map((connector) => {
    const end = (e: typeof connector.from) =>
      'shape' in e ? describe(e.shape) : `${Math.round(e.x)}, ${Math.round(e.y)}`;
    const text = formatCanvasLabel(L.connector, {
      name: end(connector.from),
      target: end(connector.to),
    });
    return { id: connector.id, text: connector.text ? `${text}: ${connector.text}` : text };
  })
);
</script>

<figure bind:this={ref} {...rest} class={['tx-canvas-viewer', className]} {dir}>
  <svg
    class="tx-canvas-viewer__svg"
    role="img"
    aria-label={name}
    viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
    preserveAspectRatio="xMidYMid meet"
  >
    <defs>
      <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10z" fill="var(--tx-foreground, CanvasText)" />
      </marker>
      <marker id={`${uid}-dot`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
        <circle cx="5" cy="5" r="4" fill="var(--tx-foreground, CanvasText)" />
      </marker>
    </defs>
    {#each canvas.shapes as shape (shape.id)}
      <ShapeView {shape} {trust} {dir} {resolveImage} {uid} imageMissing={(alt) => formatCanvasLabel(L.imageMissing, { name: alt })} />
    {/each}
    {#each routes as item (item.connector.id)}
      <path
        class="tx-canvas-viewer__connector"
        d={item.route.path}
        stroke={item.style.stroke === 'none' ? 'none' : PALETTE_TOKENS[item.style.stroke]}
        stroke-width={item.style.strokeWidth}
        stroke-dasharray={dashArray(item.style.dash, item.style.strokeWidth)}
        marker-start={item.connector.startCap === 'arrow' ? `url(#${uid}-arrow)` : item.connector.startCap === 'dot' ? `url(#${uid}-dot)` : undefined}
        marker-end={(item.connector.endCap ?? 'arrow') === 'arrow' ? `url(#${uid}-arrow)` : item.connector.endCap === 'dot' ? `url(#${uid}-dot)` : undefined}
      />
      {#if item.connector.text}
        <text class="tx-canvas-viewer__label" x={item.route.mid.x} y={item.route.mid.y - 6} text-anchor="middle">{item.connector.text}</text>
      {/if}
    {/each}
  </svg>
  <figcaption class="tx-canvas-viewer__structure">
    <span>{name}</span>
    {#if items.length > 0}
      <ul>
        {#each items as item (item.id)}<li data-level={item.level}>{item.text}</li>{/each}
        {#each links as link (link.id)}<li>{link.text}</li>{/each}
      </ul>
    {:else}
      <span>{formatCanvasLabel(L.empty)}</span>
    {/if}
  </figcaption>
</figure>

<style>
  @layer tx.components {
    .tx-canvas-viewer {
      position: relative;
      margin: 0;
      color: var(--tx-foreground, CanvasText);
      background: var(--tx-surface, Canvas);
      border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
      border-radius: var(--tx-shape-radius-xl);
      overflow: hidden;
    }

    .tx-canvas-viewer__svg {
      display: block;
      inline-size: 100%;
      block-size: auto;
      max-block-size: 70vh;
    }

    .tx-canvas-viewer__connector {
      fill: none;
    }

    .tx-canvas-viewer__label {
      fill: var(--tx-foreground, CanvasText);
      font-size: 13px;
      paint-order: stroke;
      stroke: var(--tx-surface, Canvas);
      stroke-width: 4px;
    }

    .tx-canvas-viewer__structure {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }
</style>
