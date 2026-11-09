<script lang="ts">
/**
 * Interactive Slides proof for the Solution landing. The fixture and controls
 * stay small in the island entry; the real slides stage loads on demand.
 */
import '@texuli/slides/styles.css';
import type { DeckController } from '@texuli/deck/engine';
import type { DeckRenderers, DeckThemeLoader } from '@texuli/slides/stage-core';
import type { Component, Snippet } from 'svelte';
import { onDestroy } from 'svelte';
import type { SlidesDemoAction, SlidesDemoModel, SlidesDemoSnapshot } from './model.ts';

type StageProps = {
  deck: unknown;
  syncHash: boolean;
  fit: 'container';
  tier: 'untrusted';
  autofocus: boolean;
  clickToAdvance: boolean;
  autoSlideMs: number;
  initialSlideId: string;
  coverHeadingLevel: 3;
  namespace: string;
  defaultRenderers: false;
  renderers: DeckRenderers;
  loadTheme: DeckThemeLoader | null;
  controller: DeckController | null;
  onSlideChange: (intent: { index: number; slideId: string }) => void;
  chrome: Snippet;
};

let model: SlidesDemoModel | null = null;
let snapshot = $state.raw<SlidesDemoSnapshot | null>(null);
let Stage = $state<Component<StageProps> | null>(null);
let Controls = $state<Component | null>(null);
let renderers = $state.raw<DeckRenderers>({});
let loadTheme = $state<DeckThemeLoader | null>(null);
let stageController = $state.raw<DeckController | null>(null);
let started = $state(false);
let stageLoading = $state(false);
let stageFailed = $state(false);
let announcement = $state('Start the interactive demo to explore the slide deck.');
let playSync: ReturnType<typeof setInterval> | undefined;

function slideLabel(state: SlidesDemoSnapshot): string {
  const slide = state.deck.slides[state.location.slideIndex];
  if (!slide) return 'the current slide';
  if (slide.title) return slide.title;
  if ('props' in slide && typeof slide.props.title === 'string') return slide.props.title;
  return slide.id;
}

function say(state: SlidesDemoSnapshot, prefix = ''): void {
  announcement = `${prefix ? `${prefix}. ` : ''}${slideLabel(state)}`;
}

function stopPlaySync(): void {
  if (playSync !== undefined) clearInterval(playSync);
  playSync = undefined;
}

function followModelPlayback(): void {
  if (!model) return;
  stopPlaySync();
  playSync = setInterval(() => {
    const current = model?.getSnapshot();
    if (!current) return stopPlaySync();
    snapshot = current;
    const stageState = stageController?.getState();
    if (stageState && stageState.slideId !== current.location.slideId) {
      stageController?.goTo(current.location.slideId, { source: 'auto' });
    }
    say(current);
    if (!current.playing) stopPlaySync();
  }, 120);
}

function handleStageChange(intent: { index: number; slideId: string }): void {
  if (!model) return;
  const current = model.getSnapshot();
  if (!current.deck.slides.some((slide) => slide.id === intent.slideId)) return;

  let next = current;
  let index = current.location.slideIndex;
  while (index < intent.index) {
    next = model.dispatch({ type: 'next' });
    index += 1;
  }
  while (index > intent.index) {
    next = model.dispatch({ type: 'prev' });
    index -= 1;
  }
  snapshot = next;
  if (!next.playing) stopPlaySync();
  say(next);
}

function dispatch(action: SlidesDemoAction): void {
  if (!model) return;
  const next = model.dispatch(action);
  snapshot = next;

  if (action.type === 'play') {
    if (next.playing) followModelPlayback();
    else stopPlaySync();
  } else if (action.type === 'reset' || action.type === 'scenario') {
    stopPlaySync();
    stageController?.pause();
    say(next, action.type === 'reset' ? 'Example reset' : 'Scenario changed');
  } else if (action.type === 'theme') {
    say(next, `Theme changed to ${typeof next.theme === 'string' ? next.theme : 'custom'}`);
  } else if (action.type === 'view-source') {
    announcement = next.sourceVisible ? 'Deck source shown.' : 'Deck source hidden.';
  } else {
    if (!next.playing) {
      stopPlaySync();
      stageController?.pause();
    }
    stageController?.goTo(next.location.slideId, { source: 'pointer' });
    say(next, action.type === 'next' ? 'Next slide' : 'Previous slide');
  }
}

async function startDemo(): Promise<void> {
  if (started || stageLoading || stageFailed) return;
  stageLoading = true;
  try {
    const [modelModule, stage, layouts, controls] = await Promise.all([
      import('./model.ts'),
      import('@texuli/slides/stage-core'),
      import('@texuli/slides/layouts'),
      import('./ui/SlidesDemoControls.svelte'),
    ]);
    model = modelModule.createSlidesDemoModel();
    snapshot = model.getSnapshot();
    renderers = { ...layouts.layoutRenderers, validateBlock: stage.validateDeckBlock };
    loadTheme = stage.loadDeckLibraryTheme;
    Stage = stage.DeckStageCore as unknown as Component<StageProps>;
    Controls = controls.default;
    announcement = `${slideLabel(snapshot)} is ready.`;
    started = true;
  } catch {
    stageFailed = true;
    announcement = 'The interactive stage could not load. The static preview remains available.';
  } finally {
    stageLoading = false;
  }
}

onDestroy(() => {
  stopPlaySync();
  model?.destroy();
});
</script>

{#snippet quietChrome()}
  <span class="sr-only">Use the controls above to navigate this slide deck.</span>
{/snippet}

<div class="slides-demo" data-tx-slides-demo="">
  {#if !started && !stageLoading && !stageFailed}
    <button type="button" class="slides-demo__start" onclick={startDemo}>
      Start interactive demo
    </button>
    <p class="slides-demo__hint">The static preview is ready; the interactive controls load on request.</p>
  {:else if stageLoading}
    <p class="slides-demo__loading" role="status">Loading the interactive slide stage…</p>
  {:else if stageFailed}
    <p class="slides-demo__error" role="alert">
      The interactive stage could not load. The static preview remains available above.
    </p>
  {:else if snapshot}
    {#if Controls}
      {@const DemoControls = Controls}
      <DemoControls {snapshot} {announcement} onAction={dispatch} />
    {/if}
    <p class="slides-demo__hint">
      Focus the slide stage and use the arrow keys to navigate. On touch screens, swipe across the slide.
    </p>
  {/if}

  {#if Stage && snapshot}
    {@const SlidesStage = Stage}
    <SlidesStage
      deck={snapshot.deck}
      defaultRenderers={false}
      renderers={renderers}
      {loadTheme}
      syncHash={false}
      fit="container"
      tier="untrusted"
      autofocus={false}
      clickToAdvance={false}
      autoSlideMs={0}
      initialSlideId={snapshot.location.slideId}
      coverHeadingLevel={3}
      namespace="slides-solution-demo"
      bind:controller={stageController}
      onSlideChange={handleStageChange}
      chrome={quietChrome}
    />
  {/if}

  {#if snapshot?.sourceVisible && snapshot.source}
    <section class="slides-demo__source" aria-label="Deck source as JSON">
      <h3>Deck source</h3>
      <pre><code>{snapshot.source}</code></pre>
    </section>
  {/if}
</div>

<style>
  .slides-demo {
    display: grid;
    gap: 0.85rem;
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .slides-demo__hint,
  .slides-demo__loading,
  .slides-demo__error {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.875rem;
  }

  .slides-demo__start {
    justify-self: start;
    min-block-size: 2.75rem;
    padding-inline: 1rem;
    border: 1px solid var(--tx-border, GrayText);
    border-radius: var(--tx-radius, 0.5rem);
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }

  .slides-demo__start:focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }

  .slides-demo__error {
    color: var(--tx-danger-foreground, MarkText);
  }

  .slides-demo__source {
    min-inline-size: 0;
  }

  .slides-demo__source h3 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }

  pre {
    max-block-size: 24rem;
    max-inline-size: 100%;
    overflow: auto;
    margin: 0;
    padding: 0.85rem;
    border: 1px solid var(--tx-border, GrayText);
    border-radius: var(--tx-radius, 0.5rem);
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
    white-space: pre;
    tab-size: 2;
  }

  code {
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: 0.8125rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .slides-demo,
    .slides-demo * {
      scroll-behavior: auto;
    }
  }
</style>
