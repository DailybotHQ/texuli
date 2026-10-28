<script lang="ts">
/**
 * One deck on the stage with a jump list beside it: the layout, background
 * and component galleries. The list buttons move the stage through its
 * controller (`aria-current` follows the shown slide, whichever way it got
 * there), and the stage keeps its own keyboard, overview and presenter.
 * Galleries never touch the URL hash (`syncHash={false}`): the flagship
 * deck owns it.
 */
import '@texuli/slides/styles.css';
import '@texuli/player/styles.css';
import type { DeckController } from '@texuli/deck/engine';
import { DeckStage } from '@texuli/slides/stage';
import type { GalleryEntry } from './decks.ts';

interface Props {
  deck: unknown;
  entries: readonly GalleryEntry[];
  /** The jump list's accessible name. */
  label: string;
  /** A data attribute value for tests (`layouts`, `backgrounds`, `components`). */
  name: string;
}

let { deck, entries, label, name }: Props = $props();

let controller = $state<DeckController | null>(null);
let current = $state('');

$effect(() => {
  const engine = controller;
  if (!engine) return;
  current = engine.getState().slideId;
  return engine.subscribe((state) => {
    current = state.slideId;
  });
});

function show(id: string) {
  controller?.goTo(id, { source: 'api' });
}
</script>

<div class="gallery" data-slides-gallery={name}>
  <!-- The list scrolls on narrow screens, so its scroll box is a focusable region (keyboard scrolling). -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="gallery__scroll" role="region" aria-label={`${label}: choose a slide`} tabindex="0">
    <ul class="gallery__list" aria-label={label}>
      {#each entries as entry (entry.id)}
        <li>
          <button
            type="button"
            class="gallery__item"
            aria-current={current === entry.id ? 'true' : undefined}
            data-slides-gallery-item={entry.id}
            disabled={!controller}
            onclick={() => show(entry.id)}
          >
            <span class="gallery__label">{entry.label}</span>
            <span class="gallery__summary">{entry.summary}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
  <div class="gallery__stage">
    <DeckStage {deck} tier="untrusted" syncHash={false} bind:controller />
  </div>
</div>

<style>
  .gallery {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }

  .gallery__scroll {
    min-inline-size: 0;
    padding-block-end: 0.25rem;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .gallery__scroll:focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }

  .gallery__list {
    display: flex;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .gallery__item {
    display: grid;
    gap: 0.15rem;
    min-inline-size: 11rem;
    min-block-size: 44px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  .gallery__item[aria-current="true"] {
    border-color: var(--tx-primary, Highlight);
    box-shadow: inset 0 0 0 1px var(--tx-primary, Highlight);
  }

  .gallery__item:focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }

  .gallery__item:disabled {
    cursor: progress;
  }

  .gallery__label {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .gallery__summary {
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, CanvasText);
  }

  .gallery__stage {
    min-inline-size: 0;
  }

  @media (min-width: 64rem) {
    .gallery {
      grid-template-columns: 16rem minmax(0, 1fr);
      align-items: start;
    }

    .gallery__scroll {
      max-block-size: 34rem;
      overflow: auto;
      padding-block-end: 0;
      padding-inline-end: 0.25rem;
    }

    .gallery__list {
      flex-direction: column;
    }

    .gallery__item {
      min-inline-size: 0;
    }
  }

  @media (forced-colors: active) {
    .gallery__item[aria-current="true"] {
      outline: 2px solid Highlight;
    }
  }
</style>
