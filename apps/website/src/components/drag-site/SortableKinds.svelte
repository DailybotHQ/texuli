<script lang="ts">
import { Sortable, type SortableContainer } from '@texuli/primitives/sortable';
import { LABELS, labelOf } from './data.ts';

/** Lists in every axis: vertical, horizontal (mirrored in right to left) and a swap grid. */

let vertical = $state<SortableContainer[]>([
  { id: 'outline', items: ['intro', 'setup', 'usage', 'faq'] },
]);
let horizontal = $state<SortableContainer[]>([
  { id: 'chips', items: ['stable', 'beta', 'nightly', 'canary'], orientation: 'horizontal' },
]);
let grid = $state<SortableContainer[]>([
  {
    id: 'tiles',
    items: ['revenue', 'signups', 'churn', 'latency', 'uptime', 'tickets'],
    orientation: 'grid',
  },
]);
let swap = $state(false);
</script>

<div class="kinds">
  <article class="kind">
    <h3>Vertical</h3>
    <Sortable.Root bind:containers={vertical}>
      <Sortable.List id="outline" label={LABELS.outline} class="kind__list">
        {#snippet children({ items })}
          {#each items as id (id)}
            <Sortable.Item {id} label={labelOf(id)} class="kind__item">
              <Sortable.Handle class="kind__grip"><span aria-hidden="true">⠿</span></Sortable.Handle>
              <span>{labelOf(id)}</span>
            </Sortable.Item>
          {/each}
        {/snippet}
      </Sortable.List>
    </Sortable.Root>
  </article>

  <article class="kind">
    <h3>Horizontal</h3>
    <p class="kind__note">Left and Right move; in right-to-left text they swap.</p>
    <Sortable.Root bind:containers={horizontal}>
      <Sortable.List id="chips" label={LABELS.chips} class="kind__list kind__list--row">
        {#snippet children({ items })}
          {#each items as id (id)}
            <Sortable.Item {id} label={labelOf(id)} class="kind__item kind__item--pill">
              <Sortable.Handle class="kind__grip kind__grip--label">{labelOf(id)}</Sortable.Handle>
            </Sortable.Item>
          {/each}
        {/snippet}
      </Sortable.List>
    </Sortable.Root>
  </article>

  <article class="kind">
    <h3>Grid</h3>
    <label class="kind__toggle"><input type="checkbox" bind:checked={swap} /> Swap instead of insert</label>
    <Sortable.Root bind:containers={grid} mode={swap ? 'swap' : 'insert'}>
      <Sortable.List id="tiles" label={LABELS.tiles} as="div" class="kind__list kind__list--grid">
        {#snippet children({ items })}
          {#each items as id (id)}
            <Sortable.Item {id} label={labelOf(id)} as="div" class="kind__tile">
              <Sortable.Handle class="kind__grip kind__grip--label">{labelOf(id)}</Sortable.Handle>
            </Sortable.Item>
          {/each}
        {/snippet}
      </Sortable.List>
    </Sortable.Root>
  </article>
</div>

<style>
  .kinds {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
    gap: 1rem;
  }
  .kind {
    display: grid;
    align-content: start;
    gap: 0.5rem;
    min-inline-size: 0;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  .kind__note,
  .kind__toggle {
    margin: 0;
    font-size: 0.875rem;
    color: var(--tx-muted-foreground, CanvasText);
  }
  .kind__toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-block-size: 2.25rem;
  }
  .kinds :global(.kind__list) {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0.4rem;
    list-style: none;
    border-radius: 0.75rem;
    background: var(--tx-muted, Canvas);
  }
  .kinds :global(.kind__list--row) {
    display: flex;
    flex-wrap: wrap;
  }
  .kinds :global(.kind__list--grid) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .kinds :global(.kind__item),
  .kinds :global(.kind__tile) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-block-size: 2.5rem;
    padding: 0.25rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.6rem;
    background: var(--tx-surface, Canvas);
  }
  .kinds :global(.kind__item--pill) {
    border-radius: 999px;
  }
  .kinds :global(.kind__tile) {
    justify-content: center;
    min-block-size: 4rem;
  }
  .kinds :global(.kind__grip) {
    display: inline-grid;
    place-items: center;
    min-inline-size: 2rem;
    min-block-size: 2rem;
    border: 0;
    border-radius: 0.45rem;
    background: transparent;
    color: inherit;
    font: inherit;
  }
  .kinds :global(.kind__grip--label) {
    padding-inline: 0.6rem;
  }
</style>
