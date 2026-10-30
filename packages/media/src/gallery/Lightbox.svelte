<script lang="ts">
import type { FocusRestoreEvent } from '@texuli/core/focus-scope';
import * as Dialog from '@texuli/primitives/dialog';
import type { ClassValue } from 'svelte/elements';
import type { ImageTrust } from '../image/model.ts';
import {
  clampPan,
  clampZoom,
  edgeViewable,
  formatLabel,
  GALLERY_LIMITS,
  type GalleryLabels,
  type Pan,
  type ResolvedGalleryItem,
  resolveGalleryItems,
  resolveGalleryLabels,
  stepViewable,
  swipeIntent,
  viewablePosition,
} from './model.ts';

/**
 * Lightbox: a modal image viewer on the owned Dialog primitive (focus trap,
 * Escape, inert page, scroll lock, focus restore). Previous and next by
 * buttons, arrow keys (mirrored in right-to-left layouts), Home and End, or a
 * horizontal swipe. Zoom by buttons, `+` `-` `0`, the wheel, a double tap or
 * a pinch; a zoomed image pans by drag or arrow keys. Every source passes the
 * media URL policy, and blocked items are skipped.
 */
interface Props {
  /** Raw items (validated here) or the output of `resolveGalleryItems`. */
  items: readonly unknown[];
  open?: boolean;
  /** Position of the shown item in `items`. */
  index?: number;
  loop?: boolean;
  trust?: ImageTrust;
  labels?: Partial<GalleryLabels>;
  class?: ClassValue;
  onOpenChange?: (open: boolean) => void;
  onIndexChange?: (index: number) => void;
  /** The element to focus when the lightbox closes (a gallery tile, for example). */
  returnFocus?: (index: number) => HTMLElement | null | undefined;
}

let {
  items,
  open = $bindable(false),
  index = $bindable(0),
  loop = false,
  trust = 'untrusted',
  labels,
  class: className,
  onOpenChange,
  onIndexChange,
  returnFocus,
}: Props = $props();

const uid = $props.id();
// The dialog opens one tick after mount, once its portal has moved into
// place: moving an element that holds focus would drop focus to the body.
let mounted = $state(false);
$effect(() => {
  mounted = true;
});
const closeId = `${uid}-close`;
const resolved: ResolvedGalleryItem[] = $derived(
  isResolved(items) ? (items as ResolvedGalleryItem[]) : resolveGalleryItems(items, trust)
);
const l = $derived(resolveGalleryLabels(labels));
const current = $derived(
  resolved.find((item) => item.index === index && item.viewable) ??
    resolved.find((item) => item.index === edgeViewable(resolved, 'start'))
);
const position = $derived(
  current ? viewablePosition(resolved, current.index) : { current: 0, total: 0 }
);
const hasPrevious = $derived(
  current !== undefined && stepViewable(resolved, current.index, -1, loop) !== current.index
);
const hasNext = $derived(
  current !== undefined && stepViewable(resolved, current.index, 1, loop) !== current.index
);

let zoom = $state(1);
let pan = $state<Pan>({ x: 0, y: 0 });
let drag = $state(0);
let dragging = $state(false);
let failedKey = $state<string | undefined>();
let stage = $state<HTMLDivElement>();

/** Resolved items carry a `viewable` flag; raw ones never do. */
function isResolved(list: readonly unknown[]): boolean {
  return (
    list.length > 0 &&
    list.every((item) => typeof (item as ResolvedGalleryItem)?.viewable === 'boolean')
  );
}

// A new image starts unzoomed and centered.
let shownKey: string | undefined;
$effect.pre(() => {
  const key = current?.key;
  if (key === shownKey) return;
  shownKey = key;
  zoom = 1;
  pan = { x: 0, y: 0 };
  drag = 0;
});

function go(next: number): void {
  if (!current || next === current.index) return;
  index = next;
  onIndexChange?.(next);
}

function stageSize(): { width: number; height: number } {
  return { width: stage?.clientWidth ?? 0, height: stage?.clientHeight ?? 0 };
}

function setZoom(next: number, nextPan: Pan = pan): void {
  zoom = clampZoom(next);
  pan = clampPan(nextPan, zoom, stageSize());
}

function isRtl(node: Element | null | undefined): boolean {
  if (!node) return false;
  return node.ownerDocument.defaultView?.getComputedStyle(node).direction === 'rtl';
}

function keydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !current) return;
  const step = 40;
  const rtl = isRtl(event.currentTarget as Element);
  let handled = true;
  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowRight': {
      const towardEnd = (event.key === 'ArrowRight') !== rtl;
      if (zoom > 1)
        setZoom(zoom, { x: pan.x + (event.key === 'ArrowRight' ? -step : step), y: pan.y });
      else go(stepViewable(resolved, current.index, towardEnd ? 1 : -1, loop));
      break;
    }
    case 'ArrowUp':
    case 'ArrowDown':
      if (zoom > 1)
        setZoom(zoom, { x: pan.x, y: pan.y + (event.key === 'ArrowDown' ? -step : step) });
      else handled = false;
      break;
    case 'Home':
      go(edgeViewable(resolved, 'start'));
      break;
    case 'End':
      go(edgeViewable(resolved, 'end'));
      break;
    case '+':
    case '=':
      setZoom(zoom + GALLERY_LIMITS.zoomStep);
      break;
    case '-':
      setZoom(zoom - GALLERY_LIMITS.zoomStep);
      break;
    case '0':
      setZoom(1, { x: 0, y: 0 });
      break;
    default:
      handled = false;
  }
  if (handled) event.preventDefault();
}

interface Gesture {
  kind: 'swipe' | 'pan' | 'pinch';
  x: number;
  y: number;
  pan: Pan;
  zoom: number;
  distance: number;
  moved: boolean;
}

const pointers = new Map<number, { x: number; y: number }>();
let gesture: Gesture | null = null;
let lastTap: { time: number; x: number; y: number } | null = null;

function spread(): number {
  const [a, b] = [...pointers.values()];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

function pointerdown(event: PointerEvent): void {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  try {
    stage?.setPointerCapture(event.pointerId);
  } catch {
    // Capture is an enhancement; synthetic pointers cannot be captured.
  }
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) {
    gesture = { kind: 'pinch', x: 0, y: 0, pan, zoom, distance: spread(), moved: true };
    drag = 0;
  } else if (pointers.size === 1) {
    gesture = {
      kind: zoom > 1 ? 'pan' : 'swipe',
      x: event.clientX,
      y: event.clientY,
      pan,
      zoom,
      distance: 0,
      moved: false,
    };
  }
}

function pointermove(event: PointerEvent): void {
  if (!pointers.has(event.pointerId) || !gesture) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  if (Math.hypot(dx, dy) > 4) gesture.moved = true;
  if (gesture.kind === 'pinch') {
    if (gesture.distance > 0) setZoom((gesture.zoom * spread()) / gesture.distance);
  } else if (gesture.kind === 'pan') {
    dragging = true;
    setZoom(zoom, { x: gesture.pan.x + dx, y: gesture.pan.y + dy });
  } else if (gesture.moved) {
    dragging = true;
    drag = dx;
  }
}

function pointerup(event: PointerEvent): void {
  if (!pointers.delete(event.pointerId)) return;
  const done = gesture;
  if (pointers.size > 0 || !done) return;
  gesture = null;
  dragging = false;
  const dx = event.clientX - done.x;
  const dy = event.clientY - done.y;
  drag = 0;
  if (done.kind === 'swipe' && done.moved && current) {
    const intent = swipeIntent(dx, dy, stage?.clientWidth ?? 0, isRtl(stage));
    if (intent) go(stepViewable(resolved, current.index, intent === 'next' ? 1 : -1, loop));
    return;
  }
  if (done.moved || done.kind === 'pinch') return;
  // A tap: a double tap toggles zoom; a single tap on the empty stage closes.
  const now = event.timeStamp;
  if (
    lastTap &&
    now - lastTap.time < 320 &&
    Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 30
  ) {
    lastTap = null;
    setZoom(zoom > 1 ? 1 : 2, { x: 0, y: 0 });
    return;
  }
  lastTap = { time: now, x: event.clientX, y: event.clientY };
  if (event.target === stage && zoom === 1) {
    open = false;
    openChange(false);
  }
}

function pointercancel(event: PointerEvent): void {
  pointers.delete(event.pointerId);
  if (pointers.size === 0) {
    gesture = null;
    dragging = false;
    drag = 0;
  }
}

/** The wheel zooms. Attached by hand: it must not be passive to stop page zoom. */
function wheel(node: HTMLDivElement): () => void {
  const onwheel = (event: WheelEvent) => {
    if (!Number.isFinite(event.deltaY) || event.deltaY === 0) return;
    event.preventDefault();
    setZoom(zoom - event.deltaY * (event.ctrlKey ? 0.01 : 0.002));
  };
  node.addEventListener('wheel', onwheel, { passive: false });
  return () => node.removeEventListener('wheel', onwheel);
}

function restoreFocus(event: FocusRestoreEvent): void {
  const target = returnFocus?.(current?.index ?? index);
  if (!target) return;
  event.preventDefault();
  target.focus();
}

function openChange(next: boolean): void {
  pointers.clear();
  gesture = null;
  onOpenChange?.(next);
}
</script>

<Dialog.Root
  bind:open={() => open && mounted, (next) => (open = next)}
  onOpenChange={openChange}
  onCloseAutoFocus={restoreFocus}
  initialFocus={() => (stage?.ownerDocument ?? document).getElementById(closeId)}
>
  <Dialog.Portal>
    <Dialog.Overlay class="tx-lightbox-backdrop" />
    <Dialog.Content
      class={['tx-lightbox', className]}
      data-tx-lightbox=""
      data-zoomed={zoom > 1 ? '' : undefined}
      onkeydown={keydown}
    >
      <div class="tx-lightbox-bar">
        <Dialog.Title class="tx-lightbox-title">{l.title}</Dialog.Title>
        <p class="tx-lightbox-count" aria-live="polite" aria-atomic="true">
          {formatLabel(l.position, position)}
        </p>
        <div class="tx-lightbox-tools">
          <button
            type="button"
            class="tx-lightbox-button"
            aria-label={l.zoomOut}
            aria-keyshortcuts="-"
            disabled={zoom <= GALLERY_LIMITS.minZoom}
            onclick={() => setZoom(zoom - GALLERY_LIMITS.zoomStep)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
          </button>
          <button
            type="button"
            class="tx-lightbox-button tx-lightbox-zoom"
            aria-keyshortcuts="0"
            disabled={zoom === 1}
            onclick={() => setZoom(1, { x: 0, y: 0 })}
          >
            <span class="tx-lightbox-hidden">{l.resetZoom}</span>
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            class="tx-lightbox-button"
            aria-label={l.zoomIn}
            aria-keyshortcuts="+"
            disabled={zoom >= GALLERY_LIMITS.maxZoom}
            onclick={() => setZoom(zoom + GALLERY_LIMITS.zoomStep)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg>
          </button>
          <Dialog.Close id={closeId} class="tx-lightbox-button" aria-label={l.close} aria-keyshortcuts="Escape">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </Dialog.Close>
        </div>
      </div>

      <div
        bind:this={stage}
        class="tx-lightbox-stage"
        role="presentation"
        data-dragging={dragging ? '' : undefined}
        onpointerdown={pointerdown}
        onpointermove={pointermove}
        onpointerup={pointerup}
        onpointercancel={pointercancel}
        {@attach wheel}
      >
        {#if current}
          {#if failedKey === current.key}
            <div class="tx-lightbox-fallback" role="img" aria-label={current.alt || undefined}>
              <span aria-hidden="true">{l.unavailable}</span>
            </div>
          {:else}
            {#key current.key}
              <img
                class="tx-lightbox-image"
                src={current.src}
                srcset={current.srcset}
                sizes={current.srcset ? (current.sizes ?? '100vw') : undefined}
                alt={current.alt}
                width={current.width}
                height={current.height}
                decoding="async"
                draggable="false"
                referrerpolicy={trust === 'untrusted' ? 'no-referrer' : undefined}
                style:transform={`translate(${pan.x + drag}px, ${pan.y}px) scale(${zoom})`}
                onerror={() => (failedKey = current?.key)}
              />
            {/key}
          {/if}
        {:else}
          <div class="tx-lightbox-fallback"><span>{l.unavailable}</span></div>
        {/if}
      </div>

      <button
        type="button"
        class="tx-lightbox-button tx-lightbox-nav"
        data-direction="previous"
        aria-label={l.previous}
        disabled={!hasPrevious}
        onclick={() => current && go(stepViewable(resolved, current.index, -1, loop))}
      >
        <svg class="tx-lightbox-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <button
        type="button"
        class="tx-lightbox-button tx-lightbox-nav"
        data-direction="next"
        aria-label={l.next}
        disabled={!hasNext}
        onclick={() => current && go(stepViewable(resolved, current.index, 1, loop))}
      >
        <svg class="tx-lightbox-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </button>

      <Dialog.Description class="tx-lightbox-caption">{current?.caption ?? ''}</Dialog.Description>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  @layer tx.components {
    /* The viewer is dark in every theme, like most photo viewers, so its
       colors are fixed: white on near-black passes WCAG AA everywhere. */
    :global(.tx-lightbox-backdrop) {
      background: rgb(0 0 0 / 0.88);
    }
    :global(.tx-lightbox) {
      position: fixed;
      inset: 0;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      grid-template-columns: minmax(0, 1fr);
      inline-size: 100%;
      block-size: 100%;
      max-inline-size: none;
      max-block-size: none;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: #fff;
      color-scheme: dark;
      overflow: hidden;
      outline: none;
    }
    .tx-lightbox-bar {
      display: flex;
      align-items: center;
      gap: var(--tx-space-3);
      padding: var(--tx-space-2) var(--tx-space-3);
    }
    :global(.tx-lightbox-title),
    .tx-lightbox-hidden {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .tx-lightbox-count {
      margin: 0;
      font-size: var(--tx-type-label-size);
      font-variant-numeric: tabular-nums;
    }
    .tx-lightbox-tools {
      display: flex;
      gap: var(--tx-space-1);
      margin-inline-start: auto;
    }
    .tx-lightbox-button,
    :global(.tx-lightbox-button) {
      display: inline-grid;
      place-items: center;
      min-inline-size: 2.75rem;
      min-block-size: 2.75rem;
      padding: 0 var(--tx-space-2);
      border: var(--tx-border-width-thin) solid rgb(255 255 255 / 0.35);
      border-radius: var(--tx-shape-radius-lg);
      background: rgb(0 0 0 / 0.55);
      color: #fff;
      font: inherit;
      font-size: var(--tx-type-label-size);
      font-variant-numeric: tabular-nums;
      cursor: pointer;
    }
    .tx-lightbox-button:hover:not(:disabled),
    :global(.tx-lightbox-button:hover:not(:disabled)) {
      background: rgb(255 255 255 / 0.18);
    }
    .tx-lightbox-button:disabled {
      cursor: default;
      opacity: 0.45;
    }
    .tx-lightbox-button:focus-visible,
    :global(.tx-lightbox-button:focus-visible) {
      outline: 2px solid #fff;
      outline-offset: 2px;
      box-shadow: 0 0 0 4px #000;
    }
    .tx-lightbox-button svg,
    :global(.tx-lightbox-button svg) {
      inline-size: 1.25rem;
      block-size: 1.25rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .tx-lightbox-stage {
      position: relative;
      display: grid;
      place-items: center;
      min-block-size: 0;
      overflow: hidden;
      touch-action: none;
      user-select: none;
      cursor: zoom-in;
    }
    :global(.tx-lightbox[data-zoomed]) .tx-lightbox-stage {
      cursor: grab;
    }
    .tx-lightbox-stage[data-dragging] {
      cursor: grabbing;
    }
    .tx-lightbox-image {
      max-inline-size: 100%;
      max-block-size: 100%;
      inline-size: auto;
      block-size: auto;
      object-fit: contain;
      transform-origin: center;
      transition: transform var(--tx-motion-base, 200ms) var(--tx-motion-easing, ease-out);
      -webkit-user-drag: none;
    }
    .tx-lightbox-stage[data-dragging] .tx-lightbox-image {
      transition: none;
    }
    .tx-lightbox-fallback {
      display: grid;
      place-items: center;
      min-inline-size: 12rem;
      min-block-size: 8rem;
      padding: var(--tx-space-4);
      border: var(--tx-border-width-thin) dashed rgb(255 255 255 / 0.6);
      border-radius: var(--tx-shape-radius-lg);
    }
    .tx-lightbox-nav {
      position: absolute;
      inset-block-start: 50%;
      translate: 0 -50%;
    }
    .tx-lightbox-nav[data-direction='previous'] {
      inset-inline-start: 0.75rem;
    }
    .tx-lightbox-nav[data-direction='next'] {
      inset-inline-end: 0.75rem;
    }
    :global(.tx-lightbox:dir(rtl)) .tx-lightbox-chevron {
      transform: scaleX(-1);
    }
    :global(.tx-lightbox-caption) {
      margin: 0;
      padding: var(--tx-space-2) var(--tx-space-4) var(--tx-space-4);
      text-align: center;
      font-size: 0.9375rem;
    }
    :global(.tx-lightbox-caption:empty) {
      padding: 0;
    }
    @media (prefers-reduced-motion: reduce) {
      .tx-lightbox-image {
        transition: none;
      }
    }
    @media (forced-colors: active) {
      :global(.tx-lightbox-backdrop) {
        background: Canvas;
      }
      :global(.tx-lightbox),
      .tx-lightbox-button,
      :global(.tx-lightbox-button) {
        background: Canvas;
        color: CanvasText;
        border-color: ButtonText;
      }
      .tx-lightbox-button:focus-visible,
      :global(.tx-lightbox-button:focus-visible) {
        outline-color: Highlight;
      }
    }
  }
</style>
