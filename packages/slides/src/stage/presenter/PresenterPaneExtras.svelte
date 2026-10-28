<script lang="ts">
/**
 * The lazy half of the split view, in two parts around the notes and "Up
 * next": `top` is the fallback notice and the status line with timers;
 * `bottom` is the live preview of what comes next, previous and next, and
 * the presenter window button. Both parts share the stage's session and
 * timers (one each per stage).
 */
import type { DeckStageContext } from '../context.ts';
import type { DeckStageMessageKey } from '../messages.ts';
import DeckSlidePreview from './DeckSlidePreview.svelte';
import type { DeckPresenterHost } from './host.ts';
import PresenterNav from './PresenterNav.svelte';
import PresenterStatus from './PresenterStatus.svelte';
import type { DeckPreviewPaint, PresenterPosition } from './paint.ts';
import { presenterSessionFor } from './session.svelte.ts';
import { deckPresenterTimers } from './timers.ts';

type Entry = DeckStageContext['slides'][number];

interface Props {
  part: 'top' | 'bottom';
  stage: DeckStageContext;
  at: PresenterPosition<Entry>;
  timer?: boolean;
  paint?: DeckPreviewPaint;
  host?: DeckPresenterHost;
  /** The stage root, mirrored onto the presenter window. */
  stageRoot?: () => HTMLElement | null;
}

let { part, stage, at, timer = false, paint, host, stageRoot }: Props = $props();

const REASONS: Record<string, DeckStageMessageKey> = {
  'popup-blocked': 'stage.presenterBlocked',
  'no-broadcast': 'stage.presenterNoChannel',
  'no-window': 'stage.presenterNoWindow',
  'load-error': 'stage.presenterLoadError',
};

let t = $derived(stage.t);
let timers = $derived(timer ? deckPresenterTimers(stage.controller) : null);
let session = $derived(host && paint ? presenterSessionFor(stage.controller, host) : null);
let upcoming = $derived(at.hasMoreSteps ? at.current : at.following);

$effect(() => {
  timers?.start();
});

async function openWindow() {
  if (!session || !paint) return;
  const opened = await session.open({
    stage,
    paint,
    timers: deckPresenterTimers(stage.controller),
    stageRoot: stageRoot?.() ?? null,
  });
  if (opened) stage.setPresenter(false);
}
</script>

{#if part === 'top'}
  {#if session?.reason}
    <p class="tx-deck-presenter__notice" role="status" data-tx-deck-presenter-reason={session.reason}>
      {t(REASONS[session.reason] ?? 'stage.presenterNoWindow')}
    </p>
  {/if}
  {#if timers}
    <PresenterStatus
      {t}
      locale={stage.locale}
      position={at.position}
      total={stage.slides.length}
      slideId={at.current?.slide.id}
      {timers}
    />
  {/if}
{:else}
  {#if paint && upcoming}
    <DeckSlidePreview
      {paint}
      slide={upcoming.slide}
      index={upcoming.index}
      title={upcoming.title}
      step={at.hasMoreSteps ? stage.state.step + 1 : 0}
      label={t('stage.slidePreview', { title: upcoming.title })}
    />
  {/if}
  <PresenterNav
    {t}
    atStart={at.atStart}
    atEnd={at.atEnd}
    onPrev={() => stage.prev()}
    onNext={() => stage.next()}
  >
    {#if session?.status === 'open'}
      <button
        type="button"
        class="tx-deck-stage__control"
        data-tx-deck-presenter-window-close
        onclick={() => session?.close()}
      >
        {t('stage.closePresenterWindow')}
      </button>
    {:else if session}
      <button
        type="button"
        class="tx-deck-stage__control"
        data-tx-deck-presenter-window-open
        disabled={session.status === 'opening'}
        onclick={openWindow}
      >
        {t('stage.openPresenterWindow')}
      </button>
    {/if}
  </PresenterNav>
{/if}

<style>
  .tx-deck-presenter__notice {
    margin: 0;
    padding-block: 0.5rem;
    padding-inline: 0.75rem;
    color: var(--tx-foreground);
    background: var(--tx-muted, var(--tx-background));
    border-inline-start: 3px solid var(--tx-warning, var(--tx-ring));
    border-radius: var(--tx-radius, 0.625rem);
  }

  @media (forced-colors: active) {
    .tx-deck-presenter__notice {
      border: 1px solid CanvasText;
    }
  }
</style>
