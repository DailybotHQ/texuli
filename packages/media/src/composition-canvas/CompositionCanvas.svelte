<script lang="ts" module>
import type * as Engine from './render.ts';

let engine: Promise<typeof Engine> | undefined;

/**
 * The validator, image loader and draw engine load once, on first use. Both
 * chunks are requested together, so the first draw waits for one round trip.
 */
function loadEngine(): Promise<typeof Engine> {
  engine ??= Promise.all([import('./render.ts'), import('./pipeline.ts')]).then(
    ([module]) => module
  );
  return engine;
}
</script>

<script lang="ts">
import type { CompositionValidation } from '../composition-model/index.ts';
import { describeComposition } from './describe.ts';
import type { CompositionImage, CompositionViewport } from './draw.ts';
import type { CompositionImageLoader } from './images.ts';
import { type CompositionCanvasLabels, resolveCompositionCanvasLabels } from './labels.ts';
import type { RenderCompositionResult } from './render.ts';
import {
  applyViewportAction,
  initialViewport,
  type ViewportAction,
  viewportKeyAction,
} from './viewport.ts';

/**
 * Draws a composition on a canvas: large scenes, masks and blend modes in one
 * bitmap. Untrusted by default: the data is validated and every image source
 * passes the media URL policy before anything is fetched or drawn.
 *
 * The validator and the draw engine load on first use, so the component costs
 * little until a composition is actually shown.
 *
 * The view controls are real buttons (zoom, reset, pan), so they work with a
 * keyboard, a pointer and switch access. While one has focus, plus and minus
 * zoom, arrow keys pan and 0 resets. Screen readers get the accessible name
 * plus the scene's text and image descriptions, which a bitmap cannot expose
 * by itself.
 */
interface Props {
  /** Composition data; validated before use. */
  composition: unknown;
  /** URL policy tier for the data. Default `untrusted`. */
  trust?: 'developer' | 'untrusted';
  /** Accessible name of the canvas. Default: `labels.canvas`. */
  label?: string;
  labels?: Partial<CompositionCanvasLabels>;
  /** Device pixel ratio. Default: the window's, capped by browser canvas limits. */
  pixelRatio?: number;
  /** Text direction for `align: start | end`. Default: the canvas's computed direction. */
  dir?: 'ltr' | 'rtl';
  fontFamily?: string;
  /** Painted under every layer. Default transparent. */
  background?: string;
  /** Custom image loader (workers, tests). Sources are vetted before it is called. */
  loadImage?: CompositionImageLoader;
  /** Called after each render with what was drawn, culled or skipped. */
  onrender?: (result: RenderCompositionResult) => void;
}

let {
  composition,
  trust = 'untrusted',
  label,
  labels,
  pixelRatio,
  dir,
  fontFamily,
  background,
  loadImage,
  onrender,
}: Props = $props();

// Page-unique and identical on the server and the client.
const uid = $props.id();
const hintId = `${uid}-hint`;
const contentsId = `${uid}-contents`;

const text = $derived(resolveCompositionCanvasLabels(labels));

let renderer = $state<typeof Engine | null>(null);
let engineFailed = $state(false);
$effect(() => {
  let live = true;
  loadEngine().then(
    (module) => {
      if (live) renderer = module;
    },
    () => {
      if (live) engineFailed = true;
    }
  );
  return () => {
    live = false;
  };
});

const validation = $derived<CompositionValidation | null>(
  renderer ? renderer.validateComposition(composition, { trust }) : null
);
const scene = $derived(validation?.ok ? validation.composition : null);
const items = $derived(scene ? describeComposition(scene) : []);

let canvas = $state<HTMLCanvasElement>();
let viewport = $state<CompositionViewport>(initialViewport());
let status = $state('');
let unsupported = $state(false);
const imageCache = new Map<string, CompositionImage>();

// A new scene starts at the full view.
$effect(() => {
  void validation;
  viewport = initialViewport();
  status = '';
});

$effect(() => {
  const target = canvas;
  const engineModule = renderer;
  const view = viewport;
  if (!target || !engineModule || !scene) return;
  const controller = new AbortController();
  const ratio = pixelRatio ?? target.ownerDocument.defaultView?.devicePixelRatio ?? 1;
  const direction =
    dir ??
    (target.ownerDocument.defaultView?.getComputedStyle(target).direction === 'rtl'
      ? 'rtl'
      : 'ltr');
  void engineModule
    .renderComposition(target, composition, {
      trust,
      pixelRatio: ratio,
      viewport: view,
      direction,
      imageCache,
      signal: controller.signal,
      ...(fontFamily ? { fontFamily } : {}),
      ...(background ? { background } : {}),
      ...(loadImage ? { loadImage } : {}),
    })
    .then((result) => {
      if (controller.signal.aborted) return;
      unsupported = !result.ok && result.reason === 'unsupported';
      onrender?.(result);
    });
  return () => controller.abort();
});

const controls = $derived<{ action: ViewportAction; label: string }[]>([
  { action: 'zoom-out', label: text.zoomOut },
  { action: 'zoom-in', label: text.zoomIn },
  { action: 'reset', label: text.resetView },
  { action: 'pan-left', label: text.panLeft },
  { action: 'pan-right', label: text.panRight },
  { action: 'pan-up', label: text.panUp },
  { action: 'pan-down', label: text.panDown },
]);

/** Whether an action would change the view (unavailable buttons stay focusable). */
function available(action: ViewportAction): boolean {
  if (!scene) return false;
  const next = applyViewportAction(scene, viewport, action);
  return next.zoom !== viewport.zoom || next.x !== viewport.x || next.y !== viewport.y;
}

function run(action: ViewportAction) {
  if (!scene || !available(action)) return;
  const next = applyViewportAction(scene, viewport, action);
  if (next.zoom !== viewport.zoom) status = text.zoomStatus(Math.round(next.zoom * 100));
  viewport = next;
}

function onkeydown(event: KeyboardEvent) {
  const action = viewportKeyAction(event);
  if (!action) return;
  event.preventDefault();
  run(action);
}
</script>

<figure class="tx-composition-canvas" data-tx-media="composition-canvas">
  {#if engineFailed}
    <p class="tx-composition-canvas-note" role="note">{text.unsupported}</p>
  {:else if !validation}
    <p class="tx-composition-canvas-note" role="status">{text.loading}</p>
  {:else if !scene}
    <p class="tx-composition-canvas-note" role="note">{text.invalid}</p>
  {:else if unsupported}
    <p class="tx-composition-canvas-note" role="note">{text.unsupported}</p>
  {:else}
    <div
      class="tx-composition-canvas-stage"
      role="img"
      aria-label={label ?? text.canvas}
      aria-describedby={items.length > 0 ? `${contentsId} ${hintId}` : hintId}
    >
      <canvas bind:this={canvas} class="tx-composition-canvas-surface"></canvas>
    </div>
    <div class="tx-composition-canvas-controls" role="group" aria-label={text.controls}>
      {#each controls as control (control.action)}
        <button
          type="button"
          aria-disabled={!available(control.action)}
          onclick={() => run(control.action)}
          {onkeydown}
        >{control.label}</button>
      {/each}
    </div>
    <p id={hintId} class="tx-visually-hidden">{text.keyboardHint}</p>
    {#if items.length > 0}
      <div id={contentsId} class="tx-visually-hidden">
        <p>{text.contents}</p>
        <ul>
          {#each items as item (item.layerId)}
            <li>{item.kind === 'image' ? `${text.image}: ${item.text}` : item.text}</li>
          {/each}
        </ul>
      </div>
    {/if}
    <p class="tx-visually-hidden" role="status">{status}</p>
  {/if}
</figure>

<style>
  @layer tx.components {
    .tx-composition-canvas {
      margin: 0;
      display: grid;
      /* The canvas scales down: its pixel size must not set the column width. */
      grid-template-columns: minmax(0, 1fr);
      min-inline-size: 0;
      gap: 0.5rem;
    }
    .tx-composition-canvas-surface {
      display: block;
      inline-size: 100%;
      block-size: auto;
      border-radius: var(--tx-radius-md, 0.5rem);
      background: var(--tx-color-surface-sunken, transparent);
    }
    .tx-composition-canvas-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: flex-end;
    }
    .tx-composition-canvas-controls button {
      min-block-size: 2rem;
      min-inline-size: 2rem;
      padding-inline: 0.75rem;
      font: inherit;
      color: inherit;
      background: var(--tx-color-surface, transparent);
      border: 1px solid var(--tx-color-border-strong, currentColor);
      border-radius: var(--tx-radius-sm, 0.375rem);
      cursor: pointer;
    }
    .tx-composition-canvas-controls button[aria-disabled='true'] {
      cursor: default;
      opacity: 0.6;
    }
    .tx-composition-canvas-controls button:focus-visible {
      outline: 2px solid var(--tx-color-focus-ring, currentColor);
      outline-offset: 2px;
    }
    .tx-composition-canvas-note {
      margin: 0;
    }
    .tx-visually-hidden {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }
    @media (forced-colors: active) {
      .tx-composition-canvas-controls button:focus-visible {
        outline-color: Highlight;
      }
      .tx-composition-canvas-controls button {
        border-color: ButtonText;
      }
      .tx-composition-canvas-controls button[aria-disabled='true'] {
        opacity: 1;
        border-color: GrayText;
        color: GrayText;
      }
    }
  }
</style>
