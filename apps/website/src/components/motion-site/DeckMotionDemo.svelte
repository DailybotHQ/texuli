<script lang="ts">
/**
 * /motion-page/ deck motion: the slides stage (`@texuli/slides/stage`)
 * presenting a deck with one slide per transition and every fragment
 * effect, at the motion level chosen in the page settings (the deck's
 * `style.motion`: full, subtle or none). Changing the level remounts the
 * stage with the new deck. The stage itself honors the reader's
 * reduced-motion system setting; the table under the demo shows what every
 * transition becomes at each level and under reduced motion. The stage
 * loads after the island hydrates.
 */
import '@texuli/slides/styles.css';
import '@texuli/player/styles.css';
import type { DeckController } from '@texuli/deck/engine';
import { onMount } from 'svelte';
import { motionDeck } from './deck.ts';
import { MOTION_SETTINGS } from './settings.svelte.ts';

type StageModule = typeof import('@texuli/slides/stage');

let stage = $state.raw<StageModule | null>(null);
let controller = $state<DeckController | null>(null);
let failed = $state(false);
let current = $state('');
const level = $derived(MOTION_SETTINGS.level);
const deck = $derived(motionDeck(level));
const slides = $derived(
  (deck.slides as { id: string; title: string }[]).map((slide) => ({
    id: slide.id,
    title: slide.title,
  }))
);

onMount(() => {
  let live = true;
  import('@texuli/slides/stage').then(
    (module) => {
      if (live) stage = module;
    },
    () => {
      failed = true;
    }
  );
  return () => {
    live = false;
  };
});

$effect(() => {
  const engine = controller;
  if (!engine) return;
  current = engine.getState().slideId;
  return engine.subscribe((state) => {
    current = state.slideId;
  });
});
</script>

<div class="deck-motion" data-motion-deck="">
  <p class="deck-motion__level" data-motion-deck-level="">
    Deck motion level: <strong>{level}</strong>. Change it in the settings at the top of the page.
  </p>
  <div class="deck-motion__layout">
    <ul class="deck-motion__list" aria-label="Jump to a slide">
      {#each slides as slide (slide.id)}
        <li>
          <button
            type="button"
            class="deck-motion__jump"
            aria-current={current === slide.id ? 'true' : undefined}
            aria-disabled={!controller}
            onclick={() => controller?.goTo(slide.id, { source: 'api' })}>{slide.title}</button
          >
        </li>
      {/each}
    </ul>
    <div class="deck-motion__stage">
      {#if failed}
        <p role="alert">The slides stage could not load. Reload the page to try again.</p>
      {:else if stage}
        {#key level}
          <stage.DeckStage {deck} tier="untrusted" syncHash={false} bind:controller />
        {/key}
      {:else}
        <p data-motion-deck-loading="">Loading the slides stage…</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .deck-motion {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .deck-motion__level {
    margin: 0;
    font-size: 0.875rem;
  }
  .deck-motion__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }
  @media (min-width: 64rem) {
    .deck-motion__layout {
      grid-template-columns: 14rem minmax(0, 1fr);
    }
  }
  .deck-motion__list {
    display: flex;
    flex-wrap: wrap;
    align-content: start;
    gap: 0.35rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  @media (min-width: 64rem) {
    .deck-motion__list {
      display: grid;
    }
  }
  .deck-motion__jump {
    inline-size: 100%;
    min-block-size: 2.25rem;
    padding-inline: 0.65rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    font-size: 0.8125rem;
    text-align: start;
    cursor: pointer;
  }
  .deck-motion__jump[aria-current='true'] {
    border-color: var(--tx-primary, Highlight);
    background: var(--tx-primary-soft, Canvas);
    color: var(--tx-primary-soft-foreground, CanvasText);
    font-weight: 600;
  }
  .deck-motion__jump:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .deck-motion__stage {
    min-inline-size: 0;
  }
</style>
