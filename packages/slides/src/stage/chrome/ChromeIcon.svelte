<script lang="ts">
/** One decorative chrome icon (`aria-hidden`): the button's text names it. */
import { DECK_CHROME_FLIPPED_ICONS, DECK_CHROME_ICONS } from './icons.ts';

let { name }: { name: string } = $props();
let paths = $derived(DECK_CHROME_ICONS[name as keyof typeof DECK_CHROME_ICONS] ?? []);
</script>

<svg
  class="tx-deck-chrome-icon"
  aria-hidden="true"
  focusable="false"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  data-flip={DECK_CHROME_FLIPPED_ICONS.has(name) ? 'true' : undefined}
>
  {#each paths as path (path)}<path d={path}></path>{/each}
</svg>

<style>
  .tx-deck-chrome-icon {
    flex: none;
    inline-size: 1.125rem;
    block-size: 1.125rem;
  }

  :global([dir="rtl"]) .tx-deck-chrome-icon[data-flip] {
    scale: -1 1;
  }
</style>
