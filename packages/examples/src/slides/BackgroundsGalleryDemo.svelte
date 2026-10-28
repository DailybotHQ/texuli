<script lang="ts">
/**
 * The backgrounds gallery: the 13 presets and one spec of each kind (hex
 * solid, angled gradient, light and dark images), each a one-slide deck (a free
 * slide on the section master) on a bare stage, so every tile shows the
 * resolved base, pattern or image and the contrast scrim under the slide's
 * own text color.
 */

import LayoutDeckDemo from './LayoutDeckDemo.svelte';
import { BACKGROUND_EXAMPLES, backgroundExampleDeck, backgroundLabel } from './layout-samples.ts';

let ready = $state(0);
</script>

{#if ready < BACKGROUND_EXAMPLES.length}
  <p role="status">Loading example…</p>
{/if}
<ul class="gallery" aria-label="Deck backgrounds">
  {#each BACKGROUND_EXAMPLES as background, index (index)}
    <li class="tile">
      <LayoutDeckDemo
        deck={backgroundExampleDeck(index)}
        label={`Background ${backgroundLabel(background)}`}
        bare
        paintedSelector={'[data-tx-deck-active="true"] .tx-deck-stage__regions'}
        onReady={() => (ready += 1)}
      />
    </li>
  {/each}
</ul>

<style>
  .gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
    gap: 1rem;
    max-inline-size: 72rem;
    margin: 0;
    padding: 1rem;
    list-style: none;
  }

  .tile {
    min-inline-size: 0;
  }
</style>
