<script lang="ts">
/**
 * `three-column-cards`: three parallel cards. A card's `icon` names an icon
 * the host registered in the Texuli icon registry (`registerIcons` or
 * `IconsProvider` from `texuli/icons`); the tile draws that glyph, and shows
 * the card's number when the name is missing or not registered (UG-38).
 */
import { fitContent, fitText } from './fit.ts';
import { useDeckIcons } from './icon.ts';
import LayoutFrame from './LayoutFrame.svelte';
import { type LayoutRendererProps, useLayoutSteps } from './steps.ts';

let { slide, context }: LayoutRendererProps<'three-column-cards'> = $props();
const steps = useLayoutSteps(() => context);
const icons = useDeckIcons();
let p = $derived(slide.props);
</script>

<LayoutFrame layout="three-column-cards" root={steps.at([])}>
  {#if p.title}
    <h2 class="tx-deck-layout__title" data-slot="title" data-clamp="2" {@attach fitText(40)}>
      {p.title}
    </h2>
  {/if}
  <ul class="cards" data-slot="cards" {@attach fitContent()}>
    {#each p.cards as card, index (index)}
      {@const glyph = icons(card.icon)}
      <li
        class="tx-deck-layout__panel card"
        data-slot="card"
        data-icon={card.icon}
        {...steps.at(['cards', index])}
      >
        <span class="tile" aria-hidden="true">
          {#if typeof glyph === 'function'}
            {@const Glyph = glyph}
            <Glyph class="glyph" aria-hidden="true" />
          {:else if glyph}
            <svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d={glyph} /></svg>
          {:else}{index + 1}{/if}
        </span>
        <h3 class="tx-deck-layout__lead heading">{card.heading}</h3>
        <p class="tx-deck-layout__text">{card.body}</p>
      </li>
    {/each}
  </ul>
</LayoutFrame>

<style>
  .cards {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-content: center;
    gap: clamp(16px, 2.4cqi, 32px);
    min-block-size: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: clamp(10px, 1.4cqi, 20px);
  }

  .tile {
    display: grid;
    place-items: center;
    inline-size: clamp(56px, 5.6cqi, 80px);
    block-size: clamp(56px, 5.6cqi, 80px);
    border: 2px solid var(--tx-deck-accent);
    border-radius: calc(var(--tx-deck-layout-radius) * 1.4);
    font-family: var(--tx-font-heading, inherit);
    font-size: clamp(24px, 2.4cqi, 32px);
    font-weight: 700;
  }

  .tile :global(.glyph) {
    inline-size: 55%;
    block-size: 55%;
    color: var(--tx-deck-accent);
  }

  .heading {
    font-weight: 600;
    font-family: var(--tx-font-heading, inherit);
  }

  @container (max-inline-size: 48rem) {
    .cards {
      grid-template-columns: minmax(0, 1fr);
    }

    .card {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: start;
      column-gap: 20px;
    }

    .card > :not(.tile) {
      grid-column: 2;
    }

    .tile {
      grid-row: span 2;
    }
  }
</style>
