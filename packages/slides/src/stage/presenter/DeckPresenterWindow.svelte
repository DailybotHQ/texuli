<script lang="ts">
/**
 * The presenter window: a full presenter screen (current slide and what
 * comes next as live previews, speaker notes, step label, timers, previous
 * and next) with its own engine controller, kept in step with the stage
 * over the closed presenter protocol v1 in both directions:
 *
 * - on mount it says `hello`, and the stage answers with its position;
 * - its own moves post `sync`; positions from the stage move it with the
 *   `presenter` source, which is never echoed back.
 *
 * Keys go through `decideDeckInput` on the window that holds the view (its
 * own `ownerDocument.defaultView`), so arrows, Space, Page keys, Home and
 * End drive the deck from the presenter screen; text fields are left alone.
 */
import type { DeckState, PresenterTransport } from '@texuli/deck/engine';
import { createDeckController, decideDeckInput } from '@texuli/deck/engine';
import { onMount, untrack } from 'svelte';
import type { DeckStageContext } from '../context.ts';
import { keyInput } from '../input.ts';
import { deckSyncLink } from '../sync-link.ts';
import DeckSlidePreview from './DeckSlidePreview.svelte';
import PresenterNav from './PresenterNav.svelte';
import PresenterNotes from './PresenterNotes.svelte';
import PresenterStatus from './PresenterStatus.svelte';
import PresenterUpNext from './PresenterUpNext.svelte';
import { type DeckPreviewPaint, presenterPosition } from './paint.ts';
import type { DeckPresenterTimers } from './timers.ts';

interface Props {
  stage: DeckStageContext;
  paint: DeckPreviewPaint;
  timers: DeckPresenterTimers;
  /** This window's end of the presenter link. */
  transport: PresenterTransport;
  /** Close the presenter window (the stage's session ends). */
  onClose?: () => void;
}

let { stage, paint, timers, transport, onClose }: Props = $props();

// svelte-ignore state_referenced_locally
const controller = createDeckController(stage.deck, {
  initialSlideId: stage.state.slideId,
  initialStep: stage.state.step,
  autoSlideMs: 0,
});
let position = $state.raw<DeckState>(controller.getState());
let root: HTMLElement | undefined = $state();

let at = $derived(
  presenterPosition(stage.slides, position.slideIndex, position.step, position.stepCount)
);
let entry = $derived(at.current);
let upcoming = $derived(at.hasMoreSteps ? at.current : at.following);
let announcement = $derived(
  entry
    ? stage.t('stage.announce', {
        current: entry.position + 1,
        total: stage.slides.length,
        title: entry.title,
      })
    : ''
);

function exists(slideId: string): boolean {
  return stage.slides.some((item) => item.slide.id === slideId);
}

onMount(() => {
  timers.start();
  const link = deckSyncLink(transport);
  let remote: string | null = null;
  const offState = controller.subscribe('statechange', ({ state: next, source }) => {
    position = next;
    const key = `${next.slideId}:${next.step}`;
    if (source === 'presenter' || key === remote) {
      remote = null;
      return;
    }
    link?.post(next.slideId, next.step);
  });
  const offLink = link?.subscribe((signal) =>
    untrack(() => {
      const now = controller.getState();
      if (signal.kind === 'hello') {
        link.post(now.slideId, now.step);
        return;
      }
      if (!exists(signal.slideId)) return;
      if (now.slideId === signal.slideId && now.step === signal.step) return;
      remote = `${signal.slideId}:${signal.step}`;
      controller.goTo(
        { ...now, slideId: signal.slideId, step: signal.step },
        { source: 'presenter' }
      );
    })
  );
  const now = controller.getState();
  link?.hello(now.slideId, now.step);

  const view = root?.ownerDocument.defaultView ?? null;
  const onKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    const action = decideDeckInput(keyInput(event, root), { dir: stage.dir });
    const source = { source: 'keyboard' as const };
    if (action === 'next') controller.next(source);
    else if (action === 'prev') controller.prev(source);
    else if (action === 'first') controller.first(source);
    else if (action === 'last') controller.last(source);
    else return;
    event.preventDefault();
  };
  view?.addEventListener('keydown', onKeydown);
  root?.querySelector<HTMLElement>('.tx-deck-presenter__notes')?.focus({ preventScroll: true });

  return () => {
    view?.removeEventListener('keydown', onKeydown);
    offState();
    offLink?.();
    controller.destroy();
  };
});
</script>

<div
  bind:this={root}
  class="tx-deck-presenter-window__view"
  role="region"
  aria-label={stage.t('presenter.viewLabel')}
  lang={stage.locale}
  dir={stage.dir}
>
  <header class="tx-deck-presenter-window__header">
    <h1 class="tx-deck-presenter-window__title">{stage.deck.meta.title ?? stage.t('presenter.title')}</h1>
    {#if onClose}
      <button type="button" class="tx-deck-stage__control" data-tx-deck-presenter-close onclick={() => onClose?.()}>
        {stage.t('stage.closePresenterWindow')}
      </button>
    {/if}
  </header>
  <div
    class="tx-deck-presenter-window__body"
    data-slide-id={entry?.slide.id}
    data-step={position.step}
  >
    <div class="tx-deck-presenter-window__status">
      <PresenterStatus
        t={stage.t}
        locale={stage.locale}
        position={at.position}
        total={stage.slides.length}
        slideId={entry?.slide.id}
        {timers}
      />
    </div>
    {#if entry}
      <section class="tx-deck-presenter-window__current" aria-label={stage.t('presenter.currentSlide')}>
        <h2 class="tx-deck-stage__pane-title">{stage.t('presenter.currentSlide')}</h2>
        <DeckSlidePreview
          {paint}
          slide={entry.slide}
          index={entry.index}
          title={entry.title}
          step={position.step}
          label={stage.t('stage.slidePreview', { title: entry.title })}
        />
        <p class="tx-deck-presenter-window__slide-title">{entry.title}</p>
      </section>
    {/if}
    <div class="tx-deck-presenter-window__next">
      <PresenterUpNext
        t={stage.t}
        step={position.step}
        stepCount={position.stepCount}
        following={at.following?.title}
      >
        {#snippet preview()}
          {#if upcoming}
            <DeckSlidePreview
              {paint}
              slide={upcoming.slide}
              index={upcoming.index}
              title={upcoming.title}
              step={at.hasMoreSteps ? position.step + 1 : 0}
              label={stage.t('stage.slidePreview', { title: upcoming.title })}
            />
          {/if}
        {/snippet}
      </PresenterUpNext>
    </div>
    <div class="tx-deck-presenter-window__notes">
      <PresenterNotes
        t={stage.t}
        slide={entry?.slide}
        step={position.step}
        stepCount={position.stepCount}
      />
    </div>
    <div class="tx-deck-presenter-window__nav">
      <PresenterNav
        t={stage.t}
        atStart={at.atStart}
        atEnd={at.atEnd}
        onPrev={() => controller.prev({ source: 'pointer' })}
        onNext={() => controller.next({ source: 'pointer' })}
      />
    </div>
  </div>
  <p class="tx-deck-presenter-window__live" aria-live="polite" aria-atomic="true">{announcement}</p>
</div>

<style>
  .tx-deck-presenter-window__view {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    block-size: 100dvh;
    color: var(--tx-foreground);
    background: var(--tx-background);
  }

  .tx-deck-presenter-window__header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    justify-content: space-between;
    padding-block: 0.75rem;
    padding-inline: 1rem;
    border-block-end: 1px solid var(--tx-border);
  }

  .tx-deck-presenter-window__title {
    margin: 0;
    font-size: 1.125rem;
  }

  .tx-deck-presenter-window__body {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(min(100%, 18rem), 2fr);
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    grid-template-areas:
      "status status"
      "current next"
      "current notes"
      "nav nav";
    gap: 1rem;
    min-block-size: 0;
    padding: 1rem;
  }

  .tx-deck-presenter-window__status {
    grid-area: status;
  }

  .tx-deck-presenter-window__current {
    display: grid;
    grid-area: current;
    gap: 0.5rem;
    align-content: start;
  }

  .tx-deck-presenter-window__next {
    grid-area: next;
  }

  .tx-deck-presenter-window__notes {
    display: grid;
    grid-area: notes;
    min-block-size: 0;
    font-size: 1.25rem;
  }

  .tx-deck-presenter-window__notes :global(.tx-deck-presenter__notes) {
    max-block-size: none;
  }

  .tx-deck-presenter-window__nav {
    grid-area: nav;
  }

  .tx-deck-presenter-window__slide-title {
    margin: 0;
    font-weight: 600;
  }

  @media (max-width: 48rem) {
    .tx-deck-presenter-window__body {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: none;
      grid-template-areas: "status" "current" "next" "notes" "nav";
    }
  }

  .tx-deck-presenter-window__live {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @media (forced-colors: active) {
    .tx-deck-presenter-window__header {
      border-color: CanvasText;
    }
  }
</style>
