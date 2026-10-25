<script lang="ts">
import type { BoardDiagram } from './schema.ts';
import { toneBorder } from './tones.ts';
import './diagram.css';

/** Board: columns of cards as labelled lists (structure is the text alternative). */
let { block }: { block: BoardDiagram } = $props();

const cards = $derived(block.columns.reduce((sum, column) => sum + column.cards.length, 0));
const summary = $derived(
  `Board with ${block.columns.length} ${block.columns.length === 1 ? 'column' : 'columns'} and ${cards} ${
    cards === 1 ? 'card' : 'cards'
  }`
);
</script>

<figure class="tx-diagram" data-tx-diagram="board">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -- wide board scrolls; keyboard users must reach it. -->
  <div class="tx-diagram__scroll" role="region" aria-label={summary} tabindex="0">
    <div class="tx-diagram-board">
      {#each block.columns as column (column.id)}
        <section
          class="tx-diagram-column"
          aria-label="{column.title}, {column.cards.length} {column.cards.length === 1
            ? 'card'
            : 'cards'}"
          data-column={column.id}
        >
          <p class="tx-diagram-column__title" aria-hidden="true">
            <span>{column.title}</span>
            <span class="tx-diagram-column__count">{column.cards.length}</span>
          </p>
          {#if column.cards.length > 0}
            <ul class="tx-diagram-cards">
              {#each column.cards as card (card.id)}
                <li class={`tx-diagram-card ${toneBorder(card.tone)}`} data-card={card.id}>
                  {card.title}
                </li>
              {/each}
            </ul>
          {:else}
            <p class="tx-diagram-empty">No cards</p>
          {/if}
        </section>
      {/each}
    </div>
  </div>
</figure>
