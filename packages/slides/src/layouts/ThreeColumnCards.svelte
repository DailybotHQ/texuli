<script lang="ts">
/**
 * `three-column-cards`: three parallel cards. The `icon` prop names a Texuli
 * icon; `@texuli/slides` does not depend on the icon set yet, so every card
 * shows its number in the icon tile (an open issue for the owner checkpoint).
 */
import { fitContent, fitText } from './fit.ts';
import LayoutFrame from './LayoutFrame.svelte';
import { type LayoutRendererProps, useLayoutSteps } from './steps.ts';

let { slide, context }: LayoutRendererProps<'three-column-cards'> = $props();
const steps = useLayoutSteps(() => context);
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
      <li
        class="tx-deck-layout__panel card"
        data-slot="card"
        data-icon={card.icon}
        {...steps.at(['cards', index])}
      >
        <span class="tile" aria-hidden="true">{index + 1}</span>
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
