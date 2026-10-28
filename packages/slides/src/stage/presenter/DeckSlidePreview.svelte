<script lang="ts">
/**
 * A live, inert miniature of one slide: the stage's own `DeckSlideView` (the
 * same renderers, backgrounds and step context) on the fixed virtual canvas,
 * scaled to the width of its box. The overview thumbnails and the presenter
 * previews use it.
 *
 * - The slide only mounts once the box has a measured width, so a hidden or
 *   collapsed panel never pays for painting (and server rendering paints
 *   nothing but the empty box).
 * - The miniature is `inert` and `aria-hidden`; the surrounding control or
 *   the `label` names it (`role="img"` when a label is given).
 * - Measurement uses the box's own window (`ownerDocument.defaultView`), so a
 *   preview inside the presenter popup observes the popup, not the opener.
 */
import type { DeckSlide } from '@texuli/deck/model';
import { onMount } from 'svelte';
import { deckCssVars } from '../css-vars.ts';
import DeckSlideView from '../DeckSlideView.svelte';
import { type DeckPreviewPaint, lastStep, previewScale } from './paint.ts';

interface Props {
  paint: DeckPreviewPaint;
  slide: DeckSlide;
  /** Index into `deck.slides`. */
  index: number;
  title: string;
  /** The step shown; defaults to the last one (every fragment visible). */
  step?: number;
  /** Names the preview as an image; omit when a surrounding control names it. */
  label?: string;
}

let { paint, slide, index, title, step, label }: Props = $props();

let box: HTMLElement | undefined = $state();
let width = $state(0);
let scale = $derived(previewScale(width, paint.canvas));
let shownStep = $derived(step ?? lastStep(slide));
let vars = $derived({
  '--tx-deck-scale': String(scale),
  '--tx-deck-offset-x': '0px',
  '--tx-deck-offset-y': '0px',
  '--tx-deck-preview-ratio': `${paint.canvas.width} / ${paint.canvas.height}`,
});

onMount(() => {
  const element = box;
  if (!element) return;
  const view = element.ownerDocument.defaultView as (Window & typeof globalThis) | null;
  const measure = () => {
    const next = element.getBoundingClientRect().width;
    if (next > 0) width = next;
  };
  measure();
  const Observer = view?.ResizeObserver ?? globalThis.ResizeObserver;
  if (typeof Observer !== 'function') {
    view?.addEventListener('resize', measure);
    return () => view?.removeEventListener('resize', measure);
  }
  const observer = new Observer((records) => {
    const rect = records[records.length - 1]?.contentRect;
    if (rect && rect.width > 0) width = rect.width;
  });
  observer.observe(element);
  return () => observer.disconnect();
});
</script>

<div
  bind:this={box}
  class="tx-deck-preview"
  role={label ? 'img' : undefined}
  aria-label={label}
  data-tx-deck-preview={slide.id}
  data-tx-deck-preview-ready={scale > 0 ? 'true' : 'false'}
  data-step={shownStep}
  use:deckCssVars={vars}
>
  {#if scale > 0}
    <div class="tx-deck-stage__canvas tx-deck-preview__canvas" aria-hidden="true" inert>
      <DeckSlideView
        deck={paint.deck}
        {slide}
        {index}
        active={false}
        step={shownStep}
        direction="none"
        {title}
        tier={paint.tier}
        t={paint.t}
        renderers={paint.renderers}
        palette={paint.palette(slide)}
        canvas={paint.canvas}
        resolveAvatar={paint.resolveAvatar}
      />
    </div>
  {/if}
</div>

<style>
  .tx-deck-preview {
    position: relative;
    overflow: hidden;
    inline-size: 100%;
    aspect-ratio: var(--tx-deck-preview-ratio, 16 / 9);
    background: var(--tx-muted, var(--tx-background));
    border: 1px solid var(--tx-border);
    border-radius: calc(var(--tx-radius, 0.625rem) * 0.75);
  }

  .tx-deck-preview__canvas {
    pointer-events: none;
    user-select: none;
  }

  /* The miniature paints an inactive slide (no autoplay, no focus), shown. */
  .tx-deck-preview :global(.tx-deck-stage__slide) {
    visibility: visible;
  }

  @media (forced-colors: active) {
    .tx-deck-preview {
      border-color: CanvasText;
    }
  }
</style>
