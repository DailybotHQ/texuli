<script lang="ts" module>
/** The overlay fades after this long without a pointer move or touch. */
export const FULLSCREEN_OVERLAY_IDLE_MS = 2500;
</script>

<script lang="ts">
/**
 * The way out of full screen: leave, previous, the slide counter and next.
 * It shows on entering full screen and on every pointer move or touch over
 * the stage, stays while the pointer or keyboard focus is on it, and fades
 * after 2.5 s. While hidden it is `inert`, so it never takes a click or a
 * Tab stop meant for the slide. Blackout and the laser hide it. Loaded on
 * its own chunk.
 */
import type { DeckAction } from '@texuli/deck/engine';
import type { DeckTranslate } from '../messages.ts';
import ChromeIcon from './ChromeIcon.svelte';

interface Props {
  root: HTMLElement;
  t: DeckTranslate;
  counter: string;
  suppressed?: boolean;
  onaction: (action: Extract<DeckAction, 'fullscreen-exit' | 'prev' | 'next'>) => void;
}

let { root, t, counter, suppressed = false, onaction }: Props = $props();

let shown = $state(true);
let held = $state(false);
let node: HTMLElement | undefined = $state();
let timer: ReturnType<typeof setTimeout> | undefined;

function wake() {
  shown = true;
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (!held) shown = false;
  }, FULLSCREEN_OVERLAY_IDLE_MS);
}

$effect(() => {
  const target = root;
  wake();
  target.addEventListener('pointermove', wake);
  target.addEventListener('pointerdown', wake);
  return () => {
    target.removeEventListener('pointermove', wake);
    target.removeEventListener('pointerdown', wake);
    clearTimeout(timer);
  };
});

let visible = $derived(shown && !suppressed);

function release() {
  held = Boolean(node?.matches(':hover') || node?.contains(document.activeElement));
  if (!held) wake();
}
</script>

<div
  bind:this={node}
  class="tx-deck-chrome-overlay"
  role="group"
  aria-label={t('chrome.fullscreenControls')}
  inert={!visible}
  data-tx-deck-chrome
  data-visible={visible ? 'true' : 'false'}
  onpointerenter={() => (held = true)}
  onpointerleave={release}
  onfocusin={() => (held = true)}
  onfocusout={() => queueMicrotask(release)}
>
  <button
    type="button"
    class="tx-deck-stage__control tx-deck-chrome-overlay__button"
    aria-keyshortcuts="Escape F"
    onclick={() => onaction('fullscreen-exit')}
  >
    <ChromeIcon name="fullscreen-on" />
    <span>{t('controls.leaveFullscreen')}</span>
  </button>
  <button
    type="button"
    class="tx-deck-stage__control tx-deck-chrome-overlay__button"
    aria-label={t('controls.previous')}
    onclick={() => onaction('prev')}
  >
    <ChromeIcon name="prev" />
  </button>
  <span class="tx-deck-chrome-overlay__counter">{counter}</span>
  <button
    type="button"
    class="tx-deck-stage__control tx-deck-chrome-overlay__button"
    aria-label={t('controls.next')}
    onclick={() => onaction('next')}
  >
    <ChromeIcon name="next" />
  </button>
</div>

<style>
  .tx-deck-chrome-overlay {
    position: absolute;
    z-index: 10;
    inset-block-end: 1rem;
    inset-inline-start: 50%;
    translate: -50% 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    max-inline-size: calc(100% - 2rem);
    padding: 0.25rem;
    color: var(--tx-foreground);
    background: var(--tx-elevated, var(--tx-surface, var(--tx-background)));
    border: 1px solid var(--tx-border-strong, var(--tx-border));
    border-radius: var(--tx-shape-radius-lg);
    box-shadow: var(--tx-elevation-3);
  }

  :global([dir="rtl"]) .tx-deck-chrome-overlay {
    translate: 50% 0;
  }

  .tx-deck-chrome-overlay[data-visible="false"] {
    opacity: 0;
    pointer-events: none;
  }

  .tx-deck-chrome-overlay__button {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-inline-size: 2.75rem;
    padding-block: 0.25rem;
    padding-inline: 0.625rem;
  }

  .tx-deck-chrome-overlay__counter {
    min-inline-size: 3.5rem;
    padding-inline: 0.5rem;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  @media (prefers-reduced-motion: no-preference) {
    .tx-deck-chrome-overlay {
      transition: opacity 200ms ease-out;
    }
  }

  :global(.tx-deck-stage[data-motion="reduce"]) .tx-deck-chrome-overlay {
    transition: none;
  }

  @media (forced-colors: active) {
    .tx-deck-chrome-overlay {
      border-color: CanvasText;
    }
  }
</style>
