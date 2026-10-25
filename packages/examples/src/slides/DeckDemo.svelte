<script lang="ts">
import '@texuli/slides/styles.css';
import { walkBlocks } from '@texuli/blocks/core';
import { catalogIdForBlock } from '@texuli/slides/grammar';
import type { Deck } from '@texuli/slides/model';
import {
  createDeckThemeCache,
  DeckPrint,
  DeckStage,
  deckCatalogThemeIds,
  loadDeckBlockFamily,
  loadDeckLibraryTheme,
} from '@texuli/slides/stage';
import { onMount } from 'svelte';

interface Props {
  deck: Deck;
  /** `stage`: the interactive stage on one slide; `print`: every slide as pages. */
  view?: 'stage' | 'print';
  initialSlideId?: string;
  /** The initial slide's reveal step. */
  initialStep?: number;
  /** Open the stage in presenter mode. */
  presenter?: boolean;
  label: string;
}

let { deck, view = 'stage', initialSlideId, initialStep, presenter, label }: Props = $props();

// App-authored demo decks: the developer tier lets the embedded swatches paint.
const mediaTrust = 'developer';
const themes = createDeckThemeCache(loadDeckLibraryTheme);
const loadTheme = (id: string) =>
  themes.load(id).then((theme) => theme ?? Promise.reject(new Error(`Unknown theme ${id}`)));

let preloaded = $state(false);
let printReady = $state(false);
let settled = $state(false);
let section: HTMLElement | undefined = $state();
let ready = $derived(preloaded && settled && (view === 'stage' || printReady));

// Slide content settles asynchronously: block families render, and code
// blocks tokenize once their grammar loads. Wait for both before capturing.
const UNSETTLED =
  '.tx-deck-stage__loading, [data-tx-block="code"][data-grammar]:not([data-grammar="none"]):not([data-tokenized])';

$effect(() => {
  const root = section;
  if (!root) return;
  // Readiness latches: later states (the overview, presenter mode) never
  // bring the loading status back.
  const observer = new MutationObserver(() => check());
  const check = () => {
    if (root.querySelector(UNSETTLED) !== null) return;
    if (root.querySelector('.tx-deck-stage__regions') === null) return;
    settled = true;
    observer.disconnect();
  };
  observer.observe(root, { subtree: true, childList: true, attributes: true });
  check();
  return () => observer.disconnect();
});

// Load every block family and catalog theme first, so captures never show a
// loading state; the status paragraph holds the example host until then.
onMount(() => {
  const families = new Set(
    deck.slides.flatMap((slide) =>
      walkBlocks(slide.blocks).map(({ block }) => catalogIdForBlock(block.type))
    )
  );
  void Promise.all([
    ...[...families].map((id) => loadDeckBlockFamily(id)),
    ...deckCatalogThemeIds(deck).map((id) => themes.load(id)),
  ]).then(() => {
    preloaded = true;
  });
});
</script>

{#if !ready}
  <p role="status">Loading example…</p>
{/if}
{#if preloaded}
  <section bind:this={section} class="deck-demo" aria-label={label}>
    {#if view === 'print'}
      <DeckPrint {deck} {loadTheme} {mediaTrust} onReady={() => (printReady = true)} />
    {:else}
      <DeckStage {deck} {loadTheme} {mediaTrust} {initialSlideId} {initialStep} {presenter} />
    {/if}
  </section>
{/if}

<style>
  .deck-demo {
    padding: 1rem;
    max-inline-size: 64rem;
  }
</style>
