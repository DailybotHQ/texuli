<script lang="ts">
/**
 * "More": a disclosure (`<details>`) holding the secondary tools when the
 * full toolbar does not fit. Loaded on its own chunk. Escape closes it and
 * returns focus to "More" (the deck never sees that key); choosing a tool
 * closes it, so the next Escape reaches what the tool opened. A resize
 * closes it.
 */
import type { Snippet } from 'svelte';

let { label, text, children }: { label: string; text: string; children: Snippet } = $props();
let details: HTMLDetailsElement | undefined = $state();

function onkeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !details?.open) return;
  event.preventDefault();
  event.stopPropagation();
  details.open = false;
  details.querySelector('summary')?.focus();
}

function onclick(event: MouseEvent) {
  const item = (event.target as Element | null)?.closest('button');
  const menu = details;
  if (!item || !menu?.contains(item)) return;
  queueMicrotask(() => {
    const keep = menu.contains(document.activeElement);
    menu.open = false;
    if (keep) menu.querySelector('summary')?.focus();
  });
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<details bind:this={details} class="tx-deck-chrome-more" {onkeydown} {onclick}>
  <summary class="tx-deck-stage__control tx-deck-chrome-more__summary" aria-label={label}>
    <svg
      class="tx-deck-chrome-more__icon"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    >
      <path d="M5 12h.01"></path><path d="M12 12h.01"></path><path d="M19 12h.01"></path>
    </svg>
    <span>{text}</span>
  </summary>
  <div class="tx-deck-chrome-more__panel">
    {@render children()}
  </div>
</details>

<svelte:window onresize={() => details && (details.open = false)} />

<style>
  .tx-deck-chrome-more {
    position: relative;
    flex: none;
    margin-inline-start: auto;
  }

  .tx-deck-chrome-more__summary {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    box-sizing: border-box;
    min-block-size: 2rem;
    padding-block: 0.25rem;
    padding-inline: 0.625rem;
    font-size: var(--tx-font-size-sm, 0.875rem);
    list-style: none;
  }

  .tx-deck-chrome-more__summary::-webkit-details-marker {
    display: none;
  }

  .tx-deck-chrome-more__icon {
    inline-size: 1.125rem;
    block-size: 1.125rem;
  }

  .tx-deck-chrome-more__panel {
    position: absolute;
    z-index: 30;
    inset-block-start: calc(100% + 0.25rem);
    inset-inline-end: 0;
    display: grid;
    gap: 0.5rem;
    box-sizing: border-box;
    min-inline-size: 13rem;
    max-inline-size: calc(100vw - 1rem);
    max-block-size: min(70vh, 28rem);
    padding: 0.375rem;
    overflow-y: auto;
    color: var(--tx-foreground);
    background: var(--tx-elevated, var(--tx-surface, var(--tx-background)));
    border: 1px solid var(--tx-border-strong, var(--tx-border));
    border-radius: var(--tx-radius, 0.5rem);
    box-shadow: var(--tx-shadow-float, 0 4px 16px rgb(0 0 0 / 0.16));
  }

  /* Below the slide: "More" stays beside the navigation and opens upward. */
  :global(.tx-deck-stage[data-tx-deck-toolbar="bottom"]) .tx-deck-chrome-more {
    margin-inline-start: 0;
  }

  :global(.tx-deck-stage[data-tx-deck-toolbar="bottom"]) .tx-deck-chrome-more__panel {
    inset-block: auto calc(100% + 0.25rem);
  }

  @media (pointer: coarse) {
    .tx-deck-chrome-more__summary {
      min-block-size: 2.75rem;
    }
  }

  @media (forced-colors: active) {
    .tx-deck-chrome-more__panel {
      border-color: CanvasText;
    }
  }
</style>
