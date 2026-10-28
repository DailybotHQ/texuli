<script lang="ts">
/**
 * PHASE-1 PLACEHOLDER (PLAN_008 T-stage): the in-page presenter pane (speaker
 * notes as plain text, step progress, the next slide's title and an optional
 * elapsed timer). Phase 2 replaces it with the split view (rendered next
 * slide, per-slide timers) and the popup over the presenter protocol.
 */

import { getDeckStageContext } from '../context.ts';
import { createPresenterTimer, formatElapsed } from '../presenter.ts';

interface Props {
  /** Show the elapsed timer (off by default, so the view is deterministic). */
  timer?: boolean;
  notesElement?: HTMLElement;
}

let { timer = false, notesElement = $bindable() }: Props = $props();
const stage = getDeckStageContext();
const clock = createPresenterTimer();
let elapsed = $state(0);
let running = $state(false);

let next = $derived(stage ? stage.slides[stage.position + 1] : undefined);
let hasMoreSteps = $derived(stage ? stage.state.step < stage.state.stepCount : false);

$effect(() => {
  if (!timer) return;
  clock.start();
  running = true;
  elapsed = clock.elapsed();
  const interval = setInterval(() => {
    elapsed = clock.elapsed();
  }, 1000);
  return () => {
    clearInterval(interval);
    clock.pause();
    running = false;
  };
});

function toggle() {
  if (clock.running) clock.pause();
  else clock.start();
  running = clock.running;
  elapsed = clock.elapsed();
}
</script>

{#if stage}
  {@const t = stage.t}
  <div class="tx-deck-stage__presenter-side" data-tx-deck-chrome>
    {#if timer}
      <div class="tx-deck-stage__timer">
        <span role="timer" aria-label={t('stage.elapsedTime')} class="tx-deck-stage__timer-value">
          {formatElapsed(elapsed)}
        </span>
        <button type="button" class="tx-deck-stage__control" onclick={toggle}>
          {running ? t('presenter.pause') : t('presenter.resume')}
        </button>
      </div>
    {/if}
    <aside
      bind:this={notesElement}
      class="tx-deck-stage__notes"
      aria-label={t('presenter.notes')}
      tabindex="-1"
    >
      <h2 class="tx-deck-stage__pane-title">{t('presenter.notes')}</h2>
      {#if stage.state.stepCount > 0}
        <p class="tx-deck-stage__step-progress">
          {t('stage.stepOf', { current: stage.state.step, total: stage.state.stepCount })}
        </p>
      {/if}
      {#if stage.slide.notes}
        <p class="tx-deck-stage__notes-text">{stage.slide.notes}</p>
      {:else}
        <p class="tx-deck-stage__empty">{t('presenter.noNotes')}</p>
      {/if}
    </aside>
    <section class="tx-deck-stage__next" aria-label={t('presenter.upNext')}>
      <h2 class="tx-deck-stage__pane-title">{t('presenter.upNext')}</h2>
      <p class="tx-deck-stage__next-title">
        {#if hasMoreSteps}
          {t('stage.nextStep', { current: stage.state.step + 1, total: stage.state.stepCount })}
        {:else}
          {next ? next.title : t('presenter.endOfDeck')}
        {/if}
      </p>
    </section>
  </div>
{/if}
