<script lang="ts">
/**
 * The first-visit hint: how to move, go full screen and find every control,
 * with the keys read from the registry. The stage loads it only when
 * `firstRunHintAllowed` and `claimFirstRunHint` agree (once per namespace,
 * never under automation). It stays 6 s or until the first key, pointer or
 * wheel input, never takes focus and never advances the deck. Loaded on its
 * own chunk.
 */
import { deckControlFor } from '@texuli/deck/engine';
import { onMount } from 'svelte';
import type { DeckTranslate } from '../messages.ts';
import { FIRST_RUN_HINT_MS } from './first-run.ts';

let { root, t }: { root: HTMLElement; t: DeckTranslate } = $props();

const firstKey = (action: 'prev' | 'next' | 'fullscreen' | 'help') =>
  deckControlFor(action).keys[0]?.label ?? '';
const move = `${firstKey('prev')} ${firstKey('next')}`;

const SENTENCES = [
  ['chrome.hintMove', move],
  ['chrome.hintFullscreen', firstKey('fullscreen')],
  ['chrome.hintHelp', firstKey('help')],
] as const;
// The `{key}` placeholder stays in the template, so the key can sit in a <kbd>.
let parts = $derived(
  SENTENCES.map(([key, keys]) => {
    const [before = '', after = ''] = t(key).split('{key}');
    return { before, after, keys };
  })
);

let open = $state(true);

function dismiss() {
  open = false;
}

onMount(() => {
  const timer = setTimeout(dismiss, FIRST_RUN_HINT_MS);
  // Capture: the deck's own handlers may stop the event.
  window.addEventListener('keydown', dismiss, true);
  root.addEventListener('pointerdown', dismiss, true);
  root.addEventListener('wheel', dismiss, { capture: true, passive: true });
  return () => {
    clearTimeout(timer);
    window.removeEventListener('keydown', dismiss, true);
    root.removeEventListener('pointerdown', dismiss, true);
    root.removeEventListener('wheel', dismiss, true);
  };
});
</script>

{#if open}
  <div class="tx-deck-chrome-hint" role="note" data-tx-deck-chrome data-tx-deck-hint>
    <p class="tx-deck-chrome-hint__text">
      {#each parts as part, index (index)}
        {part.before}<kbd>{part.keys}</kbd>{part.after}{' '}
      {/each}
    </p>
    <button type="button" class="tx-deck-stage__control tx-deck-chrome-hint__close" onclick={dismiss}>
      {t('stage.hintDismiss')}
    </button>
  </div>
{/if}

<style>
  .tx-deck-chrome-hint {
    position: absolute;
    z-index: 12;
    inset-block-end: 1rem;
    inset-inline: 1rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem 0.75rem;
    box-sizing: border-box;
    max-inline-size: 32rem;
    margin-inline: auto;
    padding-block: 0.5rem;
    padding-inline: 0.875rem;
    color: var(--tx-foreground);
    background: var(--tx-elevated, var(--tx-surface, var(--tx-background)));
    border: 1px solid var(--tx-border-strong, var(--tx-border));
    border-radius: var(--tx-shape-radius-lg);
    box-shadow: var(--tx-elevation-3);
    font-size: var(--tx-type-label-size);
  }

  .tx-deck-chrome-hint__text {
    margin: 0;
  }

  .tx-deck-chrome-hint__text kbd {
    padding-inline: 0.25rem;
    background: var(--tx-muted, var(--tx-surface));
    border: 1px solid var(--tx-border);
    border-radius: 0.25rem;
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: 0.75rem;
  }

  .tx-deck-chrome-hint__close {
    min-block-size: 2rem;
    padding-block: 0.25rem;
    padding-inline: 0.625rem;
  }

  @media (pointer: coarse) {
    .tx-deck-chrome-hint__close {
      min-block-size: 2.75rem;
    }
  }

  @media print {
    .tx-deck-chrome-hint {
      display: none;
    }
  }

  @media (forced-colors: active) {
    .tx-deck-chrome-hint {
      border-color: CanvasText;
    }
  }
</style>
