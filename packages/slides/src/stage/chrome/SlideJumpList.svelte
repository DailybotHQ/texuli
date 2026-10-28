<script lang="ts">
/**
 * The slide counter's list: every visible slide by number and title, as a
 * listbox of options. Loaded on its own chunk the first time it opens. Focus
 * starts on the current slide; arrows, Home and End move it, Enter or Space
 * picks, Escape closes and returns to the counter, Tab or a pointer outside
 * closes. The keys it reads never reach the deck.
 */
import { onMount } from 'svelte';
import type { DeckStageSlideEntry } from '../context.ts';

interface Props {
  id: string;
  label: string;
  slides: readonly DeckStageSlideEntry[];
  /** 0-based position of the current slide among `slides`. */
  current: number;
  onselect: (slideId: string) => void;
  onclose: (focusCounter: boolean) => void;
}

let { id, label, slides, current, onselect, onclose }: Props = $props();
let list: HTMLElement | undefined = $state();

function options(): HTMLElement[] {
  return [...(list?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
}

function onkeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    onclose(false);
    return;
  }
  event.stopPropagation();
  const all = options();
  const at = all.indexOf(document.activeElement as HTMLElement);
  const target =
    event.key === 'ArrowDown'
      ? Math.min(at + 1, all.length - 1)
      : event.key === 'ArrowUp'
        ? Math.max(at - 1, 0)
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? all.length - 1
            : null;
  if (event.key === 'Escape') {
    event.preventDefault();
    onclose(true);
  } else if (target !== null) {
    event.preventDefault();
    all[target]?.focus();
  }
}

onMount(() => {
  options()[current]?.focus({ preventScroll: false });
  const outside = (event: PointerEvent) => {
    const target = event.target as Node | null;
    if (!target || list?.contains(target)) return;
    // The counter toggles the list itself.
    if ((target as Element).closest?.('[data-tx-deck-tool="jump"]')) return;
    onclose(false);
  };
  document.addEventListener('pointerdown', outside, true);
  return () => document.removeEventListener('pointerdown', outside, true);
});
</script>

<div
  bind:this={list}
  {id}
  class="tx-deck-chrome-list"
  role="listbox"
  aria-label={label}
  tabindex="-1"
  data-tx-deck-chrome
  {onkeydown}
>
  {#each slides as entry (entry.slide.id)}
    <button
      type="button"
      class="tx-deck-chrome-list__option"
      role="option"
      aria-selected={entry.position === current}
      tabindex={entry.position === current ? 0 : -1}
      onclick={() => onselect(entry.slide.id)}
    >
      <span class="tx-deck-chrome-list__number">{entry.position + 1}.</span>
      <span class="tx-deck-chrome-list__title">{entry.title}</span>
    </button>
  {/each}
</div>

<style>
  .tx-deck-chrome-list {
    position: absolute;
    z-index: 30;
    inset-block-start: calc(100% + 0.25rem);
    inset-inline-start: 0;
    display: grid;
    box-sizing: border-box;
    inline-size: min(18rem, calc(100vw - 1rem));
    max-block-size: min(60vh, 24rem);
    padding: 0.25rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    color: var(--tx-foreground);
    background: var(--tx-elevated, var(--tx-surface, var(--tx-background)));
    border: 1px solid var(--tx-border-strong, var(--tx-border));
    border-radius: var(--tx-radius, 0.5rem);
    box-shadow: var(--tx-shadow-float, 0 4px 16px rgb(0 0 0 / 0.16));
  }

  /* Below the slide: open upward, anchored at the navigation's inline end. */
  :global(.tx-deck-stage[data-tx-deck-toolbar="bottom"]) .tx-deck-chrome-list {
    inset-block: auto calc(100% + 0.25rem);
    inset-inline: auto 0;
  }

  .tx-deck-chrome-list__option {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    box-sizing: border-box;
    inline-size: 100%;
    min-block-size: 2rem;
    padding-block: 0.375rem;
    padding-inline: 0.625rem;
    color: inherit;
    background: transparent;
    border: 0;
    border-radius: calc(var(--tx-radius, 0.5rem) - 0.125rem);
    font: inherit;
    font-size: var(--tx-font-size-sm, 0.875rem);
    text-align: start;
    cursor: pointer;
  }

  .tx-deck-chrome-list__option:hover,
  .tx-deck-chrome-list__option[aria-selected="true"] {
    background: var(--tx-muted, var(--tx-surface));
  }

  .tx-deck-chrome-list__option[aria-selected="true"] {
    font-weight: 600;
  }

  .tx-deck-chrome-list__option:focus-visible {
    outline: 2px solid var(--tx-ring);
    outline-offset: -2px;
  }

  .tx-deck-chrome-list__number {
    flex: none;
    color: var(--tx-muted-foreground, inherit);
    font-variant-numeric: tabular-nums;
  }

  .tx-deck-chrome-list__title {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }

  @media (pointer: coarse) {
    .tx-deck-chrome-list__option {
      min-block-size: 2.75rem;
    }
  }

  @media (forced-colors: active) {
    .tx-deck-chrome-list {
      border-color: CanvasText;
    }

    .tx-deck-chrome-list__option[aria-selected="true"] {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
  }
</style>
