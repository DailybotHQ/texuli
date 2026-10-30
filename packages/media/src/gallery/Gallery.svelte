<script lang="ts">
import { lazyChunk } from '@texuli/core/lazy';
import { type Component, untrack } from 'svelte';
import type { ClassValue } from 'svelte/elements';
import Image from '../image/Image.svelte';
import type { ImageTrust } from '../image/model.ts';
import {
  clampColumns,
  columnCount,
  formatLabel,
  type GalleryLabels,
  masonryLayout,
  resolveGalleryItems,
  resolveGalleryLabels,
  safeAspectRatio,
} from './model.ts';

/**
 * Gallery: a grid or masonry layout of images. Every tile whose source passes
 * the media URL policy is a native button that opens the lightbox; a blocked
 * tile shows a labeled fallback, is never requested and is not a control.
 *
 * Masonry packs each item into the shortest column (deterministic, in item
 * order) and positions it with container query units, so the DOM and focus
 * order stay the item order and no layout is measured per image.
 */
interface Props {
  items: readonly unknown[];
  layout?: 'grid' | 'masonry';
  /** Grid: the tile `aspect-ratio`, such as `4 / 3`. */
  aspectRatio?: string;
  /** Narrowest column, in CSS pixels. */
  minColumnWidth?: number;
  /** Masonry: the most columns. */
  columns?: number;
  /** Space between tiles, in CSS pixels. */
  gap?: number;
  /** Tile image loading; `eager` for galleries above the fold. */
  loading?: 'lazy' | 'eager';
  /** `false` renders plain tiles with no lightbox. */
  lightbox?: boolean;
  loop?: boolean;
  open?: boolean;
  index?: number;
  trust?: ImageTrust;
  labels?: Partial<GalleryLabels>;
  /** Accessible name of the list (recommended when the page has several galleries). */
  'aria-label'?: string;
  class?: ClassValue;
  onOpenChange?: (open: boolean) => void;
  onIndexChange?: (index: number) => void;
}

let {
  items,
  layout = 'grid',
  aspectRatio = '1 / 1',
  minColumnWidth = 180,
  columns = 4,
  gap = 8,
  loading = 'lazy',
  lightbox = true,
  loop = false,
  open = $bindable(false),
  index = $bindable(0),
  trust = 'untrusted',
  labels,
  'aria-label': ariaLabel,
  class: className,
  onOpenChange,
  onIndexChange,
}: Props = $props();

const resolved = $derived(resolveGalleryItems(items, trust));
const l = $derived(resolveGalleryLabels(labels));
const spacing = $derived(Number.isFinite(gap) ? Math.min(64, Math.max(0, gap)) : 8);
const minWidth = $derived(
  Number.isFinite(minColumnWidth) && minColumnWidth > 0 ? minColumnWidth : 180
);

const RESIZE_SETTLE_MS = 120;
let root = $state<HTMLElement>();
let width = $state(0);
const columnTotal = $derived(
  width > 0 ? columnCount(width, minWidth, spacing, columns) : clampColumns(columns)
);
const masonry = $derived(
  layout === 'masonry'
    ? masonryLayout(
        resolved.map((item) => item.ratio),
        columnTotal
      )
    : undefined
);
/** Tallest column: `max()` of each column's ratio sum times the column width plus its gaps. */
const masonryHeight = $derived(
  masonry
    ? `max(0px, ${masonry.extents
        .map(
          (e) =>
            `calc(${e.offset} * var(--tx-gallery-col) + ${Math.max(0, e.count - 1)} * var(--tx-gallery-gap))`
        )
        .join(', ')})`
    : undefined
);

// Masonry needs the column count in script; grid columns are pure CSS.
// Only the inline size is read. Later changes apply once the width has held
// for RESIZE_SETTLE_MS: a new height can toggle the page scrollbar, and a
// full-page capture briefly narrows the layout; neither may re-pack the tiles.
$effect(() => {
  const node = root;
  if (!node || layout !== 'masonry' || typeof ResizeObserver === 'undefined') return;
  const view = node.ownerDocument.defaultView;
  // Measure once now, so the first paint already has the right columns.
  const initial = Math.round(node.getBoundingClientRect().width);
  if (initial > 0 && initial !== untrack(() => width)) width = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new ResizeObserver((entries) => {
    const next = Math.round(entries[0]?.contentRect.width ?? 0);
    clearTimeout(timer);
    timer = (view ?? globalThis).setTimeout(() => {
      if (next > 0 && next !== width) width = next;
    }, RESIZE_SETTLE_MS);
  });
  observer.observe(node);
  return () => {
    clearTimeout(timer);
    observer.disconnect();
  };
});

let LightboxView = $state<Component<Record<string, unknown>> | undefined>();
let lightboxReady = $state(true);

/** The lightbox (and the dialog behind it) loads on the first open. */
function loadLightbox(): Promise<void> {
  if (LightboxView) {
    lightboxReady = true;
    return Promise.resolve();
  }
  lightboxReady = false;
  return lazyChunk('media:gallery:lightbox', () => import('./Lightbox.svelte')).then(
    (module) => {
      LightboxView = module.default as unknown as Component<Record<string, unknown>>;
      lightboxReady = true;
    },
    () => {
      lightboxReady = true;
    }
  );
}

$effect(() => {
  if (open && lightbox && !LightboxView) void loadLightbox();
});

function show(next: number): void {
  index = next;
  onIndexChange?.(next);
  open = true;
  onOpenChange?.(true);
}

function tile(target: number): HTMLElement | null {
  return root?.querySelector<HTMLElement>(`[data-gallery-index="${target}"]`) ?? null;
}
</script>

<div
  bind:this={root}
  class={['tx-gallery-frame', className]}
  data-tx-gallery=""
  data-layout={layout === 'masonry' ? 'masonry' : 'grid'}
  data-lightbox-ready={lightboxReady ? 'true' : 'false'}
>
<ul
  class="tx-gallery"
  aria-label={ariaLabel}
  style:--tx-gallery-gap={`${spacing}px`}
  style:--tx-gallery-min={`${minWidth}px`}
  style:--tx-gallery-ratio={safeAspectRatio(aspectRatio)}
  style:--tx-gallery-columns={masonry?.columns}
  style:block-size={masonryHeight}
>
  {#each resolved as item, i (item.key)}
    {@const place = masonry?.positions[i]}
    <li
      class="tx-gallery-item"
      data-blocked={item.viewable ? undefined : ''}
      style:--tx-gallery-x={place?.column}
      style:--tx-gallery-y={place?.offset}
      style:--tx-gallery-k={place?.above}
      style:--tx-gallery-h={place ? item.ratio : undefined}
    >
      <figure class="tx-gallery-figure">
        {#snippet picture()}
          <Image
            class="tx-gallery-image"
            src={item.thumbSrc ?? ''}
            srcset={item.thumbSrcset}
            sizes={item.thumbSrcset ? `${minWidth * 2}px` : undefined}
            alt={item.alt}
            focalPoint={item.focalPoint}
            placeholder={item.placeholder}
            {loading}
            {trust}
            labels={{ unavailable: l.unavailable }}
          />
        {/snippet}
        {#if lightbox && item.viewable && item.thumbSrc}
          <button
            type="button"
            class="tx-gallery-tile"
            data-gallery-index={item.index}
            aria-haspopup="dialog"
            aria-label={item.alt ? undefined : formatLabel(l.open, { current: i + 1 })}
            onclick={() => show(item.index)}
          >
            {@render picture()}
          </button>
        {:else}
          <div class="tx-gallery-tile">{@render picture()}</div>
        {/if}
        {#if item.caption}
          <figcaption class="tx-gallery-caption">{item.caption}</figcaption>
        {/if}
      </figure>
    </li>
  {/each}
</ul>
</div>

{#if lightbox && LightboxView}
  <LightboxView
    items={resolved}
    bind:open
    bind:index
    {loop}
    {trust}
    {labels}
    {onOpenChange}
    {onIndexChange}
    returnFocus={tile}
  />
{/if}

<style>
  @layer tx.components {
    .tx-gallery-frame {
      min-inline-size: 0;
    }
    /* The frame is the size container, so 100cqi in the list is its width. */
    .tx-gallery-frame[data-layout='masonry'] {
      container-type: inline-size;
    }
    .tx-gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--tx-gallery-min)), 1fr));
      gap: var(--tx-gallery-gap);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .tx-gallery-item {
      min-inline-size: 0;
    }
    .tx-gallery-figure {
      display: grid;
      gap: calc(var(--tx-space-unit) * 1.5);
      margin: 0;
    }
    .tx-gallery-tile {
      position: relative;
      display: block;
      inline-size: 100%;
      aspect-ratio: var(--tx-gallery-ratio);
      padding: 0;
      overflow: hidden;
      border: 0;
      border-radius: var(--tx-shape-radius-lg);
      background: var(--tx-muted, Canvas);
      color: inherit;
      font: inherit;
    }
    button.tx-gallery-tile {
      cursor: zoom-in;
    }
    button.tx-gallery-tile:focus-visible {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: var(--tx-focus-ring-offset, 2px);
    }
    .tx-gallery-tile :global(.tx-gallery-image),
    .tx-gallery-tile :global(.tx-gallery-image > .tx-image-img) {
      display: block;
      inline-size: 100%;
      block-size: 100%;
    }
    .tx-gallery-tile :global(.tx-gallery-image > .tx-image-img) {
      transition: scale var(--tx-motion-base, 200ms) var(--tx-motion-easing, ease-out);
    }
    button.tx-gallery-tile:hover :global(.tx-gallery-image > .tx-image-img) {
      scale: 1.03;
    }
    .tx-gallery-caption {
      color: var(--tx-muted-foreground, CanvasText);
      font-size: var(--tx-type-label-size);
      line-height: 1.4;
    }

    /* Masonry: absolute tiles placed from the packed layout. --tx-gallery-col
       is one column's width, from the container's inline size. */
    .tx-gallery-frame[data-layout='masonry'] .tx-gallery {
      --tx-gallery-col: calc(
        (100cqi - (var(--tx-gallery-columns) - 1) * var(--tx-gallery-gap)) / var(--tx-gallery-columns)
      );
      position: relative;
      display: block;
    }
    .tx-gallery-frame[data-layout='masonry'] .tx-gallery > .tx-gallery-item {
      position: absolute;
      inset-inline-start: calc(var(--tx-gallery-x) * (var(--tx-gallery-col) + var(--tx-gallery-gap)));
      inset-block-start: calc(
        var(--tx-gallery-y) * var(--tx-gallery-col) + var(--tx-gallery-k) * var(--tx-gallery-gap)
      );
      inline-size: var(--tx-gallery-col);
      block-size: calc(var(--tx-gallery-h) * var(--tx-gallery-col));
    }
    .tx-gallery-frame[data-layout='masonry'] .tx-gallery .tx-gallery-figure,
    .tx-gallery-frame[data-layout='masonry'] .tx-gallery .tx-gallery-tile {
      block-size: 100%;
      aspect-ratio: auto;
    }
    .tx-gallery-frame[data-layout='masonry'] .tx-gallery .tx-gallery-figure {
      position: relative;
    }
    /* Masonry tiles have no room below, so the caption sits on the image. */
    .tx-gallery-frame[data-layout='masonry'] .tx-gallery .tx-gallery-caption {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 0;
      padding: var(--tx-space-6) calc(var(--tx-space-unit) * 2.5) var(--tx-space-2);
      border-end-start-radius: var(--tx-shape-radius-lg);
      border-end-end-radius: var(--tx-shape-radius-lg);
      background: linear-gradient(transparent, rgb(0 0 0 / 0.78) 45%);
      color: #fff;
      pointer-events: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .tx-gallery-tile :global(.tx-gallery-image > .tx-image-img) {
        transition: none;
      }
      button.tx-gallery-tile:hover :global(.tx-gallery-image > .tx-image-img) {
        scale: none;
      }
    }
    @media (forced-colors: active) {
      .tx-gallery-tile {
        border: var(--tx-border-width-thin) solid CanvasText;
      }
      button.tx-gallery-tile:focus-visible {
        outline-color: Highlight;
      }
      .tx-gallery-frame[data-layout='masonry'] .tx-gallery .tx-gallery-caption {
        background: Canvas;
        color: CanvasText;
      }
    }
  }
</style>
