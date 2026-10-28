<script lang="ts">
/** Previous and next for the presenter, disabled at the ends, plus extra controls. */
import type { Snippet } from 'svelte';
import type { DeckTranslate } from '../messages.ts';

interface Props {
  t: DeckTranslate;
  atStart: boolean;
  atEnd: boolean;
  onPrev: () => void;
  onNext: () => void;
  children?: Snippet;
}

let { t, atStart, atEnd, onPrev, onNext, children }: Props = $props();
</script>

<div class="tx-deck-presenter__nav">
  <button
    type="button"
    class="tx-deck-stage__control"
    data-tx-deck-presenter-prev
    disabled={atStart}
    onclick={onPrev}
  >
    {t('presenter.previous')}
  </button>
  <button
    type="button"
    class="tx-deck-stage__control"
    data-tx-deck-presenter-next
    disabled={atEnd}
    onclick={onNext}
  >
    {t('presenter.advance')}
  </button>
  {#if children}{@render children()}{/if}
</div>

<style>
  .tx-deck-presenter__nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .tx-deck-presenter__nav :global(button:disabled) {
    cursor: not-allowed;
    opacity: 0.55;
  }

  @media (forced-colors: active) {
    .tx-deck-presenter__nav :global(button:disabled) {
      color: GrayText;
      opacity: 1;
    }
  }
</style>
