<script lang="ts">
/**
 * Speaker notes for the shown slide, as plain text (never markup) in a
 * scrollable, focusable `aside`, with the step progress and the step label
 * the author named (`slide.steps`).
 */
import type { DeckSlide } from '@texuli/deck/model';
import type { DeckTranslate } from '../messages.ts';
import { stepLabel } from './paint.ts';

interface Props {
  t: DeckTranslate;
  slide: DeckSlide | undefined;
  step: number;
  stepCount: number;
  element?: HTMLElement;
}

let { t, slide, step, stepCount, element = $bindable() }: Props = $props();
let label = $derived(stepLabel(slide, step));
</script>

<!-- The notes scroll, so keyboard users must be able to focus them (S focuses them too). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<aside
  bind:this={element}
  class="tx-deck-stage__notes tx-deck-presenter__notes"
  aria-label={t('presenter.notes')}
  tabindex="0"
>
  <h2 class="tx-deck-stage__pane-title">{t('presenter.notes')}</h2>
  {#if stepCount > 0}
    <p class="tx-deck-stage__step-progress">
      {t('stage.stepOf', { current: step, total: stepCount })}{#if label}<span>: {label}</span>{/if}
    </p>
  {/if}
  {#if slide?.notes}
    <p class="tx-deck-stage__notes-text">{slide.notes}</p>
  {:else}
    <p class="tx-deck-stage__empty">{t('presenter.noNotes')}</p>
  {/if}
</aside>

<style>
  .tx-deck-presenter__notes {
    min-block-size: 0;
    max-block-size: 40vh;
    overflow: auto;
    overscroll-behavior: contain;
  }
</style>
