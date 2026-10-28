<script lang="ts">
/**
 * What the next press shows: the next step of this slide while it has one,
 * else the next slide's title (or the end of the deck), with an optional
 * live preview after the labelled region.
 */
import type { Snippet } from 'svelte';
import type { DeckTranslate } from '../messages.ts';

interface Props {
  t: DeckTranslate;
  step: number;
  stepCount: number;
  /** The next slide's title; `undefined` at the end of the deck. */
  following?: string;
  preview?: Snippet;
}

let { t, step, stepCount, following, preview }: Props = $props();
</script>

<div class="tx-deck-presenter__upcoming">
  <section class="tx-deck-stage__next" aria-label={t('presenter.upNext')}>
    <h2 class="tx-deck-stage__pane-title">{t('presenter.upNext')}</h2>
    <p class="tx-deck-stage__next-title">
      {#if step < stepCount}
        {t('stage.nextStep', { current: step + 1, total: stepCount })}
      {:else}
        {following ?? t('presenter.endOfDeck')}
      {/if}
    </p>
  </section>
  {#if preview}{@render preview()}{/if}
</div>

<style>
  .tx-deck-presenter__upcoming {
    display: grid;
    gap: 0.5rem;
    align-content: start;
  }
</style>
