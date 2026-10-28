<script lang="ts">
/**
 * The body of `DeckPrintView` (loaded on first use). Print view for deck model v2: one page per visible slide at the canvas
 * size of the deck aspect (a named `@page`: 1280 × 720 CSS pixels for 16:9),
 * every reveal step shown, optional notes after the slides (`appendix`) or
 * notes only (`handout`). Hidden slides are skipped.
 *
 * By default each page paints with the stage's own renderers (the 20
 * layouts, free slides, the component registry, backgrounds), loaded on
 * first use; a `slide` snippet replaces that. `data-print-ready="true"`
 * (and `onReady`) fires once the renderers, themes, images and fonts have
 * settled and the host's `contentReady` is true; after `mediaTimeoutMs` it
 * fires anyway, so a print never hangs on one broken image.
 */
import type { Component } from 'svelte';
import { tick } from 'svelte';
import type { DeckPreviewPaint } from '../stage/presenter/paint.ts';
import { type DeckPrintPage, planDeckPrint } from './api.ts';
import type { DeckPrintPaint } from './print-paint.ts';
import { settleDeckPrint } from './print-ready.ts';
import type { DeckPrintViewProps } from './print-types.ts';

let {
  deck,
  notes = 'none',
  slide: slideSnippet,
  children,
  renderers,
  tier = 'untrusted',
  messages,
  loadTheme,
  resolveAvatar,
  contentReady = true,
  onReady,
  onError,
  mediaTimeoutMs = 10_000,
  isolate = true,
}: DeckPrintViewProps = $props();

type PaintModule = typeof import('./print-paint.ts');

let plan = $derived(planDeckPrint(deck, { notes }));
let custom = $derived(slideSnippet ?? children);
let root: HTMLElement | undefined = $state();
let printReady = $state(false);
let painter = $state.raw<{
  paint: DeckPrintPaint;
  Preview: Component<Record<string, unknown>>;
} | null>(null);
let slidesById = $derived(new Map(deck.slides.map((item) => [item.id, item])));
let slidePages = $derived(plan.pages.filter((page) => page.kind === 'slide'));
let notePages = $derived(
  plan.pages.filter(
    (page): page is Extract<DeckPrintPage, { kind: 'notes' }> => page.kind === 'notes'
  )
);

$effect(() => {
  if (custom) return;
  const current = deck;
  const options = { renderers, tier, messages, loadTheme, resolveAvatar };
  let live = true;
  painter = null;
  import('./print-paint.ts')
    .then(async (module: PaintModule) => {
      const paint = await module.createDeckPrintPaint(current, options);
      if (live) {
        painter = {
          paint,
          Preview: module.DeckSlidePreview as unknown as Component<Record<string, unknown>>,
        };
      }
    })
    .catch((error: unknown) => {
      if (live) onError?.(error);
    });
  return () => {
    live = false;
  };
});

$effect(() => {
  const element = root;
  const ready = contentReady && (custom !== undefined || painter !== null);
  const currentPlan = plan;
  let live = true;
  printReady = false;
  if (!element || !ready) return;
  void tick()
    .then(() => settleDeckPrint(element, mediaTimeoutMs, () => live))
    .then((result) => {
      if (!live) return;
      if (!result.settled)
        onError?.(new Error('Timed out waiting for print content; printing what has loaded.'));
      printReady = true;
      onReady?.(currentPlan);
    });
  return () => {
    live = false;
  };
});

function vars(values: Record<string, string> | undefined) {
  return (element: HTMLElement) => {
    if (!values) return;
    for (const [name, value] of Object.entries(values)) element.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(values)) element.style.removeProperty(name);
    };
  };
}

function previewPaint(value: DeckPrintPaint): DeckPreviewPaint {
  return value.paint;
}
</script>

<div
  bind:this={root}
  class="tx-deck-print-view tx-deck-stage"
  role="document"
  aria-label={`Print: ${plan.title}`}
  aria-busy={!printReady}
  lang={deck.meta.locale}
  dir={deck.meta.dir}
  data-aspect={plan.pageSize.aspect}
  data-notes={plan.notes}
  data-motion="reduce"
  data-tx-deck-motion="none"
  data-print-ready={printReady ? 'true' : 'false'}
  data-tx-print-isolate={isolate ? 'true' : undefined}
  {@attach vars(painter?.paint.styleVars)}
>
  {#each slidePages as page, position (page.slideId)}
    {@const item = slidesById.get(page.slideId)}
    {#if item}
      <section
        class="tx-deck-print-view__slide"
        data-slide-id={item.id}
        data-aspect={plan.pageSize.aspect}
        aria-label={`Slide ${position + 1}: ${page.label}`}
        {@attach vars(painter?.paint.themeVars(item))}
      >
        {#if custom}
          {@render custom(item, page.index)}
        {:else if painter}
          {@const Preview = painter.Preview}
          <Preview
            paint={previewPaint(painter.paint)}
            slide={item}
            index={page.index}
            title={painter.paint.title(item, position)}
            label={page.label}
          />
        {:else}
          <p class="tx-deck-stage__loading" role="status">{page.label}</p>
        {/if}
      </section>
    {/if}
  {/each}
  {#if notePages.length > 0}
    <div class="tx-deck-print-view__appendix" data-after-slides={slidePages.length > 0 ? 'true' : undefined}>
      {#each notePages as page (page.slideId)}
        <section
          class="tx-deck-print-view__notes"
          data-slide-id={page.slideId}
          aria-label={`Notes: ${page.label}`}
        >
          <h2 class="tx-deck-print-view__notes-title">{page.label}</h2>
          {#if page.notes}
            <p class="tx-deck-print-view__notes-body">{page.notes}</p>
          {:else}
            <p class="tx-deck-print-view__notes-body" data-empty="true">No notes for this slide.</p>
          {/if}
        </section>
      {/each}
    </div>
  {/if}
</div>

<style>
  @page tx-deck-canvas-16-9 {
    size: 1280px 720px;
    margin: 0;
  }
  @page tx-deck-canvas-4-3 {
    size: 1024px 768px;
    margin: 0;
  }
  @page tx-deck-canvas-9-16 {
    size: 720px 1280px;
    margin: 0;
  }
  @page tx-deck-canvas-1-1 {
    size: 1080px 1080px;
    margin: 0;
  }

  .tx-deck-print-view {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
  }

  .tx-deck-print-view__slide {
    min-inline-size: 0;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }

  /* The page paints an inactive slide (no autoplay, no focus), shown at its last step. */
  .tx-deck-print-view__slide :global(.tx-deck-stage__slide) {
    visibility: visible;
  }

  .tx-deck-print-view__notes {
    display: grid;
    gap: 0.5rem;
    break-inside: avoid;
  }

  .tx-deck-print-view__notes-title {
    margin: 0;
    font-size: 1.125rem;
  }

  .tx-deck-print-view__notes-body {
    margin: 0;
    white-space: pre-line;
  }

  @media print {
    .tx-deck-print-view {
      display: block;
      gap: 0;
      print-color-adjust: exact;
    }

    .tx-deck-print-view__slide {
      overflow: hidden;
      break-inside: avoid;
    }

    /* At print time the page is the canvas: scale 1, no frame, no letterbox. */
    .tx-deck-print-view__slide :global(.tx-deck-preview) {
      --tx-deck-scale: 1 !important;
      inline-size: 100%;
      block-size: 100%;
      aspect-ratio: auto;
      border: 0;
      border-radius: 0;
    }

    .tx-deck-print-view__slide[data-aspect="16:9"] {
      page: tx-deck-canvas-16-9;
      inline-size: 1280px;
      block-size: 720px;
    }
    .tx-deck-print-view__slide[data-aspect="4:3"] {
      page: tx-deck-canvas-4-3;
      inline-size: 1024px;
      block-size: 768px;
    }
    .tx-deck-print-view__slide[data-aspect="9:16"] {
      page: tx-deck-canvas-9-16;
      inline-size: 720px;
      block-size: 1280px;
    }
    .tx-deck-print-view__slide[data-aspect="1:1"] {
      page: tx-deck-canvas-1-1;
      inline-size: 1080px;
      block-size: 1080px;
    }

    .tx-deck-print-view__slide + .tx-deck-print-view__slide,
    .tx-deck-print-view__appendix[data-after-slides="true"],
    .tx-deck-print-view[data-notes="handout"] .tx-deck-print-view__notes + .tx-deck-print-view__notes {
      break-before: page;
    }

    .tx-deck-print-view__notes {
      padding-block: 0.25in;
      padding-inline: 0.5in;
    }

    /* Isolation: only the print view and its ancestors print, without their box spacing. */
    :global(*:has([data-tx-print-isolate="true"])) {
      display: block !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      inline-size: auto !important;
      max-inline-size: none !important;
      min-block-size: 0 !important;
      transform: none !important;
    }

    :global(
        body
          *:not(:has([data-tx-print-isolate="true"])):not([data-tx-print-isolate="true"]):not(
            [data-tx-print-isolate="true"] *
          )
      ) {
      display: none !important;
    }
  }
</style>
