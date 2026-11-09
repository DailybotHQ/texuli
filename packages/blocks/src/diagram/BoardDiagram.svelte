<script lang="ts">
import {
  countLabel,
  DEFAULT_DIAGRAM_BLOCK_LABELS,
  type DiagramBlockLabels,
  fillDiagramLabel,
} from './labels.ts';
import type { BoardDiagram as BoardDiagramData } from './schema.ts';
import { toneBorder } from './tones.ts';
import './diagram.css';

/** Board: columns of cards as labelled lists (structure is the text alternative). */
let {
  block,
  labels = DEFAULT_DIAGRAM_BLOCK_LABELS,
}: { block: BoardDiagramData; labels?: DiagramBlockLabels } = $props();

const cards = $derived(block.columns.reduce((sum, column) => sum + column.cards.length, 0));
const cardCount = (count: number) =>
  countLabel(labels.boardCardsOne, labels.boardCardsOther, count);
const summary = $derived(
  fillDiagramLabel(labels.boardSummary, {
    columns: countLabel(labels.boardColumnsOne, labels.boardColumnsOther, block.columns.length),
    cards: cardCount(cards),
  })
);
</script>

<figure class="tx-diagram" data-tx-diagram="board" data-tx-component="blocks-diagram">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -- wide board scrolls; keyboard users must reach it. -->
  <div class="tx-diagram__scroll" role="region" aria-label={summary} tabindex="0">
    <div class="tx-diagram-board">
      {#each block.columns as column (column.id)}
        <section
          class="tx-diagram-column"
          aria-label={fillDiagramLabel(labels.boardColumn, {
            title: column.title,
            cards: cardCount(column.cards.length),
          })}
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
            <p class="tx-diagram-empty">{labels.boardEmpty}</p>
          {/if}
        </section>
      {/each}
    </div>
  </div>
</figure>
