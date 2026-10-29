<script lang="ts">
// One shape as SVG, children included (frames clip theirs). Text is painted
// as text nodes; image URLs come from the host's resolver and pass the URL
// policy at the tier. The editor passes `focus` to make shapes focusable;
// the viewer and exports paint the same geometry without it.

import type { HrefTrust } from '@texuli/core/url-policy';
import { safeImageSrc } from '@texuli/core/url-policy';
import {
  dashArray,
  PALETTE_TOKENS,
  paintedText,
  resolvePaint,
  shapeOutline,
  shapeTransform,
  textLayout,
} from '../model/paint.ts';
import type { CanvasShape } from '../model/types.ts';
// The recursive self-import goes by another name (repository rule: no binding named like its file).
import ShapeNode from './ShapeView.svelte';

export interface ShapeFocus {
  /** The shape that holds the roving tab stop. */
  tabStop: string | null;
  selection: ReadonlySet<string>;
  /** The keyboard connect target. */
  target: string | null;
  /** Shapes whose text is being edited (hidden under the text box). */
  editing: string | null;
  /** The accessible name of a shape. */
  name: (shape: CanvasShape) => string;
  /** The shape kind, announced as its role description. */
  kind: (shape: CanvasShape) => string;
}

interface Props {
  shape: CanvasShape;
  trust?: HrefTrust;
  dir?: 'ltr' | 'rtl';
  resolveImage?: (ref: string) => string | null | undefined;
  /** Prefix for clip path ids (unique per canvas). */
  uid: string;
  focus?: ShapeFocus | null;
  /** Shown for an image whose URL is refused or missing. */
  imageMissing?: (alt: string) => string;
  /** Drag preview offsets in world units by shape id (the same elements move, so focus stays). */
  offsets?: ((id: string) => { x: number; y: number } | null) | null;
}

let {
  shape,
  trust = 'untrusted',
  dir = 'ltr',
  resolveImage,
  uid,
  focus = null,
  imageMissing = (alt) => alt,
  offsets = null,
}: Props = $props();

const offset = $derived(offsets?.(shape.id) ?? null);

const style = $derived(resolvePaint(shape));
const outline = $derived(shape.type === 'group' ? null : shapeOutline(shape));
const transform = $derived(
  [offset ? `translate(${offset.x} ${offset.y})` : '', shapeTransform(shape) ?? '']
    .join(' ')
    .trim() || undefined
);
const text = $derived(paintedText(shape));
const layout = $derived(shape.type === 'group' || !text ? null : textLayout(shape, text, dir));
const open = $derived(
  shape.type === 'line' || shape.type === 'arrow' || (shape.type === 'path' && !shape.closed)
);
const fill = $derived(open ? 'none' : style.fill === 'none' ? 'none' : PALETTE_TOKENS[style.fill]);
const stroke = $derived(style.stroke === 'none' ? 'none' : PALETTE_TOKENS[style.stroke]);
const image = $derived.by(() => {
  if (shape.type !== 'image') return undefined;
  const resolved = resolveImage?.(shape.ref);
  return typeof resolved === 'string' ? safeImageSrc(resolved, trust) : undefined;
});
const clipId = $derived(`${uid}-clip-${shape.id.replace(/[^A-Za-z0-9_-]/g, '_')}`);
const selected = $derived(focus?.selection.has(shape.id) ?? false);
const label = $derived(focus ? focus.name(shape) : undefined);
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -- in the editor each shape is an item of the application region with a roving tab stop (Tab moves in reading order). -->
<g
  class="tx-canvas-shape"
  data-tx-shape={shape.id}
  data-type={shape.type}
  data-selected={selected || undefined}
  data-target={focus?.target === shape.id || undefined}
  data-editing={focus?.editing === shape.id || undefined}
  data-locked={shape.locked || undefined}
  tabindex={focus ? (focus.tabStop === shape.id ? 0 : -1) : undefined}
  role={focus ? (shape.type === 'frame' || shape.type === 'group' ? 'group' : 'img') : undefined}
  aria-roledescription={focus ? focus.kind(shape) : undefined}
  aria-label={label}
  {transform}
  opacity={shape.type !== 'group' && style.opacity < 1 ? style.opacity : undefined}
>
  {#if shape.type === 'image'}
    {#if image}
      <image href={image} x={shape.x} y={shape.y} width={shape.width} height={shape.height} preserveAspectRatio="xMidYMid meet" />
    {:else}
      <rect class="tx-canvas-shape__missing" x={shape.x} y={shape.y} width={shape.width} height={shape.height} />
      <text class="tx-canvas-shape__text" x={shape.x + shape.width / 2} y={shape.y + shape.height / 2} text-anchor="middle" font-size="14">{imageMissing(shape.alt)}</text>
    {/if}
  {:else if outline?.kind === 'rect'}
    <rect class="tx-canvas-shape__body" x={outline.x} y={outline.y} width={outline.width} height={outline.height} rx={outline.rx || undefined} fill={fill === 'none' ? 'none' : `color-mix(in oklab, ${fill} ${shape.type === 'sticky' ? 28 : 16}%, var(--tx-surface, Canvas))`} {stroke} stroke-width={style.strokeWidth} stroke-dasharray={dashArray(style.dash, style.strokeWidth)} />
  {:else if outline?.kind === 'ellipse'}
    <ellipse class="tx-canvas-shape__body" cx={outline.cx} cy={outline.cy} rx={outline.rx} ry={outline.ry} fill={fill === 'none' ? 'none' : `color-mix(in oklab, ${fill} 16%, var(--tx-surface, Canvas))`} {stroke} stroke-width={style.strokeWidth} stroke-dasharray={dashArray(style.dash, style.strokeWidth)} />
  {:else if outline?.kind === 'path'}
    <path class="tx-canvas-shape__body" d={outline.d} fill={fill === 'none' ? 'none' : `color-mix(in oklab, ${fill} 16%, var(--tx-surface, Canvas))`} {stroke} stroke-width={style.strokeWidth} stroke-dasharray={dashArray(style.dash, style.strokeWidth)} stroke-linecap="round" stroke-linejoin="round" marker-end={shape.type === 'arrow' ? `url(#${uid}-arrow)` : undefined} />
    {#if open}
      <!-- A wider invisible stroke makes thin lines easy to hit. -->
      <path class="tx-canvas-shape__hit" d={outline.d} />
    {/if}
  {/if}
  {#if layout && focus?.editing !== shape.id}
    <text class="tx-canvas-shape__text" data-frame-title={shape.type === 'frame' || undefined} x={layout.x} y={layout.y} font-size={layout.size} text-anchor={layout.anchor}>
      {#each layout.lines as line, i (i)}<tspan x={layout.x} dy={i === 0 ? 0 : layout.step}>{line}</tspan>{/each}
    </text>
  {/if}
  {#if shape.type === 'frame'}
    <clipPath id={clipId}><rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} /></clipPath>
    <g clip-path={`url(#${clipId})`}>
      {#each shape.children as child (child.id)}
        <ShapeNode shape={child} {trust} {dir} {resolveImage} {uid} {focus} {imageMissing} {offsets} />
      {/each}
    </g>
  {:else if shape.type === 'group'}
    {#each shape.children as child (child.id)}
      <ShapeNode shape={child} {trust} {dir} {resolveImage} {uid} {focus} {imageMissing} {offsets} />
    {/each}
  {/if}
</g>

<style>
  @layer tx.components {
    .tx-canvas-shape {
      outline: none;
    }

    .tx-canvas-shape__text {
      fill: var(--tx-foreground, CanvasText);
      font-family: var(--tx-font-sans, system-ui, sans-serif);
      pointer-events: none;
      user-select: none;
    }

    .tx-canvas-shape__text[data-frame-title] {
      fill: var(--tx-muted-foreground, GrayText);
      font-weight: var(--tx-font-weight-semibold, 600);
    }

    .tx-canvas-shape__missing {
      fill: var(--tx-muted, Canvas);
      stroke: var(--tx-border, GrayText);
      stroke-dasharray: 4 4;
    }

    .tx-canvas-shape__hit {
      fill: none;
      stroke: transparent;
      stroke-width: 12;
      pointer-events: stroke;
    }

    /* Closed shapes take the pointer over their whole area, filled or not. */
    rect.tx-canvas-shape__body,
    ellipse.tx-canvas-shape__body,
    .tx-canvas-shape:not([data-type='line']):not([data-type='arrow']):not([data-type='path'])
      > path.tx-canvas-shape__body {
      pointer-events: all;
    }

    .tx-canvas-shape[data-editing] .tx-canvas-shape__text {
      visibility: hidden;
    }

    @media (forced-colors: active) {
      .tx-canvas-shape__body {
        stroke: CanvasText;
      }

      .tx-canvas-shape__text {
        fill: CanvasText;
      }
    }
  }
</style>
