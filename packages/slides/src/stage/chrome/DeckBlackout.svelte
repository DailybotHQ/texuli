<script lang="ts" module>
/** How long the blackout says how to come back before the screen goes fully black. */
export const BLACKOUT_HINT_MS = 2000;
</script>

<script lang="ts">
/**
 * Blackout (B or .): a black screen over the whole stage, chrome included.
 * The screen is one real button, so a click or tap brings the deck back as
 * reliably as B or Escape (both reach the engine from the focused button).
 * For two seconds it says so in visible text, then turns fully black.
 */
import { onMount } from 'svelte';

let { label, onclose }: { label: string; onclose: () => void } = $props();
let screen: HTMLButtonElement | undefined = $state();
let hint = $state(true);

onMount(() => {
  screen?.focus({ preventScroll: true });
  const timer = setTimeout(() => (hint = false), BLACKOUT_HINT_MS);
  return () => clearTimeout(timer);
});
</script>

<button
  bind:this={screen}
  type="button"
  class="tx-deck-stage__blackout"
  aria-label={label}
  data-tx-deck-chrome
  data-tx-deck-blackout
  data-hint={hint ? 'visible' : 'hidden'}
  onclick={(event) => {
    event.stopPropagation();
    onclose();
  }}
>
  <span class="tx-deck-stage__blackout-hint" aria-hidden="true">{label}</span>
</button>

<style>
  .tx-deck-stage__blackout {
    z-index: 20;
    place-items: center;
    outline: none;
    cursor: default;
  }

  .tx-deck-stage__blackout-hint {
    max-inline-size: 32rem;
    padding-block: 0.5rem;
    padding-inline: 1rem;
    color: #d4d4d4;
    text-align: center;
  }

  .tx-deck-stage__blackout[data-hint="hidden"] .tx-deck-stage__blackout-hint {
    opacity: 0;
  }

  @media (prefers-reduced-motion: no-preference) {
    .tx-deck-stage__blackout-hint {
      transition: opacity 200ms ease-out;
    }
  }

  :global(.tx-deck-stage[data-motion="reduce"]) .tx-deck-stage__blackout-hint {
    transition: none;
  }

  @media (forced-colors: active) {
    /* Black stays black for the room; the hint keeps a system-white text. */
    .tx-deck-stage__blackout {
      background: #000;
      forced-color-adjust: none;
    }

    .tx-deck-stage__blackout-hint {
      color: #fff;
    }
  }
</style>
